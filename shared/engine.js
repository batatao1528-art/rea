// Motor do Bloco Rush.
// Determinístico: a mesma seed + as mesmas jogadas sempre geram a mesma
// pontuação. O navegador usa este arquivo para jogar e o servidor usa o mesmo
// arquivo para refazer a partida a partir do replay e validar a pontuação.

export const BOARD_SIZE = 8;
export const TRAY_SIZE = 3;
export const GAME_DURATION_MS = 120_000;
export const MAX_STREAK_MULTIPLIER = 8;
export const MOVES_TO_LOSE_STREAK = 3;
export const PERFECT_CLEAR_BONUS = 300;

// Gerador pseudoaleatório mulberry32: rápido, com estado de 32 bits e idêntico
// em qualquer motor JavaScript.
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// '#' é um bloco. weight controla a frequência de cada peça.
const SHAPE_DEFS = [
  { id: 'dot', color: 1, weight: 4, rows: ['#'] },
  { id: 'i2h', color: 2, weight: 6, rows: ['##'] },
  { id: 'i2v', color: 2, weight: 6, rows: ['#', '#'] },
  { id: 'i3h', color: 3, weight: 6, rows: ['###'] },
  { id: 'i3v', color: 3, weight: 6, rows: ['#', '#', '#'] },
  { id: 'i4h', color: 4, weight: 4, rows: ['####'] },
  { id: 'i4v', color: 4, weight: 4, rows: ['#', '#', '#', '#'] },
  { id: 'i5h', color: 5, weight: 2, rows: ['#####'] },
  { id: 'i5v', color: 5, weight: 2, rows: ['#', '#', '#', '#', '#'] },
  { id: 'o2', color: 6, weight: 6, rows: ['##', '##'] },
  { id: 'o3', color: 7, weight: 2, rows: ['###', '###', '###'] },
  { id: 'r23', color: 6, weight: 3, rows: ['###', '###'] },
  { id: 'r32', color: 6, weight: 3, rows: ['##', '##', '##'] },
  { id: 'c3a', color: 1, weight: 3, rows: ['##', '#.'] },
  { id: 'c3b', color: 1, weight: 3, rows: ['##', '.#'] },
  { id: 'c3c', color: 1, weight: 3, rows: ['#.', '##'] },
  { id: 'c3d', color: 1, weight: 3, rows: ['.#', '##'] },
  { id: 'l4a', color: 3, weight: 2, rows: ['#.', '#.', '##'] },
  { id: 'l4b', color: 3, weight: 2, rows: ['.#', '.#', '##'] },
  { id: 'l4c', color: 3, weight: 2, rows: ['##', '#.', '#.'] },
  { id: 'l4d', color: 3, weight: 2, rows: ['##', '.#', '.#'] },
  { id: 'l4e', color: 4, weight: 2, rows: ['###', '#..'] },
  { id: 'l4f', color: 4, weight: 2, rows: ['###', '..#'] },
  { id: 'l4g', color: 4, weight: 2, rows: ['#..', '###'] },
  { id: 'l4h', color: 4, weight: 2, rows: ['..#', '###'] },
  { id: 't4a', color: 5, weight: 2, rows: ['###', '.#.'] },
  { id: 't4b', color: 5, weight: 2, rows: ['.#.', '###'] },
  { id: 't4c', color: 5, weight: 2, rows: ['#.', '##', '#.'] },
  { id: 't4d', color: 5, weight: 2, rows: ['.#', '##', '.#'] },
  { id: 's4a', color: 2, weight: 2, rows: ['.##', '##.'] },
  { id: 's4b', color: 2, weight: 2, rows: ['##.', '.##'] },
  { id: 's4c', color: 2, weight: 2, rows: ['#.', '##', '.#'] },
  { id: 's4d', color: 2, weight: 2, rows: ['.#', '##', '#.'] },
  { id: 'l5a', color: 7, weight: 1, rows: ['#..', '#..', '###'] },
  { id: 'l5b', color: 7, weight: 1, rows: ['..#', '..#', '###'] },
  { id: 'l5c', color: 7, weight: 1, rows: ['###', '#..', '#..'] },
  { id: 'l5d', color: 7, weight: 1, rows: ['###', '..#', '..#'] },
];

function parseShape(def) {
  const cells = [];
  def.rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') cells.push([r, c]);
    });
  });
  return {
    id: def.id,
    color: def.color,
    weight: def.weight,
    cells,
    height: def.rows.length,
    width: Math.max(...def.rows.map((l) => l.length)),
  };
}

export const SHAPES = Object.freeze(SHAPE_DEFS.map(parseShape));
const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0);

function drawShape(rng) {
  let roll = rng() * TOTAL_WEIGHT;
  for (const shape of SHAPES) {
    roll -= shape.weight;
    if (roll < 0) return shape;
  }
  return SHAPES[SHAPES.length - 1];
}

