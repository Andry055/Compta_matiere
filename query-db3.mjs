import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = new Database(path.resolve('backend/.tmp/data.db'), { readonly: true });

console.log('=== RÔLES (up_roles) ===');
try {
  const roles = db.prepare("SELECT * FROM up_roles").all();
  console.log(JSON.stringify(roles, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== PERMISSIONS pour api::reception-physique.reception-physique ===');
try {
  const rows = db.prepare(
    "SELECT p.id, p.action, p.controller, p.enabled, p.policy, " +
    "r.type AS role_type, r.name AS role_name " +
    "FROM up_permissions p " +
    "LEFT JOIN up_permissions_role_lnk prl ON p.id = prl.permission_id " +
    "LEFT JOIN up_roles r ON prl.role_id = r.id " +
    "WHERE p.controller LIKE '%reception-physique%' " +
    "ORDER BY p.action, r.type"
  ).all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== TOUTES LES PERMISSIONS (action/controller) ===');
try {
  const rows = db.prepare(
    "SELECT DISTINCT p.action, p.controller, p.enabled " +
    "FROM up_permissions p " +
    "WHERE p.controller LIKE '%reception%' " +
    "ORDER BY p.controller, p.action"
  ).all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

db.close();
