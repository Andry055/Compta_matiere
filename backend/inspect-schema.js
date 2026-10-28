'use strict';

const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db', { readonly: true });

const tables = ['sorties', 'up_users', 'up_roles', 'up_users_role_lnk', 'directions', 'up_users_direction_lnk', 'sortie_lignes'];
for (const t of tables) {
  console.log(`=== ${t} ===`);
  const schema = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
  ).get(t);
  console.log(schema.sql);
  console.log();
}

db.close();