export function createGame(seed, { durationMs = GAME_DURATION_MS } = {}) {
  const state = {
    seed: seed >>> 0,
    durationMs,
    rng: createRng(seed),
    board: new Array(BOARD_SIZE * BOARD_SIZE).fill(0),
    tray: [],
    score: 0,
    streak: 0,
    movesSinceClear: 0,
    linesCleared: 0,
    placements: 0,
    lastT: 0,
    over: false,
    endReason: null,
  };
  refillTray(state);
  return state;
}

function refillTray(state) {
  state.tray = Array.from({ length: TRAY_SIZE }, () => drawShape(state.rng));
}

export function canPlace(board, shape, row, col) {
  for (const [dr, dc] of shape.cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return false;
    if (board[r * BOARD_SIZE + c] !== 0) return false;
  }
  return true;
}

export function fitsAnywhere(board, shape) {
  for (let r = 0; r <= BOARD_SIZE - shape.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - shape.width; c++) {
      if (canPlace(board, shape, r, c)) return true;
    }
  }
  return false;
}

// Linhas e colunas que ficariam completas se a peça fosse colocada ali.
// Usado tanto pela jogada real quanto pela prévia ao arrastar.
export function findClears(board, shape, row, col) {
  const filled = board.slice();
  for (const [dr, dc] of shape.cells) filled[(row + dr) * BOARD_SIZE + col + dc] = shape.color;
  const rows = [];
  const cols = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < BOARD_SIZE; j++) {
      if (filled[i * BOARD_SIZE + j] === 0) rowFull = false;
      if (filled[j * BOARD_SIZE + i] === 0) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

export function clearPoints(lines, streak) {
  if (lines === 0) return 0;
  const base = (10 * lines * (lines + 1)) / 2;
  return base * Math.min(streak, MAX_STREAK_MULTIPLIER);
}

export function endGame(state, reason) {
  if (!state.over) {
    state.over = true;
    state.endReason = reason;
  }
}

// Coloca a peça tray[trayIndex] com seu canto superior esquerdo em (row, col).
// t = milissegundos desde o início da partida. Lança erro em jogada inválida.
export function place(state, trayIndex, row, col, t) {
  if (state.over) throw new Error('partida encerrada');
  if (!Number.isInteger(trayIndex) || trayIndex < 0 || trayIndex >= TRAY_SIZE) {
    throw new Error('peça inválida');
  }
  if (!Number.isInteger(row) || !Number.isInteger(col)) throw new Error('posição inválida');
  if (!Number.isInteger(t) || t < state.lastT) throw new Error('tempo inválido');
  if (t > state.durationMs) {
    endGame(state, 'tempo');
    throw new Error('tempo esgotado');
  }
  const shape = state.tray[trayIndex];
  if (!shape) throw new Error('peça já usada');
  if (!canPlace(state.board, shape, row, col)) throw new Error('não cabe aí');

  const { rows, cols } = findClears(state.board, shape, row, col);
  for (const [dr, dc] of shape.cells) state.board[(row + dr) * BOARD_SIZE + col + dc] = shape.color;
  const clearedCells = new Set();
  for (const r of rows) for (let c = 0; c < BOARD_SIZE; c++) clearedCells.add(r * BOARD_SIZE + c);
  for (const c of cols) for (let r = 0; r < BOARD_SIZE; r++) clearedCells.add(r * BOARD_SIZE + c);
  const clearedColors = [...clearedCells].map((i) => [i, state.board[i]]);
  for (const i of clearedCells) state.board[i] = 0;

  const lines = rows.length + cols.length;
  let points = shape.cells.length;
  if (lines > 0) {
    state.streak += 1;
    state.movesSinceClear = 0;
    points += clearPoints(lines, state.streak);
  } else {
    state.movesSinceClear += 1;
    if (state.movesSinceClear >= MOVES_TO_LOSE_STREAK) state.streak = 0;
  }
  const perfect = lines > 0 && state.board.every((v) => v === 0);
  if (perfect) points += PERFECT_CLEAR_BONUS;

  state.score += points;
  state.linesCleared += lines;
  state.placements += 1;
  state.lastT = t;
  state.tray[trayIndex] = null;
  if (state.tray.every((s) => s === null)) refillTray(state);
  if (!state.tray.some((s) => s && fitsAnywhere(state.board, s))) endGame(state, 'sem-espaco');

  return { shape, row, col, rows, cols, lines, points, streak: state.streak, perfect, clearedColors };
}

// Refaz uma partida inteira a partir do replay. É o que o servidor usa para
// conferir a pontuação: o número enviado pelo navegador nunca é confiado.
export function simulate(seed, moves, options = {}) {
  const state = createGame(seed, options);
  if (!Array.isArray(moves)) return { ok: false, error: 'replay inválido', score: 0, state };
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    try {
      if (!m || typeof m !== 'object') throw new Error('jogada malformada');
      place(state, m.p, m.r, m.c, m.t);
    } catch (err) {
      return { ok: false, error: `jogada ${i + 1}: ${err.message}`, score: 0, state };
    }
  }
  return { ok: true, score: state.score, state };
}
