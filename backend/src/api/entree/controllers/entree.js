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
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController, getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');

const ENTREE_UID = 'api::entree.entree';
const LIGNE_UID = 'api::entree-ligne.entree-ligne';
const MATERIEL_UID = 'api::material.material';
const MOUVEMENT_UID = 'api::mouvement.mouvement';

const SIGNATURE_ROLES = {
  depositaire: { flag: 'depositaire_signed', dateField: 'date_signature_depositaire', signerField: 'signataire_depositaire', order: 1 },
  chef_service_1: { flag: 'chef_service_1_signed', dateField: 'date_signature_chef_service_1', signerField: 'signataire_chef_service_1', order: 2 },
  chef_service_2: { flag: 'chef_service_2_signed', dateField: 'date_signature_chef_service_2', signerField: 'signataire_chef_service_2', order: 3 },
};

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  ctx.body = {
    error: {
      status,
      name: status === 409 ? 'ConflictError' : 'ForbiddenError',
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
  return strapi.documents(ENTREE_UID).findOne({
    documentId,
    populate: ['lignes', 'fournisseur', 'direction', 'service', 'mouvements'],
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
   * POST /api/entrees/create-complete
   * Création complète : entête administrative + lignes matériels.
   * Accessible aux responsables (le Demandeur est bloqué par le roleGuard).
   */
  async createComplete(ctx) {
    const app = strapi;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Validation des champs obligatoires -------------------------------
    // `brouillon: true` : enregistrement partiel autorisé (validation assouplie)
    const estBrouillon = body.brouillon === true;
    if (!estBrouillon) {
      if (!body.fournisseur && !body.fournisseur_id) {
        return badRequest(ctx, 'Fournisseur obligatoire.');
      }
      if (!body.date_entree) {
        return badRequest(ctx, "Date d'entrée obligatoire.");
      }
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

    // --- Création de l'entrée ---------------------------------------------
    let entree;
    try {
      entree = await app.documents(ENTREE_UID).create({
        data: {
          reference,
          date_entree: body.date_entree,
          numero_facture: body.numero_facture || null,
          fournisseur: body.fournisseur_id || body.fournisseur || null,
          direction: body.direction_id || null,
          service: body.service_id || null,
          responsable: body.responsable || null,
          statut: estBrouillon ? 'brouillon' : 'en_attente',
        affectation_depositaire: body.affectation_depositaire || null,
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

    // --- Pose de la signature -------------------------------------------------
    const signataire = user.username || user.email || `Utilisateur #${user.id}`;
    await app.documents(ENTREE_UID).update({
      documentId,
      data: {
        [config.flag]: true,
        [config.signerField]: signataire,
      },
    });

    // Recalcul du nombre de signatures
    const apres = await loadEntree(app, documentId);
    const nbSignatures = Object.values(SIGNATURE_ROLES).filter((c) => apres[c.flag] === true).length;

    let statutFinal = 'verifiee'; // partiellement signée (1/3 ou 2/3)
    if (nbSignatures === 3) {
      // Validation finale UNIQUEMENT ici (3/3) puis impact stock unique
      await app.documents(ENTREE_UID).update({ documentId, data: { statut: 'validee' } });
      statutFinal = 'validee';
      await appliquerImpactStock(app, { ...apres, documentId }, signataire);
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
    return { data: finale, meta: { signatures: nbSignatures, statut: statutFinal } };
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
