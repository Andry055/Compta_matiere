'use strict';

/**
 * remise-detenteur controller
 *
 * Endpoints :
 *   POST /api/remises-detenteurs       enregistrement d'une remise au détenteur
 *   GET  /api/remises-detenteurs       liste des remises (filtrées par direction si demandeur)
 *   GET  /api/remises-detenteurs/:id   détail d'une remise (vérification d'appropriation)
 *
 * Seuls les demandeurs (dépositaires de direction) et les dépositaires peuvent
 * créer et lire des remises au détenteur. Une remise ne peut être créée que
 * sur une sortie en statut `sortie_effectuee` ayant une réception physique
 * confirmée (quantité reçue > 0) appartenant à la direction de l'utilisateur.
 * Une seule remise par dossier : verrou anti-double sur `sorties.remise_detenteur_cloturee`.
 * AUCUNE déduction de stock (déjà faite à la validation logistique).
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { getRoleCode, DEMANDEUR_ROLE } = require('../../../utils/roleGuard');
const { getDirectionIdsDuUtilisateur } = require('../../../utils/directionUtilisateur');
const { dateDuJour, comparerDates } = require('../../../utils/horloge');

const REMISE_UID = 'api::remise-detenteur.remise-detenteur';
const LIGNE_UID = 'api::remise-detenteur-ligne.remise-detenteur-ligne';
const SORTIE_UID = 'api::sortie.sortie';
const RECEPTION_UID = 'api::reception-physique.reception-physique';
const MOUVEMENT_UID = 'api::mouvement.mouvement';

const DEPOSITAIRE_ROLE = 'depositaire';
const ADMIN_ROLE = 'admin';
const ROLES_AUTORISES = [DEMANDEUR_ROLE, DEPOSITAIRE_ROLE, ADMIN_ROLE];

const LONGUEUR_MIN_DETENTEUR = 2;
const LONGUEUR_MAX_DETENTEUR = 150;
const LONGUEUR_MAX_FONCTION = 150;
const LONGUEUR_MAX_OBSERVATION = 500;
const CARACTERES_DETENTEUR = /^[A-Za-zÀ-ÖØ-öø-ÿ'’\-. ]+$/u;
const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TABLE_SORTIES = 'sorties';
const USER_UID = 'plugin::users-permissions.user';

/**
 * Récupère le documentId valide de l'utilisateur connecté depuis la base
 * users-permissions. L'objet `ctx.state.user` provient du JWT et son
 * `documentId` n'est pas toujours fiable (peut être absent ou provenir
 * d'une autre collection). On interroge donc la base par l'ID numérique
 * (toujours présent dans le JWT) pour obtenir le documentId canonique.
 */
async function getUserDocumentId(strapi, userId) {
  if (!userId) return null;
  try {
    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
    });
    return user?.documentId ?? null;
  } catch (e) {
    strapi.log.warn(`[remise-detenteur] Impossible de résoudre le documentId utilisateur #${userId} : ${e.message}`);
    return null;
  }
}

/** Classe d'erreur pour les conflits transactionnels (409). */
class ErreurTransaction extends Error {
  constructor(statusTransaction, message) {
    super(message);
    this.name = 'ErreurTransaction';
    this.statusTransaction = statusTransaction;
  }
}

