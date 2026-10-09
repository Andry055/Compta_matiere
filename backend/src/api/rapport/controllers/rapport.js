'use strict';

/**
 * rapport controller
 *
 * Endpoints de REDDITION DE COMPTE — 100 % LECTURE SEULE.
 * Aucune modification de stock ni de données existantes : les handlers ne
 * font que lire (entree-ligne / sortie-ligne / ouverture-exercice) et
 * calculer. Accès restreint aux rôles dépositaire, comptable, logistique
 * (+ admin/authenticated) via rapportsGuard.js (même logique que roleGuard).
 *
 * Routes (routes/rapport.js) :
 *   GET /api/rapports/recapitulation?annee=AAAA
 *   GET /api/rapports/recapitulations?depuis=AAAA&jusqu=AAAA  (enchaînées)
 *   GET /api/rapports/etat-appreciatif?annee=AAAA
 *   GET /api/rapports/inventaire?annee=AAAA
 *   GET /api/rapports/grand-livre?materiel=ID&annee=AAAA
 *   GET /api/rapports/bordereau?annee=AAAA[&jusqu=AAAA]
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { assertCanReadRapports } = require('../../../utils/rapportsGuard');
const calculs = require('../services/redition-calculs');

const ENTREE_LIGNE_UID = 'api::entree-ligne.entree-ligne';
const SORTIE_LIGNE_UID = 'api::sortie-ligne.sortie-ligne';
const MATERIEL_UID = 'api::material.material';
const OUVERTURE_UID = 'api::ouverture-exercice.ouverture-exercice';

function badRequest(ctx, message) {
  ctx.status = 400;
  ctx.body = {
    error: { status: 400, name: 'ValidationError', message },
  };
  return ctx.body;
}

/** Année valide entre 2000 et 2100 (défaut : année courante). */
function lireAnnee(ctx, { defaut = null } = {}) {
  const brut = ctx.query.annee;
  if (brut == null || brut === '') {
    if (defaut) return defaut;
    return badRequest(ctx, "Paramètre « annee » requis (ex. ?annee=2017)."), null;
  }
  const annee = Number(brut);
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
    badRequest(ctx, 'Paramètre « annee » invalide (entier attendu, ex. 2017).');
    return null;
  }
  return annee;
}

/** Extrait toutes les lignes de mouvement, enrichies de leur document parent. */
async function chargerLignes(strapi) {
  const entreeLignes = await strapi.db.query(ENTREE_LIGNE_UID).findMany({
    populate: ['entree', 'materiel'],
    limit: -1,
  });
  const sortieLignes = await strapi.db.query(SORTIE_LIGNE_UID).findMany({
    populate: ['sortie', 'materiel'],
    limit: -1,
  });

  const entrees = entreeLignes.map((l) => calculs.normaliserLigne(l, 'entree'));
  const sorties = sortieLignes.map((l) => calculs.normaliserLigne(l, 'sortie'));
  return { entrees, sorties };
}

async function chargerOuvertures(strapi) {
  const rows = await strapi.db.query(OUVERTURE_UID).findMany({ limit: -1 });
  return rows.map((r) => ({
    annee: r.annee,
    nomenclature: r.nomenclature,
    montant_existant: Number(r.montant_existant) || 0,
  }));
}

async function chargerMateriaux(strapi) {
  return strapi.db.query(MATERIEL_UID).findMany({
    limit: -1,
    orderBy: [{ designation: 'asc' }],
  });
}

/**
 * Identité de la fiche matériel affichée en tête de Fiche de stock :
 * désignation, nomenclature et PHOTO DE RÉFÉRENCE (champ media `photos`,
 * première image en guise de vignette). Lecture seule, optionnelle — un
 * matériel sans photo renvoie `photo: null`, jamais une erreur.
 */
async function chargerFicheMateriel(strapi, documentId) {
  if (!documentId) return null;
  try {
    const materiel = await strapi.documents(MATERIEL_UID).findOne({
      documentId,
      populate: ['photos'],
    });
    if (!materiel) return null;
    const photos = Array.isArray(materiel.photos) ? materiel.photos : [];
    const premiere = photos.find((p) => p && p.url);
    return {
      documentId: materiel.documentId,
      designation: materiel.designation || null,
      nomenclature: materiel.nomenclature || null,
      photo: (premiere && premiere.url) || null,
    };
  } catch (e) {
    return null;
  }
}

