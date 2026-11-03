import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const dbPath = process.argv[2] || path.resolve('backend/.tmp/data.db');
const Database = require('better-sqlite3');

const db = new Database(dbPath, { readonly: true });

// Liste toutes les tables
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  .all();
console.log('=== TABLES ===');
tables.forEach((t) => console.log(' -', t.name));

function count(table) {
  try {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
    return n.n;
  } catch (e) {
    return `ERR: ${e.message}`;
  }
}

console.log('\n=== COUNTS ===');
for (const t of tables.map((x) => x.name)) {
  console.log(` ${t}: ${count(t)}`);
}

console.log('\n=== RECEPTIONS_PHYSIQUES ===');
try {
  const rows = db.prepare('SELECT * FROM receptions_physiques ORDER BY date_reception DESC').all();
  console.log(`Nombre: ${rows.length}`);
  rows.forEach((r) => {
    console.log(JSON.stringify(r, null, 2));
  });
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== SORTIES (aperçu) ===');
try {
  const rows = db.prepare('SELECT documentId, reference, statut, direction_id, date_sortie FROM sorties ORDER BY date_sortie DESC LIMIT 20').all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

console.log('\n=== DIRECTIONS ===');
try {
  const rows = db.prepare('SELECT * FROM directions').all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.log('ERR:', e.message);
}

db.close();
