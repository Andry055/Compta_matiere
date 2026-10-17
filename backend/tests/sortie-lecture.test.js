'use strict';

/**
 * Étape 1 du circuit de sortie — schémas, routes et lecture sécurisée.
 *
 * Engagements verrouillés ici, sans démarrer Strapi (harnais `node --test`,
 * même approche que tests/photos-entree-ligne.test.js) :
 *
 *   1. les nouveaux champs existent (types + valeurs par défaut) dans `sortie`
 *      et `sortie-ligne`, sans rien retirer à l'existant ;
 *   2. le routeur ne déclare QUE les deux routes GET — aucune route
 *      d'écriture sur /api/sorties ;
 *   3. le filtre « demandeur » est PUR : il ne voit que ses sorties, un filtre
 *      client ne peut que restreindre, et findOne renvoie 404 (pas 403) pour
 *      la sortie d'un autre ;
 *   4. les listes de permissions dédiées aux sorties contiennent les actions
 *      attendues… et les listes d'ENTRÉES n'ont pas bougé.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SCHEMA_SORTIE = path.join(
  racine, 'src', 'api', 'sortie', 'content-types', 'sortie', 'schema.json'
);
const SCHEMA_LIGNE = path.join(
  racine, 'src', 'api', 'sortie-ligne', 'content-types', 'sortie-ligne', 'schema.json'
);
const ROUTES = path.join(racine, 'src', 'api', 'sortie', 'routes', 'sortie.js');
const CONTROLEUR = path.join(racine, 'src', 'api', 'sortie', 'controllers', 'sortie.js');
const BOOTSTRAP = path.join(racine, 'src', 'index.js');

const lire = (f) => fs.readFileSync(f, 'utf8');

/** Commentaires retirés : les assertions « ceci n'existe plus » portent sur le
 *  CODE, pas sur la documentation qui le décrit. */
function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((ligne) => !/^\s*\/\//.test(ligne))
    .join('\n');
}

/** Extrait un tableau de littéraux `api::...` déclaré dans le bootstrap. */
function extraireActions(source, nomConst) {
  const debut = source.indexOf(`const ${nomConst} = [`);
  assert.notStrictEqual(debut, -1, `constante ${nomConst} introuvable`);
  const fin = source.indexOf('];', debut);
  assert.notStrictEqual(fin, -1, `fin de ${nomConst} introuvable`);
  const bloc = source.slice(debut, fin);
  return { bloc, actions: bloc.match(/'(api::[^']+)'/g).map((s) => s.slice(1, -1)) };
}

/* ───────────────── 1. Schéma `sortie` : les nouveaux champs ───────────────── */

test('sortie expose les champs de signature, de stock et de remise', () => {
  const schema = JSON.parse(lire(SCHEMA_SORTIE));
  const a = schema.attributes;

  // 3 signatures (booléens à false) + horodatage + nom du signataire.
  for (const role of ['magasinier', 'depositaire', 'logistique']) {
    const signed = a[`${role}_signed`];
    assert.ok(signed, `champ ${role}_signed attendu`);
    assert.strictEqual(signed.type, 'boolean');
    assert.strictEqual(signed.default, false, `${role}_signed vaut false par défaut`);

    assert.ok(a[`signataire_${role}`], `champ signataire_${role} attendu`);
    assert.strictEqual(a[`signataire_${role}`].type, 'text');

    assert.ok(a[`date_signature_${role}`], `champ date_signature_${role} attendu`);
    assert.strictEqual(a[`date_signature_${role}`].type, 'text');
  }

  // Impact stock : garde-fou d'unicité, identique à `entree.stock_impacte`.
  assert.strictEqual(a.stock_impacte.type, 'boolean');
  assert.strictEqual(a.stock_impacte.default, false);

  // Remise au détenteur.
  for (const champ of ['detenteur_nom', 'detenteur_fonction', 'date_remise']) {
    assert.ok(a[champ], `champ ${champ} attendu`);
    assert.strictEqual(a[champ].type, 'text');
  }
});

