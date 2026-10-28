'use strict';

const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db', { readonly: true });

console.log('=== SORTIES ===');
const sorties = db.prepare('SELECT id, document_id, reference, statut, magasinier_signed, depositaire_signed FROM sorties ORDER BY id').all();
console.table(sorties);
console.log();

console.log('=== SORTIES + DIRECTIONS ===');
const sortieDirs = db.prepare(`
  SELECT s.id, s.document_id, s.reference, d.id as direction_id, d.nom_direction
  FROM sorties s
  LEFT JOIN sorties_direction_lnk l ON s.id = l.sortie_id
  LEFT JOIN directions d ON l.direction_id = d.id
  ORDER BY s.id
`).all();
console.table(sortieDirs);
console.log();

console.log('=== UTILISATEURS ===');
const users = db.prepare('SELECT id, document_id, username, email, department FROM up_users ORDER BY id').all();
console.table(users);
console.log();

console.log('=== UTILISATEURS + RÔLES ===');
const userRoles = db.prepare(`
  SELECT u.id, u.username, u.email, r.name as role_name, r.type as role_type
  FROM up_users u
  LEFT JOIN up_users_role_lnk l ON u.id = l.user_id
  LEFT JOIN up_roles r ON l.role_id = r.id
  ORDER BY u.id
`).all();
console.table(userRoles);
console.log();

console.log('=== UTILISATEURS + DIRECTIONS ===');
const userDirs = db.prepare(`
  SELECT u.id, u.username, u.department, d.id as direction_id, d.nom_direction
  FROM up_users u
  LEFT JOIN up_users_direction_lnk l ON u.id = l.user_id
  LEFT JOIN directions d ON l.direction_id = d.id
  ORDER BY u.id
`).all();
console.table(userDirs);
console.log();

console.log('=== SORTIE_LIGNES ===');
const lignes = db.prepare('SELECT id, document_id, etat FROM sortie_lignes ORDER BY id').all();
console.table(lignes);
console.log();

db.close();
