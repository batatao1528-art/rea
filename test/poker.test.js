// Rode com: node test/poker.test.js
const assert = require('assert');
const P = require('../js/poker.js');

const cards = (s) => s.split(' ').map(P.parseCard);
const ev = (s) => P.evaluate(cards(s));
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

test('categorias de mão', () => {
  const C = P.CATEGORY;
  assert.strictEqual(ev('As Ks Qs Js Ts 2d 3c').category, C.STRAIGHT_FLUSH);
  assert.strictEqual(ev('9h 9d 9s 9c 2d 3c 4h').category, C.QUADS);
  assert.strictEqual(ev('9h 9d 9s 4c 4d 3c 2h').category, C.FULL_HOUSE);
  assert.strictEqual(ev('9h 9d 9s 4c 4d 4h 2h').category, C.FULL_HOUSE);
  assert.strictEqual(ev('2h 7h 9h Jh Kh 3c 4d').category, C.FLUSH);
  assert.strictEqual(ev('5h 6d 7s 8c 9d Kc 2h').category, C.STRAIGHT);
  assert.strictEqual(ev('Ah 2d 3s 4c 5d Kc 9h').category, C.STRAIGHT);
  assert.strictEqual(ev('7h 7d 7s Kc 2d 4c 9h').category, C.TRIPS);
  assert.strictEqual(ev('7h 7d Ks Kc 2d 4c 9h').category, C.TWO_PAIR);
  assert.strictEqual(ev('7h 7d Ks Qc 2d 4c 9h').category, C.PAIR);
  assert.strictEqual(ev('7h 8d Ks Qc 2d 4c 9h').category, C.HIGH_CARD);
});

test('comparação e desempates', () => {
  assert(ev('Ah Ad 2c 3d 7s 9h Jc').score > ev('Kh Kd 2c 3d 7s 9h Jc').score);
  assert(ev('Ah Ad Kc 3d 7s 9h 2c').score > ev('Ah Ad Qc 3d 7s 9h 2c').score);
  assert(ev('6h 2d 3s 4c 5d Kc 9h').score > ev('Ah 2d 3s 4c 5d Kc 9h').score, '6-alto vence a roda');
  assert(ev('9h 9d 9s Ac Ad 4h 4s').score > ev('9h 9d 9s Kc Kd 4h 4s').score);
  assert.strictEqual(ev('Ah Kd 2c 3d 7s 9h Jc').score, ev('As Kc 2h 3s 7d 9c Jd').score);
});

test('descrição da mão', () => {
  assert.strictEqual(P.describeHand(ev('As Ks Qs Js Ts 2d 3c')), 'Royal flush');
  assert.strictEqual(P.describeHand(ev('Ah Ad 2c 3d 7s 9h Jc')), 'Par de Ases');
});

test('equidade: AA vs 1 oponente ~85%', () => {
  const r = P.equity(cards('As Ah'), [], 1, 20000);
  assert(r.equity > 0.83 && r.equity < 0.87, 'equidade ' + r.equity);
});

test('equidade: 72o vs 1 oponente ~35%', () => {
  const r = P.equity(cards('7s 2h'), [], 1, 20000);
  assert(r.equity > 0.32 && r.equity < 0.38, 'equidade ' + r.equity);
});

test('equidade: nuts no river = 100%', () => {
  const r = P.equity(cards('As Ks'), cards('Qs Js Ts 2d 3c'), 3, 2000);
  assert.strictEqual(r.equity, 1);
});

test('pontuação de Chen', () => {
  assert.strictEqual(P.chenScore(cards('As Ah')), 20);
  assert.strictEqual(P.chenScore(cards('As Ks')), 12);
  assert.strictEqual(P.chenScore(cards('7s 2h')), -1);
  assert.strictEqual(P.chenScore(cards('5s 5h')), 5);
  assert.strictEqual(P.handCode(cards('Ks As')), 'AKs');
});

test('projetos', () => {
  assert.deepStrictEqual(P.detectDraws(cards('Ah 5h'), cards('Kh 9h 2c')), ['Projeto de flush (9 outs)']);
  assert.deepStrictEqual(P.detectDraws(cards('8c 9d'), cards('Th Jh 2c')), ['Projeto de sequência aberta (8 outs)']);
  assert.deepStrictEqual(P.detectDraws(cards('8c 9d'), cards('Qh Jh 2c')), ['Sequência de barriga / gutshot (4 outs)']);
});

test('recomendação usa pot odds', () => {
  const base = { hole: cards('Ah 5h'), opponents: 1, street: 'flop' };
  assert.strictEqual(P.recommend({ ...base, equity: 0.35, pot: 100, toCall: 20 }).action, 'call');
  assert.strictEqual(P.recommend({ ...base, equity: 0.20, pot: 100, toCall: 100 }).action, 'fold');
  assert.strictEqual(P.recommend({ ...base, equity: 0.80, pot: 100, toCall: 20 }).action, 'raise');
  assert.strictEqual(P.recommend({ ...base, equity: 0.80 }).action, 'bet');
});

test('recomendação pré-flop por posição', () => {
  const r = (h, pos) => P.recommend({ hole: cards(h), opponents: 5, street: 'preflop', position: pos, equity: 0.2 }).action;
  assert.strictEqual(r('As Kd', 'utg'), 'raise');
  assert.strictEqual(r('9s 7d', 'utg'), 'fold');
  assert.strictEqual(r('9s 7d', 'bb'), 'check');
});

console.log(`\n${passed} testes passaram`);