test('sortie : aucun champ existant n\'a été retiré', () => {
  const schema = JSON.parse(lire(SCHEMA_SORTIE));
  const a = schema.attributes;

  assert.strictEqual(a.reference.type, 'string');
  assert.strictEqual(a.date_sortie.type, 'date');
  assert.strictEqual(a.date_sortie.required, true);
  assert.deepStrictEqual(
    a.statut.enum,
    ['demandee', 'en_preparation', 'validee', 'sortie_effectuee', 'annulee']
  );
  assert.strictEqual(a.demande.target, 'api::demande.demande');
  assert.strictEqual(a.direction.target, 'api::direction.direction');
  assert.strictEqual(a.service.target, 'api::service.service');
  assert.strictEqual(a.lignes.target, 'api::sortie-ligne.sortie-ligne');
  assert.strictEqual(a.mouvements.target, 'api::mouvement.mouvement');
  assert.strictEqual(a.beneficiaire.type, 'string');
  assert.strictEqual(a.responsable.type, 'string');
  assert.strictEqual(a.justificatif.type, 'string');
  assert.strictEqual(a.observations.type, 'text');
});

/* ─────────────── 2. Schéma `sortie-ligne` : etat + numero_logistique ───────── */

test('sortie-ligne : etat (neuf/bon/moyen/defaillant) et numero_logistique', () => {
  const schema = JSON.parse(lire(SCHEMA_LIGNE));
  const a = schema.attributes;

  assert.strictEqual(a.etat.type, 'enumeration');
  assert.deepStrictEqual(a.etat.enum, ['neuf', 'bon', 'moyen', 'defaillant']);
  // « vide par défaut » : aucune valeur imposée à la création (comme `etat`
  // de entree-ligne) — une ligne sans contrôle reste stockable.
  assert.strictEqual(a.etat.default, undefined);
  assert.notStrictEqual(a.etat.required, true);

  assert.strictEqual(a.numero_logistique.type, 'text');
  assert.notStrictEqual(a.numero_logistique.required, true, 'champ optionnel');

  // Les champs existants sont intacts.
  assert.strictEqual(a.quantite.type, 'integer');
  assert.strictEqual(a.quantite.required, true);
  assert.strictEqual(a.materiel.target, 'api::material.material');
  assert.strictEqual(a.sortie.target, 'api::sortie.sortie');
  assert.strictEqual(a.valeur_unitaire.type, 'decimal');
  assert.strictEqual(a.observations.type, 'string');
});

/* ───── 3. Routeur : lecture GET + endpoints custom du circuit (étapes 2-3) ───── */

test('le routeur déclare les lectures GET (liste, distributions, détail) et les 4 endpoints custom', () => {
  const mod = require(ROUTES);
  const routes = mod.routes;

  assert.ok(Array.isArray(routes), 'module.exports.routes attendu');
  assert.strictEqual(routes.length, 7, '3 lectures GET + 4 POST du circuit');

  const signatures = routes.map((r) => `${r.method} ${r.path}`).sort();
  assert.deepStrictEqual(signatures, [
    'GET /sorties',
    'GET /sorties/:id',
    'GET /sorties/distributions',
    'POST /sorties/:documentId/reject',
    'POST /sorties/:documentId/remise',
    'POST /sorties/:documentId/sign',
    'POST /sorties/create-complete',
  ]);

  assert.strictEqual(routes.find((r) => r.path === '/sorties').handler, 'sortie.find');
  assert.strictEqual(routes.find((r) => r.path === '/sorties/distributions').handler, 'sortie.findDistributions');
  assert.strictEqual(routes.find((r) => r.path === '/sorties/:id').handler, 'sortie.findOne');
  assert.strictEqual(routes.find((r) => r.path === '/sorties/create-complete').handler, 'sortie.createComplete');
  assert.strictEqual(routes.find((r) => r.path === '/sorties/:documentId/sign').handler, 'sortie.sign');
  assert.strictEqual(routes.find((r) => r.path === '/sorties/:documentId/reject').handler, 'sortie.reject');
  assert.strictEqual(routes.find((r) => r.path === '/sorties/:documentId/remise').handler, 'sortie.remise');

  // Lecture AUTHENTIFIÉE : sans session résolue, le sanitizer Strapi retire
  // les relations (lignes, direction, service, demande) de la réponse.
  for (const route of routes) {
    assert.ok(!route.auth, `pas de override d'authentification sur ${route.path}`);
    assert.ok(!route.config, `pas de config inutile sur ${route.path}`);
    assert.ok(['GET', 'POST'].includes(route.method), `méthode attendue sur ${route.path}`);
  }
});

