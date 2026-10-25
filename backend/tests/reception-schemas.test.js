'use strict';

/**
 * Validation des schémas content-types de la réception physique.
 *
 * Harnais `node --test`, SANS Strapi : on vérifie l'existence et la
 * structure déclarative de chaque fichier schema.json.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

const SCHEMAS = {
  reception: path.join(RACINE, 'src', 'api', 'reception', 'content-types', 'reception', 'schema.json'),
  'reception-ligne': path.join(RACINE, 'src', 'api', 'reception-ligne', 'content-types', 'reception-ligne', 'schema.json'),
  anomalie: path.join(RACINE, 'src', 'api', 'anomalie', 'content-types', 'anomalie', 'schema.json'),
  'journal-action': path.join(RACINE, 'src', 'api', 'journal-action', 'content-types', 'journal-action', 'schema.json'),
};

const lire = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('réception : le schéma existe et est un content-type Strapi 5', () => {
  assert.ok(fs.existsSync(SCHEMAS.reception), 'reception/schema.json existe');
  const s = lire(SCHEMAS.reception);
  assert.strictEqual(s.kind, 'collectionType');
  assert.strictEqual(s.info.singularName, 'reception');
  assert.strictEqual(s.options.draftAndPublish, false);
});

test('réception : attributs requis présents et typés', () => {
  const s = lire(SCHEMAS.reception);
  const a = s.attributes;
  assert.strictEqual(a.sortie.type, 'relation');
  assert.strictEqual(a.sortie.relation, 'manyToOne');
  assert.strictEqual(a.sortie.target, 'api::sortie.sortie');
  assert.strictEqual(a.numero.type, 'integer');
  assert.strictEqual(a.numero.required, true);
  assert.strictEqual(a.date_reception.type, 'date');
  assert.strictEqual(a.date_reception.required, true);
  assert.strictEqual(a.statut.type, 'enumeration');
  assert.deepStrictEqual(a.statut.enum, ['en_cours', 'partielle', 'complete', 'annulee']);
  assert.strictEqual(a.version.type, 'integer');
  assert.strictEqual(a.version.required, true);
  assert.strictEqual(a.depositaire_nom.type, 'text');
  assert.strictEqual(a.depositaire_nom.required, true);
  assert.strictEqual(a.depositaire_fonction.type, 'text');
  assert.strictEqual(a.depositaire_fonction.required, true);
  assert.strictEqual(a.direction.type, 'relation');
  assert.strictEqual(a.direction.relation, 'manyToOne');
  assert.strictEqual(a.direction.target, 'api::direction.direction');
  assert.strictEqual(a.direction.required, true);
  // Pas d'unicité reception -> sortie (plusieurs réceptions par sortie autorisées)
  assert.strictEqual(a.sortie.unique, undefined);
});

test('réception-ligne : le schéma existe avec les attributs requis', () => {
  assert.ok(fs.existsSync(SCHEMAS['reception-ligne']), 'reception-ligne/schema.json existe');
  const s = lire(SCHEMAS['reception-ligne']);
  assert.strictEqual(s.kind, 'collectionType');
  const a = s.attributes;
  assert.strictEqual(a.reception.target, 'api::reception.reception');
  assert.strictEqual(a.sortie_ligne.target, 'api::sortie-ligne.sortie-ligne');
  assert.strictEqual(a.materiel.target, 'api::material.material');
  assert.strictEqual(a.quantite_commandee.type, 'integer');
  assert.strictEqual(a.quantite_commandee.required, true);
  assert.strictEqual(a.quantite_recue.type, 'integer');
  assert.strictEqual(a.quantite_recue.required, true);
  assert.strictEqual(a.quantite_reliquat.type, 'integer');
});

test('anomalie : le schéma existe avec les attributs requis', () => {
  assert.ok(fs.existsSync(SCHEMAS.anomalie), 'anomalie/schema.json existe');
  const s = lire(SCHEMAS.anomalie);
  assert.strictEqual(s.kind, 'collectionType');
  const a = s.attributes;
  assert.strictEqual(a.reception.target, 'api::reception.reception');
  assert.strictEqual(a.type_anomalie.type, 'enumeration');
  assert.deepStrictEqual(a.type_anomalie.enum, ['manquant', 'endommage', 'non_conforme', 'autre']);
  assert.strictEqual(a.statut.type, 'enumeration');
  assert.deepStrictEqual(a.statut.enum, ['ouverte', 'en_cours', 'resolue', 'rejetee']);
  assert.strictEqual(a.version.type, 'integer');
  assert.strictEqual(a.version.required, true);
});

test('journal-action : le schéma existe, lecture seule et immuable', () => {
  assert.ok(fs.existsSync(SCHEMAS['journal-action']), 'journal-action/schema.json existe');
  const s = lire(SCHEMAS['journal-action']);
  assert.strictEqual(s.kind, 'collectionType');
  const a = s.attributes;
  assert.strictEqual(a.anomalie.target, 'api::anomalie.anomalie');
  assert.strictEqual(a.action.type, 'enumeration');
  assert.deepStrictEqual(a.action.enum, ['ouverte', 'prise_en_charge', 'resolue', 'rejetee']);
  assert.strictEqual(a.nouveau_statut.type, 'enumeration');
  assert.deepStrictEqual(a.nouveau_statut.enum, ['ouverte', 'en_cours', 'resolue', 'rejetee']);
  assert.strictEqual(a.commentaire.type, 'text');
});
