'use strict';

const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db', { readonly: true });

console.log('=== SORTIES ===');
const sorties = db.prepare('SELECT id, documentId, reference, statut, magasinier_signed, depositaire_signed, logistique_signed, direction_id FROM sorties ORDER BY id').all();
console.table(sorties);
console.log();

console.log('=== UTILISATEURS (up_users) ===');
const users = db.prepare('SELECT id, username, email FROM up_users ORDER BY id').all();
console.table(users);
console.log();

console.log('=== UTILISATEURS + RÔLES ===');
const userRoles = db.prepare(`
  SELECT u.id, u.username, r.name as role_name
  FROM up_users u
  LEFT JOIN up_users_role_lnk l ON u.id = l.user_id
  LEFT JOIN up_roles r ON l.role_id = r.id
  ORDER BY u.id
`).all();
console.table(userRoles);
console.log();

console.log('=== DIRECTIONS ===');
const directions = db.prepare('SELECT id, nom_direction, abreviation FROM directions ORDER BY id').all();
console.table(directions);
console.log();

console.log('=== UTILISATEURS + DIRECTIONS ===');
const userDirs = db.prepare(`
  SELECT u.id, u.username, d.id as direction_id, d.nom_direction
  FROM up_users u
  LEFT JOIN up_users_direction_lnk l ON u.id = l.user_id
  LEFT JOIN directions d ON l.direction_id = d.id
  ORDER BY u.id
`).all();
console.table(userDirs);
console.log();

console.log('=== SORTIE_LIGNES (vérifier état des lignes) ===');
const lignes = db.prepare('SELECT id, sortie_id, etat FROM sortie_lignes ORDER BY id').all();
console.table(lignes);
console.log();

console.log('=== notification_outboxes_sortie_lnk ===');
const links = db.prepare('SELECT * FROM notification_outboxes_sortie_lnk ORDER BY id').all();
console.table(links);

db.close();