test('le routeur n\'utilise plus createCoreRouter ni auth: false', () => {
  const code = sansCommentaires(lire(ROUTES));
  assert.doesNotMatch(code, /createCoreRouter/, 'routes déclarées explicitement');
  assert.doesNotMatch(code, /auth:\s*false/, 'jamais de lecture anonyme');
  // Étapes 2-3 : POST /sorties/create-complete, /sign et /reject sont legal ;
  // AUCUNE autre écriture (PUT / PATCH / DELETE) n'apparaît dans le routeur.
  assert.doesNotMatch(code, /\bPUT\b|\bPATCH\b|\bDELETE\b/);
});

/* ───────────── 4. Filtre demandeur : fonction pure, findOne → 404 ──────────── */

const { filtreAppropriation, verifierAccesSortie } = require(
  path.join(racine, 'src', 'utils', 'sortieAcces.js')
);

/** Mini-moteur de filtres : n'évalue que les formes produites par
 *  `filtreAppropriation` ($in, $and, égalité) sur une liste en mémoire. */
function appliquerFiltre(filtre, sorties) {
  if (!filtre) return sorties;
  if (Array.isArray(filtre.$and)) {
    return sorties.filter((s) => filtre.$and.every((f) => appliquerFiltre(f, [s]).length === 1));
  }
  return sorties.filter((s) =>
    Object.entries(filtre).every(([cle, valeur]) => {
      if (valeur && typeof valeur === 'object' && '$in' in valeur) {
        return valeur.$in.includes(s[cle]);
      }
      return s[cle] === valeur;
    })
  );
}

const SORTIES = [
  { documentId: 's1', statut: 'validee', demande: { demandeur: { documentId: 'u-tolotra' } } },
  { documentId: 's2', statut: 'demandee', demande: { demandeur: { documentId: 'u-autre' } } },
  { documentId: 's3', statut: 'validee', demande: { demandeur: { documentId: 'u-autre' } } },
  { documentId: 's4', statut: 'validee', demande: null },
];

test('le filtre demandeur ne renvoie que SES sorties', () => {
  const miens = ['s1'];
  const vus = appliquerFiltre(filtreAppropriation(null, miens), SORTIES);
  assert.deepStrictEqual(vus.map((s) => s.documentId), ['s1']);

  // Un demandeur sans aucune sortie ne voit RIEN ($in: [] -> aucun résultat).
  assert.deepStrictEqual(appliquerFiltre(filtreAppropriation(null, []), SORTIES), []);

  // La forme envoyée au moteur porte bien sur la relation demande -> demandeur.
  assert.deepStrictEqual(filtreAppropriation(null, miens), {
    documentId: { $in: ['s1'] },
  });
});

test('un filtre client ne peut que restreindre, jamais élargir', () => {
  const miens = ['s1', 's3'];

  // a) Restreint effectivement : s1 est « validee », s3 aussi -> les deux ;
  //    en ajoutant un statut, on réduit le périmètre.
  const etroit = appliquerFiltre(
    filtreAppropriation({ statut: 'demandee' }, miens),
    SORTIES
  );
  assert.deepStrictEqual(etroit.map((s) => s.documentId), []);

  // b) Tentative d'élargissement (demander la sortie d'un autre) : le filtre
  //    client est combiné par ET -> résultat vide, jamais la sortie étrangère.
  const large = appliquerFiltre(
    filtreAppropriation({ documentId: { $in: ['s2'] } }, miens),
    SORTIES
  );
  assert.deepStrictEqual(large, []);

  // c) Combinaison par $and (jamais $or) : le client ne peut qu'en réduire.
  const combine = filtreAppropriation({ statut: 'validee' }, miens);
  assert.ok(Array.isArray(combine.$and), 'combinaison par ET');
  assert.strictEqual(combine.$or, undefined, 'jamais de OU');
  assert.deepStrictEqual(combine.$and[0], { statut: 'validee' });
  assert.deepStrictEqual(combine.$and[1], { documentId: { $in: ['s1', 's3'] } });
});

