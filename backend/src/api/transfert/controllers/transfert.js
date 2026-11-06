'use strict';

/**
 * transfert controller
 *
 * Endpoints (routes/transfert.js) :
 *   GET  /api/transferts                  lecture publique (find)
 *   GET  /api/transferts/:documentId      lecture publique (findOne)
 *   POST /api/transferts/create-complete  création complète (auth)
 *   POST /api/transferts/:documentId/sign signature contrôlée par rôle (auth)
 *
 * Règle métier stricte : un transfert n'est « validee » QUE si TOUTES les
 * signatures attendues sont présentes, dans l'ordre du circuit. Deux circuits
 * coexistent (mêmes règles que frontend/src/lib/transferts.ts) :
 *
 *   NOUVEAU — transfert vers une autre Direction — 3 signatures :
 *     1/3 Responsable du transfert (le créateur, ou l'admin)
 *     2/3 Dépositaire
 *     3/3 Logistique
 *   ANCIEN — enregistrements portant encore les chefs de service — 4 :
 *     1/4 Responsable du transfert, 2/4 Dépositaire,
 *     3/4 Chef de service 1, 4/4 Chef de service 2
 *
 * Un profil « demandeur » ne peut jamais signer à la place d'un responsable
 * (sauf 1/3 sur SON propre transfert, en tant que créateur). Le contrôle est
 * effectué ICI, côté serveur (roleGuard.js). Une signature déjà posée n'est
 * jamais modifiable (double signature refusée avec 409).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const {
  guardedCoreController,
  getRoleCode,
  DEMANDEUR_ROLE,
  ADMIN_ROLE,
} = require('../../../utils/roleGuard');

const TRANSFERT_UID = 'api::transfert.transfert';
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
  logistique: {
    flag: 'logistique_signed',
    dateField: 'date_signature_logistique',
    signerField: 'signataire_logistique',
    order: 3,
  },
  chef_service_1: {
    flag: 'chef_service_1_signed',
    dateField: 'date_signature_chef_service_1',
    signerField: 'signataire_chef_service_1',
    order: 4,
  },
  chef_service_2: {
    flag: 'chef_service_2_signed',
    dateField: 'date_signature_chef_service_2',
    signerField: 'signataire_chef_service_2',
    order: 5,
  },
};

/** Circuit des NOUVEAUX transferts (Direction → Direction), dans l'ordre. */
const NOUVEAU_CIRCUIT = ['responsable_transfert', 'depositaire', 'logistique'];

/** Circuit des ANCIENS transferts (encore porteurs de chefs de service). */
const ANCIEN_CIRCUIT = ['responsable_transfert', 'depositaire', 'chef_service_1', 'chef_service_2'];

/**
 * Rôles autorisés pour signer `roleKey` (cohérent avec le frontend
 * frontend/src/lib/transferts.ts -> peutValiderTransfert) :
 *   responsable_transfert -> le CRÉATEUR du transfert (ou admin)
 *   depositaire           -> depositaire (ou admin)
 *   logistique            -> logistique (ou admin)
 *   chef_service_1        -> magasinier (ou admin)
 *   chef_service_2        -> logistique (ou admin)
 */
