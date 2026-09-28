'use strict';

/**
 * affectation controller
 *
 * Endpoints (routes/affectation.js) :
 *   GET  /api/affectations                  lecture publique (find)
 *   GET  /api/affectations/:documentId      lecture publique (findOne)
 *   POST /api/affectations/create-complete  création complète (auth)
 *   POST /api/affectations/:documentId/sign signature contrôlée par rôle (auth)
 *
 * Règle métier stricte : une affectation n'est « validee » QUE si les 4
 * signatures obligatoires sont présentes, dans l'ordre :
 *   1/4 Responsable du transfert (le créateur, ou l'admin)
 *   2/4 Dépositaire
 *   3/4 Chef de service 1
 *   4/4 Chef de service 2
 * Un profil « demandeur » ne peut jamais signer à la place d'un responsable
 * (sauf 1/4 sur SA propre affectation, en tant que créateur). Le contrôle est
 * effectué ICI, côté serveur (roleGuard.js). Une signature déjà posée n'est
 * jamais modifiable (double signature refusée avec 409).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { guardedCoreController, getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');

const AFFECTATION_UID = 'api::affectation.affectation';
const MOUVEMENT_UID = 'api::mouvement.mouvement';


const SIGNATURE_ROLES = {
  responsable_transfert: {
    flag: 'responsable_transfert_signed',
    dateField: 'date_signature_responsable_transfert',
    signerField: 'signataire_responsable_transfert',
    order: 1,
  },
  depositaire: {
    flag: 'depositaire_signed',
    dateField: 'date_signature_depositaire',
    signerField: 'signataire_depositaire',
    order: 2,
  },
  chef_service_1: {
    flag: 'chef_service_1_signed',
    dateField: 'date_signature_chef_service_1',
    signerField: 'signataire_chef_service_1',
    order: 3,
  },
  chef_service_2: {
    flag: 'chef_service_2_signed',
    dateField: 'date_signature_chef_service_2',
    signerField: 'signataire_chef_service_2',
    order: 4,
  },
};

/**
 * Rôles autorisés pour signer `roleKey` (cohérent avec le frontend
 * frontend/src/lib/affectations.ts -> peutValiderAffectation) :
 *   responsable_transfert -> le CRÉATEUR de l'affectation (ou admin)
 *   depositaire           -> depositaire (ou admin)
 *   chef_service_1        -> magasinier (ou admin)
 *   chef_service_2        -> logistique (ou admin)
 */