test('findOne renvoie 404 pour la sortie d\'un autre (jamais 403)', () => {
  const miens = ['s1'];

  // a) Sortie d'un autre -> refus 404, corps type NotFound.
  const ctx = { status: 200, body: null };
  const refus = verifierAccesSortie(ctx, 's3', miens);
  assert.ok(refus, 'un refus est retourné au contrôleur');
  assert.strictEqual(ctx.status, 404);
  assert.strictEqual(ctx.body.error.status, 404);
  assert.strictEqual(ctx.body.error.name, 'NotFoundError');
  assert.notStrictEqual(ctx.status, 403, 'jamais de 403 : pas de fuite d\'information');

  // b) Sortie inexistante : même réponse qu'une sortie étrangère.
  const ctxInconnu = { status: 200, body: null };
  verifierAccesSortie(ctxInconnu, 'zzz', miens);
  assert.strictEqual(ctxInconnu.status, 404);
  assert.strictEqual(ctxInconnu.body.error.message, 'Sortie introuvable.');

  // c) Sortie à lui -> aucun refus, le handler core enchaîne.
  const ctxMien = { status: 200, body: null };
  assert.strictEqual(verifierAccesSortie(ctxMien, 's1', miens), null);
  assert.strictEqual(ctxMien.body, null);
  assert.strictEqual(ctxMien.status, 200);

  // d) Identifiant absent -> refus aussi.
  const ctxSansId = { status: 200, body: null };
  assert.ok(verifierAccesSortie(ctxSansId, undefined, miens));
  assert.strictEqual(ctxSansId.status, 404);
});