const ROLE_FOR_SIGNATURE = {
  depositaire: ['depositaire'],
  logistique: ['logistique'],
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

/**
 * Circuit de validation attendu pour UN transfert, dans l'ordre.
 *
 * Les anciens enregistrements (créés avant la suppression des deux chefs de
 * service) portent encore leurs responsables / signatures de chef : circuit à
 * 4. Les nouveaux transferts (Direction → Direction) n'en portent pas : 3
 * (Responsable du transfert, Dépositaire, Logistique).
 * Même règle que `clesAttendues()` côté frontend.
 */
function circuitTransfert(transfert) {
  const ancienCircuit =
    !!transfert.chef_service_1 ||
    !!transfert.chef_service_2 ||
    transfert.chef_service_1_signed === true ||
    transfert.chef_service_2_signed === true ||
    !!transfert.date_signature_chef_service_1 ||
    !!transfert.date_signature_chef_service_2;

  return ancienCircuit ? ANCIEN_CIRCUIT : NOUVEAU_CIRCUIT;
}

/** Nombre de signatures déjà posées SUR LE CIRCUIT attendu. */
function signaturesPosees(transfert, circuit) {
  return circuit.filter((cle) => transfert[SIGNATURE_ROLES[cle].flag] === true).length;
}

/** Token unique pour le QR Code du transfert (aucune donnée sensible). */
function genererQrToken() {
  return `TRF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

async function loadTransfert(strapi, documentId) {
  return strapi.documents(TRANSFERT_UID).findOne({ documentId });
}

/**
 * Le Demandeur ne signe jamais une validation « responsable » ; il peut
 * seulement apposer la 1/3 sur SON PROPRE transfert (en tant que créateur).
 */
async function peutSignerResponsableTransfert(strapi, ctx, transfert) {
  const user = ctx.state && ctx.state.user;
  if (!user) return false;
  const code = (await getRoleCode(strapi, user.id)).toLowerCase();
  if (code === ADMIN_ROLE) return false;
  if (code === DEMANDEUR_ROLE) {
    const estCreateur =
      (!!user.username && user.username === transfert.createur) ||
      (!!user.email && user.email === transfert.createur_email);
    return estCreateur;
  }
  return false;
}

/** Trace l'action dans la table `mouvements` (historique non modifiable). */
async function tracerMouvement(strapi, transfert, action, statut, observations, utilisateur = '') {
  try {
    await strapi.documents(MOUVEMENT_UID).create({
      data: {
        reference: transfert.reference,
        type: 'sortie', // le mouvement n'a pas de type « transfert » : tracé comme sortie interne
        date_mouvement: new Date().toISOString().slice(0, 10),
        utilisateur,
        action,
        materiel: transfert.materiel || '—',
        quantite: Number(transfert.quantite) || 0,
        statut,
        observations:
          observations ||
          `Transfert ${transfert.service_source || '—'} → ${
            transfert.direction_destinataire || transfert.service_destinataire || '—'
          } (Direction d'origine ${transfert.direction || '—'})`,
      },
    });
  } catch (e) {
    strapi.log.warn(`[transfert] Historique non tracé : ${e.message}`);
  }
}

