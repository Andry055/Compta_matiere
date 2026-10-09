'use strict';

/**
 * Liaison entrée ↔ matériel + photo de référence de la fiche.
 *
 * Trois engagements verrouillés ici, sans démarrer Strapi (harnais
 * `node --test`, même approche que tests/photos-entree-ligne.test.js) :
 *
 *   1. `material` expose bien le champ media `photos` — sans lui, aucun
 *      fichier ne peut être rattaché à une fiche et l'écran reste vide ;
 *   2. la relation entree_ligne → material part DÈS LA SAISIE (l'entrée ne
 *      devine jamais une correspondance approximative) et `appliquerImpactStock`
 *      (3ᵉ signature) reste inchangé ;
 *   3. la Fiche de stock renvoie l'en-tête de la fiche, photo de référence
 *      incluse — et continue de fonctionner sans photo.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const SCHEMA_MATERIEL = path.join(
  racine, 'src', 'api', 'material', 'content-types', 'material', 'schema.json'
);
const SCHEMA_LIGNE = path.join(
  racine, 'src', 'api', 'entree-ligne', 'content-types', 'entree-ligne', 'schema.json'
);
const CONTROLEUR_ENTREE = path.join(
  racine, 'src', 'api', 'entree', 'controllers', 'entree.js'
);
const CONTROLEUR_RAPPORT = path.join(
  racine, 'src', 'api', 'rapport', 'controllers', 'rapport.js'
);
const BOOTSTRAP = path.join(racine, 'src', 'index.js');
const CALCULS = path.join(
  racine, 'src', 'api', 'rapport', 'services', 'redition-calculs.js'
);

const lire = (f) => fs.readFileSync(f, 'utf8');

/* ───────────── 1. Le champ media `photos` existe sur material ───────────── */

test('material expose un champ media `photos` (multiple, images, optionnel)', () => {
  const schema = JSON.parse(lire(SCHEMA_MATERIEL));
  const photos = schema.attributes.photos;

  assert.ok(photos, 'le champ photos doit exister sur material');
  assert.strictEqual(photos.type, 'media');
  assert.strictEqual(photos.multiple, true, 'plusieurs photos possibles');
  assert.deepStrictEqual(photos.allowedTypes, ['images']);
  // Optionnel : un matériel sans photo reste utilisable normalement.
  assert.notStrictEqual(photos.required, true);

  // Même MECHANISME que les photos de contrôle des lignes d'entrée.
  const ligne = JSON.parse(lire(SCHEMA_LIGNE));
  assert.strictEqual(ligne.attributes.photos.type, 'media');
  assert.strictEqual(ligne.attributes.photos.multiple, photos.multiple);
  assert.deepStrictEqual(
    ligne.attributes.photos.allowedTypes,
    photos.allowedTypes
  );

  // Les champs métier de la fiche sont intacts (aucun renommage).
  assert.strictEqual(schema.attributes.designation.type, 'string');
  assert.strictEqual(schema.attributes.nomenclature.type, 'string');
  assert.strictEqual(
    schema.attributes.lignes_entree.target,
    'api::entree-ligne.entree-ligne'
  );
});

/* ───── 2. La relation part à la saisie, l'impact stock reste identique ───── */

test('create-complete rattache la ligne au matériel fourni à la saisie (materiel_id)', () => {
  const source = lire(CONTROLEUR_ENTREE);

  // a) Le client décide : `materiel_id` du corps est repris tel quel.
  assert.match(
    source,
    /let materielId = ligne\.materiel_id \|\| null/,
    'la relation provient du choix EXPLICITE du client'
  );
  // b) … et est persisté sur la ligne créée.
  assert.match(source, /materiel:\s*materielId/);
  // c) Aucune recherche approximative côté serveur : sans décision client,
  //    seul le rapprochement EXACT historique (insensible à la casse) s'applique.
  assert.match(
    source,
    /filters:\s*\{\s*designation:\s*\{\s*\$eqi:\s*designation\s*\}\s*\}/,
    'jamais de correspondance approchée déduite côté serveur'
  );
  assert.doesNotMatch(
    source,
    /levenshtein/i,
    "aucune détection approximative (ni IA) côté serveur : l'utilisateur tranche"
  );
});

