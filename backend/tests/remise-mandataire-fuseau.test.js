'use strict';

/**
 * REMISE DE MATÉRIEL — `mandataire_nom` et fuseau horaire de Madagascar.
 *
 * Ce test est un test HTTP RÉEL : Strapi est démarré pour de vrai sur une
 * base SQLite TEMPORAIRE placée dans le dossier temporaire du système (hors
 * du projet), et tous les appels passent par de vrais appels HTTP
 * (POST /api/auth/local puis POST /api/sorties/:documentId/remise avec jeton
 * Bearer). Aucun mot de passe ni jeton n'est affiché.
 *
 * Deux défauts sont vérifiés ici :
 *
 *  1. FUSEAU HORAIRE — la route de remise mélange trois notions de
 *     « aujourd'hui » : le minuit du fuseau du SERVEUR (comparaisons) et le
 *     jour UTC (valeur par défaut). Sur un serveur qui n'est pas à
 *     Madagascar, une remise datée d'aujourd'hui (Madagascar) est REFUSÉE
 *     (« postérieure à aujourd'hui ») et la valeur par défaut est en avance
 *     d'un jour. Le test force le fuseau du processus à UTC (déploiement
 *     réaliste) et simule l'horloge à 2026-10-20T23:30:00Z, instant où le
 *     jour madagascarais est le 21 octobre alors que le jour UTC est le 20.
 *
 *  2. MANDATAIRE — le champ `mandataire_nom` (personne mandatée par le
 *     détenteur pour retirer le matériel) n'existe pas : il est aujourd'hui
 *     silencieusement ignoré par la route.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

// ─── Le fuseau du SERVEUR ne doit pas être supposé être celui de Madagascar ─
// Forcé AVANT tout chargement de Strapi : c'est la situation d'un serveur
// déployé en UTC. Le correctif doit produire le même résultat dans les deux
// cas.
process.env.TZ = 'UTC';

// ─── Base temporaire : CONFIGURÉE AVANT tout chargement de Strapi ──────────
const RACINE_BACKEND = path.resolve(__dirname, '..');
const FICHIER_BASE = path.join(os.tmpdir(), `compta-remise-${process.pid}.db`);
for (const fichier of [FICHIER_BASE, `${FICHIER_BASE}-journal`]) {
  try { fs.rmSync(fichier, { force: true }); } catch (e) { /* base absente */ }
}
process.env.DATABASE_FILENAME = FICHIER_BASE;

const { createStrapi } = require('@strapi/strapi');

// Mot de passe PROVISOIRE des comptes de test (jetable, jamais affiché).
const MOT_DE_PASSE = 'Remise-Tmp-2026';

/** Instant de référence des scénarios d'horloge. */
const INSTANT_SIMULE = new Date('2026-10-20T23:30:00Z');
/** Jour calendaire à Madagascar à cet instant : 21 octobre 2026. */
const JOUR_MADAGASCAR = '2026-10-21';

/** Date calendaire d'un instant, vue de Madagascar (fuseau applicatif). */
function dateMadagascar(instant) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Antananarivo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

let strapi = null;
let BASE = '';
const jetons = {};
let compteur = 0;

/** Port libre, pour ne pas entrer en collision avec un autre test. */
function portLibre() {
  return new Promise((resolve, reject) => {
    const serveur = net.createServer();
    serveur.once('error', reject);
    serveur.listen(0, '127.0.0.1', () => {
      const port = serveur.address().port;
      serveur.close(() => resolve(port));
    });
  });
}

async function creerUtilisateur(roleType, cle) {
  const role = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: roleType } });
  assert.ok(role, `rôle « ${roleType} » attendu dans la base temporaire`);
  return strapi.plugin('users-permissions').service('user').add({
    username: cle,
    email: `${cle}.remise@example.local`,
    password: MOT_DE_PASSE,
    provider: 'local',
    confirmed: true,
    blocked: false,
    role: role.id,
  });
}

async function jetonDe(cle) {
  const reponse = await fetch(`${BASE}/api/auth/local`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: `${cle}.remise@example.local`, password: MOT_DE_PASSE }),
  });
  assert.strictEqual(reponse.status, 200, `connexion ${cle} : HTTP ${reponse.status}`);
  const corps = await reponse.json();
  assert.ok(corps.jwt, 'jeton absent de la réponse de connexion');
  return corps.jwt; // jamais journalisé
}

