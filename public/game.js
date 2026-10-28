import {
  BOARD_SIZE,
  createGame,
  canPlace,
  fitsAnywhere,
  findClears,
  place,
  endGame,
} from '/shared/engine.js';

const COLORS = ['#000', '#ff5d73', '#ffa23a', '#ffd93d', '#5ee07a', '#3ec7ff', '#7b6bff', '#d46bff'];
const EMPTY = 'rgba(255,255,255,0.06)';
const CLEAR_ANIM_MS = 350;
const TEXT_ANIM_MS = 900;

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBlock(ctx, x, y, size, color, alpha = 1) {
  const inset = Math.max(1, size * 0.06);
  const s = size - inset * 2;
  const r = s * 0.18;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = shade(color, -45);
  roundRect(ctx, x + inset, y + inset, s, s, r);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x + inset, y + inset, s, s * 0.88, r);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, x + inset + s * 0.15, y + inset + s * 0.1, s * 0.7, s * 0.18, s * 0.09);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Desenha a partida em um canvas e transforma toques em jogadas do motor.
export class GameView {
  constructor(canvas, { seed, durationMs, onUpdate, onEnd }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = createGame(seed, { durationMs });
    this.durationMs = durationMs;
    this.onUpdate = onUpdate;
    this.onEnd = onEnd;
    this.moves = [];
    this.drag = null;
    this.effects = [];
    this.startTime = performance.now();
    this.finished = false;

    this.handleDown = this.handleDown.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleUp = this.handleUp.bind(this);
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    canvas.addEventListener('pointerdown', this.handleDown);
    canvas.addEventListener('pointermove', this.handleMove);
    canvas.addEventListener('pointerup', this.handleUp);
    canvas.addEventListener('pointercancel', this.handleUp);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.handleDown);
    this.canvas.removeEventListener('pointermove', this.handleMove);
    this.canvas.removeEventListener('pointerup', this.handleUp);
    this.canvas.removeEventListener('pointercancel', this.handleUp);
    window.removeEventListener('resize', this.resize);
  }

  elapsed() {
    const now = this.endedAt ?? performance.now();
    return Math.min(this.durationMs, Math.round(now - this.startTime));
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const pad = 6;
    this.cell = Math.floor((width - pad * 2) / BOARD_SIZE);
    this.boardX = Math.round((width - this.cell * BOARD_SIZE) / 2);
    this.boardY = pad;
    this.trayY = this.boardY + this.cell * BOARD_SIZE + 12;
    this.trayH = Math.round(this.cell * 3);
    this.slotW = width / 3;
    this.trayCell = Math.floor(this.cell * 0.5);
    this.width = width;
    this.height = this.trayY + this.trayH + pad;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  pointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  handleDown(e) {
    if (this.finished || this.drag) return;
    const { x, y } = this.pointerPos(e);
    if (y < this.trayY - 8) return;
    const slot = Math.min(2, Math.floor(x / this.slotW));
    const shape = this.state.tray[slot];
    if (!shape) return;
    this.canvas.setPointerCapture(e.pointerId);
    // No toque a peça sobe acima do dedo para não ficar escondida.
    const lift = e.pointerType === 'mouse' ? -(shape.height * this.cell) / 2 : this.cell * 1.3;
    this.drag = { slot, shape, x, y, lift, pointerId: e.pointerId, target: null };
    this.updateTarget();
  }

  handleMove(e) {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    Object.assign(this.drag, this.pointerPos(e));
    this.updateTarget();
  }

  handleUp(e) {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    const { slot, target } = this.drag;
    this.drag = null;
    if (target && e.type === 'pointerup') this.commit(slot, target.row, target.col);
  }

  dragOrigin() {
    const { shape, x, y, lift } = this.drag;
    return {
      left: x - (shape.width * this.cell) / 2,
      top: y - shape.height * this.cell - lift,
    };
  }

  updateTarget() {
    const { left, top } = this.dragOrigin();
    const row = Math.round((top - this.boardY) / this.cell);
    const col = Math.round((left - this.boardX) / this.cell);
    const { shape } = this.drag;
    if (canPlace(this.state.board, shape, row, col)) {
      this.drag.target = { row, col, ...findClears(this.state.board, shape, row, col) };
    } else {
      this.drag.target = null;
    }
  }

  commit(slot, row, col) {
    const t = Math.max(this.state.lastT, this.elapsed());
    let result;
    try {
      result = place(this.state, slot, row, col, t);
    } catch {
      this.finish();
      return;
    }
    this.moves.push({ p: slot, r: row, c: col, t });
    const now = performance.now();
    for (const [i, color] of result.clearedColors) this.effects.push({ kind: 'cell', i, color, start: now });
    if (result.lines > 0 || result.perfect) {
      const label = [
        `+${result.points}`,
        result.lines > 1 ? `${result.lines} linhas` : '',
        result.streak > 1 ? `combo x${Math.min(result.streak, 8)}` : '',
        result.perfect ? 'LIMPOU TUDO!' : '',
      ].filter(Boolean).join(' · ');
      const x = this.boardX + (col + result.shape.width / 2) * this.cell;
      const y = this.boardY + row * this.cell;
      this.effects.push({ kind: 'text', text: label, x, y, start: now });
    }
    this.emitUpdate();
    if (this.state.over) this.finish();
  }

  emitUpdate() {
    this.onUpdate?.({
      score: this.state.score,
      streak: this.state.streak,
      remainingMs: this.durationMs - this.elapsed(),
    });
  }

  finish() {
    if (this.finished) return;
    if (!this.state.over) endGame(this.state, 'tempo');
    this.finished = true;
    this.endedAt = performance.now();
    this.drag = null;
    this.emitUpdate();
    // Deixa as animações finais aparecerem antes de trocar de tela.
    setTimeout(() => {
      this.destroy();
      this.onEnd?.({ score: this.state.score, moves: this.moves, endReason: this.state.endReason });
    }, 700);
  }

  frame(now) {
    if (!this.finished && this.elapsed() >= this.durationMs) this.finish();
    this.emitUpdate();
    this.draw(now);
    this.raf = requestAnimationFrame(this.frame);
  }

  draw(now) {
    const { ctx, cell, boardX, boardY, state } = this;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, boardX - 4, boardY - 4, cell * BOARD_SIZE + 8, cell * BOARD_SIZE + 8, 12);
    ctx.fill();

    const target = this.drag?.target;
    const highlight = new Set();
    if (target) {
      for (const r of target.rows) for (let c = 0; c < BOARD_SIZE; c++) highlight.add(r * BOARD_SIZE + c);
      for (const c of target.cols) for (let r = 0; r < BOARD_SIZE; r++) highlight.add(r * BOARD_SIZE + c);
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const i = r * BOARD_SIZE + c;
        const x = boardX + c * cell;
        const y = boardY + r * cell;
        const v = state.board[i];
        if (v) {
          drawBlock(ctx, x, y, cell, highlight.has(i) ? COLORS[this.drag.shape.color] : COLORS[v]);
        } else {
          ctx.fillStyle = highlight.has(i) ? 'rgba(255,255,255,0.18)' : EMPTY;
          roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, cell * 0.16);
          ctx.fill();
        }
      }
    }

    if (target) {
      for (const [dr, dc] of this.drag.shape.cells) {
        drawBlock(ctx, boardX + (target.col + dc) * cell, boardY + (target.row + dr) * cell, cell,
          COLORS[this.drag.shape.color], 0.45);
      }
    }

    this.drawEffects(now);

    state.tray.forEach((shape, slot) => {
      if (!shape || this.drag?.slot === slot) return;
      const tc = this.trayCell;
      const ox = slot * this.slotW + this.slotW / 2 - (shape.width * tc) / 2;
      const oy = this.trayY + this.trayH / 2 - (shape.height * tc) / 2;
      const alpha = fitsAnywhere(state.board, shape) ? 1 : 0.3;
      for (const [dr, dc] of shape.cells) drawBlock(ctx, ox + dc * tc, oy + dr * tc, tc, COLORS[shape.color], alpha);
    });

    if (this.drag) {
      const { left, top } = this.dragOrigin();
      for (const [dr, dc] of this.drag.shape.cells) {
        drawBlock(ctx, left + dc * cell, top + dr * cell, cell, COLORS[this.drag.shape.color], 0.92);
      }
    }
  }

  drawEffects(now) {
    const { ctx, cell, boardX, boardY } = this;
    this.effects = this.effects.filter((fx) => now - fx.start < (fx.kind === 'cell' ? CLEAR_ANIM_MS : TEXT_ANIM_MS));
    for (const fx of this.effects) {
      const p = (now - fx.start) / (fx.kind === 'cell' ? CLEAR_ANIM_MS : TEXT_ANIM_MS);
      if (fx.kind === 'cell') {
        const size = cell * (1 - p * 0.6);
        const r = Math.floor(fx.i / BOARD_SIZE);
        const c = fx.i % BOARD_SIZE;
        const x = boardX + c * cell + (cell - size) / 2;
        const y = boardY + r * cell + (cell - size) / 2;
        drawBlock(ctx, x, y, size, COLORS[fx.color], 1 - p);
      } else {
        ctx.globalAlpha = 1 - p * p;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 4;
        ctx.font = `800 ${Math.round(cell * 0.42)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        const x = Math.min(Math.max(fx.x, 90), this.width - 90);
        const y = fx.y - p * cell * 1.2;
        ctx.strokeText(fx.text, x, y);
        ctx.fillText(fx.text, x, y);
        ctx.globalAlpha = 1;
      }
    }
  }
}
