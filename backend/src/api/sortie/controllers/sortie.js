'use strict';

/**
 * sortie controller
 *
 * Endpoints custom (circuit de sortie, même modèle que les entrées) :
 *   POST /api/sorties/create-complete    création complète (entête + lignes)
 *   POST /api/sorties/:documentId/sign   signature contrôlée par rôle
 *   POST /api/sorties/:documentId/reject rejet par un habilité
 *
 * Circuit cible (ordre strict) : magasinier → dépositaire comptable →
 * chef logistique. À l'étape 4, la 3ᵉ signature (logistique) valide la
 * sortie et DÉBITE le stock, en une seule transaction de base de données :
 * validation, baisse des stocks et mouvements réussissent ensemble ou
 * échouent ensemble — aucun état intermédiaire n'est jamais visible.
 * Le statut reste « en_preparation » après les signatures 1 et 2 ; il passe
 * à « validee » uniquement à la 3ᵉ signature.
 *
 * Contrôles effectués ICI, côté serveur (le frontend n'est jamais une
 * source de sécurité) :
 *   - le rôle connecté doit correspondre à la signature demandée ;
 *   - l'ordre du workflow est respecté (1 puis 2 puis 3) ;
 *   - une signature enregistrée n'est jamais modifiable (409) ;
 *   - le Demandeur ne signe ni ne rejette jamais.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const {
  guardedCoreController,
  getRoleCode,
  DEMANDEUR_ROLE,
} = require('../../../utils/roleGuard');
const {
  filtreAppropriation,
  verifierAccesSortie,
} = require('../../../utils/sortieAcces');

const SORTIE_UID = 'api::sortie.sortie';
const SORTIE_LIGNE_UID = 'api::sortie-ligne.sortie-ligne';
const MATERIEL_UID = 'api::material.material';
const MOUVEMENT_UID = 'api::mouvement.mouvement';

/** Noms des tables SQL (collectionName des schémas) : utilisés par le SQL
 *  conditionnel ATOMIQUE de la validation (verrou stock_impacte et
 *  décrémentations du stock, dans la transaction). */
const TABLE_SORTIES = 'sorties';
const TABLE_MATERIALS = 'materials';

/**
 * Rôle autorisé pour signer. Correspondance entre les rôles Strapi et les
 * signataires réglementaires du circuit de sortie :
 *   magasinier   -> MAGASINIER (et admin) — ordre 1
 *   depositaire  -> DEPOSITAIRE (et admin) — ordre 2
 *   logistique   -> LOGISTIQUE (et admin) — ordre 3 (bientôt, refusé à l'étape 3)
 */
const SIGNATURE_ROLES = {
  magasinier: {
    flag: 'magasinier_signed',
    dateField: 'date_signature_magasinier',
    signerField: 'signataire_magasinier',
    roles: ['magasinier'],
    order: 1,
  },
  depositaire: {
    flag: 'depositaire_signed',
    dateField: 'date_signature_depositaire',
    signerField: 'signataire_depositaire',
    roles: ['depositaire'],
    order: 2,
  },
  logistique: {
    flag: 'logistique_signed',
    dateField: 'date_signature_logistique',
    signerField: 'signataire_logistique',
    roles: ['logistique'],
    order: 3,
  },
};

const ETATS_VALIDES = ['neuf', 'bon', 'moyen', 'defaillant'];

/** Erreur métier levée DANS la transaction de validation : le rollback est
 *  déclenché par strapi.db.transaction (tout est annulé), puis l'erreur est
 *  convertie en réponse 400/409/500 hors de la transaction. */
class ErreurTransaction extends Error {
  constructor(statusTransaction, message) {
    super(message);
    this.name = 'ErreurTransaction';
    this.statusTransaction = statusTransaction;
  }
}

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

function erreurInterne(ctx, message) {
  ctx.status = 500;
  ctx.body = { error: { status: 500, name: 'ApplicationError', message } };
  return ctx.body;
}

async function isDemandeurSession(strapi, ctx) {
  const user = ctx.state && ctx.state.user;
  if (!user || !user.id) return false;
  const code = await getRoleCode(strapi, user.id);
  return code === DEMANDEUR_ROLE;
}

