'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const controller = require('../src/api/notification/controllers/notification');

test('le flux SSE envoie un heartbeat et arrête son timer à la fermeture', async () => {
  const originalStrapi = global.strapi;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const clearedTimers = [];
  let sendHeartbeat;
  const timer = {};

  global.strapi = {
    plugin: () => ({
      service: () => ({
        verify: async () => ({ id: 42 }),
      }),
    }),
  };
  global.setInterval = (callback, delay) => {
    assert.equal(delay, 25000);
    sendHeartbeat = callback;
    return timer;
  };
  global.clearInterval = (handle) => clearedTimers.push(handle);

  const response = new EventEmitter();
  response.writableEnded = false;
  response.destroyed = false;
  response.writes = [];
  response.write = (chunk) => {
    response.writes.push(chunk);
    return true;
  };
  response.flushHeaders = () => {
    response.headersFlushed = true;
  };

  const headers = {};
  const ctx = {
    query: { jwt: 'test-token' },
    status: 0,
    respond: true,
    res: response,
    set: (name, value) => {
      headers[name] = value;
    },
  };

  try {
    await controller.stream(ctx);

    assert.equal(ctx.status, 200);
    assert.equal(ctx.respond, false);
    assert.equal(headers['Content-Type'], 'text/event-stream');
    assert.equal(response.headersFlushed, true);
    assert.match(response.writes[0], /event: connected/);

    sendHeartbeat();
    assert.equal(response.writes[1], ': keep-alive\n\n');

    response.emit('close');
    assert.deepEqual(clearedTimers, [timer]);
  } finally {
    global.strapi = originalStrapi;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }
});
