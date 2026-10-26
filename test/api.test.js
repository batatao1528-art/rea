'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fichas-')), 'db.json');
const { server } = require('../server.js');

let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => server.close());

function client() {
  let cookie = '';
  return async (path, body) => {
    const res = await fetch(base + '/api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: await res.json() };
  };
}

test('fluxo completo: depósito, mesa, mão, pote, saque', async () => {
  const admin = client();
  const ana = client();
  const bia = client();
  assert.equal((await admin('/register', { name: 'Dono', username: 'dono', password: 'segredo1' })).status, 200);
  await ana('/register', { name: 'Ana', username: 'ana', password: 'segredo1' });
  await bia('/register', { name: 'Bia', username: 'bia', password: 'segredo1' });

  let s = (await admin('/state')).data;
  assert.equal(s.me.isAdmin, true);
  assert.equal((await ana('/state')).data.me.isAdmin, false);
  assert.equal((await ana('/admin/tables', { name: 'x' })).status, 403);

  // Depósitos: R$ 10 = 1000 fichas
  await ana('/requests/deposit', { reais: 10 });
  await bia('/requests/deposit', { reais: 10 });
  s = (await admin('/state')).data;
  assert.equal(s.pending.length, 2);
  for (const r of s.pending) await admin(`/admin/requests/${r.id}`, { approve: true });
  assert.equal((await ana('/state')).data.me.balance, 1000);

  const t = (await admin('/admin/tables', { name: 'Mesa 1', smallBlind: 5, bigBlind: 10, minBuyIn: 100, maxBuyIn: 1000 })).data.id;
  assert.equal((await ana(`/tables/${t}/join`, { chips: 2000 })).status, 400);
  await ana(`/tables/${t}/join`, { chips: 500 });
  await bia(`/tables/${t}/join`, { chips: 500 });

  await admin(`/admin/tables/${t}/dealer`, { action: 'newHand' });
  let table = (await ana('/state')).data.tables[0];
  assert.equal(table.currentBet, 10);
  assert.equal(table.seats.reduce((a, x) => a + x.bet, 0), 15);

  // Quem está com o small blind paga e o outro aumenta
  const sbName = table.seats.find((x) => x.bet === 5).name;
  const [sb, bb] = sbName === 'Ana' ? [ana, bia] : [bia, ana];
  assert.equal((await sb(`/tables/${t}/action`, { action: 'check' })).status, 400);
  await sb(`/tables/${t}/action`, { action: 'call' });
  await bb(`/tables/${t}/action`, { action: 'raise', to: 50 });
  await sb(`/tables/${t}/action`, { action: 'call' });
  await admin(`/admin/tables/${t}/dealer`, { action: 'collect' });
  table = (await ana('/state')).data.tables[0];
  assert.equal(table.pot, 100);
  assert.equal((await ana(`/tables/${t}/leave`, {})).status, 400);

  // Paga o pote para a Ana
  const anaId = (await ana('/state')).data.me.id;
  await admin(`/admin/tables/${t}/dealer`, { action: 'award', userId: anaId });
  table = (await ana('/state')).data.tables[0];
  assert.equal(table.pot, 0);
  assert.equal(table.seats.find((x) => x.name === 'Ana').stack, 550);

  // Ana sai da mesa e saca
  await ana(`/tables/${t}/leave`, {});
  assert.equal((await ana('/state')).data.me.balance, 1050);
  await ana('/requests/withdraw', { chips: 1050 });
  assert.equal((await ana('/state')).data.me.balance, 0);
  s = (await admin('/state')).data;
  assert.equal(s.audit.total, s.audit.issued);
  await admin(`/admin/requests/${s.pending[0].id}`, { approve: true });
  s = (await admin('/state')).data;
  assert.equal(s.audit.total, 950);
  assert.equal(s.audit.total, s.audit.issued);
});

test('erro no meio de uma operação não altera o estado', async () => {
  const admin = client();
  await admin('/login', { username: 'dono', password: 'segredo1' });
  const s = (await admin('/state')).data;
  const t = s.tables[0];
  const bia = s.users.find((u) => u.username === 'bia');
  // Aposta pendente + split inválido (1 jogador): as apostas não podem ir para o pote
  const biaC = client();
  await biaC('/login', { username: 'bia', password: 'segredo1' });
  await admin(`/admin/tables/${t.id}/dealer`, { action: 'newHand' }); // falha: só 1 jogador
  await biaC(`/tables/${t.id}/action`, { action: 'raise', to: 20 });
  const before = (await admin('/state')).data.tables[0];
  assert.equal((await admin(`/admin/tables/${t.id}/dealer`, { action: 'split', userIds: [bia.id] })).status, 400);
  const after = (await admin('/state')).data.tables[0];
  assert.deepEqual(after.seats, before.seats);
  assert.equal(after.pot, before.pot);
});