async function api(method, url, cle, corps) {
  const reponse = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      ...(corps ? { 'content-type': 'application/json' } : {}),
      ...(cle ? { authorization: `Bearer ${jetons[cle]}` } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const texte = await reponse.text();
  let parsed;
  try { parsed = JSON.parse(texte); } catch (e) { parsed = { brut: texte.slice(0, 200) }; }
  return { status: reponse.status, corps: parsed };
}

const messageDe = (r) => r.corps?.error?.message ?? r.corps?.message ?? '';

/**
 * Crée une sortie « validee » (avec son matériel, sa ligne et sa demande
 * liée). Chaque test dispose de sa propre sortie : les remises sont
 * mutantes.
 */
async function creerSortieValidee(options = {}) {
  compteur += 1;
  const suffixe = `${process.pid}-${compteur}`;
  const materiel = await strapi.documents('api::material.material').create({
    data: {
      designation: `Matériel ${suffixe}`,
      quantite_stock: 10,
      statut: 'en_stock',
    },
  });
  const demande = await strapi.documents('api::demande.demande').create({
    data: {
      reference: `DEM-REMISE-${suffixe}`,
      type: 'sortie',
      designation_materiel: `Matériel ${suffixe}`,
      quantite: 2,
      statut: 'approuvee',
      date_demande: '2026-10-01',
      demandeur: (await demanderDemandeur()).documentId,
    },
  });
  const sortie = await strapi.documents('api::sortie.sortie').create({
    data: {
      reference: `SOR-REMISE-${suffixe}`,
      date_sortie: '2026-10-02',
      statut: options.statut || 'validee',
      demande: demande.documentId,
      ...(options.dateSignatureLogistique === undefined
        ? { date_signature_logistique: '2026-10-19T12:00:00.000Z' }
        : { date_signature_logistique: options.dateSignatureLogistique }),
    },
  });
  await strapi.documents('api::sortie-ligne.sortie-ligne').create({
    data: {
      sortie: sortie.documentId,
      materiel: materiel.documentId,
      quantite: 2,
      valeur_unitaire: 1500,
      etat: 'neuf',
      numero_logistique: `NL-${suffixe}`,
    },
  });
  return { sortie, demande, materiel };
}

let _demandeur = null;
async function demanderDemandeur() {
  if (!_demandeur) throw new Error('utilisateur demandeur non initialisé');
  return _demandeur;
}

/* ═══════════════════════ Démarrage / arrêt de Strapi ═════════════════════ */

test.before(async () => {
  const port = await portLibre();
  process.env.PORT = String(port);
  process.env.HOST = '127.0.0.1';
  BASE = `http://127.0.0.1:${port}`;

  strapi = createStrapi({
    appDir: RACINE_BACKEND,
    distDir: RACINE_BACKEND,
    autoReload: false,
    serveAdminPanel: false,
  });
  // Silence ABSOLU : le bootstrap journalise les mots de passe de démonstration.
  strapi.log.level = 'silent';
  if (strapi.startupLogger && typeof strapi.startupLogger.disable === 'function') {
    strapi.startupLogger.disable();
  }
  await strapi.load();
  await strapi.listen();

  await creerUtilisateur('magasinier', 'magasinier-remise');
  await creerUtilisateur('depositaire', 'depositaire-remise');
  await creerUtilisateur('logistique', 'logistique-remise');
  _demandeur = await creerUtilisateur('demandeur', 'demandeur-remise');

  jetons.magasinier = await jetonDe('magasinier-remise');
  jetons.depositaire = await jetonDe('depositaire-remise');
  jetons.logistique = await jetonDe('logistique-remise');
  jetons.demandeur = await jetonDe('demandeur-remise');
});

test.after(async () => {
  if (strapi) {
    try { await strapi.destroy(); } catch (e) { /* la base sera libérée */ }
  }
  for (let tentative = 0; tentative < 10; tentative += 1) {
    try {
      fs.rmSync(FICHIER_BASE, { force: true });
      fs.rmSync(`${FICHIER_BASE}-journal`, { force: true });
      break;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
});

/* ═══════════════════════════ Les scénarios ═══════════════════════════════ */

test('remise : sans mandataire — statut, champs stockés, stock inchangé, mouvement et demande suivis', async () => {
  const { sortie, demande, materiel } = await creerSortieValidee();

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
  });

  assert.strictEqual(r.status, 200, `HTTP ${r.status} — ${messageDe(r)}`);
  const remise = r.corps.data;
  assert.strictEqual(remise.statut, 'sortie_effectuee', 'statut non mis à jour');
  assert.strictEqual(remise.detenteur_nom, 'Rakoto Hery', 'détenteur non stocké');
  assert.strictEqual(remise.detenteur_fonction, 'Dépositaire', 'fonction du détenteur non stockée');
  assert.strictEqual(remise.date_remise, dateMadagascar(new Date()), 'date de remise par défaut incorrecte');
  assert.ok(!remise.mandataire_nom, 'un mandataire vide ne doit rien écrire');

  // Le stock du matériel n'est PAS touché par une remise.
  const stock = await api('GET', `/api/materials/${materiel.documentId}`, 'magasinier');
  assert.strictEqual(stock.corps.data.quantite_stock, 10, 'le stock a été modifié par la remise');

  // La demande liée passe en « sortie_effectuee ».
  const demandeApres = await api('GET', `/api/demandes/${demande.documentId}`, 'magasinier');
  assert.strictEqual(demandeApres.corps.data.statut, 'sortie_effectuee', 'demande liée non mise à jour');

  // Le mouvement de traçage existe, daté du jour de la remise.
  const mouvements = await api('GET', '/api/mouvements?populate=sortie&pagination[pageSize]=100', 'magasinier');
  const traces = (mouvements.corps.data || []).filter(
    (m) => m.sortie && m.sortie.documentId === sortie.documentId
  );
  const remises = traces.filter((m) => m.action === 'Remise au détenteur');
  assert.strictEqual(remises.length, 1, `mouvement de remise attendu, trouvé ${remises.length}`);
  assert.strictEqual(remises[0].date_mouvement, dateMadagascar(new Date()), 'mouvement mal daté');
  assert.strictEqual(remises[0].statut, 'sortie_effectuee', 'statut du mouvement inattendu');
});

test('remise : avec mandataire — le nom est taillé, stocké et relu', async () => {
  const { sortie } = await creerSortieValidee();

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'depositaire', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
    mandataire_nom: '  Andrianina Fara  ',
  });

  assert.strictEqual(r.status, 200, `HTTP ${r.status} — ${messageDe(r)}`);
  assert.strictEqual(r.corps.data.mandataire_nom, 'Andrianina Fara', 'mandataire non stocké (ou non taillé)');

  // La relecture renvoie bien le champ.
  const lecture = await api('GET', `/api/sorties/${sortie.documentId}`, 'depositaire');
  assert.strictEqual(lecture.corps.data.mandataire_nom, 'Andrianina Fara', 'mandataire absent de la lecture');
});