function forbid(ctx, message, status = 403) {
  ctx.status = status;
  const noms = { 401: 'UnauthorizedError', 403: 'ForbiddenError', 404: 'NotFoundError', 409: 'ConflictError' };
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

/** Extrait un identifiant de relation (string, {documentId}, {id}) */
function identifiantRelation(valeur) {
  if (!valeur) return null;
  if (typeof valeur === 'string') return valeur;
  if (typeof valeur === 'object') return valeur.documentId || valeur.id || null;
  return null;
}

/** Vérifie qu'un utilisateur a un rôle autorisé pour la remise au détenteur. */
async function estRoleAutorise(strapi, userId) {
  if (!userId) return false;
  const code = await getRoleCode(strapi, userId);
  return ROLES_AUTORISES.includes(code);
}

/** Récupère les documentId des directions du demandeur connecté. */
async function getDirectionIds(strapi, user) {
  return getDirectionIdsDuUtilisateur(strapi, user);
}

/** Charge une sortie avec ses lignes (et matériel) + direction. */
async function chargerSortie(strapi, documentId) {
  return strapi.documents(SORTIE_UID).findOne({
    documentId,
    populate: {
      lignes: { populate: ['materiel'] },
      direction: true,
    },
  });
}

/** Vérifie qu'une réception physique confirmée existe pour cette sortie. */
async function receptionConfirmee(strapi, sortieId) {
  const receptions = await strapi.documents(RECEPTION_UID).findMany({
    filters: {
      sortie: { documentId: { $eq: sortieId } },
      quantite_recue: { $gt: 0 },
    },
    fields: ['documentId', 'date_reception', 'quantite_recue'],
    sort: { date_reception: 'asc' },
    limit: -1,
  });
  return (receptions || []).filter(r => Number(r.quantite_recue) > 0);
}

/** Filtre d'isolation par direction (sur la relation `sortie.direction`). */
function filtreDirection(directionIds) {
  if (!directionIds || directionIds.length === 0) {
    return { sortie: { documentId: { $null: true } } };
  }
  return { sortie: { direction: { documentId: { $in: directionIds } } } };
}

/** Applique le peuplement forcé pour la liste (lignes + sortie). */
function forcerPopulateListe(ctx) {
  ctx.query.populate = {
    lignes: { populate: ['sortie_ligne'] },
    sortie: true,
  };
}

/** Applique le peuplement forcé pour le détail. */
function forcerPopulateDetail(ctx) {
  ctx.query.populate = {
    lignes: { populate: ['sortie_ligne'] },
    sortie: { populate: { direction: true } },
  };
}

/** Valide un nom de détenteur selon les règles métier. */
function validerNomDetenteur(nom) {
  const valeur = (nom ?? '').trim();
  if (!valeur) return { ok: false, message: 'Le nom du détenteur est obligatoire.' };
  if (valeur.length < LONGUEUR_MIN_DETENTEUR) {
    return { ok: false, message: `Le nom du détenteur doit comporter au moins ${LONGUEUR_MIN_DETENTEUR} caractères.` };
  }
  if (valeur.length > LONGUEUR_MAX_DETENTEUR) {
    return { ok: false, message: `Le nom du détenteur est limité à ${LONGUEUR_MAX_DETENTEUR} caractères.` };
  }
  if (!CARACTERES_DETENTEUR.test(valeur)) {
    return {
      ok: false,
      message: 'Le nom du détenteur ne peut contenir que des lettres, espaces, apostrophes, tirets ou points.',
    };
  }
  return { ok: true };
}

module.exports = createCoreController(REMISE_UID, ({ strapi: app }) => ({
  /**
   * POST /api/remises-detenteurs
   * Enregistre la remise du matériel au détenteur.
   *
   * Body attendu :
   * {
   *   data: {
   *     sortie: "<documentId>",
   *     date_remise: "2026-10-28",
   *     materiels: [
   *       { ligne: "<documentId ligne sortie>", detenteur_nom: "...", detenteur_fonction: "...", observation: "..." }
   *     ],
   *     attestation: true
   *   }
   * }
   */
  async create(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise pour enregistrer la remise du matériel au détenteur.', 401);
    }

    // Vérification du rôle
    const autorise = await estRoleAutorise(app, user.id);
    if (!autorise) {
      return forbid(ctx, "Votre rôle ne permet pas d'enregistrer la remise du matériel au détenteur.");
    }

    // Extraction et validation du corps de requête
    const body = (ctx.request.body && ctx.request.body.data) || ctx.request.body || {};
    const sortieId = identifiantRelation(body.sortie || body.sortieId || body.sortie_id);
    if (!sortieId) {
      return badRequest(ctx, 'La référence du dossier de sortie est requise.');
    }

    // L'attestation de remise physique effective est obligatoire : le client
    // ne peut pas l'omettre, et ne peut pas la poser à `false`.
    if (body.attestation !== undefined && body.attestation !== true) {
      return badRequest(ctx, 'L\'attestation de remise physique effective est obligatoire.');
    }

    // Chargement de la sortie avec ses lignes et sa direction
    const sortie = await chargerSortie(app, sortieId);
    if (!sortie) {
      return forbid(ctx, 'Sortie introuvable.');
    }

    // Vérification direction : la sortie doit appartenir à la direction de l'utilisateur
    // (admin bypass)
    const codeRole = (await getRoleCode(app, user.id)).toLowerCase();
    if (codeRole !== ADMIN_ROLE) {
      const directionIds = await getDirectionIds(app, user);
      const sortieDirectionId = sortie.direction && sortie.direction.documentId;
      if (!sortieDirectionId || !directionIds.includes(sortieDirectionId)) {
        return forbid(ctx, 'Ce dossier de sortie n\'appartient pas à votre direction.');
      }
    }

    // Vérification du statut : doit être sortie_effectuee
    if (sortie.statut !== 'sortie_effectuee') {
      return badRequest(
        ctx,
        `La remise au détenteur n'est possible que pour une sortie « sortie_effectuee » (statut actuel : ${sortie.statut || '—'}).`
      );
    }

    // Vérification : réception physique confirmée (quantite_recue > 0)
    const receptions = await receptionConfirmee(app, sortieId);
    if (receptions.length === 0) {
      return badRequest(
        ctx,
        'Aucune réception physique confirmée n\'existe pour ce dossier. La remise ne peut pas être enregistrée.'
      );
    }
    // Date de la réception la plus récente (pour la borne inférieure de date_remise)
    const dateReceptionRecente = receptions[receptions.length - 1].date_reception;

    // Vérification anti-double : la remise est-elle déjà clôturée ?
    if (sortie.remise_detenteur_cloturee) {
      return forbid(ctx, 'La remise du matériel au détenteur est déjà enregistrée pour ce dossier.', 409);
    }

    // Validation du tableau materiels
    const materiels = Array.isArray(body.materiels) ? body.materiels : [];
    if (materiels.length === 0) {
      return badRequest(ctx, 'Au moins un matériel avec son détenteur est requis.');
    }

    // Construction du map des lignes de la sortie (par documentId et id numérique)
    const lignesSortie = sortie.lignes || [];
    const lignesParDocId = new Map();
    const lignesParId = new Map();
    for (const ligne of lignesSortie) {
      if (ligne.documentId) lignesParDocId.set(ligne.documentId, ligne);
      if (ligne.id) lignesParId.set(String(ligne.id), ligne);
    }

    // Clés acceptées pour l'identifiant de ligne
    const CLEFS_LIGNE = ['ligne', 'ligneId', 'ligne_id', 'sortie_ligne', 'sortieLigne', 'id'];

    // Validation de chaque matériel
    const lignesVues = new Set();
    const validations = [];
    let totalQuantite = 0;

    for (let i = 0; i < materiels.length; i++) {
      const m = materiels[i] || {};
      const detenteurNom = (m.detenteur_nom ?? m.detenteurNom ?? '').trim();
      const detenteurFonction = (m.detenteur_fonction ?? m.detenteurFonction ?? '').trim();
      const observation = (m.observation ?? '').trim();

      // Identifiant de la ligne de sortie (optionnel si dossier sans ligne)
      let ligneRef = null;
      for (const clef of CLEFS_LIGNE) {
        if (m[clef] !== undefined && m[clef] !== null && m[clef] !== '') {
          ligneRef = identifiantRelation(m[clef]);
          break;
        }
      }

      // Validation du nom du détenteur
      const verdictNom = validerNomDetenteur(detenteurNom);
      if (!verdictNom.ok) {
        return badRequest(ctx, `Matériel #${i + 1} : ${verdictNom.message}`);
      }

      // Validation fonction (optionnelle, max 150)
      if (detenteurFonction && detenteurFonction.length > LONGUEUR_MAX_FONCTION) {
        return badRequest(ctx, `Matériel #${i + 1} : fonction limitée à ${LONGUEUR_MAX_FONCTION} caractères.`);
      }

      // Validation observation (optionnelle, max 500)
      if (observation && observation.length > LONGUEUR_MAX_OBSERVATION) {
        return badRequest(ctx, `Matériel #${i + 1} : observation limitée à ${LONGUEUR_MAX_OBSERVATION} caractères.`);
      }

      // Vérification de la ligne de sortie
      let ligneCorrespondante = null;
      if (lignesSortie.length > 0) {
        if (!ligneRef) {
          return badRequest(ctx, `Matériel #${i + 1} : la ligne de sortie est requise.`);
        }
        ligneCorrespondante = lignesParDocId.get(ligneRef) || lignesParId.get(String(ligneRef)) || null;
        if (!ligneCorrespondante) {
          return badRequest(ctx, `Matériel #${i + 1} : la ligne de sortie ${ligneRef} n'appartient pas à ce dossier.`);
        }
        const cleLigne = ligneCorrespondante.documentId || String(ligneCorrespondante.id);
        if (lignesVues.has(cleLigne)) {
          return badRequest(ctx, `La ligne ${ligneRef} est indiquée plusieurs fois.`);
        }
        lignesVues.add(cleLigne);
        totalQuantite += Number(ligneCorrespondante.quantite) || 0;

        validations.push({
          ligne: ligneCorrespondante,
          detenteurNom,
          detenteurFonction: detenteurFonction || null,
          observation: observation || null,
          designation: ligneCorrespondante.materiel?.designation || ligneCorrespondante.designation || '—',
          quantite: Number(ligneCorrespondante.quantite) || 1,
        });
      } else {
        // Dossier sans lignes : une seule entrée synthétique attendue
        if (i > 0) {
          return badRequest(ctx, 'Un dossier sans ligne de sortie ne peut avoir qu\'un seul matériel de remise (entrée synthétique).');
        }
        if (ligneRef && ligneRef !== sortieId) {
          return badRequest(ctx, `L'identifiant de ligne ${ligneRef} ne correspond pas à ce dossier sans ligne.`);
        }
        // Quantité reçue = total des réceptions confirmées
        const quantiteRecue = receptions.reduce((s, r) => s + (Number(r.quantite_recue) || 0), 0);
        totalQuantite += quantiteRecue || 1;
        validations.push({
          ligne: null,
          detenteurNom,
          detenteurFonction: detenteurFonction || null,
          observation: observation || null,
          designation: sortie.materiel || sortie.reference || 'Matériel',
          quantite: quantiteRecue || 1,
        });
      }
    }

    // Vérification : toutes les lignes du dossier doivent être couvertes exactement une fois
    if (lignesSortie.length > 0 && lignesVues.size !== lignesSortie.length) {
      return badRequest(ctx, `Toutes les lignes du dossier doivent avoir un détenteur (${lignesVues.size}/${lignesSortie.length} couvertes).`);
    }

    // Validation de date_remise
    let dateRemise = (body.date_remise ?? '').trim();
    const aujourdhui = dateDuJour(new Date());
    if (!dateRemise) {
      dateRemise = aujourdhui;
    } else {
      if (!FORMAT_DATE.test(dateRemise)) {
        return badRequest(ctx, 'date_remise doit être au format AAAA-MM-JJ.');
      }
      if (aujourdhui && dateRemise > aujourdhui) {
        return badRequest(ctx, 'date_remise ne peut pas être postérieure à aujourd\'hui.');
      }
      // Ne peut pas être antérieure à la date de réception
      const jourReception = dateDuJour(dateReceptionRecente);
      if (jourReception && dateRemise < jourReception) {
        return badRequest(ctx, 'date_remise ne peut pas être antérieure à la date de réception physique.');
      }
    }

    // Transaction : verrou anti-double + création remise + lignes + mouvement
    const signataire = user.username || user.email || `Utilisateur #${user.id}`;
    const maintenant = new Date().toISOString();
    const dateEnregistrement = maintenant;
    let remiseCreee = null;

    // Résoudre le documentId canonique de l'utilisateur dans
    // plugin::users-permissions.user (l'ID du JWT ne suffit pas pour une relation).
    const demandeurDocumentId = await getUserDocumentId(app, user.id);
    if (!demandeurDocumentId) {
      return forbid(ctx, 'Utilisateur introuvable dans la base d\'authentification.');
    }

    try {
      await app.db.transaction(async ({ trx }) => {
        // 1. Verrou anti-double exécution : UPDATE conditionnel, tolérant au
        //    NULL (colonne créée après les lignes déjà enregistrées).
        //    Deux étapes explicites : NULL -> true, puis false -> true.
        //    0 ligne modifiée => la remise est déjà enregistrée : 409.
        let nbVerrou = await trx(TABLE_SORTIES)
          .where({ document_id: sortieId })
          .whereNull('remise_detenteur_cloturee')
          .update({ remise_detenteur_cloturee: true });
        if (!nbVerrou) {
          nbVerrou = await trx(TABLE_SORTIES)
            .where({ document_id: sortieId })
            .where('remise_detenteur_cloturee', false)
            .update({ remise_detenteur_cloturee: true });
        }
        if (!nbVerrou) {
          throw new ErreurTransaction(409, 'La remise du matériel au détenteur est déjà enregistrée pour ce dossier (conflit).');
        }

        // 2. Création de la remise-detenteur (en-tête)
        remiseCreee = await app.documents(REMISE_UID).create({
          data: {
            sortie: sortieId,
            reference: sortie.reference,
            direction: sortie.direction?.nom_direction || sortie.direction?.abreviation || '',
            date_reception: dateDuJour(dateReceptionRecente) || dateRemise,
            date_remise: dateRemise,
            demandeur: demandeurDocumentId,
            demandeur_nom: signataire,
            attestation: true,
            date_enregistrement: dateEnregistrement,
          },
        });

        // 3. Création des lignes de remise
        for (const v of validations) {
          await app.documents(LIGNE_UID).create({
            data: {
              remise: remiseCreee.documentId,
              sortie_ligne: v.ligne ? (v.ligne.documentId || v.ligne.id) : null,
              designation: v.designation,
              quantite: v.quantite,
              detenteur_nom: v.detenteurNom,
              detenteur_fonction: v.detenteurFonction,
              observation: v.observation,
            },
          });
        }

        // 4. Mise à jour de la sortie : date de remise au détenteur
        await app.documents(SORTIE_UID).update({
          documentId: sortieId,
          data: { remise_detenteur_date: dateRemise },
        });

        // 5. Mouvement de traçabilité — AUCUNE déduction de stock ici :
        //    le stock a déjà été débité à la validation logistique.
        const observationsMouv = validations
          .map(v => `${v.designation} → ${v.detenteurNom}${v.detenteurFonction ? ` (${v.detenteurFonction})` : ''}`)
          .join(' ; ');
        await app.documents(MOUVEMENT_UID).create({
          data: {
            reference: sortie.reference,
            type: 'sortie',
            date_mouvement: dateRemise,
            utilisateur: signataire,
            action: 'Remise du matériel au détenteur',
            materiel: validations.map(v => v.designation).join(', ') || '—',
            quantite: totalQuantite,
            statut: 'sortie_effectuee',
            sortie: sortieId,
            observations: observationsMouv || 'Remise du matériel au détenteur enregistrée.',
          },
        });
      });

      // Après transaction réussie : recharger la remise complète pour la réponse
      const remiseComplete = await app.documents(REMISE_UID).findOne({
        documentId: remiseCreee.documentId,
        populate: {
          lignes: { populate: ['sortie_ligne'] },
          sortie: { populate: { direction: true } },
        },
      });

      return { data: remiseComplete, meta: { remise_enregistree: true } };
    } catch (e) {
      if (e instanceof ErreurTransaction) {
        return forbid(ctx, e.message, e.statusTransaction);
      }
      app.log.warn(`[remise-detenteur] Erreur lors de l'enregistrement : ${e.message}`);
      return erreurInterne(ctx, `Erreur lors de l'enregistrement de la remise : ${e.message}`);
    }
  },

  /**
   * GET /api/remises-detenteurs
   * Liste des remises (filtrée par direction pour les demandeurs/dépositaires).
   */
  async find(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise.', 401);
    }

    const codeRole = (await getRoleCode(app, user.id)).toLowerCase();
    if (codeRole === DEMANDEUR_ROLE || codeRole === DEPOSITAIRE_ROLE) {
      const directionIds = await getDirectionIds(app, user);
      const directionFilter = filtreDirection(directionIds);
      if (ctx.query.filters) {
        ctx.query.filters = { $and: [ctx.query.filters, directionFilter] };
      } else {
        ctx.query.filters = directionFilter;
      }
    }
    // Admin : pas de filtre (voit tout)

    forcerPopulateListe(ctx);
    return super.find(ctx);
  },

  /**
   * GET /api/remises-detenteurs/:id
   * Détail d'une remise (vérification d'appropriation pour demandeur/dépositaire).
   */
  async findOne(ctx) {
    const user = ctx.state && ctx.state.user;
    if (!user || !user.id) {
      return forbid(ctx, 'Authentification requise.', 401);
    }

    const codeRole = (await getRoleCode(app, user.id)).toLowerCase();
    if (codeRole === DEMANDEUR_ROLE || codeRole === DEPOSITAIRE_ROLE) {
      const documentId = ctx.params.id || ctx.params.documentId;
      const remise = await app.documents(REMISE_UID).findOne({
        documentId,
        populate: { sortie: { populate: { direction: true } } },
      });
      if (!remise) {
        return forbid(ctx, 'Remise introuvable.', 404);
      }
      const directionIds = await getDirectionIds(app, user);
      const sortieDirectionId = remise.sortie && remise.sortie.direction
        ? remise.sortie.direction.documentId
        : null;
      if (!directionIds.includes(sortieDirectionId)) {
        return forbid(ctx, 'Cette remise n\'appartient pas à votre direction.');
      }
    }
    // Admin : pas de filtre

    forcerPopulateDetail(ctx);
    return super.findOne(ctx);
  },
}));