function withAppropriationFilter(ctx, documentIds) {
  ctx.query.filters = filtreAppropriation(ctx.query.filters, documentIds || []);
}

function baseHandler(ctrl, nom, ctx) {
  const base = Object.getPrototypeOf(ctrl);
  const handler = base && base[nom];
  if (typeof handler !== 'function') {
    throw new Error(`Handler core « ${nom} » introuvable sur ${SORTIE_UID}.`);
  }
  return handler.call(ctrl, ctx);
}

/** documentId des sorties créées par cet utilisateur (via SA demande). */
async function documentIdsPossedesPar(strapi, user) {
  const rows = await strapi.documents(SORTIE_UID).findMany({
    filters: {
      demande: {
        demandeur: {
          documentId: user.documentId,
        },
      },
    },
    fields: ['documentId'],
    limit: -1,
  });
  return (rows || []).map((l) => l.documentId);
}

/** Sortie peuplée : lignes (avec leur matériel) + données d'en-tête. */
async function loadSortie(strapi, documentId) {
  return strapi.documents(SORTIE_UID).findOne({
    documentId,
    populate: {
      lignes: { populate: ['materiel'] },
      direction: true,
      service: true,
      demande: true,
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

/** Nom de l'utilisateur (signataire / auteur d'un mouvement). */
function nomUtilisateur(user) {
  return (
    (user && (user.username || user.email)) ||
    (user && `Utilisateur #${user.id}`) ||
    ''
  );
}

/** Trace l'action dans la table `mouvements` (historique non modifiable).
 *  Un échec de traçage n'annule JAMAIS l'action métier déjà effectuée. */
async function tracerMouvementSortie(app, sortie, action, statut, observations, utilisateur = '') {
  try {
    await app.documents(MOUVEMENT_UID).create({
      data: {
        reference: sortie.reference,
        type: 'sortie',
        date_mouvement: new Date().toISOString().slice(0, 10),
        utilisateur,
        action,
        materiel: (sortie.lignes || [])
          .map((l) => l.designation)
          .filter(Boolean)
          .join(', ') || '—',
        quantite: (sortie.lignes || []).reduce((sum, l) => sum + (Number(l.quantite) || 0), 0),
        statut,
        sortie: sortie.documentId,
        observations,
      },
    });
  } catch (e) {
    app.log.warn(`[sortie] Historique non tracé : ${e.message}`);
  }
}

/**
 * Aux signatures 1 et 2, vérifie que chaque ligne reste couverte par le
 * stock ACTUEL du matériel (la baisse définitive a lieu à l'étape 4, avec
 * une vérification atomique ; ici il s'agit d'alerter avant de signer).
 * Retourne un message d'erreur (nom du matériel + quantités) ou null.
 */
async function verifierStockDisponible(app, sortie) {
  for (const ligne of sortie.lignes || []) {
    const materiel = ligne.materiel;
    if (!materiel) continue; // ligne sans matériel relié : rien à couvrir
    const quantiteStock = Number(materiel.quantite_stock) || 0;
    const quantiteDemandee = Number(ligne.quantite) || 0;
    if (quantiteDemandee > quantiteStock) {
      return (
        `Stock insuffisant pour « ${materiel.designation || materiel.documentId} » : ` +
        `quantité demandée ${quantiteDemandee}, quantité en stock ${quantiteStock}.`
      );
    }
  }
  return null;
}

/**
 * ÉTAPE 4 — signature du chef logistique : validation finale + baisse du stock.
 *
 * Tout se déroule dans UNE transaction (strapi.db.transaction, liaisons
 * automatiques par AsyncLocalStorage vérifiées dans @strapi/database) :
 *   1. réception de toutes les pénuries EN LECTURE SEULE dans la transaction :
 *      pour chaque matériel, lecture de quantite_stock actuelle ; si quantite
 *      demandée > stock, la ligne est inscrite dans la liste des insuffisances ;
 *      si la liste n'est pas vide, 409 avec toutes les lignes listées, AUCUNE
 *      décrémentation, ROLLBACK avec le stock intact.
 *   2. verrou anti-double exécution : UPDATE conditionnel
 *      sorties.stock_impacte false->true (0 ligne modifiée => 409) ;
 *   3. décrémentations ATOMIQUES du stock :
 *      UPDATE materials SET quantite_stock = quantite_stock - X
 *      WHERE document_id = ? AND quantite_stock >= X
 *      (0 ligne modifiée => 409, nom du matériel + quantités, rollback) ;
 *      NOTE : si une concurrence a passé entre la lecture et la décrémentation,
 *      la décrémentation peut échouer même si la lecture est passée — dans ce
 *      cas on annule avec la ligne fautive (même principe : rollback complet).
 *   4. numeros_logistiques sur les lignes (texte enregistré TEL QUEL, jamais
 *      généré, jamais de format imposé, 100 caractères maximum) ;
 *   5. signature logistique + statut validee + date ISO posée par le serveur ;
 *   6. mouvements : un mouvement « Sortie validée, stock débité » PAR ligne
 *      + un mouvement « Signature logistique ».
 * Un échec de traçage constitue un échec de validation : la transaction est
 * annulée (une sortie sans trace ne doit pas exister).
 */
async function signerLogistique(app, ctx, sortie, documentId, user, body) {
  const lignes = sortie.lignes || [];

  // --- Ligne sans fiche matériel : refus AVANT la transaction (400) ----------
  // La décrémentation atomique cible la fiche par documentId : sans fiche,
  // rien ne peut être débité de manière fiable.
  const sansFiche = lignes.filter((l) => !l.materiel || !l.materiel.documentId);
  if (sansFiche.length > 0) {
    return badRequest(
      ctx,
      `Validation impossible : ${sansFiche.length} ligne(s) sans fiche matériel — ${sansFiche
        .map((l) => l.designation || `Ligne ${l.documentId}`)
        .join(', ')}. Une sortie ne peut pas être validée sans fiche matériel.`
    );
  }

  // --- numeros_logistiques facultatifs : { ligne, numero_logistique } --------
  const numeros = Array.isArray(body.numeros_logistiques)
    ? body.numeros_logistiques
    : [];
  const numerosParLigne = new Map();
  for (const element of numeros) {
    if (!element || typeof element.ligne !== 'string' || !element.ligne) {
      return badRequest(
        ctx,
        'numeros_logistiques : chaque élément doit contenir { ligne, numero_logistique }.'
      );
    }
    if (
      typeof element.numero_logistique !== 'string' ||
      element.numero_logistique.length === 0 ||
      element.numero_logistique.length > 100
    ) {
      return badRequest(
        ctx,
        'numeros_logistiques : numero_logistique obligatoire (texte de 100 caractères maximum).'
      );
    }
    if (!lignes.some((l) => l.documentId === element.ligne)) {
      return badRequest(
        ctx,
        `La ligne ${element.ligne} ne fait pas partie de cette sortie.`
      );
    }
    numerosParLigne.set(element.ligne, element.numero_logistique);
  }

  // --- Eléments des mouvements (recalculés côté serveur, jamais du client) --
  const signataire = nomUtilisateur(user);
  const maintenant = new Date().toISOString();
  const jour = maintenant.slice(0, 10);
  const totalQuantite = lignes.reduce(
    (s, l) => s + (Number(l.quantite) || 0),
    0
  );

  // Valide les décrémentations et EXIGE le traçage : les exceptions ci
  // dessous (ErreurTransaction ou erreur brute) annulent TOUT.
  try {
    await app.db.transaction(async ({ trx }) => {
      // 1) Réception de toutes les pénuries AVANT toute écriture.
      //    Lis chaque stock, collecte les insuffisances ; si au moins une
      //    pénurie existe, annule immédiatement avec la liste complète.
      const insuffisances = [];
      for (const ligne of lignes) {
        const materielId = ligne.materiel.documentId;
        const courant = await trx(TABLE_MATERIALS)
          .where({ document_id: materielId })
          .first('quantite_stock');
        const stock = courant ? Number(courant.quantite_stock) || 0 : 0;
        const demande = Number(ligne.quantite) || 0;
        if (demande > stock) {
          insuffisances.push({
            materiel: ligne.materiel.designation || ligne.designation || materielId,
            demande,
            stock,
            materielId,
          });
        }
      }
      if (insuffisances.length > 0) {
        const message = insuffisances
          .map(
            (inv) =>
              `Stock insuffisant pour « ${inv.materiel} » : quantité demandée ${inv.demande}, quantité disponible ${inv.stock}.`
          )
          .join(' ');
        throw new ErreurTransaction(409, message);
      }

      // 2) Verrou anti-double exécution : false -> true, conditionnel.
      const nbVerrou = await trx(TABLE_SORTIES)
        .where({ document_id: documentId, stock_impacte: false })
        .update({ stock_impacte: true });
      if (!nbVerrou) {
        throw new ErreurTransaction(
          409,
          'Cette sortie a déjà été validée : le stock a déjà été débité une seule fois.'
        );
      }

      // 3) Décrémentations atomiques (ordre stable par fiche matériel pour
      //    limiter les verrous croisés entre sorties concurrentes).
      const lignesTriees = [...lignes].sort((a, b) =>
        a.materiel.documentId < b.materiel.documentId ? -1 : 1
      );
      for (const ligne of lignesTriees) {
        const quantite = Number(ligne.quantite) || 0;
        const nbDecrement = await trx(TABLE_MATERIALS)
          .where({ document_id: ligne.materiel.documentId })
          .where('quantite_stock', '>=', quantite)
          .decrement('quantite_stock', quantite);
        if (!nbDecrement) {
          const courant = await trx(TABLE_MATERIALS)
            .where({ document_id: ligne.materiel.documentId })
            .first('quantite_stock');
          throw new ErreurTransaction(
            409,
            `Stock insuffisant pour « ${
              ligne.materiel.designation || ligne.designation || ligne.materiel.documentId
            } » : quantité demandée ${quantite}, quantité disponible ${
              courant ? Number(courant.quantite_stock) || 0 : 0
            }. Aucune modification enregistrée.`
          );
        }
      }

      // 4) numeros_logistiques (seule écriture demandée au client : un texte,
      //    enregistré tel quel — jamais généré, jamais de format imposé).
      for (const [ligneId, numero] of numerosParLigne) {
        await app.documents(SORTIE_LIGNE_UID).update({
          documentId: ligneId,
          data: { numero_logistique: numero },
        });
      }

      // 5) Signature logistique + validation (date ISO serveur = date de
      //    validation pour le Journal).
      await app.documents(SORTIE_UID).update({
        documentId,
        data: {
          logistique_signed: true,
          signataire_logistique: signataire,
          date_signature_logistique: maintenant,
          stock_impacte: true,
          statut: 'validee',
        },
      });

      // 6) Mouvements, dans la même transaction — UN PAR ligne + signature.
      //    SANS try/catch avalant : un échec de traçage annule toute la
      //    validation (throw = rollback automatique).
      for (const ligne of lignes) {
        await app.documents(MOUVEMENT_UID).create({
          data: {
            reference: sortie.reference,
            type: 'sortie',
            date_mouvement: jour,
            utilisateur: signataire,
            action: 'Sortie validée, stock débité',
            materiel:
              ligne.materiel.designation ||
              ligne.designation ||
              ligne.materiel.documentId,
            quantite: Number(ligne.quantite) || 0,
            statut: 'validee',
            sortie: documentId,
            observations:
              ligne.materiel.documentId === ligne.designation
                ? null
                : `Fiche matériel : ${ligne.materiel.documentId}`,
          },
        });
      }
      await app.documents(MOUVEMENT_UID).create({
        data: {
          reference: sortie.reference,
          type: 'sortie',
          date_mouvement: jour,
          utilisateur: signataire,
          action: 'Signature logistique',
          materiel:
            lignes
              .map((l) => l.materiel.designation || l.designation)
              .filter(Boolean)
              .join(', ') || '—',
          quantite: totalQuantite,
          statut: 'validee',
          sortie: documentId,
          observations:
            `Sortie validée par le chef logistique : stock débité (${lignes.length} ligne(s)).`,
        },
      });
    });
  } catch (e) {
    // La transaction a été annulée par strapi.db.transaction : ni stock, ni
    // signature, ni mouvement ne subsistent.
    if (e instanceof ErreurTransaction) {
      if (e.statusTransaction === 409) return forbid(ctx, e.message, 409);
      return badRequest(ctx, e.message);
    }
    app.log.warn(`[sortie] Validation annulée (tout est annulé) : ${e.message}`);
    return erreurInterne(
      ctx,
      `Validation impossible (tout a été annulé) : ${e.message}`
    );
  }

  const finale = await loadSortie(app, documentId);
  return {
    data: finale,
    meta: {
      signatures: 3,
      statut: 'validee',
      date_validation: maintenant,
    },
  };
}

module.exports = guardedCoreController(createCoreController, SORTIE_UID, {
  /**
   * GET /api/sorties
   * Le Demandeur ne voit que SES sorties (via SA demande) ; le filtre client
   * ne peut que restreindre le résultat. Les autres rôles lisent tout.
   */
  async find(ctx) {
    const app = strapi;
    if (await isDemandeurSession(app, ctx)) {
      const miens = await documentIdsPossedesPar(app, ctx.state.user);
      withAppropriationFilter(ctx, miens);
    }
    return baseHandler(this, 'find', ctx);
  },

  /**
   * GET /api/sorties/:id
   * Même règle, appliquée à la sortie visée (404, jamais 403).
   */
  async findOne(ctx) {
    const app = strapi;
    if (await isDemandeurSession(app, ctx)) {
      const documentId = ctx.params.id || ctx.params.documentId;
      const miens = await documentIdsPossedesPar(app, ctx.state.user);
      const refus = verifierAccesSortie(ctx, documentId, miens);
      if (refus) return refus;
    }
    return baseHandler(this, 'findOne', ctx);
  },

  /**
   * POST /api/sorties/create-complete (étape 2 du circuit)
   * Création complète d'un ordre de sortie : entête + lignes de matériel.
   * Réservé au profil « dépositaire » (contrôlé ICI, la permission ne couvre
   * que l'accès à la route). La sortie démarre TOUJOURS « en_preparation » :
   * impossible de fabriquer une sortie déjà signée ou déjà validée, et le
   * stock n'est PAS touché à la création.
   */
  async createComplete(ctx) {
    const app = strapi;
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour créer une sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();
    if (code !== 'depositaire' && code !== 'admin') {
      return forbid(ctx, "Seul le dépositaire peut créer un ordre de sortie.");
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Validation des champs obligatoires --------------------------------
    if (!body.date_sortie) {
      return badRequest(ctx, 'Date de sortie obligatoire.');
    }
    const lignes = Array.isArray(body.lignes) ? body.lignes : [];
    if (lignes.length === 0) {
      return badRequest(ctx, 'Au moins un matériel est requis.');
    }
    for (const ligne of lignes) {
      const quantite = Number(ligne.quantite);
      if (!Number.isFinite(quantite) || quantite <= 0 || !Number.isInteger(quantite)) {
        return badRequest(ctx, 'Quantité invalide : elle doit être un entier supérieur à 0.');
      }
      if (typeof ligne.observations === 'string') {
        ligne.observations = ligne.observations.trim() || null;
      }
    }

    // --- Résolution du matériel de chaque ligne (avant toute création) -----
    // Toutes les lignes sont validées AVANT de créer quoi que ce soit :
    // aucune sortie partielle.
    const materielResolus = [];
    for (const ligne of lignes) {
      let materiel = null;
      if (ligne.materiel_id) {
        try {
          materiel = await app.documents(MATERIEL_UID).findOne({
            documentId: ligne.materiel_id,
          });
        } catch (e) {
          materiel = null;
        }
        if (!materiel) {
          return badRequest(
            ctx,
            `Matériel introuvable pour la ligne « ${ligne.designation || ligne.materiel_id} ».`
          );
        }
      } else if (ligne.designation && String(ligne.designation).trim()) {
        materiel = await findMaterielByDesignation(app, ligne.designation);
      }
      if (!materiel) {
        return badRequest(
          ctx,
          'Matériel obligatoire : fournissez materiel_id ou designation pour chaque ligne.'
        );
      }
      materielResolus.push(materiel);
    }

    // --- Génération automatique de la référence SOR-AAAA-NNN ---------------
    let reference = body.reference;
    if (!reference) {
      const annee = new Date(body.date_sortie).getFullYear();
      const prefixe = `SOR-${annee}-`;
      const existantes = await app.documents(SORTIE_UID).findMany({
        filters: { reference: { $startsWith: prefixe } },
        limit: -1,
      });
      const numeros = (existantes || [])
        .map((row) => Number((row.reference || '').slice(prefixe.length)))
        .filter((n) => Number.isFinite(n));
      const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
      reference = `${prefixe}${String(suivant).padStart(3, '0')}`;
    }

    // --- Création de la sortie (statut initial : en_preparation) -----------
    let sortie;
    try {
      sortie = await app.documents(SORTIE_UID).create({
        data: {
          reference,
          date_sortie: body.date_sortie,
          statut: 'en_preparation',
          direction: body.direction_id || body.direction || null,
          service: body.service_id || body.service || null,
          demande: body.demande_id || body.demande || null,
          beneficiaire: body.beneficiaire || null,
          responsable: body.responsable || null,
          justificatif: body.justificatif || null,
          observations: body.observations || null,
        },
      });
    } catch (e) {
      return badRequest(ctx, `Création impossible : ${e.message}`);
    }

    // --- Création des lignes -------------------------------------------------
    for (let i = 0; i < lignes.length; i += 1) {
      const ligne = lignes[i];
      try {
        await app.documents(SORTIE_LIGNE_UID).create({
          data: {
            sortie: sortie.documentId,
            materiel: materielResolus[i].documentId,
            designation: ligne.designation || null,
            quantite: Number(ligne.quantite),
            valeur_unitaire:
              Number.isFinite(Number(ligne.valeur_unitaire)) && ligne.valeur_unitaire !== undefined && ligne.valeur_unitaire !== null && ligne.valeur_unitaire !== ''
                ? Number(ligne.valeur_unitaire)
                : null,
            observations: ligne.observations || null,
          },
        });
      } catch (e) {
        app.log.warn(`[sortie] Ligne ${i + 1} non créée : ${e.message}`);
      }
    }

    const sortieComplete = await loadSortie(app, sortie.documentId);
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

  /**
   * POST /api/sorties/:documentId/sign (étape 3 du circuit)
   * Corpus : { role: 'magasinier' | 'depositaire' | 'logistique', controles? }
   * - rôle connecté correspondant (contrôle serveur, 403 sinon) ;
   * - statut « en_preparation » obligatoire (400 sinon) ;
   * - ordre strict : 1 (magasinier) puis 2 (dépositaire) — 400 en nommant la
   *   signature manquante, 409 en cas de double signature ;
   * - « logistique » : refusé à l'étape 3 (signature du chef logistique à
   *   l'étape suivante, avec la baisse du stock) ;
   * - signature 1 (magasinier) : `controles` obligatoire — un élément par
   *   ligne { ligne, etat, observations? }, enregistrés DANS LE MÊME appel
   *   que la signature (jamais d'état intermédiaire incohérent) ;
   * - signature 2 (dépositaire) : aucun `controles` ; signe même si une
   *   ligne est defaillant ;
   * - aux deux signatures, chaque quantité doit rester couverte par le stock
   *   actuel du matériel (409, sans rien modifier) ;
   * - le nom du signataire et la date-heure ISO sont posés SEULS par le
   *   serveur, et le statut reste « en_preparation ».
   */
  async sign(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const roleKey = body.role;

    if (!SIGNATURE_ROLES[roleKey]) {
      return badRequest(ctx, "Rôle de signature inconnu (magasinier, depositaire, logistique).");
    }

    // --- Contrôle du rôle connecté ------------------------------------------
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour signer une sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    // Le Demandeur ne signe jamais (garde-fou redondant avec roleGuard.js).
    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas de signer une sortie.");
    }

    const config = SIGNATURE_ROLES[roleKey];
    const estAdmin = code === 'admin';
    if (!estAdmin && !config.roles.includes(code)) {
      return forbid(
        ctx,
        `Votre rôle ne permet pas d'apposer la signature « ${roleKey.replace(/_/g, ' ')} ».`
      );
    }

    const sortie = await loadSortie(app, documentId);
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // --- Statut obligatoire : en_preparation ---------------------------------
    if (sortie.statut !== 'en_preparation') {
      return badRequest(
        ctx,
        `La signature n'est possible que pour une sortie « en_preparation » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    // --- Double signature interdite -------------------------------------------
    if (sortie[config.flag] === true) {
      return forbid(ctx, 'Cette signature a déjà été enregistrée et ne peut pas être modifiée.', 409);
    }

    // --- Ordre strict du workflow (TOUTES les signatures précédentes) --------
    // Pour la 3ᵉ signature, magasinier (1) ET dépositaire (2) doivent avoir
    // signé : le message nomme la première signature manquante.
    const precedents = Object.values(SIGNATURE_ROLES)
      .filter((c) => c.order < config.order)
      .sort((a, b) => a.order - b.order);
    for (const precedent of precedents) {
      if (sortie[precedent.flag] !== true) {
        return badRequest(
          ctx,
          `Signature manquante : la signature « ${precedent.signerField.replace('signataire_', '')} » doit être apposée avant celle-ci.`
        );
      }
    }

    // --- Étape 4 : la signature du chef logistique valide et débite le stock ----
    if (roleKey === 'logistique') {
      return await signerLogistique(app, ctx, sortie, documentId, user, body);
    }

    // --- Signature 1 (magasinier) : contrôle par ligne, OBLIGATOIRE -----------
    //Les lignes sont mises à jour AVANT de poser la signature (tout ou rien —
    // jamais un état intermédiaire incohérent).
    if (roleKey === 'magasinier') {
      const controles = body.controles;
      if (!Array.isArray(controles) || controles.length === 0) {
        return badRequest(
          ctx,
          'Contrôles obligatoires : un élément { ligne, etat, observations? } par ligne de la sortie.'
        );
      }
      const lignes = sortie.lignes || [];
      const parLigne = new Map();
      for (const c of controles) {
        if (c && c.ligne) parLigne.set(c.ligne, c);
      }

      // a) Chaque ligne de la sortie doit être contrôlée.
      const manquants = [];
      const misesAJour = [];
      for (const ligne of lignes) {
        const controle = parLigne.get(ligne.documentId);
        const etatValide =
          controle && controle.etat && ETATS_VALIDES.includes(controle.etat);
        if (!controle || !etatValide) {
          manquants.push(ligne.designation || `Ligne ${ligne.id || ligne.documentId}`);
          continue;
        }
        misesAJour.push({
          documentId: ligne.documentId,
          etat: controle.etat,
          observations:
            typeof controle.observations === 'string' && controle.observations.trim()
              ? controle.observations.trim()
              : null,
        });
      }
      if (manquants.length > 0) {
        return badRequest(
          ctx,
          `Contrôle incomplet : état invalide (neuf, bon, moyen ou defaillant) ou ligne manquante pour ${manquants.length} article(s) — ${manquants.join(', ')}.`
        );
      }

      // b) Un contrôle doit référencer une ligne DE CETTE sortie (jamais
      //    celle d'une autre) : sans ce garde-fou, journaliola validée depuis
      //    un autre circuit.
      for (const [ligneId] of parLigne) {
        if (!lignes.some((l) => l.documentId === ligneId)) {
          return badRequest(
            ctx,
            `La ligne ${ligneId} ne fait pas partie de cette sortie.`
          );
        }
      }

      // --- Stock actuel : chaque quantité doit rester couverte ----------------
      const insuffisant = await verifierStockDisponible(app, sortie);
      if (insuffisant) {
        // 409 AVANT toute écriture : rien n'est modifié.
        return forbid(ctx, insuffisant, 409);
      }

      // --- Enregistrement du contrôle dans le MÊME appel que la signature ----
      try {
        for (const maj of misesAJour) {
          const data = { etat: maj.etat };
          if (maj.observations) data.observations = maj.observations;
          await app.documents(SORTIE_LIGNE_UID).update({ documentId: maj.documentId, data });
        }
      } catch (e) {
        return badRequest(
          ctx,
          `Mise à jour du contrôle impossible : ${e.message}. Signature non posée.`
        );
      }
    } else {
      // --- Signature 2 (dépositaire) : aucun controles demandé, mais la
      // vérification du stock actuel reste valable (409 sans rien modifier).
      const insuffisant = await verifierStockDisponible(app, sortie);
      if (insuffisant) {
        return forbid(ctx, insuffisant, 409);
      }
    }

    // --- Pose de la signature (nom + date posés SEULS par le serveur) -------
    const signataire = nomUtilisateur(user);
    await app.documents(SORTIE_UID).update({
      documentId,
      data: {
        [config.flag]: true,
        [config.signerField]: signataire,
        [config.dateField]: new Date().toISOString(),
        // La sortie peut être signée même si une ligne est defaillant.
      },
    });

    const apres = await loadSortie(app, documentId);
    const nbSignatures = Object.values(SIGNATURE_ROLES).filter(
      (c) => apres[c.flag] === true
    ).length;

    await tracerMouvementSortie(
      app,
      apres,
      `Signature ${roleKey === 'magasinier' ? 'magasinier' : 'dépositaire'}`,
      'en_preparation',
      null,
      signataire
    );

    return {
      data: apres,
      meta: {
        signatures: nbSignatures,
        statut: 'en_preparation',
      },
    };
  },

  /**
   * POST /api/sorties/:documentId/reject (étape 3 du circuit)
   * Corpus : { motif }
   * - motif obligatoire (non vide) ;
   * - autorisé aux magasinier / dépositaire / logistique uniquement (le
   *   Demandeur ne peut jamais rejeter), sur une sortie « en_preparation »
   *   SEULEMENT : statut -> « annulee », motif_rejet enregistré, aucun effet
   *   sur le stock ;
   * - refuse toute sortie déjà annulée / validée / sortie_effectuee (400).
   */
  async reject(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const user = ctx.state && ctx.state.user;

    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour rejeter une sortie.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    if (code === DEMANDEUR_ROLE) {
      return forbid(ctx, "Votre rôle (Demandeur) ne permet pas de rejeter une sortie.");
    }
    const rolesAutorises = ['magasinier', 'depositaire', 'logistique'];
    if (code !== 'admin' && !rolesAutorises.includes(code)) {
      return forbid(ctx, "Votre rôle ne permet pas de rejeter une sortie.");
    }

    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const motif = typeof body.motif === 'string' ? body.motif.trim() : '';
    if (!motif) {
      return badRequest(ctx, 'Motif de rejet obligatoire (texte non vide).');
    }

    const sortie = await loadSortie(app, documentId);
    if (!sortie) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Sortie introuvable.' } };
      return ctx.body;
    }

    // Déjà rejetée : erreur explicite plutôt qu'un succès silencieux (le
    // mouvement et l'horodatage ne doivent pas être réécrits).
    if (sortie.statut === 'annulee') {
      return badRequest(ctx, 'Cette sortie a déjà été rejetée.');
    }
    if (sortie.statut === 'validee') {
      return badRequest(ctx, 'Une sortie validée ne peut plus être rejetée.');
    }
    if (sortie.statut === 'sortie_effectuee') {
      return badRequest(ctx, 'Une sortie déjà effectuée ne peut pas être rejetée.');
    }
    if (sortie.statut !== 'en_preparation') {
      return badRequest(
        ctx,
        `Le rejet n'est possible que pour une sortie « en_preparation » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    await app.documents(SORTIE_UID).update({
      documentId,
      data: { statut: 'annulee', motif_rejet: motif },
    });

    const finale = await loadSortie(app, documentId);
    await tracerMouvementSortie(
      app,
      finale,
      'Sortie rejetée',
      'annulee',
      motif,
      nomUtilisateur(user)
    );

    return { data: finale };
  },
});