test('remise : un mandataire composé d’espaces n’écrit rien', async () => {
  const { sortie } = await creerSortieValidee();

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
    mandataire_nom: '   ',
  });

  assert.strictEqual(r.status, 200, `HTTP ${r.status} — ${messageDe(r)}`);
  assert.ok(!r.corps.data.mandataire_nom, 'un mandataire vide ne doit rien écrire');
});

test('remise : un mandataire de plus de 150 caractères est refusé (400)', async () => {
  const { sortie } = await creerSortieValidee();

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
    mandataire_nom: 'a'.repeat(151),
  });

  assert.strictEqual(r.status, 400, `attendu 400, reçu ${r.status} — ${messageDe(r)}`);
  // La sortie n'a pas été touchée.
  const lecture = await api('GET', `/api/sorties/${sortie.documentId}`, 'magasinier');
  assert.strictEqual(lecture.corps.data.statut, 'validee', 'la sortie a été modifiée malgré le refus');
});

test('remise : le chef logistique ne peut pas remettre (403)', async () => {
  const { sortie } = await creerSortieValidee();

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'logistique', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
  });

  assert.strictEqual(r.status, 403, `attendu 403, reçu ${r.status} — ${messageDe(r)}`);
});

test('remise : le demandeur ne peut pas remettre (403)', async () => {
  const { sortie } = await creerSortieValidee();

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'demandeur', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
  });

  assert.strictEqual(r.status, 403, `attendu 403, reçu ${r.status} — ${messageDe(r)}`);
});