test('le contrôleur applique le filtre dans la requête, avant pagination', () => {
  const source = lire(CONTROLEUR);

  // a) Filtre posé sur ctx.query.filters (muté, comme entree.find) via la
  //    fonction pure — donc DANS la requête, avant la pagination core.
  assert.match(source, /ctx\.query\.filters = filtreAppropriation\(/);
  assert.match(source, /withAppropriationFilter\(ctx, miens\)/);

  // b) Le périmètre provient de la relation demande -> demandeur (document
  //    service : ni le sanitizer ni les permissions du rôle n'entrent en jeu).
  assert.match(
    source,
    /filters:\s*\{\s*demande:\s*\{\s*demandeur:\s*\{\s*documentId:/
  );

  // c) findOne contrôle l'appropriation et renvoie le refus (404).
  assert.match(source, /verifierAccesSortie\(ctx, documentId, miens\)/);
  assert.match(source, /if \(refus\) return refus;/);

  // d) Seul le profil « demandeur » est filtré : les autres rôles lisent tout.
  assert.match(source, /isDemandeurSession\(strapi, ctx\)/);
  assert.match(source, /getRoleCode/);

  // e) Le populate du client n'est ni forcé ni retiré (fetchSorties inchangé).
  //    La vérification porte sur les handlers GET (find/findOne) — le helper
  //    loadSortie (utilisé par createComplete / sign / reject, étapes 2-3)
  //    peuple les lignes et leur matériel, il n'est JAMAIS sur le chemin d'un
  //    GET de liste.
  const code = sansCommentaires(source);
  const handlersLecture = code.slice(
    code.indexOf('module.exports'),
    code.indexOf('async createComplete')
  );
  assert.ok(handlersLecture.includes("async find("), 'handlers find/findOne couverts');
  assert.doesNotMatch(handlersLecture, /ctx\.query\.populate\s*=/);
  assert.doesNotMatch(handlersLecture, /delete ctx\.query/);
  assert.doesNotMatch(handlersLecture, /populate:\s*\{/, 'aucun populate imposé aux GET');

  // f) L'écriture reste protégée par roleGuard (aucun contournement possible).
  assert.match(source, /guardedCoreController\(createCoreController, SORTIE_UID/);
});

/* ───────────────────── 5. Permissions dédiées aux sorties ──────────────────── */

const SORTIE_ACTIONS_ATTENDUES = [
  'api::sortie.sortie.find',
  'api::sortie.sortie.findOne',
  'api::sortie.sortie.findDistributions',
  'api::sortie-ligne.sortie-ligne.find',
  'api::sortie-ligne.sortie-ligne.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::demande.demande.find',
  'api::demande.demande.findOne',
];

const ENTREE_SIGN_ACTIONS_ATTENDUES = [
  'api::entree.entree.find',
  'api::entree.entree.findOne',
  'api::entree-ligne.entree-ligne.find',
  'api::entree-ligne.entree-ligne.findOne',
  'api::entree.entree.createComplete',
  'api::entree.entree.sign',
  'api::entree.entree.reject',
  'api::fournisseur.fournisseur.find',
  'api::fournisseur.fournisseur.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  'api::material.material.create',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::mouvement.mouvement.find',
];

const DEMANDEUR_ENTREE_ACTIONS_ATTENDUES = [
  'api::entree.entree.createComplete',
  'api::entree.entree.find',
  'api::entree.entree.findOne',
  'api::entree-ligne.entree-ligne.find',
  'api::entree-ligne.entree-ligne.findOne',
  'api::fournisseur.fournisseur.find',
  'api::fournisseur.fournisseur.findOne',
  'api::material.material.find',
  'api::material.material.findOne',
  'api::category.category.find',
  'api::direction.direction.find',
  'api::service.service.find',
  'api::mouvement.mouvement.find',
];

test('la liste des permissions de sortie contient les lectures attendues', () => {
  const source = lire(BOOTSTRAP);
  const { actions } = extraireActions(source, 'SORTIE_READ_ACTIONS');
  assert.deepStrictEqual(actions, SORTIE_ACTIONS_ATTENDUES);

  // Lecture STRICTE : aucune action d'écriture sur les sorties à l'étape 1.
  assert.doesNotMatch(
    actions.join(' '),
    /\.(create|update|delete|sign|reject|createComplete)\b/,
    'étape 1 : lecture seule'
  );

  // Accordée aux rôles qui lisent les sorties aujourd'hui (dont le Demandeur,
  // dont la vue est restreinte côté contrôleur).
  const roles = source.slice(
    source.indexOf('const ROLES_LECTURE_SORTIE = ['),
    source.indexOf('];', source.indexOf('const ROLES_LECTURE_SORTIE = ['))
  );
  for (const role of ['demandeur', 'depositaire', 'magasinier', 'logistique', 'comptable']) {
    assert.match(roles, new RegExp(`'${role}'`), `rôle ${role} lit les sorties`);
  }
  assert.match(source, /for \(const action of SORTIE_READ_ACTIONS\)/);
});

test('les listes de permissions des ENTRÉES n\'ont pas changé', () => {
  const source = lire(BOOTSTRAP);

  const sign = extraireActions(source, 'ENTREE_SIGN_ACTIONS');
  assert.deepStrictEqual(sign.actions, ENTREE_SIGN_ACTIONS_ATTENDUES);
  assert.doesNotMatch(sign.bloc, /api::sortie/, 'aucune action de sortie glissée');

  const demandeur = extraireActions(source, 'DEMANDEUR_ENTREE_ACTIONS');
  assert.deepStrictEqual(demandeur.actions, DEMANDEUR_ENTREE_ACTIONS_ATTENDUES);
  assert.doesNotMatch(demandeur.bloc, /api::sortie/, 'aucune action de sortie glissée');

  // Le Demandeur ne reçoit toujours AUCUNE action de signature / de rejet.
  assert.doesNotMatch(demandeur.bloc, /\.sign'/);
  assert.doesNotMatch(demandeur.bloc, /\.reject'/);

  // Pas de duplication à l'accordement : le jeu est recalculé après les
  // créations du même boot (demande.find déjà ouverte par DEMAND_ACTIONS)…
  assert.match(source, /const accordees = new Set\(/);
  assert.match(source, /if \(accordees\.has\(cle\)\) continue;/);
  // …et chaque accordement est MÉMORISÉ au fil de l'eau (plusieurs listes
  // partagent `material.find` : sans cela, `authenticated` le recevrait deux
  // fois dans la même exécution).
  assert.match(source, /accordees\.add\(cle\)/);
});
