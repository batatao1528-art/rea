import test from 'node:test';
import assert from 'node:assert/strict';
import { GameService, DEFAULT_CONFIG, botFlags, payoutShares } from '../server/rooms.js';
import { autoplay, memoryStore } from './helpers.js';

function setup(config) {
  const clock = { t: 1_000_000 };
  let seq = 0;
  const service = new GameService({
    store: memoryStore(),
    now: () => clock.t,
    config,
    randomSeed: () => 4242,
    randomId: () => `id${++seq}`,
  });
  const newPlayer = (name) => {
    const { player, token } = service.createPlayer(name);
    return service.authenticate(token) ?? assert.fail(`login falhou para ${player.name}`);
  };
  return { clock, service, newPlayer };
}

// Simula o jogador terminando a partida depois de jogar por stepMs × jogadas.
function playAndSubmit({ clock, service }, player, { stepMs = 900, tamper } = {}) {
  const join = service.joinRoom(player);
  const { moves, score } = autoplay(join.seed, { stepMs });
  const sent = tamper ? tamper(moves) : moves;
  clock.t += (moves.at(-1)?.t ?? 0) + 500;
  const result = service.submit(player, join.roomId, { attemptId: join.attemptId, moves: sent, clientScore: score });
  return { join, result, score };
}

test('nome inválido é recusado', () => {
  const { service } = setup();
  assert.throws(() => service.createPlayer('a'), /Apelido/);
  assert.throws(() => service.createPlayer('<script>'), /Apelido/);
  assert.equal(service.authenticate('token-falso'), null);
});

test('entrar na sala cobra a entrada e todos recebem a mesma seed', () => {
  const ctx = setup();
  const ana = ctx.newPlayer('Ana');
  const bia = ctx.newPlayer('Bia');
  const a = ctx.service.joinRoom(ana);
  const b = ctx.service.joinRoom(bia);
  assert.equal(a.roomId, b.roomId);
  assert.equal(a.seed, b.seed);
  assert.equal(ana.balance, DEFAULT_CONFIG.startingBalance - DEFAULT_CONFIG.entryFee);
  assert.throws(() => ctx.service.joinRoom(ana), /em andamento/);
});

test('replay válido recebe a pontuação calculada pelo servidor', () => {
  const ctx = setup();
  const ana = ctx.newPlayer('Ana');
  const { result, score } = playAndSubmit(ctx, ana);
  assert.equal(result.status, 'done');
  assert.equal(result.score, score);
  assert.throws(() => ctx.service.submit(ana, Object.keys(ctx.service.db.rooms)[0], {}), /não encontrada/);
});

test('replay adulterado é recusado com pontuação zero', () => {
  const ctx = setup();
  const ana = ctx.newPlayer('Ana');
  const { result } = playAndSubmit(ctx, ana, {
    tamper: (moves) => [...moves, { ...moves[0], t: moves.at(-1).t + 10 }],
  });
  assert.equal(result.status, 'invalid');
  assert.equal(result.score, 0);
});

test('replay que diz ter durado mais que o tempo real é recusado', () => {
  const ctx = setup();
  const ana = ctx.newPlayer('Ana');
  const join = ctx.service.joinRoom(ana);
  const { moves, score } = autoplay(join.seed);
  ctx.clock.t += 5_000; // jogou só 5 segundos de verdade
  const result = ctx.service.submit(ana, join.roomId, { attemptId: join.attemptId, moves, clientScore: score });
  assert.equal(result.status, 'invalid');
  assert.match(result.error, /relógio/);
});

test('ao fechar a sala o prêmio vai para o melhor e a casa fica com 10%', () => {
  const ctx = setup();
  const players = ['Ana', 'Bia', 'Caio'].map(ctx.newPlayer);
  // Mais devagar = menos jogadas; no empate vence quem terminou antes.
  const results = players.map((p, i) => playAndSubmit(ctx, p, { stepMs: 600 + i * 2500 }));
  assert.ok(results[0].score >= results[2].score);

  ctx.clock.t += DEFAULT_CONFIG.roomWindowMs;
  const view = ctx.service.roomView(results[0].join.roomId, players[0]);
  assert.equal(view.status, 'finished');
  assert.equal(view.prize, 27);
  assert.deepEqual(view.payouts.map((p) => [p.name, p.amount]), [['Ana', 27]]);
  assert.equal(players[0].balance, 1000 - 10 + 27);
  assert.equal(players[1].balance, 990);
  assert.equal(view.me.payout.place, 1);
});

test('sala sem adversários devolve a entrada', () => {
  const ctx = setup();
  const ana = ctx.newPlayer('Ana');
  playAndSubmit(ctx, ana);
  ctx.clock.t += DEFAULT_CONFIG.roomWindowMs;
  ctx.service.tick();
  assert.equal(ana.balance, 1000);
});

test('quem não envia a partida é marcado como abandonado', () => {
  const ctx = setup();
  const ana = ctx.newPlayer('Ana');
  const join = ctx.service.joinRoom(ana);
  ctx.clock.t += DEFAULT_CONFIG.durationMs + DEFAULT_CONFIG.submitGraceMs + 1;
  assert.throws(() => ctx.service.submit(ana, join.roomId, { attemptId: join.attemptId, moves: [] }), /esgotado/);
  const view = ctx.service.roomView(join.roomId, ana);
  assert.equal(view.ranking[0].status, 'abandoned');
});

test('sala cheia fecha sem esperar o prazo e o próximo jogador abre outra', () => {
  const ctx = setup({ capacity: 3 });
  const players = ['Ana', 'Bia', 'Caio'].map(ctx.newPlayer);
  const roomId = players.map((p) => playAndSubmit(ctx, p).join.roomId)[0];
  assert.equal(ctx.service.roomView(roomId, players[0]).status, 'finished');
  const next = ctx.service.joinRoom(ctx.newPlayer('Duda'));
  assert.notEqual(next.roomId, roomId);
});

test('divisão do prêmio por número de jogadores', () => {
  assert.equal(payoutShares(1), null);
  assert.deepEqual(payoutShares(4), [1]);
  assert.deepEqual(payoutShares(9), [0.65, 0.35]);
  assert.deepEqual(payoutShares(30), [0.5, 0.3, 0.2]);
});

test('ritmo de robô é sinalizado para revisão', () => {
  const robot = Array.from({ length: 20 }, (_, i) => ({ t: (i + 1) * 500 }));
  assert.deepEqual(botFlags(robot), ['ritmo constante demais']);
  const human = [700, 1900, 2500, 4800, 5300, 7900, 8400, 9100, 12000].map((t) => ({ t }));
  assert.deepEqual(botFlags(human), []);
});
