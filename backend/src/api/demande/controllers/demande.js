'use strict';

/**
 * demande controller
 *
 * Règles de l'étape 1 « Demande » (appliquées côté serveur) :
 *  - le matériel vient du STOCK RÉEL : chaque ligne pointe une fiche
 *    `api::material.material` existante, et la quantité demandée ne peut pas
 *    dépasser le stock disponible (cumul des lignes visant un même matériel) ;
 *  - la DIRECTION et le SERVICE viennent du COMPTE (`department` de
 *    l'utilisateur connecté), JAMAIS de l'écran : la valeur envoyée par le
 *    client est ignorée ;
 *  - la POSSESSION est celle de l'utilisateur connecté ;
 *  - une demande peut porter PLUSIEURS lignes (composant `demande.ligne`) ;
 *  - le Demandeur ne voit que SES demandes (filtre SERVEUR : le post-filtrage
 *    sur la relation `demandeur` ne peut pas fonctionner, le sanitizer la
 *    retirant de la réponse).
 *
 * Pourquoi la création n'appelle PAS `super.create(ctx)` : le Content API de
 * Strapi valide les relations de l'entrée contre les permissions du rôle.
 * Aucun rôle ne peut lire `plugin::users-permissions.user` (ouvrir cette
 * permission exposerait la liste de TOUS les utilisateurs) : la clé
 * `demandeur` était donc refusée — HTTP 400 « Invalid key demandeur » — et
 * AUCUNE demande ne pouvait être enregistrée. Le contrôleur construit donc une
 * charge utile en LISTE BLANCHE et écrit par le service du content-type.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { assertCanWrite, getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
const {
  resoudreDepositaireGeneral,
} = require('../../../utils/resolveDepositaireGeneral');
const {
  creerEntreeNouvelleDemande,
  distribuerNotifications,
} = require('../../notification-outbox/services/notification-outbox');
// Étape 3 « Ordre de sortie » : la création d'un ordre passe par la MÊME
// logique que le formulaire de distribution (contrôles, transaction, référence).
const {
  SORTIE_UID,
  preparerSortie,
  creerSortieEtLignes,
  tracerMouvementSortie,
  ErreurCreationSortie,
} = require('../../../utils/creationSortie');

const DEMANDE_UID = 'api::demande.demande';
const MATERIEL_UID = 'api::material.material';
const DIRECTION_UID = 'api::direction.direction';
const SERVICE_UID = 'api::service.service';

// Statuts qu'un demandeur peut lui-même donner à sa demande.
const DEMANDEUR_ALLOWED_STATUTS = ['brouillon', 'en_attente', 'annulee'];
const PRIORITES = ['normal', 'urgent', 'critique'];
// Fiches de stock qui ne peuvent plus être demandées.
const MATERIEL_INDISPONIBLE = ['reforme', 'sortie'];

// ── Étape 2 « Décision » ──────────────────────────────────────────────────
// Seul le Dépositaire comptable tranche une demande (l'administrateur
// applicatif aussi) : le Demandeur, le magasinier, le logistique et le
// comptable n'ont AUCUN droit de décision.
const ROLE_DECISION = 'depositaire';
// Statuts de décision : posés UNIQUEMENT par les endpoints « approuver » et
// « rejeter » (jamais par une mise à jour classique).
const STATUTS_DECISION = ['approuvee', 'rejetee'];

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  ctx.body = {
    error: {
      status,
      name: status === 401 ? 'UnauthorizedError' : 'ForbiddenError',
      message,
    },
  };
  return ctx.body;
}

function badRequest(ctx, message) {
  ctx.status = 400;
  ctx.body = {
    error: {
      status: 400,
      name: 'ValidationError',
      message,
    },
  };
  return ctx.body;
}

function notFound(ctx, message) {
  ctx.status = 404;
  ctx.body = {
    error: {
      status: 404,
      name: 'NotFoundError',
      message,
    },
  };
  return ctx.body;
}

/** 409 — conflit métier (ex. : un ordre existe déjà pour cette demande). */
function conflict(ctx, message) {
  ctx.status = 409;
  ctx.body = {
    error: {
      status: 409,
      name: 'ConflictError',
      message,
    },
  };
  return ctx.body;
}

