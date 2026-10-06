'use strict';

/**
 * entree controller
 *
 * Endpoints custom (au-delà du CRUD core) :
 *   POST /api/entrees/create-complete    création complète (entête + lignes)
 *   POST /api/entrees/:documentId/sign   signature contrôlée par rôle
 *   POST /api/entrees/:documentId/reject rejet par un habilité
 *
 * Règle métier stricte : une entrée n'est « validee » QUE si les 3
 * signatures obligatoires sont présentes (Dépositaire, Chef de service 1,
 * Chef de service 2). Un profil « demandeur » ne peut jamais signer ni
 * valider : le contrôle est effectué ICI, côté serveur (roleGuard.js).
 * Une signature enregistrée n'est jamais modifiable (double signature
 * refusée avec 409).
 *
 * Lecture (`GET /entrees`, `GET /entrees/:id`) : les handlers core sont
 * surchargés pour n'appliquer qu'au profil « demandeur » un filtrage
 * d'APPROPRIATION — il ne voit que les entrées dont il est le créateur
 * (relation `demandeur`, alimentée par `createComplete` depuis la session).
 * Même règle et même mécanisme que `demande.find` / `demande.findOne`.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController, getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');

const ENTREE_UID = 'api::entree.entree';
const LIGNE_UID = 'api::entree-ligne.entree-ligne';
const MATERIEL_UID = 'api::material.material';
const MOUVEMENT_UID = 'api::mouvement.mouvement';
const FOURNISSEUR_UID = 'api::fournisseur.fournisseur';

const SIGNATURE_ROLES = {
  // Décision 4 — ordre définitif : magasinier (chef_service_1) → logistique
  // (chef_service_2) → dépositaire (depositaire). La 3ᵉ signature déclenche
  // la validation finale + l'impact stock unique (mécanisme existant,
  // inchangé : nbSignatures === 3).
  depositaire: { flag: 'depositaire_signed', dateField: 'date_signature_depositaire', signerField: 'signataire_depositaire', affectationField: 'affectation_depositaire', order: 3 },
  chef_service_1: { flag: 'chef_service_1_signed', dateField: 'date_signature_chef_service_1', signerField: 'signataire_chef_service_1', affectationField: 'affectation_chef_service_1', order: 1 },
  chef_service_2: { flag: 'chef_service_2_signed', dateField: 'date_signature_chef_service_2', signerField: 'signataire_chef_service_2', affectationField: 'affectation_chef_service_2', order: 2 },
};

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  const noms = { 403: 'ForbiddenError', 404: 'NotFoundError', 409: 'ConflictError' };
  ctx.body = {
    error: {
      status,
      name: noms[status] || 'ForbiddenError',
      message,
    },
  };
  return ctx.body;
}

function badRequest(ctx, message) {
  ctx.status = 400;
  ctx.body = {
    error: { status: 400, name: 'ValidationError', message },
  };
  return ctx.body;
}

/** Token unique pour le QR Code de l'entrée (jamais de données sensibles dedans) */
function genererQrToken() {
  return `ENT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

/** Clé de comparaison d'un nom de fournisseur : insensible à la casse et aux
 *  espaces superflus (décision 2). */
function cleFournisseur(nom) {
  return String(nom || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** La requête courante provient-elle d'un profil « demandeur » (et non
 *  anonyme, ni d'un rôle habilité) ? */
async function isDemandeurSession(strapi, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user || !user.id) return false;
  return (await getRoleCode(strapi, user.id)) === DEMANDEUR_ROLE;
}

/** documentId des entrées créées par cet utilisateur.
 *
 *  La recherche passe par le DOCUMENT SERVICE et non par la relation peuplée
 *  dans la réponse : le sanitizer de sortie Content-API retire une relation
 *  dont la cible n'est pas lisible par le rôle (or le rôle Demandeur n'a pas
 *  `plugin::users-permissions.user.find`), si bien qu'un simple peuplement de
 *  `demandeur` ne renvoyait... rien de vérifiable. Le Document Service, lui,
 *  n'applique pas ce sanitizer. */
async function documentIdsPossedesPar(strapi, user) {
  const lignes = await strapi.documents(ENTREE_UID).findMany({
    filters: { demandeur: { documentId: user.documentId } },
    fields: ['documentId'],
    limit: -1,
  });
  return (lignes || []).map((l) => l.documentId);
}

/** Ajoute la contrainte d'appropriation à la requête, combinée (ET) au
 *  `filters` éventuellement fourni par le client : un filtre client ne peut
 *  qu'en réduire le résultat, jamais l'éluder. La liste vide est acceptée par
 *  le moteur de requête (`$in: []` -> aucun résultat).
 *
 *  ⚠️ On MUTE `ctx.query` (et non `ctx.query = …`) : `query` est un getter
 *  Koa en lecture seule — une affectation lèverait une TypeError en mode
 *  strict. Le getter met en cache l'objet parsé, la mutation est donc vue par
 *  le handler core (même mécanisme que `demande.find`). */
function withAppropriationFilter(ctx, documentIds) {
  const existant = ctx.query.filters;
  ctx.query.filters = existant
    ? { $and: [existant, { documentId: { $in: documentIds } }] }
    : { documentId: { $in: documentIds } };
}

/** Handler CORE correspondant, appelé depuis une surcharge : le prototype du
 *  contrôleur fusionné est le contrôleur core (cf. createCoreController). */
function baseHandler(ctrl, nom, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[nom];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${nom} » introuvable sur ${ENTREE_UID}.`);
  }
  return handler.call(ctrl, ctx);
}