module.exports = createCoreController('api::rapport.rapport', ({ strapi: app }) => ({
  /**
   * GET /api/rapports/recapitulation?annee=AAAA
   * Récapitulation annuelle par nomenclature + TOTAUX + montants en lettres.
   */
  async recapitulation(ctx) {
    const refuse = await assertCanReadRapports(app, ctx);
    if (refuse) return refuse;

    const annee = lireAnnee(ctx);
    if (!annee) return;

    const { entrees, sorties } = await chargerLignes(app);
    const ouvertures = await chargerOuvertures(app);

    // Enchaînement : le reste de N-1 devient l'existant de N (report) quand
    // aucune ouverture explicite ne couvre l'année — on remonte jusqu'à la
    // première année connue (première ouverture ou premier mouvement).
    const anneesConnues = [
      ...ouvertures.map((o) => o.annee),
      ...entrees.map((l) => calculs.anneeDe(l.date)),
      ...sorties.map((l) => calculs.anneeDe(l.date)),
    ].filter(Boolean);
    const anneeDebut = anneesConnues.length ? Math.min(...anneesConnues) : annee;

    const chainees = calculs.calculerRecapitulationsChainees({
      anneeDebut,
      anneeFin: annee,
      entrees,
      sorties,
      ouvertures,
    });
    const recap = chainees[chainees.length - 1];

    ctx.body = { data: recap };
  },

  /**
   * GET /api/rapports/recapitulations?depuis=AAAA&jusqu=AAAA
   * Série enchaînée d'exercices (report automatique du reste).
   */
  async recapitulations(ctx) {
    const refuse = await assertCanReadRapports(app, ctx);
    if (refuse) return refuse;

    const depuis = Number(ctx.query.depuis) || Number(ctx.query.annee);
    const jusqu = Number(ctx.query.jusqu) || depuis;
    if (!Number.isInteger(depuis) || !Number.isInteger(jusqu) || depuis > jusqu) {
      return badRequest(ctx, "Paramètres « depuis »/« jusqu » invalides.");
    }

    const { entrees, sorties } = await chargerLignes(app);
    const ouvertures = await chargerOuvertures(app);

    const data = calculs.calculerRecapitulationsChainees({
      anneeDebut: depuis,
      anneeFin: jusqu,
      entrees,
      sorties,
      ouvertures,
    });
    ctx.body = { data };
  },

  /**
   * GET /api/rapports/etat-appreciatif?annee=AAAA
   * Mouvements de l'année + nombre de pièces justificatives.
   */
  async etatAppreciatif(ctx) {
    const refuse = await assertCanReadRapports(app, ctx);
    if (refuse) return refuse;

    const annee = lireAnnee(ctx);
    if (!annee) return;

    const { entrees, sorties } = await chargerLignes(app);
    const data = calculs.calculerEtatAppreciatif({ annee, entrees, sorties });
    ctx.body = { data };
  },

  /**
   * GET /api/rapports/inventaire?annee=AAAA
   * Inventaire annuel, une section par nomenclature, détail par article.
   */
  async inventaire(ctx) {
    const refuse = await assertCanReadRapports(app, ctx);
    if (refuse) return refuse;

    const annee = lireAnnee(ctx);
    if (!annee) return;

    const { entrees, sorties } = await chargerLignes(app);
    const materiaux = await chargerMateriaux(app);
    const ouvertures = await chargerOuvertures(app);

    const data = calculs.calculerInventaire({ annee, entrees, sorties, materiaux, ouvertures });
    ctx.body = { data };
  },

  /**
   * GET /api/rapports/grand-livre?materiel=ID&annee=AAAA
   * Fiche de stock / grand-livre d'un matériel (cumul chronologique).
   */
  async grandLivre(ctx) {
    const refuse = await assertCanReadRapports(app, ctx);
    if (refuse) return refuse;

    const materiel = ctx.query.materiel;
    if (!materiel) {
      return badRequest(ctx, "Paramètre « materiel » requis (ID du matériel).");
    }
    const annee = ctx.query.annee ? Number(ctx.query.annee) : null;
    if (annee && (!Number.isInteger(annee) || annee < 2000 || annee > 2100)) {
      return badRequest(ctx, "Paramètre « annee » invalide.");
    }

    const { entrees, sorties } = await chargerLignes(app);
    // En-tête de la fiche : identité + photo de référence du matériel suivi.
    const fiche = await chargerFicheMateriel(app, materiel);
    const data = calculs.calculerGrandLivre({
      materielId: materiel,
      entrees,
      sorties,
      annee,
      materiel: fiche,
    });
    ctx.body = { data };
  },

  /**
   * GET /api/rapports/bordereau?annee=AAAA[&jusqu=AAAA]
   * Bordereau d'envoi : décompte des pièces par année.
   */
  async bordereau(ctx) {
    const refuse = await assertCanReadRapports(app, ctx);
    if (refuse) return refuse;

    const annee = lireAnnee(ctx);
    if (!annee) return;
    const jusqu = Number(ctx.query.jusqu) || annee;
    if (!Number.isInteger(jusqu) || jusqu < annee) {
      return badRequest(ctx, "Paramètre « jusqu » invalide (≥ annee).");
    }

    const { entrees } = await chargerLignes(app);
    const annees = [];
    for (let a = annee; a <= jusqu; a++) annees.push(a);

    const data = calculs.calculerBordereau({ annees, entrees });
    ctx.body = { data };
  },
}));
