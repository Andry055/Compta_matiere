'use strict';

/**
 * Réception physique — EVENT_TYPE outbox.
 *
 * Harnais `node --test`, SANS démarrer Strapi ni toucher la vraie base :
 * lit le service `notification-outbox.js` et vérifie que les quatre
 * EVENT_TYPE de réception sont déclarés et acceptés par `creerEntrees`.
 *
 * Le module `../../../lib/notifications` est mocké dans le cache de `require`
 * avant le chargement du service (rien n'atteint node_modules).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const SERVICE = path.join(
  RACINE,
  'src',
  'api',
  'notification-outbox',
  'services',
  'notification-outbox.js'
);
const lire = (f) => fs.readFileSync(f, 'utf8');

const EVENT_TYPE_ATTENDUS = [
  'reception_partielle',
  'reception_complete',
  'anomalie_ouverte',
  'anomalie_resolue',
];

/* ────────────────────────── Mock de ../../../lib/notifications ────────────────────────── */

const NOTIFICATIONS_PATH = path.join(RACINE, 'src', 'lib', 'notifications.js');
require.cache[NOTIFICATIONS_PATH] = {
  id: NOTIFICATIONS_PATH,
  filename: NOTIFICATIONS_PATH,
  loaded: true,
  exports: { sseBroadcastToUser: () => 0 },
};

/* ────────────────────────── 1. Déclaration des EVENT_TYPE ────────────────────────── */

test('EVENT_TYPE_RECEPTION déclare les 4 EVENT_TYPE de réception', () => {
  const source = lire(SERVICE);
  assert.match(
    source,
    /const EVENT_TYPE_RECEPTION\s*=/,
    'const EVENT_TYPE_RECEPTION déclarée'
  );
  for (const et of EVENT_TYPE_ATTENDUS) {
    assert.match(source, new RegExp(`'${et}'`), `EVENT_TYPE ${et} présent`);
  }
  assert.match(source, /'depositaire'/, "rôle 'depositaire' associé");
});

test('EVENT_TYPE_RECEPTION est exporté', () => {
  const source = lire(SERVICE);
  assert.match(source, /EVENT_TYPE_RECEPTION/, 'EVENT_TYPE_RECEPTION exporté');
});

/* ────────────────────────── 2. creerEntrees accepte les EVENT_TYPE de réception ────────────────────────── */

test("creerEntrees consulte EVENT_TYPE_RECEPTION (pas d'erreur 'Rôle inconnu')", () => {
  const source = lire(SERVICE);
  assert.match(
    source,
    /EVENT_TYPE_RECEPTION/,
    "creerEntrees référence EVENT_TYPE_RECEPTION"
  );
  assert.match(
    source,
    /Rôle de destinataire inconnu/,
    "message d'erreur clair pour un rôle vraiment inconnu"
  );
});

test('creerEntrees crée une entrée avec eventType reception_partielle', async () => {
  delete require.cache[SERVICE];
  const { creerEntrees } = require(SERVICE);

  const captures = [];
  const app = {
    documents: () => ({
      create: async ({ data } = {}) => {
        captures.push(data);
        return {};
      },
    }),
  };

  await creerEntrees(
    app,
    'sortie-123',
    [{ id: 1, email: 'a@b.com', username: 'test' }],
    'reception_partielle',
    { info: 'test' }
  );

  assert.strictEqual(captures.length, 1, 'une entrée créée');
  assert.strictEqual(captures[0].eventType, 'reception_partielle', 'eventType correct');
  assert.strictEqual(captures[0].status, 'pending', 'statut pending');
  assert.strictEqual(captures[0].recipientId, 1, 'recipientId correct');
  assert.strictEqual(captures[0].recipientRole, 'depositaire', 'recipientRole depositaire');
});

test('creerEntrees crée une entrée avec eventType anomalie_resolue', async () => {
  delete require.cache[SERVICE];
  const { creerEntrees } = require(SERVICE);

  const captures = [];
  const app = {
    documents: () => ({
      create: async ({ data } = {}) => {
        captures.push(data);
        return {};
      },
    }),
  };

  await creerEntrees(
    app,
    'sortie-456',
    [{ id: 7, email: 'b@c.com', username: 'test2' }],
    'anomalie_resolue',
    { info: 'test2' }
  );

  assert.strictEqual(captures.length, 1, 'une entrée créée');
  assert.strictEqual(captures[0].eventType, 'anomalie_resolue', 'eventType correct');
  assert.strictEqual(captures[0].recipientRole, 'depositaire', 'recipientRole depositaire');
});

test("creerEntrees rejette un rôle vraiment inconnu", async () => {
  delete require.cache[SERVICE];
  const { creerEntrees } = require(SERVICE);

  const app = {
    documents: () => ({
      create: async () => {
        throw new Error('ne devrait pas être appelé');
      },
    }),
  };

  await assert.rejects(
    creerEntrees(app, 'sortie-999', [], 'role_inconnu', {}),
    /Rôle de destinataire inconnu/
  );
});