/**
 * Décision 2 — find-or-create silencieux du fournisseur à partir du nom saisi
 * en texte libre à l'écran (flux « Arrivée matériel »). Aucun écran de gestion
 * fournisseurs : on crée un enregistrement minimal (nom uniquement) si aucun
 * existant ne correspond.
 */
async function findOrCreateFournisseur(strapi, nom) {
  const nomPropre = String(nom || '').trim().replace(/\s+/g, ' ');
  if (!nomPropre) return null;

  // Recherche directe (insensible à la casse)…
  try {
    const directs = await strapi.documents(FOURNISSEUR_UID).findMany({
      filters: { nom: { $eqi: nomPropre } },
      limit: 1,
    });
    if (directs && directs.length > 0) return directs[0];
  } catch (e) {
    // On tente la comparaison normalisée ci-dessous.
  }

  // …puis comparaison normalisée (espaces superflus / casse mélangée).
  try {
    const tous = await strapi.documents(FOURNISSEUR_UID).findMany({ limit: -1 });
    const cle = cleFournisseur(nomPropre);
    const existant = (tous || []).find((f) => cleFournisseur(f.nom) === cle);
    if (existant) return existant;
  } catch (e) {
    // Création ci-dessous.
  }

  try {
    return await strapi.documents(FOURNISSEUR_UID).create({ data: { nom: nomPropre } });
  } catch (e) {
    // Course concurrente (deux créations simultanées) : retenter la lecture.
    try {
      const directs = await strapi.documents(FOURNISSEUR_UID).findMany({
        filters: { nom: { $eqi: nomPropre } },
        limit: 1,
      });
      return directs && directs.length > 0 ? directs[0] : null;
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Rôle autorisé pour signer `roleKey`. Correspondance entre les rôles
 * Strapi et les signataires réglementaires :
 *   depositaire   -> DEPOSITAIRE (et admin)
 *   chef_service_1 -> MAGASINIER (et admin)
 *   chef_service_2 -> LOGISTIQUE (et admin)
 */
const ROLE_FOR_SIGNATURE = {
  depositaire: ['depositaire'],
  chef_service_1: ['magasinier'],
  chef_service_2: ['logistique'],
};

async function loadEntree(strapi, documentId) {
  // `lignes` est peuplée en profondeur : les photos (champ media `photos` de
  // entree-ligne) et le matériel des lignes. Sans ce `populate` imbriqué, les
  // pièces jointes par le magasinier ne seraient jamais renvoyées (Strapi 5
  // ne peuple que le premier niveau avec la forme tableau) — le PV et le
  // détail d'une entrée traitée afficheraient alors des photos vides après un
  // simple rechargement de page.
  return strapi.documents(ENTREE_UID).findOne({
    documentId,
    populate: {
      lignes: { populate: ['photos', 'materiel'] },
      fournisseur: true,
      direction: true,
      service: true,
      mouvements: true,
    },
  });
}

async function findMaterielByDesignation(strapi, designation) {
  if (!designation) return null;
  try {
    const rows = await strapi.documents(MATERIEL_UID).findMany({
      filters: { designation: { $eqi: designation } },
      limit: 1,
    });
    return rows && rows.length > 0 ? rows[0] : null;
  } catch (e) {
    return null;
  }
}

/** Impacte le stock une seule fois : garde-fou `stock_impacte`. */
async function appliquerImpactStock(strapi, entree, utilisateur) {
  if (entree.stock_impacte === true) return; // déjà appliqué -> jamais deux fois

  const lignes = entree.lignes || [];
  for (const ligne of lignes) {
    let materiel = ligne.materiel;
    if (!materiel) {
      materiel = await findMaterielByDesignation(strapi, ligne.designation);
    }
    if (!materiel) continue;

    const nouvelleQuantite = (Number(materiel.quantite_stock) || 0) + (Number(ligne.quantite) || 0);
    await strapi.documents(MATERIEL_UID).update({
      documentId: materiel.documentId,
      data: { quantite_stock: nouvelleQuantite },
    });
  }

  await strapi.documents(ENTREE_UID).update({
    documentId: entree.documentId,
    data: { stock_impacte: true },
  });
}

/** Trace l'action dans la table `mouvements` (historique non modifiable). */
async function tracerMouvement(strapi, entree, action, statut, observations, utilisateur = '') {
  try {
    await strapi.documents(MOUVEMENT_UID).create({
      data: {
        reference: entree.reference,
        type: 'entree',
        date_mouvement: new Date().toISOString().slice(0, 10),
        utilisateur,
        action,
        materiel: (entree.lignes || [])
          .map((l) => l.designation)
          .filter(Boolean)
          .join(', ') || entree.numero_facture || '—',
        quantite: (entree.lignes || []).reduce((sum, l) => sum + (Number(l.quantite) || 0), 0),
        statut,
        entree: entree.documentId,
        observations,
      },
    });
  } catch (e) {
    strapi.log.warn(`[entree] Historique non tracé : ${e.message}`);
  }
}

module.exports = guardedCoreController(createCoreController, ENTREE_UID, {
  /**
   * GET /api/entrees
   *
   * Surcharge du handler core : le Demandeur est autorisé à lire les entrées
   * (il en crée et doit suivre leur validation) mais UNIQUEMENT les siennes.
   * La restriction est appliquée dans la requête, avant pagination : un
   * `filters[...]` envoyé par le client ne peut ni l'éluder ni l'orienter
   * vers une entrée étrangère — il ne peut qu'en réduire le résultat.
   * Les rôles habilités ne sont pas filtrés (ils voient toutes les entrées).
   */
  async find(ctx) {
    if (await isDemandeurSession(strapi, ctx)) {
      const miens = await documentIdsPossedesPar(strapi, ctx.state.user);
      withAppropriationFilter(ctx, miens);
    }
    return baseHandler(this, 'find', ctx);
  },

  /**
   * GET /api/entrees/:id
   * Même règle que `find`, appliquée à l'entrée visée. Le handler core
   * `findOne` résout l'entrée par son documentId en IGNORANT les filtres de
   * la requête : l'appropriation est donc contrôlée explicitement, sur la
   * liste des entrées du Demandeur. Réponse 404 (et non 403) pour ne pas
   * distinguer « entrée inexistante » de « entrée d'un autre ».
   */
  async findOne(ctx) {
    if (await isDemandeurSession(strapi, ctx)) {
      const documentId = ctx.params.id || ctx.params.documentId;
      const miens = await documentIdsPossedesPar(strapi, ctx.state.user);
      if (!documentId || !miens.includes(documentId)) {
        return forbid(ctx, 'Entrée introuvable.', 404);
      }
    }
    return baseHandler(this, 'findOne', ctx);
  },

  /**
   * POST /api/entrees/create-complete
   * Création complète : entête administrative + lignes matériels.
   */
  async createComplete(ctx) {
    const app = strapi;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Validation des champs obligatoires -------------------------------
    // `brouillon: true` : enregistrement partiel autorisé (validation assouplie)
    const estBrouillon = body.brouillon === true;
    // Décision 1 — le flux « Arrivée matériel » (MaterialEntry) crée l'entrée
    // SANS affectations pré-remplies : affectation_depositaire est dérivée de
    // la session, chef_service_1/chef_service_2 sont posés par la première
    // signature de chaque rôle. Le circuit historique (EntriesPage/NewEntry)
    // continue d'exiger les 3 affectations : il les envoie explicitement et
    // n'envoie pas le drapeau ci-dessous (non-régression).
    const affectationsExigees = body.exigerAffectations !== false;
    if (!estBrouillon) {
      if (!body.fournisseur && !body.fournisseur_id) {
        return badRequest(ctx, 'Fournisseur obligatoire.');
      }
      if (!body.date_entree) {
        return badRequest(ctx, "Date d'entrée obligatoire.");
      }
      if (affectationsExigees) {
        if (!body.affectation_depositaire) {
          return badRequest(ctx, 'Veuillez sélectionner le dépositaire par service.');
        }
        if (!body.affectation_chef_service_1) {
          return badRequest(ctx, 'Veuillez sélectionner le Chef de service 1.');
        }
        if (!body.affectation_chef_service_2) {
          return badRequest(ctx, 'Veuillez sélectionner le Chef de service 2.');
        }
      }
    }
    const lignes = Array.isArray(body.lignes) ? body.lignes : [];
    if (!estBrouillon && lignes.length === 0) {
      return badRequest(ctx, 'Au moins un matériel est requis.');
    }
    for (const ligne of lignes) {
      const quantite = Number(ligne.quantite);
      if (!Number.isFinite(quantite) || quantite <= 0) {
        return badRequest(ctx, 'Quantité invalide : elle doit être supérieure à 0.');
      }
      const prix = Number(ligne.valeur_unitaire);
      if (!Number.isFinite(prix) || prix < 0) {
        return badRequest(ctx, 'Prix unitaire invalide : il doit être positif ou nul.');
      }
      // Cohérence : montant recalculé serveur (jamais pris du client)
      ligne.montant = Math.round(quantite * prix * 100) / 100;
    }

    // --- Génération automatique de la référence ENT-AAAA-NNN --------------
    let reference = body.reference;
    if (!reference) {
      const annee = new Date(body.date_entree).getFullYear();
      const prefixe = `ENT-${annee}-`;
      const existantes = await app.documents(ENTREE_UID).findMany({
        filters: { reference: { $startsWith: prefixe } },
        limit: -1,
      });
      const numeros = (existantes || [])
        .map((row) => Number((row.reference || '').slice(prefixe.length)))
        .filter((n) => Number.isFinite(n));
      const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
      reference = `${prefixe}${String(suivant).padStart(3, '0')}`;
    }

    // --- Décision 2 : fournisseur texte libre -> relation ------------------
    // find-or-create silencieux quand seul un nom est fourni (sans id).
    let fournisseurId = body.fournisseur_id || null;
    if (!fournisseurId && typeof body.fournisseur === 'string' && body.fournisseur.trim()) {
      const fournisseur = await findOrCreateFournisseur(app, body.fournisseur);
      fournisseurId = fournisseur ? fournisseur.documentId : null;
    }

    // --- Création de l'entrée ---------------------------------------------
    let entree;
    try {
      entree = await app.documents(ENTREE_UID).create({
        data: {
          reference,
          date_entree: body.date_entree,
          numero_facture: body.numero_facture || null,
          fournisseur: fournisseurId,
          direction: body.direction_id || null,
          service: body.service_id || null,
          responsable: body.responsable || null,
          // Possession de l'entrée : déduite de la session, jamais du corps de
          // requête (même règle que `demande.create`). C'est ce champ que
          // `find` / `findOne` utilisent pour nister les lectures du
          // Demandeur sur SES entrées.
          demandeur:
            (ctx.state && ctx.state.user && ctx.state.user.documentId) || null,
          statut: estBrouillon ? 'brouillon' : 'en_attente',
        // Décision 1 : affectations nullables jusqu'à signature. Le
        // dépositaire est dérivé de la session quand il n'est pas fourni ;
        // chef_service_1/2 sont fixés par la première signature de chaque
        // rôle (voir sign()).
        affectation_depositaire:
          body.affectation_depositaire ||
          (ctx.state && ctx.state.user && (ctx.state.user.username || ctx.state.user.email)) ||
          null,
        affectation_chef_service_1: body.affectation_chef_service_1 || null,
        affectation_chef_service_2: body.affectation_chef_service_2 || null,
        qr_token: genererQrToken(),
          notes: body.notes || null,
          total: Math.round(lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100,
          numero_chapitre: body.numero_chapitre || null,
          libelle_chapitre: body.libelle_chapitre || null,
          subdivision_chapitre: body.subdivision_chapitre || null,
          numero_ordre_journal: body.numero_ordre_journal || null,
          budget_general: body.budget_general || null,
          soa: body.soa || null,
          type_operation: body.type_operation || null,
          adresse_fournisseur: body.adresse_fournisseur || null,
          date_facture: body.date_facture || null,
          bon_livraison: body.bon_livraison || null,
          date_bon_livraison: body.date_bon_livraison || null,
          motif_entree: body.motif_entree || null,
          reference_marche: body.reference_marche || null,
          piece_justificative: body.piece_justificative || null,
          declaration_nom: body.declaration_nom || null,
          declaration_fonction: body.declaration_fonction || null,
          declaration_date: body.declaration_date || null,
        },
      });
    } catch (e) {
      return badRequest(ctx, `Création impossible : ${e.message}`);
    }

    // --- Création des lignes ------------------------------------------------
    for (let i = 0; i < lignes.length; i += 1) {
      const ligne = lignes[i];
      let materielId = ligne.materiel_id || null;
      if (!materielId && ligne.designation) {
        const existant = await findMaterielByDesignation(app, ligne.designation);
        materielId = existant ? existant.documentId : null;
      }
      try {
        await app.documents(LIGNE_UID).create({
          data: {
            entree: entree.documentId,
            materiel: materielId,
            numero_ordre: ligne.numero_ordre || i + 1,
            designation: ligne.designation || null,
            reference: ligne.reference || null,
            espece: ligne.espece || null,
            unite: ligne.unite || null,
            quantite: Number(ligne.quantite),
            valeur_unitaire: Number(ligne.valeur_unitaire),
            montant: ligne.montant,
            nomenclature: ligne.nomenclature || null,
            piece_justificative: ligne.piece_justificative || null,
            observations: ligne.observations || null,
          },
        });
      } catch (e) {
        app.log.warn(`[entree] Ligne ${i + 1} non créée : ${e.message}`);
      }
    }

    const entreeComplete = await loadEntree(app, entree.documentId);
    const createur =
      (ctx.state && ctx.state.user && (ctx.state.user.username || ctx.state.user.email)) ||
      body.responsable ||
      '';
    await tracerMouvement(app, entreeComplete, 'Entrée créée', 'en_attente', null, createur);
    ctx.status = 201;
    return { data: entreeComplete };
  },

  /**
   * POST /api/entrees/:documentId/sign
   * Signature d'une entrée : { role: 'depositaire' | 'chef_service_1' | 'chef_service_2' }
   * - le rôle connecté doit correspondre au signataire demandé ;
   * - l'ordre du workflow est respecté (1 puis 2 puis 3) ;
   * - une signature déjà posée ne peut pas être re-signée (409) ;
   * - validation finale automatique à 3/3 avec impact stock unique.
   */
  async sign(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const roleKey = body.role;

    if (!SIGNATURE_ROLES[roleKey]) {
      return badRequest(ctx, "Rôle de signature inconnu (depositaire, chef_service_1, chef_service_2).");
    }

    // --- Contrôle du rôle connecté ------------------------------------------
    const user = ctx.state && ctx.state.user;
    if (!user) {
      return forbid(ctx, 'Authentification requise pour signer une entrée.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    // Le Demandeur ne signe jamais (garde-fou supplémentaire, redondant
    // avec roleGuard.js) : aucun rôle de signature ne lui est associé.
    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas de signer une entrée.");
    }

    // L'admin peut signer pour tous les rôles ; sinon correspondance stricte.
    const roleCodesAutorises = ROLE_FOR_SIGNATURE[roleKey];
    const estAdmin = code === 'admin';
    if (!estAdmin && !roleCodesAutorises.includes(code)) {
      return forbid(
        ctx,
        `Votre rôle ne permet pas d'apposer la signature « ${roleKey.replace(/_/g, ' ')} ».`
      );
    }

    const entree = await loadEntree(app, documentId);
    if (!entree) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Entrée introuvable.' } };
      return ctx.body;
    }
    if (entree.statut === 'rejetee') {
      return badRequest(ctx, 'Cette entrée a été rejetée : signature impossible.');
    }

    // Photos de l'étape 2 (magasinier) : le stockage passe par le endpoint
    // standard d'upload de Strapi (POST /api/upload avec
    // ref=api::entree-ligne.entree-ligne, refId=<ligne>, field="photos") —
    // AUCUN mécanisme d'upload n'est recodé ici, et la signature ne dépend
    // JAMAIS des photos : un échec d'envoi ne peut ni bloquer ni annuler la
    // signature (elle est déjà actée). Cette liste sert uniquement à
    // renvoyer au client la correspondance numero_ordre → documentId, pour
    // qu'il rattache chaque photo à la BONNE ligne sans nouvel aller-retour.
    const ciblesPhotos = [];

    const config = SIGNATURE_ROLES[roleKey];

    // --- Double signature interdite ------------------------------------------
    if (entree[config.flag] === true) {
      return forbid(ctx, 'Cette signature a déjà été enregistrée et ne peut pas être modifiée.', 409);
    }

    // --- Ordre du workflow : les signatures précédentes doivent exister ------
    for (const [autreRole, autreConfig] of Object.entries(SIGNATURE_ROLES)) {
      if (autreConfig.order < config.order && entree[autreConfig.flag] !== true) {
        return badRequest(
          ctx,
          `Workflow respecté : la signature ${autreRole.replace(/_/g, ' ')} doit être apposée avant celle-ci.`
        );
      }
    }

    // --- Étape 2 : contrôle par article groupé avec la signature -------------
    // Le flux « Arrivée matériel » envoie la signature chef_service_1 ET le
    // détail du contrôle (etat/conforme/observations par ligne) en UN SEUL
    // appel : les lignes sont mises à jour AVANT de poser la signature
    // (tout ou rien — jamais un état intermédiaire incohérent). Sans
    // `controles` dans le corps, comportement historique inchangé
    // (MovementDetailModal / circuit EntriesPage-NewEntryPage).
    if (roleKey === 'chef_service_1' && Array.isArray(body.controles)) {
      const ETATS_VALIDES = ['neuf', 'bon', 'moyen', 'defaillant'];
      const lignes = entree.lignes || [];
      const manquants = [];
      const misesAJour = [];
      for (const ligne of lignes) {
        const controle = body.controles.find(
          (c) => Number(c && c.numero_ordre) === Number(ligne.numero_ordre)
        );
        const etatValide = controle && ETATS_VALIDES.includes(controle.etat);
        if (!etatValide || typeof controle.conforme !== 'boolean') {
          manquants.push(ligne.designation || `Ligne ${ligne.numero_ordre}`);
          continue;
        }
        misesAJour.push({
          documentId: ligne.documentId,
          etat: controle.etat,
          conforme: controle.conforme,
          observations:
            typeof controle.observations === 'string' && controle.observations.trim()
              ? controle.observations.trim()
              : null,
        });
        ciblesPhotos.push({
          numero_ordre: Number(ligne.numero_ordre),
          documentId: ligne.documentId,
          designation: ligne.designation || null,
        });
      }
      // Pas de valeur par défaut silencieuse : toute ligne sans etat/conforme
      // explicites refuse la signature entière.
      if (manquants.length > 0) {
        return badRequest(
          ctx,
          `Contrôle incomplet : il manque l'état de ${manquants.length} article(s) — ${manquants.join(', ')}.`
        );
      }
      try {
        for (const maj of misesAJour) {
          const data = { etat: maj.etat, conforme: maj.conforme };
          if (maj.observations) data.observations = maj.observations;
          await app.documents(LIGNE_UID).update({ documentId: maj.documentId, data });
        }
      } catch (e) {
        return badRequest(
          ctx,
          `Mise à jour du contrôle impossible : ${e.message}. Signature non posée.`
        );
      }
    }

    // --- Pose de la signature -------------------------------------------------
    // Décision 1 : la première signature de chaque rôle fixe son affectation
    // (une signature ne pouvant jamais être reposée, premier = unique).
    const signataire = user.username || user.email || `Utilisateur #${user.id}`;
    await app.documents(ENTREE_UID).update({
      documentId,
      data: {
        [config.flag]: true,
        [config.signerField]: signataire,
        [config.dateField]: new Date().toISOString(),
        [config.affectationField]: entree[config.affectationField] || signataire,
      },
    });

    // Recalcul du nombre de signatures
    const apres = await loadEntree(app, documentId);
    const nbSignatures = Object.values(SIGNATURE_ROLES).filter((c) => apres[c.flag] === true).length;

    let statutFinal = 'en_attente';
    if (nbSignatures === 3) {
      // Validation finale UNIQUEMENT ici (3/3) puis impact stock unique
      await app.documents(ENTREE_UID).update({ documentId, data: { statut: 'validee' } });
      statutFinal = 'validee';
      await appliquerImpactStock(app, { ...apres, documentId }, signataire);
    } else {
      // Signatures partielles (1/3 ou 2/3) : le statut passe à « verifiee »
      // dès la 1ʳᵉ signature (lacune préexistante : la valeur n'était calculée
      // que pour la réponse, jamais persistée — les GET ultérieurs renvoyaient
      // « en_attente »).
      await app.documents(ENTREE_UID).update({ documentId, data: { statut: 'verifiee' } });
      statutFinal = 'verifiee';
    }

    await tracerMouvement(
      app,
      apres,
      `Signature ${roleKey.replace(/_/g, ' ')}`,
      statutFinal,
      nbSignatures === 3 ? 'Entrée validée : les 3 signatures sont réunies. Stock mis à jour.' : null,
      signataire
    );

    const finale = await loadEntree(app, documentId);
    return {
      data: finale,
      meta: {
        signatures: nbSignatures,
        statut: statutFinal,
        // Cibles d'upload des photos (étape 2) : le client y joint ses Data
        // URLs via /api/upload APRÈS cette réponse — la signature est déjà
        // enregistrée, un échec d'envoi n'a donc aucun effet sur elle.
        lignesPhotos: ciblesPhotos,
      },
    };
  },

  /**
   * POST /api/entrees/:documentId/reject
   * Rejet d'une entrée par un responsable habilité (jamais un Demandeur).
   */
  async reject(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;

    if (!user) {
      return forbid(ctx, 'Authentification requise.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas de rejeter une entrée.");
    }

    const entree = await loadEntree(app, documentId);
    if (!entree) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Entrée introuvable.' } };
      return ctx.body;
    }
    if (entree.statut === 'validee') {
      return badRequest(ctx, 'Une entrée validée ne peut plus être rejetée.');
    }
    // Déjà rejetée : erreur explicite plutôt qu'un succès silencieux (le
    // mouvement et l'horodatage ne doivent pas être réécrits).
    if (entree.statut === 'rejetee') {
      return badRequest(ctx, 'Cette entrée a déjà été rejetée.');
    }

    await app.documents(ENTREE_UID).update({ documentId, data: { statut: 'rejetee' } });
    await tracerMouvement(
      app,
      entree,
      'Entrée rejetée',
      'rejetee',
      null,
      (user.username || user.email || '')
    );

    const finale = await loadEntree(app, documentId);
    return { data: finale };
  },
});
