import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  SHAPES,
  PERFECT_CLEAR_BONUS,
  createGame,
  canPlace,
  clearPoints,
  place,
  simulate,
} from '../shared/engine.js';
import { autoplay } from './helpers.js';

const shape = (id) => SHAPES.find((s) => s.id === id);

test('a mesma seed gera a mesma sequência de peças', () => {
  const a = autoplay(1234);
  const b = autoplay(1234);
  assert.deepEqual(a.moves, b.moves);
  assert.equal(a.score, b.score);
  assert.notDeepEqual(createGame(1).tray.map((s) => s.id), createGame(2).tray.map((s) => s.id));
});

test('peça não pode sair do tabuleiro nem sobrepor blocos', () => {
  const board = new Array(BOARD_SIZE * BOARD_SIZE).fill(0);
  assert.equal(canPlace(board, shape('i3h'), 0, 5), true);
  assert.equal(canPlace(board, shape('i3h'), 0, 6), false);
  assert.equal(canPlace(board, shape('dot'), -1, 0), false);
  board[0] = 1;
  assert.equal(canPlace(board, shape('dot'), 0, 0), false);
});

test('completar uma linha limpa e pontua com combo crescente', () => {
  const state = createGame(7);
  for (let c = 0; c < 7; c++) state.board[c] = 1;
  for (let c = 0; c < 7; c++) state.board[BOARD_SIZE + c] = 1;
  state.board[63] = 1; // evita limpar o tabuleiro inteiro
  state.tray = [shape('dot'), shape('dot'), shape('o2')];

  const first = place(state, 0, 0, 7, 100);
  assert.equal(first.lines, 1);
  assert.equal(first.points, 1 + clearPoints(1, 1));
  assert.equal(state.board.slice(0, BOARD_SIZE).every((v) => v === 0), true);

  const second = place(state, 1, 1, 7, 200);
  assert.equal(second.streak, 2);
  assert.equal(second.points, 1 + clearPoints(1, 2));
  assert.equal(state.score, first.points + second.points);
});

test('limpar o tabuleiro inteiro dá bônus', () => {
  const state = createGame(7);
  for (let c = 0; c < 7; c++) state.board[c] = 1;
  state.tray = [shape('dot'), shape('dot'), shape('dot')];
  const result = place(state, 0, 0, 7, 100);
  assert.equal(result.perfect, true);
  assert.equal(result.points, 1 + clearPoints(1, 1) + PERFECT_CLEAR_BONUS);
});

test('a bandeja só é reabastecida depois de usar as três peças', () => {
  const state = createGame(99);
  state.tray = [shape('dot'), shape('dot'), shape('dot')];
  place(state, 0, 0, 0, 10);
  assert.equal(state.tray[0], null);
  assert.throws(() => place(state, 0, 0, 1, 20), /peça já usada/);
  place(state, 1, 0, 1, 20);
  place(state, 2, 0, 2, 30);
  assert.equal(state.tray.every(Boolean), true);
});

test('a partida acaba quando nenhuma peça cabe', () => {
  const state = createGame(5);
  // Duas casas vazias por linha e coluna: nada é limpo e não cabe um 3×3.
  state.board.fill(1);
  for (let i = 0; i < BOARD_SIZE; i++) {
    state.board[i * BOARD_SIZE + i] = 0;
    state.board[i * BOARD_SIZE + ((i + 4) % BOARD_SIZE)] = 0;
  }
  state.tray = [shape('dot'), shape('o3'), shape('o3')];
  place(state, 0, 0, 0, 10);
  assert.equal(state.over, true);
  assert.equal(state.endReason, 'sem-espaco');
});

test('simulate reproduz a pontuação de uma partida real', () => {
  for (const seed of [1, 42, 2026, 0xffffffff]) {
    const played = autoplay(seed);
    const replay = simulate(seed, played.moves);
    assert.equal(replay.ok, true);
    assert.equal(replay.score, played.score);
  }
});

test('simulate recusa replays adulterados', () => {
  const { moves } = autoplay(42);
  const outside = moves.map((m, i) => (i === 0 ? { ...m, c: 8 } : m));
  assert.equal(simulate(42, outside).ok, false);

  const backwards = moves.map((m, i) => (i === 3 ? { ...m, t: 0 } : m));
  assert.match(simulate(42, backwards).error, /tempo inválido/);

  const late = moves.map((m, i) => (i === 0 ? { ...m, t: 999_999 } : m));
  assert.match(simulate(42, late).error, /tempo/);

  assert.equal(simulate(42, 'lixo').ok, false);
  assert.equal(simulate(42, [null]).ok, false);
});