/** Sortie peuplée (lignes + matériel + en-tête) : renvoyée après création. */
async function chargerSortie(app, documentId) {
  return app.documents(SORTIE_UID).findOne({
    documentId,
    populate: {
      lignes: { populate: ['materiel'] },
      direction: true,
      service: true,
      demande: true,
    },
  });
}

/** Nom du validateur (champ `valide_par`), posé par le serveur. */
function nomUtilisateur(user) {
  return (
    (user && (user.username || user.email)) ||
    (user && `Utilisateur #${user.id}`) ||
    ''
  );
}

/** Comparaison insensible à la casse, aux accents et aux espaces multiples. */
function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Date de demande : AAAA-MM-JJ, ou aujourd'hui si l'écran n'en envoie pas. */
function dateValide(valeur) {
  if (typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur.trim())) {
    return valeur.trim();
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * DIRECTION et SERVICE déduits du COMPTE (`department`).
 *
 * `department` est de la forme « <DIRECTION> - <SERVICE> » (ex. « DAF - Service
 * Comptabilité Matière »). Règle strictement déterministe, qui ne lit JAMAIS
 * l'écran :
 *   1. la partie après « - » est un service connu   -> sa direction + ce service ;
 *   2. la partie après « - » est une direction connue -> cette direction ;
 *   3. la partie avant « - » est une abréviation connue -> cette direction ;
 *   4. la partie avant « - » est un nom de direction connu -> cette direction ;
 *   5. sinon : aucune direction (l'écran affiche « — »).
 */
async function resoudreOrganigramme(app, department) {
  const texte = typeof department === 'string' ? department.trim() : '';
  if (!texte) return { direction: null, service: null };

  const separateur = texte.indexOf(' - ');
  const gauche = separateur >= 0 ? texte.slice(0, separateur).trim() : texte;
  const droite = separateur >= 0 ? texte.slice(separateur + 3).trim() : null;

  const directions = await app.documents(DIRECTION_UID).findMany({ limit: -1 });
  const services = await app.documents(SERVICE_UID).findMany({
    limit: -1,
    populate: { direction: true },
  });

  const directionPar = (cible) =>
    (directions || []).find(
      (d) =>
        normaliser(d.nom_direction) === normaliser(cible) ||
        normaliser(d.abreviation) === normaliser(cible)
    ) || null;
  const servicePar = (cible) =>
    (services || []).find((s) => normaliser(s.nom_service) === normaliser(cible)) || null;

  if (droite) {
    const service = servicePar(droite);
    if (service) {
      return { direction: service.direction || directionPar(gauche), service };
    }
    const direction = directionPar(droite);
    if (direction) return { direction, service: null };
  }
  return { direction: directionPar(gauche), service: null };
}

/**
 * Fiche de stock correspondant EXACTEMENT à une désignation (insensible à la
 * casse). Renvoie null si aucune fiche, ou si la désignation est ambiguë
 * (plusieurs fiches) : dans les deux cas, aucune ligne fantôme n'est créée.
 */
async function trouverMaterielParDesignation(app, designation) {
  if (!designation || !String(designation).trim()) return null;
  try {
    const rows = await app.documents(MATERIEL_UID).findMany({
      filters: { designation: { $eqi: String(designation).trim() } },
      limit: 2,
    });
    return rows && rows.length === 1 ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Valide les lignes d'une demande contre le STOCK RÉEL.
 *
 * Renvoie `{ lignes }` (lignes normalisées, prêtes à écrire) ou
 * `{ erreur }` (message destiné au client). Aucune écriture n'a lieu avant
 * que TOUTES les lignes soient validées : jamais de demande partielle.
 */
async function validerLignes(app, lignes, ancienContrat) {
  // Ancien contrat (une ligne = la demande elle-même) : la désignation libre
  // est résolue EXACTEMENT dans le stock. Elle ne peut donc jamais créer une
  // ligne fantôme : soit elle désigne une fiche réelle, soit c'est refusé.
  const legacy = ancienContrat || {};
  const brutes =
    Array.isArray(lignes) && lignes.length > 0
      ? lignes
      : typeof legacy.designation_materiel === 'string' &&
        legacy.designation_materiel.trim()
        ? [
            {
              designation: legacy.designation_materiel,
              quantite: legacy.quantite,
              motif: legacy.motif,
            },
          ]
        : [];

  if (brutes.length === 0) {
    return { erreur: 'Une demande doit comporter au moins un matériel du stock.' };
  }

  const validees = [];
  const cumulParMateriel = new Map();

  for (const brute of brutes) {
    const ligne = brute && typeof brute === 'object' ? brute : {};
    const materielId = ligne.materiel || ligne.materiel_id || ligne.materielId || null;
    const designationDemandee =
      typeof ligne.designation === 'string' ? ligne.designation.trim() : '';

    let materiel = null;
    if (materielId && typeof materielId === 'string') {
      try {
        materiel = await app.documents(MATERIEL_UID).findOne({ documentId: materielId });
      } catch (e) {
        materiel = null;
      }
      if (!materiel) {
        return { erreur: `Le matériel « ${materielId} » n'existe pas au stock.` };
      }
    } else if (designationDemandee) {
      materiel = await trouverMaterielParDesignation(app, designationDemandee);
      if (!materiel) {
        return {
          erreur: `Le matériel « ${designationDemandee} » n'existe pas au stock.`,
        };
      }
    } else {
      return {
        erreur: 'Chaque ligne doit désigner un matériel du stock (identifiant manquant).',
      };
    }

    const quantite = Number(ligne.quantite);
    if (!Number.isInteger(quantite) || quantite < 1) {
      return {
        erreur:
          `Quantité invalide pour « ${materiel.designation || materielId} » : ` +
          'un entier supérieur à 0 est attendu.',
      };
    }

    if (MATERIEL_INDISPONIBLE.includes(String(materiel.statut || ''))) {
      return {
        erreur:
          `Le matériel « ${materiel.designation || materielId} » n'est pas ` +
          `disponible (statut : ${materiel.statut}).`,
      };
    }

    // Cumul des lignes visant le MÊME matériel (deux lignes ne peuvent pas
    // contourner le contrôle de stock en se partageant le même article).
    const cumul = (cumulParMateriel.get(materiel.documentId) || 0) + quantite;
    cumulParMateriel.set(materiel.documentId, cumul);

    const stock = Number(materiel.quantite_stock) || 0;
    if (cumul > stock) {
      return {
        erreur:
          `Stock insuffisant pour « ${materiel.designation || materielId} » : ` +
          `quantité demandée ${cumul}, quantité disponible ${stock}.`,
      };
    }

    validees.push({
      materiel: materiel.documentId,
      designation: materiel.designation || null,
      quantite,
      // Quantité DEMANDÉE : conservée même si le Dépositaire ajuste la
      // quantité approuvée à l'étape 2 (traçabilité de la décision).
      quantite_demandee: quantite,
      motif:
        typeof ligne.motif === 'string' && ligne.motif.trim() ? ligne.motif.trim() : null,
    });
  }

  return { lignes: validees };
}

/** documentId des demandes APPARTENANT à cet utilisateur (lecture serveur). */
async function demandesPossedees(app, user) {
  if (!user || !user.documentId) return [];
  try {
    const rows = await app.documents(DEMANDE_UID).findMany({
      filters: { demandeur: { documentId: user.documentId } },
      fields: ['documentId'],
      limit: -1,
    });
    return (rows || []).map((row) => row.documentId);
  } catch (e) {
    return [];
  }
}

/**
 * Filtre serveur d'appropriation. Le filtre du client ne peut que
 * RESTREINDRE le résultat : il est combiné (ET) au filtre de possession.
 * Un tableau vide est exprimé par `documentId: { $null: true }` — un `$in`
 * vide serait retiré par le sanitizer et la condition disparaîtrait.
 */
function filtrePossessions(filtreClient, documentIds) {
  const ids = documentIds || [];
  const possession = ids.length
    ? { documentId: { $in: ids } }
    : { documentId: { $null: true } };
  if (!filtreClient || typeof filtreClient !== 'object') {
    return possession;
  }
  return { $and: [filtreClient, possession] };
}

/** 404 (jamais 403) si la demande visée n'appartient pas à l'utilisateur. */
function verifierPossession(ctx, documentId, documentIds) {
  const ids = documentIds || [];
  if (!documentId || !ids.includes(documentId)) {
    return notFound(ctx, 'Demande introuvable.');
  }
  return null;
}

async function isDemandeur(app, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user) return false;
  const code = await getRoleCode(app, user.id);
  return code === DEMANDEUR_ROLE;
}

/**
 * NOTIFICATION « nouvelle demande » : prévient le DÉPOSITAIRE GÉNÉRAL qu'une
 * demande de matériel vient d'être déposée.
 *
 * Le destinataire est EXCLUSIVEMENT `hery.rakoto@mtefop.gov.mg` : il n'est pas
 * cherché par rôle ni par direction. La notification est idempotente (clé
 * unique en base), elle ne peut donc pas être dupliquée pour une même
 * demande.
 *
 * DOIT être appelée dans la transaction de création de la demande : la
 * demande et sa notification sont alors écrites ensemble.
 *
 * Une résolution de destinataire impossible (compte absent, bloqué, non
 * confirmé…) n'annule PAS la demande : elle est seulement journalisée, la
 * demande reste enregistrable.
 *
 * @param {object} app - instance Strapi
 * @param {object} demande - demande créée (avec `documentId` et `reference`)
 * @param {object} demandeur - utilisateur connecté (demandeur)
 * @param {object} organigramme - `{ direction, service }` déduits du compte
 * @returns {Promise<boolean>} true si une entrée outbox a été créée
 */
async function notifierNouvelleDemande(app, demande, demandeur, organigramme) {
  const resolution = await resoudreDepositaireGeneral(app);

  if (!resolution.ok) {
    app.log.warn(
      `[demande] Demande ${demande.reference} créée mais AUCUNE notification « nouvelle_demande » envoyée : destinataire introuvable (raison : ${resolution.reason}).`
    );
    return false;
  }

  const direction = organigramme && organigramme.direction;
  const service = organigramme && organigramme.service;
  const priorite = demande.priorite || 'normal';

  const payload = {
    demandeDocumentId: demande.documentId,
    demandeId: demande.id,
    demandeReference: demande.reference,
    demandeDate: demande.date_demande || null,
    demandeur: nomUtilisateur(demandeur),
    direction: direction ? direction.nom_direction || direction.abreviation : null,
    service: service ? service.nom_service : null,
    priorite,
    message:
      `Nouvelle demande ${demande.reference} (${priorite}) déposée par ` +
      `${nomUtilisateur(demandeur)}.`,
  };

  await creerEntreeNouvelleDemande(
    app,
    demande.documentId,
    resolution.user,
    payload
  );

  return true;
}

module.exports = createCoreController(DEMANDE_UID, ({ strapi: app }) => ({
  /** Le Demandeur ne list que ses propres demandes (contrôle serveur). */
  async find(ctx) {
    if (await isDemandeur(app, ctx)) {
      const miens = await demandesPossedees(app, ctx.state.user);
      ctx.query.filters = filtrePossessions(ctx.query.filters, miens);
      const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
      securePopulateAndFilters(ctx);
    }
    return super.find(ctx);
  },

  /** Un Demandeur ne lit que ses propres demandes (404 sinon). */
  async findOne(ctx) {
    if (await isDemandeur(app, ctx)) {
      const miens = await demandesPossedees(app, ctx.state.user);
      const documentId = ctx.params.id || ctx.params.documentId;
      const refus = verifierPossession(ctx, documentId, miens);
      if (refus) return refus;
      const { securePopulateAndFilters } = require('../../../utils/populateSecurise');
      securePopulateAndFilters(ctx);
    }
    return super.findOne(ctx);
  },

  /**
   * Création d'une demande.
   *
   * La charge utile est reconstruite EN LISTE BLANCHE : ce que l'écran envoie
   * n'est jamais recopié tel quel. Trois règles sont garanties par le serveur :
   *  - POSSESSION   : `demandeur` = l'utilisateur connecté ;
   *  - ORGANIGRAMME : `direction` / `service` = ceux déduits du COMPTE ;
   *  - STOCK       : chaque ligne pointe une fiche `material` existante, et la
   *                  quantité demandée reste couverte par le stock.
   *
   * L'écriture passe par le service du content-type et NON par `super.create`
   * : le Content API de Strapi refuse la relation `demandeur` (aucun rôle ne
   * peut lire `plugin::users-permissions.user`) et répondait 400 « Invalid key
   * demandeur » — aucune demande n'était donc jamais enregistrée.
   */
  async create(ctx) {
    await assertCanWrite(app, ctx, DEMANDE_UID);
    if (ctx.status === 403) return ctx.body;

    const user = ctx.state && ctx.state.user;
    if (!user || !user.documentId) {
      return forbid(ctx, 'Authentification requise pour créer une demande.');
    }

    const body = (ctx.request.body && ctx.request.body.data) || {};

    // 1. Statut : jamais un statut de décision (approbation, rejet...).
    const statut =
      typeof body.statut === 'string' && body.statut ? body.statut : 'en_attente';
    if (!DEMANDEUR_ALLOWED_STATUTS.includes(statut)) {
      return forbid(
        ctx,
        'Seul un responsable habilité peut fixer ce statut de demande.'
      );
    }

    // 2. Lignes : matériel du STOCK RÉEL, quantité, stock contrôlé.
    const { lignes, erreur } = await validerLignes(app, body.lignes, body);
    if (erreur) return badRequest(ctx, erreur);

    // 3. Direction et service : déduits du COMPTE, jamais de l'écran.
    const organigramme = await resoudreOrganigramme(app, user.department);

    // 4. Charge utile en LISTE BLANCHE.
    const totalQuantite = lignes.reduce((somme, ligne) => somme + ligne.quantite, 0);
    const designations = lignes.map((ligne) => ligne.designation).filter(Boolean);
    const data = {
      type: body.type === 'entree' ? 'entree' : 'sortie',
      statut,
      priorite: PRIORITES.includes(body.priorite) ? body.priorite : 'normal',
      date_demande: dateValide(body.date_demande),
      motif:
        typeof body.motif === 'string' && body.motif.trim()
          ? body.motif.trim()
          : lignes[0].motif || null,
      // Dénormalisation : le circuit de sortie (non modifié) lit ces champs.
      designation_materiel: designations.join(' / ') || '—',
      quantite: totalQuantite,
      // POSSESSION : toujours l'utilisateur connecté.
      demandeur: user.documentId,
      // ORGANIGRAMME : toujours celui du compte.
      direction: organigramme.direction ? organigramme.direction.documentId : null,
      service: organigramme.service ? organigramme.service.documentId : null,
      // LIGNES : matériel du stock réel, quantité et motif.
      lignes: lignes.map((ligne) => ({ __component: 'demande.ligne', ...ligne })),
    };

    // 5. Écriture (service du content-type : la référence DEM-AAAA-NNN y est
    //    générée par le service de la demande).
    //
    //    La création et sa notification « nouvelle_demande » forment UNE
    //    transaction : en Strapi 5, une transaction imbriquée réutilise la
    //    transaction ambiante, la demande et son entrée outbox sont donc
    //    écrites ensemble — ou pas du tout. Une notification orpheline
    //    (demande absente) est ainsi impossible, comme une demande sans sa
    //    notification quand l'insertion outbox échoue pour une raison
    //    technique.
    let notificationCreee = false;
    const entite = await app.db.transaction(async () => {
      const created = await app.service(DEMANDE_UID).create({ data });

      // Seule une demande DÉPOSÉE (en attente de décision) est notifiée :
      // un brouillon n'est pas visible du côté dépositaire et sa notification
      // ne pourrait mener à aucune demande à ouvrir.
      if (created.statut === 'en_attente') {
        notificationCreee = await notifierNouvelleDemande(
          app,
          created,
          user,
          organigramme
        );
      }

      return created;
    });

    // --- Distribution des notifications outbox (APRÈS transaction réussie) ---
    // L'entrée « nouvelle_demande » a été créée dans la transaction (atomicité
    // avec la demande). Le distributeur la revendique et l'envoie via SSE, avec
    // reprise en cas d'échec. Un échec d'envoi n'annule PAS la demande déjà
    // enregistrée : la notification sera rejouée à la reconnexion du
    // dépositaire (réconciliation de l'outbox côté frontend).
    if (notificationCreee) {
      try {
        await distribuerNotifications(app);
      } catch (e) {
        app.log.warn(
          `[demande] Échec de la distribution des notifications outbox : ${e.message}`
        );
      }
    }

    const sanitized = await this.sanitizeOutput(entite, ctx);
    ctx.status = 201;
    return this.transformResponse(sanitized);
  },

  /**
   * ÉTAPE 2 — DÉCISION : APPROBATION par le Dépositaire comptable.
   *
   * POST /api/demandes/:documentId/approuver
   * Corps : { lignes?: [{ materiel, quantite }], observation? }
   *
   * Règles appliquées côté serveur (le frontend n'est jamais une source de
   * sécurité) :
   *  - SEUL le rôle « depositaire » décide (l'administrateur applicatif
   *    aussi) : Demandeur, magasinier, logistique et comptable sont refusés ;
   *  - la demande doit être « en_attente » : UNE SEULE validation — une
   *    demande déjà approuvée ou rejetée ne se re-tranche pas ;
   *  - les QUANTITÉS SONT AJUSTABLES : le Dépositaire peut réduire la
   *    quantité d'une ligne ; la quantité demandée est conservée dans
   *    `quantite_demandee` (traçabilité) ;
   *  - le STOCK est re-vérifié AU MOMENT de la décision (il a pu bouger
   *    depuis le dépôt de la demande) ;
   *  - le validateur et la date de validation sont posés par le serveur.
   */
  async approuver(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour approuver une demande.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code !== ROLE_DECISION && code !== 'admin') {
      return forbid(ctx, "Votre rôle ne permet pas d'approuver une demande.");
    }

    const demande = await app.documents(DEMANDE_UID).findOne({
      documentId,
      populate: { lignes: { populate: ['materiel'] } },
    });
    if (!demande) {
      return notFound(ctx, 'Demande introuvable.');
    }
    if (demande.statut !== 'en_attente') {
      return badRequest(
        ctx,
        `La décision n'est possible que pour une demande « en_attente » (statut actuel : ${demande.statut || '—'}).`
      );
    }

    const lignesDemande = Array.isArray(demande.lignes) ? demande.lignes : [];
    if (lignesDemande.length === 0) {
      return badRequest(ctx, 'Cette demande ne porte aucune ligne : rien à approuver.');
    }

    const body = (ctx.request.body && ctx.request.body.data) || {};

    // 1. Quantités proposées par le Dépositaire, indexées par matériel.
    const proposees = new Map();
    for (const entree of Array.isArray(body.lignes) ? body.lignes : []) {
      if (!entree || typeof entree !== 'object') continue;
      const materielId =
        entree.materiel || entree.materiel_id || entree.materielId || null;
      if (!materielId) {
        return badRequest(
          ctx,
          'Chaque ligne approuvée doit désigner un matériel (identifiant manquant).'
        );
      }
      if (proposees.has(materielId)) {
        return badRequest(
          ctx,
          `Le matériel « ${materielId} » est cité deux fois dans les quantités approuvées.`
        );
      }
      proposees.set(materielId, entree.quantite);
    }

    // 2. Toute ligne proposée doit viser un matériel DE CETTE demande.
    for (const materielId of proposees.keys()) {
      const connue = lignesDemande.some(
        (ligne) => ligne.materiel && ligne.materiel.documentId === materielId
      );
      if (!connue) {
        return badRequest(
          ctx,
          `Le matériel « ${materielId} » ne fait pas partie de cette demande.`
        );
      }
    }

    // 3. Quantités approuvées + contrôle du STOCK (cumul par matériel).
    const cumul = new Map();
    const decisions = [];
    for (const ligne of lignesDemande) {
      const materiel = ligne.materiel || null;
      if (!materiel) {
        return badRequest(ctx, 'Une ligne de la demande ne pointe vers aucun matériel.');
      }
      const materielId = materiel.documentId;
      const demandee = Number(ligne.quantite) || 0;
      let quantite = demandee;
      if (proposees.has(materielId)) {
        quantite = Number(proposees.get(materielId));
        if (!Number.isInteger(quantite) || quantite < 1) {
          return badRequest(
            ctx,
            `Quantité approuvée invalide pour « ${ligne.designation || materielId} » : un entier supérieur à 0 est attendu.`
          );
        }
      }
      const total = (cumul.get(materielId) || 0) + quantite;
      cumul.set(materielId, total);
      const stock = Number(materiel.quantite_stock) || 0;
      if (total > stock) {
        return forbid(
          ctx,
          `Stock insuffisant pour « ${ligne.designation || materielId} » : quantité approuvée ${total}, quantité disponible ${stock}.`,
          409
        );
      }
      decisions.push({
        id: ligne.id,
        quantite,
        quantite_demandee: demandee,
      });
    }

    // 4. Écriture : statut, validateur et date posés par le serveur.
    const data = {
      statut: 'approuvee',
      valide_par: nomUtilisateur(user),
      date_validation: new Date().toISOString(),
      quantite: decisions.reduce((somme, d) => somme + d.quantite, 0),
      lignes: decisions.map((d) => ({
        id: d.id,
        quantite: d.quantite,
        quantite_demandee: d.quantite_demandee,
      })),
    };
    if (typeof body.observation === 'string' && body.observation.trim()) {
      data.observation = body.observation.trim();
    }
    await app.documents(DEMANDE_UID).update({ documentId, data });

    const finale = await app.documents(DEMANDE_UID).findOne({
      documentId,
      populate: { lignes: { populate: ['materiel'] } },
    });
    return { data: finale };
  },

  /**
   * ÉTAPE 2 — DÉCISION : REJET par le Dépositaire comptable.
   *
   * POST /api/demandes/:documentId/rejeter
   * Corps : { motif }
   *
   *  - rôle « depositaire » (ou administrateur applicatif) uniquement ;
   *  - MOTIF OBLIGATOIRE (texte non vide) : une demande rejetée sans motif
   *    n'est jamais enregistrée ;
   *  - demande « en_attente » uniquement (une seule validation) ;
   *  - aucun effet sur le stock ; le motif est conservé pour le demandeur.
   */
  async rejeter(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour rejeter une demande.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code !== ROLE_DECISION && code !== 'admin') {
      return forbid(ctx, 'Votre rôle ne permet pas de rejeter une demande.');
    }

    const body = (ctx.request.body && ctx.request.body.data) || {};
    const motif = typeof body.motif === 'string' ? body.motif.trim() : '';
    if (!motif) {
      return badRequest(ctx, 'Motif de rejet obligatoire (texte non vide).');
    }

    const demande = await app.documents(DEMANDE_UID).findOne({ documentId });
    if (!demande) {
      return notFound(ctx, 'Demande introuvable.');
    }
    if (demande.statut !== 'en_attente') {
      return badRequest(
        ctx,
        `La décision n'est possible que pour une demande « en_attente » (statut actuel : ${demande.statut || '—'}).`
      );
    }

    await app.documents(DEMANDE_UID).update({
      documentId,
      data: {
        statut: 'rejetee',
        motif_rejet: motif,
        valide_par: nomUtilisateur(user),
        date_validation: new Date().toISOString(),
      },
    });

    const finale = await app.documents(DEMANDE_UID).findOne({ documentId });
    return { data: finale };
  },

  /**
   * ÉTAPE 3 — ORDRE DE SORTIE : création depuis une demande approuvée.
   *
   * POST /api/demandes/:documentId/creer-ordre
   *
   *  - rôle « depositaire » (ou administrateur applicatif) uniquement ;
   *  - demande APPROUVÉE uniquement (statut « approuvee ») ;
   *  - UNE DEMANDE, UN ORDRE : si un ordre existe déjà pour cette demande,
   *    la création est refusée (409) ;
   *  - l'ordre est PRÉREMPLI À PARTIR DE LA BASE (jamais à partir de l'écran) :
   *    direction et service de la demande, lignes et quantités APPROUVÉES,
   *    pièce justificative = RÉFÉRENCE de la demande ;
   *  - la création passe par le MÊME chemin que le formulaire de
   *    distribution (`utils/creationSortie.js`) : stock re-contrôlé, valeur
   *    unitaire exigée, transaction unique, référence SOR-AAAA-NNN générée
   *    par le serveur, ordre « en_preparation » (les 3 signatures suivent).
   */
  async creerOrdre(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour créer un ordre de sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code !== ROLE_DECISION && code !== 'admin') {
      return forbid(ctx, "Votre rôle ne permet pas de créer un ordre de sortie.");
    }

    const demande = await app.documents(DEMANDE_UID).findOne({
      documentId,
      populate: { lignes: { populate: ['materiel'] }, direction: true, service: true },
    });
    if (!demande) {
      return notFound(ctx, 'Demande introuvable.');
    }
    if (demande.statut !== 'approuvee') {
      return badRequest(
        ctx,
        `Un ordre de sortie ne peut être créé qu'à partir d'une demande « approuvee » (statut actuel : ${demande.statut || '—'}).`
      );
    }

    // Lignes de l'ordre = lignes de la demande, quantités APPROUVÉES.
    const lignes = (demande.lignes || []).map((ligne) => ({
      materiel_id: ligne.materiel && ligne.materiel.documentId,
      quantite: Number(ligne.quantite) || 0,
      observations: null,
    }));
    if (lignes.length === 0) {
      return badRequest(ctx, 'Cette demande ne porte aucune ligne : rien à sortir.');
    }
    const sansMateriel = lignes.find((ligne) => !ligne.materiel_id);
    if (sansMateriel) {
      return badRequest(ctx, 'Une ligne de la demande ne pointe aucune fiche de stock.');
    }

    // Une demande, un ordre : un second ordre est refusé (409). Le contrôle
    // est fait ICI et, de nouveau, dans la logique de création partagée.
    const ordresLies = await app.documents(SORTIE_UID).findMany({
      filters: { demande: { documentId } },
      fields: ['documentId', 'reference'],
      limit: -1,
    });
    if (ordresLies && ordresLies.length > 0) {
      const reference = ordresLies[0].reference || '';
      return conflict(
        ctx,
        reference
          ? `Un ordre de sortie existe déjà pour cette demande (${reference}) : une demande ne porte qu'un seul ordre.`
          : "Un ordre de sortie existe déjà pour cette demande : une demande ne porte qu'un seul ordre."
      );
    }

    // Préremplissage : TOUT vient de la base.
    const body = {
      date_sortie: new Date().toISOString().slice(0, 10),
      // PIÈCE JUSTIFICATIVE = référence de la demande.
      justificatif: demande.reference,
      direction_id:
        demande.direction && demande.direction.documentId
          ? demande.direction.documentId
          : null,
      service_id:
        demande.service && demande.service.documentId
          ? demande.service.documentId
          : null,
      lignes,
      demande_id: documentId,
    };

    let prepare;
    try {
      prepare = await preparerSortie(app, body);
    } catch (e) {
      if (e instanceof ErreurCreationSortie) {
        return e.status === 409 ? conflict(ctx, e.message) : badRequest(ctx, e.message);
      }
      throw e;
    }

    const sortie = await creerSortieEtLignes(app, prepare);
    const sortieComplete = await chargerSortie(app, sortie.documentId);
    await tracerMouvementSortie(
      app,
      sortieComplete,
      'Sortie créée',
      'en_preparation',
      null,
      nomUtilisateur(user)
    );
    ctx.status = 201;
    return { data: sortieComplete };
  },

  async update(ctx) {
    await assertCanWrite(app, ctx, DEMANDE_UID);
    if (ctx.status === 403) return ctx.body;
    // La DÉCISION passe par un seul chemin (« approuver » / « rejeter ») :
    // une mise à jour classique ne peut ni approuver ni rejeter (sinon le
    // contrôle de stock, les quantités ajustables et la trace de validation
    // seraient contournables par un simple PUT).
    const body = (ctx.request.body && ctx.request.body.data) || {};
    if (typeof body.statut === 'string' && STATUTS_DECISION.includes(body.statut)) {
      return forbid(
        ctx,
        'Une demande ne peut être approuvée ou rejetée que via les endpoints de décision.'
      );
    }
    return super.update(ctx);
  },

  async delete(ctx) {
    await assertCanWrite(app, ctx, DEMANDE_UID);
    if (ctx.status === 403) return ctx.body;
    return super.delete(ctx);
  },
}));
