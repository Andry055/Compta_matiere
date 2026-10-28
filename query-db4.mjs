import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const db = new Database(path.resolve('backend/.tmp/data.db'), { readonly: true });

console.log('=== SCHEMA up_permissions ===');
try {
  const cols = db.prepare("PRAGMA table_info(up_permissions)").all();
  console.log(JSON.stringify(cols, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== SAMPLE up_permissions ===');
try {
  const rows = db.prepare("SELECT * FROM up_permissions LIMIT 10").all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== Permissions avec reception-physique ===');
try {
  const rows = db.prepare(
    "SELECT * FROM up_permissions WHERE action LIKE '%reception%' OR policy LIKE '%reception%'"
  ).all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

db.close();
