import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = new Database(path.resolve('backend/.tmp/data.db'), { readonly: true });

console.log('=== Permissions contenant "reception" ===');
try {
  const rows = db.prepare(
    "SELECT * FROM up_permissions WHERE action LIKE '%reception%'"
  ).all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== Permissions contenant "sortie" ===');
try {
  const rows = db.prepare(
    "SELECT * FROM up_permissions WHERE action LIKE '%sortie%'"
  ).all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== up_permissions_role_lnk (liens permission-rôle) ===');
try {
  const rows = db.prepare("SELECT * FROM up_permissions_role_lnk").all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

db.close();