// `find` / `findOne` sont hérités du contrôleur core (routes en `auth: false`,
// comme direction / service) : seuls les endpoints custom sont définis ici.
module.exports = guardedCoreController(createCoreController, TRANSFERT_UID, {
  /**
   * POST /api/transferts/create-complete
   * Création d'un transfert : un matériel déjà enregistré rejoint une autre
   * Direction (`direction_destinataire`) — ou un autre service (ancien format
   * interne via `service_destinataire`). Pas de sortie, pas de nouvelle
   * entrée : seule la destination du matériel change.
   * Les drapeaux de signature sont TOUJOURS initialisés à false : impossible
   * de fabriquer un transfert déjà validé.
   */
  async createComplete(ctx) {
    const app = strapi;
    const user = ctx.state && ctx.state.user;
    // L'administrateur est en consultation seule : il ne crée aucun transfert.
    if (user && user.id) {
      const code = (await getRoleCode(app, user.id)).toLowerCase();
      if (code === ADMIN_ROLE) {
        return forbid(
          ctx,
          "Le compte administrateur est en consultation seule : il ne peut pas créer de transfert."
        );
      }
    }
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};

    // --- Validation des champs obligatoires --------------------------------
    if (!body.direction) return badRequest(ctx, 'Direction obligatoire.');
    if (!body.service_source) return badRequest(ctx, 'Service source obligatoire.');
    // Destination : une Direction (nouveau circuit, l'UI n'impose plus de
    // service destinataire) et/ou un service (ancien circuit interne).
    const directionDestinataire = String(body.direction_destinataire || '').trim();
    const serviceDestinataire = String(body.service_destinataire || '').trim();
    if (!directionDestinataire && !serviceDestinataire) {
      return badRequest(ctx, 'Direction destinataire obligatoire.');
    }
    if (!body.materiel) return badRequest(ctx, 'Matériel obligatoire.');
    const quantite = Number(body.quantite);
    if (!Number.isFinite(quantite) || quantite <= 0) {
      return badRequest(ctx, 'Quantité invalide : elle doit être supérieure à 0.');
    }
    if (
      serviceDestinataire &&
      serviceDestinataire.toLowerCase() === String(body.service_source).trim().toLowerCase()
    ) {
      return badRequest(
        ctx,
        'Le service source et le service destinataire doivent être différents (même service = aucun transfert).'
      );
    }
    if (
      !serviceDestinataire &&
      directionDestinataire.toLowerCase() === String(body.direction).trim().toLowerCase()
    ) {
      return badRequest(
        ctx,
        "La Direction destinataire doit être différente de la Direction d'origine (sinon : transfert interne)."
      );
    }
    if (!body.responsable_transfert) {
      return badRequest(ctx, 'Veuillez indiquer le Responsable du transfert.');
    }
    if (!body.depositaire) {
      return badRequest(ctx, 'Veuillez indiquer le Dépositaire.');
    }

    // --- Génération automatique de la référence TRF-AAAA-NNN ---------------
    let reference = body.reference;
    if (!reference) {
      const annee = new Date(body.date || Date.now()).getFullYear();
      const prefixe = `TRF-${annee}-`;
      const existantes = await app.documents(TRANSFERT_UID).findMany({
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
    let transfert;
    try {
      transfert = await app.documents(TRANSFERT_UID).create({
        data: {
          reference,
          date: body.date || new Date().toISOString().slice(0, 10),
          direction: body.direction || null,
          direction_destinataire: directionDestinataire || null,
          service_source: body.service_source || null,
          service_destinataire: serviceDestinataire || null,
          materiel: body.materiel || null,
          materiel_reference: body.materiel_reference || null,
          quantite,
          motif: body.motif || null,
          observation: body.observation || null,
          createur,
          createur_email: body.createur_email || (ctx.state && ctx.state.user && ctx.state.user.email) || null,
          responsable_transfert: body.responsable_transfert || null,
          depositaire: body.depositaire || null,
          logistique: body.logistique || null,
          chef_service_1: body.chef_service_1 || null,
          chef_service_2: body.chef_service_2 || null,
          responsable_transfert_signed: false,
          depositaire_signed: false,
          logistique_signed: false,
          chef_service_1_signed: false,
          chef_service_2_signed: false,
          statut: 'en_attente',
          historique: [
            {
              date: new Date().toISOString().slice(0, 10),
              libelle: `Création du transfert par ${createur || '—'}`,
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
      transfert,
      'Transfert créée',
      'en_attente',
      null,
      createur
    );

    ctx.status = 201;
    return { data: transfert };
  },

  /**
   * POST /api/transferts/:documentId/sign
   * Signature d'un transfert :
   *   { role: 'responsable_transfert' | 'depositaire' | 'logistique'
   *     | 'chef_service_1' | 'chef_service_2' }
   * - le rôle connecté doit correspondre au signataire demandé ;
   * - le circuit attendu est 3 signatures (nouveau) ou 4 (ancien) ;
   * - l'ordre du workflow est respecté ;
   * - une signature déjà posée ne peut pas être re-signée (409) ;
   * - un transfert validé n'est plus modifiable ;
   * - validation finale automatique à n/n (le stock est recalculé côté client).
   */
  async sign(ctx) {
    const app = strapi;
    const { documentId } = ctx.params;
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const roleKey = body.role;

    if (!SIGNATURE_ROLES[roleKey]) {
      return badRequest(
        ctx,
        'Rôle de signature inconnu (responsable_transfert, depositaire, logistique, chef_service_1, chef_service_2).'
      );
    }

    // --- Contrôle du rôle connecté ------------------------------------------
    const user = ctx.state && ctx.state.user;
    if (!user) {
      return forbid(ctx, 'Authentification requise pour signer un transfert.', 401);
    }
    const code = (await getRoleCode(app, user.id)).toLowerCase();

    // L'administrateur est en consultation seule : aucune signature.
    if (code === ADMIN_ROLE) {
      return forbid(
        ctx,
        "Le compte administrateur est en consultation seule : il ne peut pas signer un transfert."
      );
    }

    const transfert = await loadTransfert(app, documentId);
    if (!transfert) {
      ctx.status = 404;
      ctx.body = { error: { status: 404, name: 'NotFound', message: 'Transfert introuvable.' } };
      return ctx.body;
    }

    const config = SIGNATURE_ROLES[roleKey];

    // --- Circuit attendu pour CE transfert (3 validations, ou 4 pour les
    //     anciens enregistrements qui portent encore des chefs de service) ----
    const circuit = circuitTransfert(transfert);
    const attendues = circuit.length;
    if (!circuit.includes(roleKey)) {
      return badRequest(ctx, "Cette validation n'existe plus dans le circuit d'approbation.");
    }

    // Correspondance stricte entre le rôle connecté et la signature demandée.
    if (roleKey === 'responsable_transfert') {
      const autorise = await peutSignerResponsableTransfert(app, ctx, transfert);
      if (!autorise) {
        return forbid(
          ctx,
          'Seul le créateur du transfert (Responsable du transfert) peut apposer cette signature.'
        );
      }
    } else if (!ROLE_FOR_SIGNATURE[roleKey].includes(code)) {
      return forbid(
        ctx,
        `Votre rôle ne permet pas d'apposer la signature « ${roleKey.replace(/_/g, ' ')} ».`
      );
    }

    // --- Transfert déjà validé : immuable ----------------------------------
    const nbAvant = signaturesPosees(transfert, circuit);
    if (nbAvant === attendues || transfert.statut === 'validee') {
      return forbid(
        ctx,
        `Transfert déjà validé (${attendues}/${attendues}) : il n'est plus modifiable.`,
        409
      );
    }

    // --- Double signature interdite -------------------------------------------
    if (transfert[config.flag] === true) {
      return forbid(ctx, 'Cette signature a déjà été enregistrée et ne peut pas être modifiée.', 409);
    }

    // --- Ordre du workflow : les signatures précédentes du circuit doivent
    //     exister (un rôle hors circuit n'est jamais un prérequis) ------------
    for (const autreRole of circuit) {
      const autreConfig = SIGNATURE_ROLES[autreRole];
      if (autreConfig.order < config.order && transfert[autreConfig.flag] !== true) {
        return badRequest(
          ctx,
          `Workflow respecté : la signature ${autreRole.replace(/_/g, ' ')} doit être apposée avant celle-ci.`
        );
      }
    }

    // --- Pose de la signature --------------------------------------------------
    const signataire = user.username || user.email || `Utilisateur #${user.id}`;
    await app.documents(TRANSFERT_UID).update({
      documentId,
      data: {
        [config.flag]: true,
        [config.signerField]: signataire,
      },
    });

    // Recalcul du nombre de signatures SUR LE CIRCUIT attendu
    const apres = await loadTransfert(app, documentId);
    const nbSignatures = signaturesPosees(apres, circuit);

    let statutFinal = 'en_attente'; // partiellement signée (1/3…2/3, ou 1/4…3/4)
    if (nbSignatures === attendues) {
      // Validation finale UNIQUEMENT ici (n/n) — stock recalculé côté client.
      await app.documents(TRANSFERT_UID).update({ documentId, data: { statut: 'validee' } });
      statutFinal = 'validee';
    }

    const destination = apres.direction_destinataire || apres.service_destinataire || '—';
    await tracerMouvement(
      app,
      apres,
      `Signature ${roleKey.replace(/_/g, ' ')}`,
      statutFinal,
      nbSignatures === attendues
        ? `Transfert validé : les ${attendues} signatures sont réunies. Stock : −${apres.quantite} (${apres.service_source}) / +${apres.quantite} (${destination}).`
        : `Validation ${nbSignatures}/${attendues}`,
      signataire
    );

    const finale = await loadTransfert(app, documentId);
    return { data: finale, meta: { signatures: nbSignatures, statut: statutFinal } };
  },
});
