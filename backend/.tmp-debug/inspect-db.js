'use strict';
const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db', { readonly: true });
const q = (sql) => {
  try {
    return db.prepare(sql).all();
  } catch (e) {
    return [{ err: e.message }];
  }
};
console.log('USERS:', JSON.stringify(q('SELECT id, username, email, blocked, role FROM "users-permissions_users"'), null, 1));
console.log('ROLES:', JSON.stringify(q('SELECT id, name, type FROM "users-permissions_roles"')));
console.log('SERVICES:', JSON.stringify(q('SELECT COUNT(*) n FROM services')));
console.log(JSON.stringify(q('SELECT document_id, nom_service FROM services')));
console.log('PERMS distributions:', JSON.stringify(q("SELECT r.type, p.action FROM \"users-permissions_permissions\" p JOIN \"users-permissions_roles\" r ON r.id = p.role WHERE p.action LIKE '%distributions%'")));
console.log('PERMS sortie:', JSON.stringify(q("SELECT r.type, p.action FROM \"users-permissions_permissions\" p JOIN \"users-permissions_roles\" r ON r.id = p.role WHERE p.action LIKE '%sortie%' ORDER BY r.type, p.action")));
console.log('TABLES:', JSON.stringify(q("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%permission%'")));
db.close();
