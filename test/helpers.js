import { BOARD_SIZE, createGame, canPlace, place } from '../shared/engine.js';

// Joga uma partida com uma estratégia simples (primeira posição válida) e
// devolve o replay, para testar o motor e a validação do servidor.
export function autoplay(seed, { stepMs = 900, durationMs } = {}) {
  const state = createGame(seed, durationMs ? { durationMs } : undefined);
  const moves = [];
  let t = 0;
  while (!state.over) {
    t += stepMs;
    if (t > state.durationMs) break;
    let move = null;
    for (let p = 0; p < state.tray.length && !move; p++) {
      const shape = state.tray[p];
      if (!shape) continue;
      for (let r = 0; r < BOARD_SIZE && !move; r++) {
        for (let c = 0; c < BOARD_SIZE && !move; c++) {
          if (canPlace(state.board, shape, r, c)) move = { p, r, c, t };
        }
      }
    }
    place(state, move.p, move.r, move.c, move.t);
    moves.push(move);
  }
  return { moves, score: state.score, state };
}

export function memoryStore() {
  return { data: { players: {}, tokens: {}, rooms: {} }, save() {} };
}
