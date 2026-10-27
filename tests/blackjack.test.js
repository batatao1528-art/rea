// Testes da lógica do 21: node tests/blackjack.test.js
var assert = require('assert');
var B = require('../app/src/main/assets/www/js/blackjack.js');

function act(cards, up, opts) {
  opts = opts || {};
  return B.recommend({ cards: cards, up: up, hitSoft17: opts.h17, das: opts.das !== false, surrender: opts.surrender }).action;
}

// Valores da mão.
assert.deepStrictEqual(B.handValue([1, 6]), { total: 17, soft: true });
assert.deepStrictEqual(B.handValue([1, 6, 10]), { total: 17, soft: false });
assert.deepStrictEqual(B.handValue([1, 1, 9]), { total: 21, soft: true });
assert.ok(B.isBlackjack([1, 10]) && !B.isBlackjack([7, 7, 7]));

// Distribuição do dealer soma 1 e bate com valores conhecidos (S17, baralho infinito).
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (up) {
  var d = B.dealerOutcomes(up, false), sum = 0;
  for (var k in d) sum += d[k];
  assert.ok(Math.abs(sum - 1) < 1e-9);
});
assert.ok(Math.abs(B.dealerOutcomes(6, false).bust - 0.423) < 0.002);
assert.ok(Math.abs(B.dealerOutcomes(10, false).bust - 0.230) < 0.002);
assert.ok(B.dealerOutcomes(6, true).bust > B.dealerOutcomes(6, false).bust);

// Chance de estourar.
assert.strictEqual(B.bustChance([10, 2]), 4 / 13);
assert.strictEqual(B.bustChance([1, 6]), 0);

// Estratégia básica: totais duros.
assert.strictEqual(act([10, 6], 10), 'hit');
assert.strictEqual(act([10, 6], 6), 'stand');
assert.strictEqual(act([10, 2], 3), 'hit');
assert.strictEqual(act([10, 2], 4), 'stand');
assert.strictEqual(act([6, 5], 10), 'double');
assert.strictEqual(act([6, 5], 1), 'hit');
assert.strictEqual(act([6, 5], 1, { h17: true }), 'double');
assert.strictEqual(act([5, 4], 2), 'hit');
assert.strictEqual(act([5, 4], 3), 'double');
assert.strictEqual(act([4, 3, 4], 6), 'hit'); // 11 com três cartas: não pode dobrar
assert.strictEqual(act([10, 7], 1), 'stand');

// Mãos macias.
assert.strictEqual(act([1, 7], 2), 'stand');
assert.strictEqual(act([1, 7], 4), 'double');
assert.strictEqual(act([1, 7], 9), 'hit');
assert.strictEqual(act([1, 4, 3], 4), 'stand'); // 18 macio, sem poder dobrar
assert.strictEqual(act([1, 2], 5), 'double');
assert.strictEqual(act([1, 2], 4), 'hit');

// Pares.
assert.strictEqual(act([8, 8], 10), 'split');
assert.strictEqual(act([1, 1], 1), 'split');
assert.strictEqual(act([10, 10], 6), 'stand');
assert.strictEqual(act([5, 5], 6), 'double');
assert.strictEqual(act([9, 9], 7), 'stand');
assert.strictEqual(act([9, 9], 8), 'split');
assert.strictEqual(act([2, 2], 2), 'split');
assert.strictEqual(act([2, 2], 2, { das: false }), 'hit');

// Desistência.
assert.strictEqual(act([10, 6], 10, { surrender: true }), 'surrender');
assert.strictEqual(act([8, 8], 10, { surrender: true }), 'split');
assert.strictEqual(act([10, 7], 1, { surrender: true, h17: true }), 'surrender');
assert.strictEqual(act([10, 3, 3], 10, { surrender: true }), 'hit');

// Fim de mão.
assert.strictEqual(act([1, 10], 6), 'blackjack');
assert.strictEqual(act([10, 6, 9], 6), 'bust');
assert.strictEqual(act([7, 7, 7], 10), 'stand');

console.log('blackjack: ok');
