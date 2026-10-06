'use strict';

/**
 * Photos de la réception matérielle — persistance côté serveur.
 *
 * Les photos sont stockées par le plugin d'upload NATIF de Strapi
 * (POST /api/upload : ref=api::entree-ligne.entree-ligne, refId=<ligne>,
 * field="photos"). Sans champ media déclaré, cet appel ne peut RIEN
 * rattacher : ce fichier verrouille donc ce qui rend la persistance possible,
 * sans démarrer Strapi (le harnais du projet est `node --test`).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = path.join(
  __dirname,
  '..',
  'src',
  'api',
  'entree-ligne',
  'content-types',
  'entree-ligne',
  'schema.json'
);
const CONTROLEUR = path.join(
  __dirname,
  '..',
  'src',
  'api',
  'entree',
  'controllers',
  'entree.js'
);

/* ────────────────────── 1. Le champ media existe vraiment ────────────────────── */

test('entree-ligne expose un champ media `photos` (multiple, images)', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  const photos = schema.attributes.photos;

  assert.ok(photos, 'le champ photos doit exister sur entree-ligne');
  assert.strictEqual(photos.type, 'media');
  assert.strictEqual(photos.multiple, true, 'plusieurs photos par ligne');
  assert.deepStrictEqual(photos.allowedTypes, ['images']);

  // Non requis : une entrée sans photo doit se signer normalement.
  assert.notStrictEqual(photos.required, true);

  // Les autres champs de contrôle du magasinier sont intacts.
  assert.strictEqual(schema.attributes.etat.type, 'enumeration');
  assert.strictEqual(schema.attributes.conforme.type, 'boolean');
});

/* ───────────── 2. Les photos reviennent dans les réponses (populate) ───────────── */

test('le contrôleur populate les photos des lignes et renvoie les cibles d\'upload', () => {
  const source = fs.readFileSync(CONTROLEUR, 'utf8');

  // a) `loadEntree` peuple les photos des LIGNES (forme imbriquée) : sans cela
  //    les pièces jointes seraient vides après un simple rechargement.
  const loadEntree = source.slice(
    source.indexOf('async function loadEntree'),
    source.indexOf('async function findMaterielByDesignation')
  );
  assert.match(loadEntree, /lignes:\s*\{\s*populate:\s*\[[^\]]*photos/, 'photos peuplées sur les lignes');

  // b) La signature expose la correspondance numero_ordre → documentId, ce qui
  //    permet au client de rattacher chaque photo à la BONNE ligne sans
  //    re-lecture supplémentaire.
  assert.match(source, /lignesPhotos/, 'meta.lignesPhotos renvoyé par /sign');
  assert.match(source, /documentId:\s*ligne\.documentId/);

  // c) La signature ne dépend JAMAIS des photos : aucun filtre ni rejet ne porte
  //    sur un envoi de photo, et le contrôle d'intégrité reste limité à
  //    etat/conforme (une entrée sans photo passe).
  const blocControles = source.slice(
    source.indexOf("roleKey === 'chef_service_1' && Array.isArray(body.controles)"),
    source.indexOf('// --- Pose de la signature')
  );
  assert.ok(blocControles.length > 0, 'le bloc de contrôle groupé est présent');
  assert.doesNotMatch(
    blocControles,
    /photos?\s*(===|!==|==|!=)\s*(undefined|null|false|true|\d)/,
    'la validation ne doit dépendre d\'aucune photo'
  );
  assert.match(blocControles, /ETATS_VALIDES\.includes\(controle\.etat\)/);
  assert.match(blocControles, /typeof controle\.conforme !== 'boolean'/);
});