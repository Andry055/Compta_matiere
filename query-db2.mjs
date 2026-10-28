import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = new Database(path.resolve('backend/.tmp/data.db'), { readonly: true });

console.log('=== SORTIES avec statut et direction ===');
try {
  const rows = db.prepare(
    "SELECT s.id, s.document_id, s.reference, s.statut, s.date_sortie, d.nom_direction " +
    "FROM sorties s " +
    "LEFT JOIN sorties_direction_lnk sdl ON s.id = sdl.sortie_id " +
    "LEFT JOIN directions d ON sdl.direction_id = d.id " +
    "ORDER BY s.date_sortie DESC"
  ).all();
  console.log('Nombre de sorties:', rows.length);
  rows.forEach((r) => console.log(JSON.stringify(r)));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== SORTIES avec statut sortie_effectuee ===');
try {
  const rows = db.prepare(
    "SELECT s.id, s.document_id, s.reference, s.statut FROM sorties s WHERE s.statut = 'sortie_effectuee'"
  ).all();
  console.log('Nombre:', rows.length);
  rows.forEach((r) => console.log(JSON.stringify(r)));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== Utilisateurs et rôles ===');
try {
  const users = db.prepare("SELECT id, username, email FROM up_users").all();
  console.log('Utilisateurs:', JSON.stringify(users, null, 2));
} catch (e) {
  console.log('ERR users:', e.message);
}
try {
  const roles = db.prepare("SELECT id, type, name, code FROM up_roles").all();
  console.log('Rôles:', JSON.stringify(roles, null, 2));
} catch (e) {
  console.log('ERR roles:', e.message);
}
try {
  const userRoles = db.prepare("SELECT * FROM up_users_role_lnk").all();
  console.log('User-Role liens:', JSON.stringify(userRoles, null, 2));
} catch (e) {
  console.log('ERR user-roles:', e.message);
}
try {
  const userDirections = db.prepare("SELECT * FROM up_users_direction_lnk").all();
  console.log('User-Direction liens:', JSON.stringify(userDirections, null, 2));
} catch (e) {
  console.log('ERR user-directions:', e.message);
}

db.close();