const ROLE_FOR_SIGNATURE = {
  depositaire: ['depositaire'],
  chef_service_1: ['magasinier'],
  chef_service_2: ['logistique'],
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

/** Token unique pour le QR Code de l'affectation (aucune donnée sensible). */
function genererQrToken() {
  return `AFF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

async function loadAffectation(strapi, documentId) {
  return strapi.documents(AFFECTATION_UID).findOne({ documentId });
}

/**
 * Le Demandeur ne signe jamais une validation « responsable » ; il peut
 * seulement apposer la 1/4 sur SA PROPRE affectation (en tant que créateur).
 */
async function peutSignerResponsableTransfert(strapi, ctx, affectation) {
  const user = ctx.state && ctx.state.user;
  if (!user) return false;
  const code = (await getRoleCode(strapi, user.id)).toLowerCase();
  if (code === 'admin') return true;
  if (code === DEMANDEUR_ROLE) {
    const estCreateur =
      (!!user.username && user.username === affectation.createur) ||
      (!!user.email && user.email === affectation.createur_email);
    return estCreateur;
  }
  return false;
}

/** Trace l'action dans la table `mouvements` (historique non modifiable). */
async function tracerMouvement(strapi, affectation, action, statut, observations, utilisateur = '') {
  try {
    await strapi.documents(MOUVEMENT_UID).create({
      data: {
        reference: affectation.reference,
        type: 'sortie', // le mouvement n'a pas de type « affectation » : tracé comme sortie interne
        date_mouvement: new Date().toISOString().slice(0, 10),
        utilisateur,
        action,
        materiel: affectation.materiel || '—',
        quantite: Number(affectation.quantite) || 0,
        statut,
        observations:
          observations ||
          `Affectation interne ${affectation.service_source || '—'} → ${
            affectation.service_destinataire || '—'
          } (Direction ${affectation.direction || '—'})`,
      },
    });
  } catch (e) {
    strapi.log.warn(`[affectation] Historique non tracé : ${e.message}`);
  }
}

// `find` / `findOne` sont hérités du contrôleur core (routes en `auth: false`,
// comme direction / service) : seuls les endpoints custom sont définis ici.
module.exports = guardedCoreController(createCoreController, AFFECTATION_UID, {
  /**
   * POST /api/affectations/create-complete
   * Création d'une affectation (réaffectation interne d'un matériel déjà
   * enregistré, entre deux services d'une même Direction). Pas de sortie,
   * pas de nouvelle entrée : seule la destination du matériel change.
   * Les drapeaux de signature sont TOUJOURS initialisés à false : impossible
   * de fabriquer une affectation déjà validée.
   */
  async createComplete(ctx) {
    const app = strapi;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Validation des champs obligatoires --------------------------------
    if (!body.direction) return badRequest(ctx, 'Direction obligatoire.');
    if (!body.service_source) return badRequest(ctx, 'Service source obligatoire.');
    if (!body.service_destinataire) return badRequest(ctx, 'Service destinataire obligatoire.');
    if (!body.materiel) return badRequest(ctx, 'Matériel obligatoire.');
    const quantite = Number(body.quantite);
    if (!Number.isFinite(quantite) || quantite <= 0) {
      return badRequest(ctx, 'Quantité invalide : elle doit être supérieure à 0.');
    }
    if (
      (body.service_source || '').trim().toLowerCase() ===
      (body.service_destinataire || '').trim().toLowerCase()
    ) {
      return badRequest(
        ctx,
        'Le service source et le service destinataire doivent être différents (même service = aucune affectation).'
      );
    }
    if (!body.responsable_transfert) {
      return badRequest(ctx, 'Veuillez indiquer le Responsable du transfert.');
    }
    if (!body.depositaire) {
      return badRequest(ctx, 'Veuillez indiquer le Dépositaire.');
    }

    // --- Génération automatique de la référence AFF-AAAA-NNN ---------------
    let reference = body.reference;
    if (!reference) {
      const annee = new Date(body.date || Date.now()).getFullYear();
      const prefixe = `AFF-${annee}-`;
      const existantes = await app.documents(AFFECTATION_UID).findMany({
        filters: { reference: { $startsWith: prefixe } },
        limit: -1,
      });
      const numeros = (existantes || [])
        .map((row) => Number((row.reference || '').slice(prefixe.length)))
        .filter((n) => Number.isFinite(n));
      const suivant = (numeros.length ? Math.max(...numeros) : 0) + 1;
      reference = `${prefixe}${String(suivant).padStart(3, '0')}`;
    }

    const createur =
      (ctx.state && ctx.state.user && (ctx.state.user.username || ctx.state.user.email)) ||
      body.createur ||
      '';

    // --- Création (signatures toujours à false) ------------------------------
    let affectation;
    try {
      affectation = await app.documents(AFFECTATION_UID).create({
        data: {
          reference,
          date: body.date || new Date().toISOString().slice(0, 10),
          direction: body.direction || null,
          service_source: body.service_source || null,
          service_destinataire: body.service_destinataire || null,
          materiel: body.materiel || null,
          materiel_reference: body.materiel_reference || null,
          quantite,
          motif: body.motif || null,
          observation: body.observation || null,
          createur,
          createur_email: body.createur_email || (ctx.state && ctx.state.user && ctx.state.user.email) || null,
          responsable_transfert: body.responsable_transfert || null,
          depositaire: body.depositaire || null,
          chef_service_1: body.chef_service_1 || null,
          chef_service_2: body.chef_service_2 || null,
          responsable_transfert_signed: false,
          depositaire_signed: false,
          chef_service_1_signed: false,
          chef_service_2_signed: false,
          statut: 'en_attente',
          historique: [
            {
              date: new Date().toISOString().slice(0, 10),
              libelle: `Création de l'affectation par ${createur || '—'}`,
            },
          ],
          qr_token: genererQrToken(),
        },
      });
    } catch (e) {
      return badRequest(ctx, `Création impossible : ${e.message}`);
    }

    await tracerMouvement(
      app,
      affectation,
      'Affectation créée',
      'en_attente',
      null,
      createur
    );

    ctx.status = 201;
    return { data: affectation };
  },

  /**
   * POST /api/affectations/:documentId/sign
   * Signature d'une affectation :
   *   { role: 'responsable_transfert' | 'depositaire' | 'chef_service_1' | 'chef_service_2' }
   * - le rôle connecté doit correspondre au signataire demandé ;
   * - l'ordre du workflow est respecté (1 puis 2 puis 3 puis 4) ;
   * - une signature déjà posée ne peut pas être re-signée (409) ;
   * - une affectation validée (4/4) n'est plus modifiable ;
   * - validation finale automatique à 4/4 (le stock est recalculé côté client).
   */
  async sign(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const roleKey = body.role;

    if (!SIGNATURE_ROLES[roleKey]) {
      return badRequest(
        ctx,
        'Rôle de signature inconnu (responsable_transfert, depositaire, chef_service_1, chef_service_2).'
      );
    }

    // --- Contrôle du rôle connecté ------------------------------------------
    const user = ctx.state && ctx.state.user;
    if (!user) {
      return forbid(ctx, 'Authentification requise pour signer une affectation.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    const affectation = await loadAffectation(app, documentId);
    if (!affectation) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Affectation introuvable.' } };
      return ctx.body;
    }

    const config = SIGNATURE_ROLES[roleKey];

    // L'admin peut signer pour tous les rôles ; sinon correspondance stricte.
    const estAdmin = code === 'admin';
    if (roleKey === 'responsable_transfert') {
      const autorise = await peutSignerResponsableTransfert(app, ctx, affectation);
      if (!autorise) {
        return forbid(
          ctx,
          'Seul le créateur de l’affectation (Responsable du transfert) ou un administrateur peut apposer cette signature.'
        );
      }
    } else if (!estAdmin && !ROLE_FOR_SIGNATURE[roleKey].includes(code)) {
      return forbid(
        ctx,
        `Votre rôle ne permet pas d'apposer la signature « ${roleKey.replace(/_/g, ' ')} ».`
      );
    }

    // --- Affectation déjà validée : immuable ---------------------------------
    const nbAvant = Object.values(SIGNATURE_ROLES).filter((c) => affectation[c.flag] === true).length;
    if (nbAvant === 4 || affectation.statut === 'validee') {
      return forbid(ctx, 'Affectation déjà validée (4/4) : elle n’est plus modifiable.', 409);
    }

    // --- Double signature interdite -------------------------------------------
    if (affectation[config.flag] === true) {
      return forbid(ctx, 'Cette signature a déjà été enregistrée et ne peut pas être modifiée.', 409);
    }

    // --- Ordre du workflow : les signatures précédentes doivent exister ------
    for (const [autreRole, autreConfig] of Object.entries(SIGNATURE_ROLES)) {
      if (autreConfig.order < config.order && affectation[autreConfig.flag] !== true) {
        return badRequest(
          ctx,
          `Workflow respecté : la signature ${autreRole.replace(/_/g, ' ')} doit être apposée avant celle-ci.`
        );
      }
    }

    // --- Pose de la signature --------------------------------------------------
    const signataire = user.username || user.email || `Utilisateur #${user.id}`;
    await app.documents(AFFECTATION_UID).update({
      documentId,
      data: {
        [config.flag]: true,
        [config.signerField]: signataire,
      },
    });

    // Recalcul du nombre de signatures
    const apres = await loadAffectation(app, documentId);
    const nbSignatures = Object.values(SIGNATURE_ROLES).filter((c) => apres[c.flag] === true).length;

    let statutFinal = 'en_attente'; // partiellement signée (1/4, 2/4, 3/4)
    if (nbSignatures === 4) {
      // Validation finale UNIQUEMENT ici (4/4) — stock recalculé côté client.
      await app.documents(AFFECTATION_UID).update({ documentId, data: { statut: 'validee' } });
      statutFinal = 'validee';
    }

    await tracerMouvement(
      app,
      apres,
      `Signature ${roleKey.replace(/_/g, ' ')}`,
      statutFinal,
      nbSignatures === 4
        ? `Affectation validée : les 4 signatures sont réunies. Stock : −${apres.quantite} (${apres.service_source}) / +${apres.quantite} (${apres.service_destinataire}).`
        : `Validation ${nbSignatures}/4`,
      signataire
    );

    const finale = await loadAffectation(app, documentId);
    return { data: finale, meta: { signatures: nbSignatures, statut: statutFinal } };
  },
});