test("appliquerImpactStock (3ᵉ signature) reste inchangé : unique et garde-fou", () => {
  const source = lire(CONTROLEUR_ENTREE);
  const bloc = source.slice(
    source.indexOf('async function appliquerImpactStock'),
    source.indexOf('/** Trace l')
  );

  assert.ok(bloc.length > 0, 'le bloc appliquerImpactStock est présent');
  // Garde-fou : jamais d'impact deux fois.
  assert.match(bloc, /if \(entree\.stock_impacte === true\) return;/);
  // La relation DÉJÀ posée à la saisie est prioritaire sur le texte libre.
  assert.match(bloc, /let materiel = ligne\.materiel;/);
  // Incrémentation du stock par la quantité de la ligne.
  assert.match(bloc, /quantite_stock:\s*nouvelleQuantite/);
  assert.match(
    bloc,
    /\(Number\(materiel\.quantite_stock\) \|\| 0\) \+ \(Number\(ligne\.quantite\) \|\| 0\)/
  );
  // Déclenchement uniquement à 3/3 signatures.
  assert.match(source, /if \(nbSignatures === 3\) \{/);
  assert.match(source, /appliquerImpactStock\(app,/);
});

test('bootstrap : création de fiche autorisée aux signataires, lecture des photos à tous', () => {
  const source = lire(BOOTSTRAP);

  // POST /api/materials depuis la saisie (« c'est un nouvel article »).
  assert.match(
    source,
    /'api::material\.material\.create'/,
    'permission de création de fiche accordée'
  );
  // … aux rôles de signature seulement (jamais le Demandeur, gardé par roleGuard).
  const blocSignataires = source.slice(
    source.indexOf('const ENTREE_SIGN_ACTIONS'),
    source.indexOf('const AFFECTATION_ACTIONS')
  );
  assert.match(blocSignataires, /'api::material\.material\.create'/);
  const blocDemandeur = source.slice(
    source.indexOf('const DEMANDEUR_ENTREE_ACTIONS'),
    source.indexOf('const DEMO_DEMANDEUR')
  );
  assert.doesNotMatch(
    blocDemandeur,
    /'api::material\.material\.create'/,
    'le Demandeur ne crée pas de fiche (son écriture reste limitée aux demandes)'
  );

  // Lecture des médias pour TOUS les rôles : sinon le sanitizer retire le
  // champ `photos` des réponses et la vignette n'apparaît jamais.
  assert.match(source, /'plugin::upload\.content-api\.find'/);
  assert.match(
    source,
    /for \(const def of APP_ROLES\) \{[\s\S]*?plugin::upload\.content-api\.find/,
    'la lecture des photos est accordée à tous les rôles métier'
  );
  // L'upload reste réservé aux habilités (pas d'écriture pour tout le monde).
  assert.match(source, /const UPLOAD_ACTIONS = \[/);
});

/* ───────── 3. La Fiche de stock porte la photo de référence ───────── */

test("calculerGrandLivre renvoie l'en-tête de la fiche (photo de référence)", () => {
  const calculs = require(CALCULS);

  const entrees = [
    {
      id: 11, documentId: 'l11', date: '2026-10-05', reference: 'ENT-2026-001',
      statut: 'validee', quantite: 4, montant: 11200000,
      materielId: 'doc-rv340', designation: 'Routeur Cisco RV 340', nomenclature: '05',
    },
    {
      id: 12, documentId: 'l12', date: '2026-10-06', reference: 'ENT-2026-002',
      statut: 'validee', quantite: 2, montant: 5000,
      materielId: 'autre-fiche', designation: 'Chaise de bureau', nomenclature: '03',
    },
    {
      id: 13, documentId: 'l13', date: '2026-10-07', reference: 'ENT-2026-003',
      statut: 'en_attente', quantite: 9, montant: 9,
      materielId: 'doc-rv340', designation: 'Routeur Cisco RV 340', nomenclature: '05',
    },
  ];

  const fiche = {
    documentId: 'doc-rv340',
    designation: 'Routeur Cisco RV340',
    nomenclature: '05',
    photo: '/uploads/materiel_7.jpg',
  };

  const gl = calculs.calculerGrandLivre({
    materielId: 'doc-rv340',
    entrees,
    sorties: [],
    annee: 2026,
    materiel: fiche,
  });

  // En-tête de fiche : identité + photo de référence (1ʳᵉ image).
  assert.deepStrictEqual(gl.materiel, fiche);
  // Les lignes RATTACHÉES au matériel (relation posée à la saisie) alimentent
  // la fiche : c'est là que le rapprochement confirmé devient visible.
  assert.strictEqual(gl.mouvements.length, 1, 'ligne validée du matériel suivi');
  assert.strictEqual(gl.mouvements[0].reference, 'ENT-2026-001');
  assert.strictEqual(gl.mouvements[0].quantiteCumulee, 4);
  assert.strictEqual(gl.quantiteFinale, 4);
  assert.strictEqual(gl.totalEntreesQ, 4);
});

test('Fiche de stock sans photo (ou sans en-tête) reste normalement calculée', () => {
  const calculs = require(CALCULS);
  const entrees = [
    {
      id: 21, documentId: 'l21', date: '2026-01-10', reference: 'ENT-2026-010',
      statut: 'validee', quantite: 3, montant: 3000,
      materielId: 'doc-chaise', designation: 'Chaise de bureau', nomenclature: '03',
    },
  ];

  // a) Fiche sans photo : l'en-tête est renvoyé, photo à null.
  const sansPhoto = calculs.calculerGrandLivre({
    materielId: 'doc-chaise',
    entrees,
    sorties: [],
    materiel: {
      documentId: 'doc-chaise',
      designation: 'Chaise de bureau',
      nomenclature: '03',
      photo: null,
    },
  });
  assert.strictEqual(sansPhoto.materiel.photo, null);
  assert.strictEqual(sansPhoto.quantiteFinale, 3);

  // b) Aucun en-tête fourni (matériel introuvable / appel ancien) : pas d'erreur.
  const sansEntete = calculs.calculerGrandLivre({
    materielId: 'doc-chaise',
    entrees,
    sorties: [],
  });
  assert.strictEqual(sansEntete.materiel, null);
  assert.strictEqual(sansEntete.quantiteFinale, 3);
  assert.strictEqual(sansEntete.mouvements.length, 1);
});

test('le contrôleur de rapport peuple la photo de la fiche matériel', () => {
  const source = lire(CONTROLEUR_RAPPORT);

  // Chargement de la fiche AVEC le champ media.
  assert.match(source, /populate:\s*\['photos'\]/);
  assert.match(source, /async function chargerFicheMateriel/);
  // Première photo en guise de vignette, null si absence.
  assert.match(source, /photos\.find\(\(p\) => p && p\.url\)/);
  assert.match(source, /photo: \(premiere && premiere\.url\) \|\| null/);
  // L'en-tête est transmis au calcul (pur) puis renvoyé au client.
  assert.match(source, /materiel:\s*fiche/);
  assert.match(source, /chargerFicheMateriel\(app, materiel\)/);
});
