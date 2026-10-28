'use strict';

const Database = require('better-sqlite3');
const db = new Database('.tmp/data.db', { readonly: true });

console.log('=== SCHEMA notification_outboxes ===');
const schema = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='notification_outboxes'"
).get();
console.log(schema.sql);
console.log();

console.log('=== CHECK constraints sur notification_outboxes ===');
const checks = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='check' AND tbl_name='notification_outboxes'"
).all();
checks.forEach((c) => console.log(c.sql));
console.log();

console.log('=== Événements par type ===');
const rows = db.prepare(
  'SELECT event_type, COUNT(*) as nb FROM notification_outboxes GROUP BY event_type ORDER BY event_type'
).all();
console.table(rows);
console.log();

console.log('=== 30 dernières entrées ===');
const rows2 = db.prepare(
  'SELECT id, event_type, recipient_id, recipient_role, status, cle_unicite, created_at FROM notification_outboxes ORDER BY id DESC LIMIT 30'
).all();
console.table(rows2);
console.log();

console.log('=== Tables dans la base ===');
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
).all();
tables.forEach((t) => console.log(t.name));

db.close();