test('remise : une sortie non validée est refusée (400)', async () => {
  const { sortie } = await creerSortieValidee({ statut: 'en_preparation' });

  const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
  });

  assert.strictEqual(r.status, 400, `attendu 400, reçu ${r.status} — ${messageDe(r)}`);
});

test('remise : une seconde remise sur la même sortie est refusée (409)', async () => {
  const { sortie } = await creerSortieValidee();

  const premiere = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
  });
  assert.strictEqual(premiere.status, 200, `première remise : HTTP ${premiere.status} — ${messageDe(premiere)}`);

  const seconde = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
    detenteur_nom: 'Rakoto Hery',
    detenteur_fonction: 'Dépositaire',
  });
  assert.strictEqual(seconde.status, 409, `attendu 409, reçu ${seconde.status} — ${messageDe(seconde)}`);
});

/* ── Scénarios d'horloge : horloge simulée à 2026-10-20T23:30:00Z ───────── */

test('remise : horloge simulée — une remise datée du jour à Madagascar est acceptée', async () => {
  test.mock.timers.enable({ apis: ['Date'], now: INSTANT_SIMULE });
  try {
    const { sortie } = await creerSortieValidee({ dateSignatureLogistique: '2026-10-19T12:00:00.000Z' });

    const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
      detenteur_nom: 'Rakoto Hery',
      detenteur_fonction: 'Dépositaire',
      date_remise: JOUR_MADAGASCAR,
    });

    assert.strictEqual(
      r.status,
      200,
      `une remise datée d'aujourd'hui à Madagascar (${JOUR_MADAGASCAR}) doit être acceptée — HTTP ${r.status} : ${messageDe(r)}`
    );
    assert.strictEqual(r.corps.data.date_remise, JOUR_MADAGASCAR, 'date de remise enregistrée incorrecte');
  } finally {
    test.mock.timers.reset();
  }
});

test('remise : horloge simulée — le jour de la validation logistique est accepté', async () => {
  test.mock.timers.enable({ apis: ['Date'], now: INSTANT_SIMULE });
  try {
    // Signature logistique du 19 octobre 2026 à 12:00 UTC → 19 octobre à
    // Madagascar (15:00 locales). La remise du jour de la validation est
    // admise.
    const { sortie } = await creerSortieValidee({ dateSignatureLogistique: '2026-10-19T12:00:00.000Z' });

    const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
      detenteur_nom: 'Rakoto Hery',
      detenteur_fonction: 'Dépositaire',
      date_remise: '2026-10-19',
    });

    assert.strictEqual(
      r.status,
      200,
      `le jour de la validation doit être accepté — HTTP ${r.status} : ${messageDe(r)}`
    );
  } finally {
    test.mock.timers.reset();
  }
});

test('remise : horloge simulée — une remise datée du lendemain à Madagascar est refusée (400)', async () => {
  test.mock.timers.enable({ apis: ['Date'], now: INSTANT_SIMULE });
  try {
    const { sortie } = await creerSortieValidee();

    const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
      detenteur_nom: 'Rakoto Hery',
      detenteur_fonction: 'Dépositaire',
      date_remise: '2026-10-22',
    });

    assert.strictEqual(
      r.status,
      400,
      `une remise datée du lendemain à Madagascar doit être refusée — HTTP ${r.status} : ${messageDe(r)}`
    );
  } finally {
    test.mock.timers.reset();
  }
});

test('remise : horloge simulée — la date par défaut est le jour à Madagascar', async () => {
  test.mock.timers.enable({ apis: ['Date'], now: INSTANT_SIMULE });
  try {
    const { sortie } = await creerSortieValidee();

    const r = await api('POST', `/api/sorties/${sortie.documentId}/remise`, 'magasinier', {
      detenteur_nom: 'Rakoto Hery',
      detenteur_fonction: 'Dépositaire',
    });

    assert.strictEqual(r.status, 200, `HTTP ${r.status} — ${messageDe(r)}`);
    assert.strictEqual(
      r.corps.data.date_remise,
      JOUR_MADAGASCAR,
      `date par défaut : attendu ${JOUR_MADAGASCAR} (jour à Madagascar), reçu ${r.corps.data.date_remise}`
    );
  } finally {
    test.mock.timers.reset();
  }
});
