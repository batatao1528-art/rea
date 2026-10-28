import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server/server.js';
import { GameService } from '../server/rooms.js';
import { autoplay, memoryStore } from './helpers.js';

test('fluxo completo pela API HTTP', async (t) => {
  const service = new GameService({ store: memoryStore() });
  const server = createServer(service).listen(0);
  t.after(() => server.close());
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Bloco/);
  assert.equal((await fetch(`${base}/shared/engine.js`)).status, 200);
  assert.equal((await fetch(`${base}/..%2fpackage.json`)).status, 404);

  assert.equal((await call('GET', '/api/health')).body.ok, true);
  assert.equal((await call('POST', '/api/rooms/join')).status, 401);
  const { body: login } = await call('POST', '/api/players', { name: 'Ana' });
  const join = await call('POST', '/api/rooms/join', null, login.token);
  assert.equal(join.status, 200);
  assert.equal(join.body.balance, 990);

  const { moves } = autoplay(join.body.seed, { stepMs: 0 });
  const submit = await call('POST', `/api/rooms/${join.body.roomId}/submit`,
    { attemptId: join.body.attemptId, moves: moves.slice(0, 1) }, login.token);
  assert.equal(submit.status, 200);
  assert.equal(submit.body.status, 'done');

  const room = await call('GET', `/api/rooms/${join.body.roomId}`, null, login.token);
  assert.equal(room.body.ranking[0].name, 'Ana');
  assert.equal(room.body.seed, undefined);
});
