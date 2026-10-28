import crypto from 'node:crypto';
import { simulate, GAME_DURATION_MS } from '../shared/engine.js';

export const DEFAULT_CONFIG = Object.freeze({
  capacity: 30,
  entryFee: 10,
  houseCut: 0.1,
  roomWindowMs: 30 * 60_000,
  durationMs: GAME_DURATION_MS,
  // Folga para a rede: o replay pode chegar um pouco depois do fim do relógio.
  submitGraceMs: 15_000,
  clockToleranceMs: 1_000,
  startingBalance: 1000,
  dailyBonus: 200,
  bonusIntervalMs: 24 * 60 * 60_000,
  maxMoves: 600,
});

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Divisão do prêmio conforme o número de jogadores que terminaram a partida.
export function payoutShares(finishers) {
  if (finishers < 2) return null;
  if (finishers < 5) return [1];
  if (finishers < 10) return [0.65, 0.35];
  return [0.5, 0.3, 0.2];
}

// Sinais de robô para revisão manual. Não banem ninguém sozinhos.
export function botFlags(moves) {
  const flags = [];
  if (moves.length < 8) return flags;
  const gaps = moves.map((m, i) => m.t - (i === 0 ? 0 : moves[i - 1].t));
  const tooFast = gaps.filter((g) => g < 120).length;
  if (tooFast / gaps.length > 0.3) flags.push('jogadas rápidas demais');
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
  if (mean > 0 && sd / mean < 0.15) flags.push('ritmo constante demais');
  return flags;
}

const NAME_RE = /^[\p{L}\p{N} _-]{2,16}$/u;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function compareEntries(a, b) {
  return b.score - a.score || a.lastT - b.lastT || a.submittedAt - b.submittedAt;
}

export class GameService {
  constructor({ store, now = Date.now, config = {}, randomSeed, randomId } = {}) {
    this.store = store;
    this.db = store.data;
    this.now = now;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.randomSeed = randomSeed ?? (() => crypto.randomBytes(4).readUInt32BE(0));
    this.randomId = randomId ?? ((bytes = 9) => crypto.randomBytes(bytes).toString('base64url'));
  }

  createPlayer(rawName) {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!NAME_RE.test(name)) {
      throw new HttpError(400, 'Apelido deve ter de 2 a 16 letras, números, espaço, _ ou -');
    }
    const id = this.randomId();
    const token = this.randomId(24);
    const player = {
      id,
      name,
      balance: this.config.startingBalance,
      createdAt: this.now(),
      lastBonusAt: this.now(),
    };
    this.db.players[id] = player;
    this.db.tokens[hashToken(token)] = id;
    this.store.save();
    return { player: this.publicPlayer(player), token };
  }

  authenticate(token) {
    if (typeof token !== 'string' || !token) return null;
    const id = this.db.tokens[hashToken(token)];
    return id ? this.db.players[id] ?? null : null;
  }

  publicPlayer(player) {
    const nextBonusAt = player.lastBonusAt + this.config.bonusIntervalMs;
    return { id: player.id, name: player.name, balance: player.balance, nextBonusAt };
  }

  claimBonus(player) {
    if (this.now() < player.lastBonusAt + this.config.bonusIntervalMs) {
      throw new HttpError(429, 'Bônus diário ainda não disponível');
    }
    player.balance += this.config.dailyBonus;
    player.lastBonusAt = this.now();
    this.store.save();
    return this.publicPlayer(player);
  }

  joinRoom(player) {
    this.tick();
    const { capacity, entryFee, roomWindowMs, durationMs } = this.config;
    const rooms = Object.values(this.db.rooms).filter((r) => r.status === 'open');
    if (rooms.some((r) => r.entries.some((e) => e.playerId === player.id && e.status === 'playing'))) {
      throw new HttpError(409, 'Você já tem uma partida em andamento');
    }
    if (player.balance < entryFee) throw new HttpError(402, 'Fichas insuficientes');

    // Prioriza a sala mais cheia para fechar as salas mais rápido.
    const now = this.now();
    let room = rooms
      .filter((r) => now < r.closesAt && r.entries.length < r.capacity)
      .filter((r) => !r.entries.some((e) => e.playerId === player.id))
      .sort((a, b) => b.entries.length - a.entries.length)[0];
    if (!room) {
      room = {
        id: this.randomId(6),
        seed: this.randomSeed(),
        createdAt: now,
        closesAt: now + roomWindowMs,
        capacity,
        entryFee,
        status: 'open',
        pool: 0,
        entries: [],
        payouts: [],
      };
      this.db.rooms[room.id] = room;
    }

    player.balance -= entryFee;
    room.pool += entryFee;
    const entry = {
      playerId: player.id,
      name: player.name,
      attemptId: this.randomId(),
      startedAt: now,
      status: 'playing',
      score: 0,
      lastT: 0,
      submittedAt: null,
      flags: [],
    };
    room.entries.push(entry);
    this.store.save();
    return {
      roomId: room.id,
      attemptId: entry.attemptId,
      seed: room.seed,
      durationMs,
      balance: player.balance,
    };
  }

  submit(player, roomId, body) {
    const room = this.db.rooms[roomId];
    if (!room) throw new HttpError(404, 'Sala não encontrada');
    const entry = room.entries.find((e) => e.playerId === player.id);
    if (!entry || entry.attemptId !== body?.attemptId) throw new HttpError(403, 'Partida não encontrada');
    if (entry.status !== 'playing') throw new HttpError(409, 'Esta partida já foi enviada');

    const { durationMs, submitGraceMs, clockToleranceMs, maxMoves } = this.config;
    const elapsed = this.now() - entry.startedAt;
    if (elapsed > durationMs + submitGraceMs) {
      entry.status = 'abandoned';
      this.tick();
      throw new HttpError(410, 'Tempo para enviar a partida esgotado');
    }

    const moves = body.moves;
    let error = null;
    if (!Array.isArray(moves) || moves.length > maxMoves) {
      error = 'replay inválido';
    } else if (moves.some((m) => !Number.isInteger(m?.t) || m.t > elapsed + clockToleranceMs)) {
      // O replay não pode dizer que durou mais do que o tempo real decorrido.
      error = 'tempo do replay não confere com o relógio do servidor';
    }
    let result = null;
    if (!error) {
      result = simulate(room.seed, moves, { durationMs });
      if (!result.ok) error = result.error;
    }

    entry.submittedAt = this.now();
    if (error) {
      entry.status = 'invalid';
      entry.score = 0;
      entry.flags.push(error);
    } else {
      entry.status = 'done';
      entry.score = result.score;
      entry.lastT = result.state.lastT;
      entry.flags.push(...botFlags(moves));
      if (body.clientScore !== result.score) entry.flags.push('pontuação do navegador divergente');
    }
    this.store.save();
    this.tick();
    return { status: entry.status, score: entry.score, error };
  }

  // Encerra tentativas abandonadas e fecha salas que terminaram.
  tick() {
    const now = this.now();
    const { durationMs, submitGraceMs, houseCut } = this.config;
    let changed = false;
    for (const room of Object.values(this.db.rooms)) {
      if (room.status !== 'open') continue;
      for (const e of room.entries) {
        if (e.status === 'playing' && now > e.startedAt + durationMs + submitGraceMs) {
          e.status = 'abandoned';
          changed = true;
        }
      }
      const anyPlaying = room.entries.some((e) => e.status === 'playing');
      const full = room.entries.length >= room.capacity;
      if (anyPlaying || (!full && now < room.closesAt)) continue;
      this.finishRoom(room, houseCut);
      changed = true;
    }
    if (changed) this.store.save();
  }

  finishRoom(room, houseCut) {
    room.status = 'finished';
    room.finishedAt = this.now();
    const finishers = room.entries.filter((e) => e.status === 'done').sort(compareEntries);
    const shares = payoutShares(finishers.length);
    const credit = (entry, amount, kind, place) => {
      const player = this.db.players[entry.playerId];
      if (player) player.balance += amount;
      room.payouts.push({ playerId: entry.playerId, name: entry.name, amount, kind, place });
    };
    if (!shares) {
      // Sem adversários suficientes: devolve a entrada (menos para quem trapaceou).
      for (const e of room.entries) if (e.status !== 'invalid') credit(e, room.entryFee, 'reembolso', null);
      room.prize = 0;
      return;
    }
    const prize = Math.floor(room.pool * (1 - houseCut));
    const amounts = shares.map((s) => Math.floor(prize * s));
    amounts[0] += prize - amounts.reduce((a, b) => a + b, 0);
    amounts.forEach((amount, i) => credit(finishers[i], amount, 'premio', i + 1));
    room.prize = prize;
  }

  roomView(roomId, player) {
    this.tick();
    const room = this.db.rooms[roomId];
    if (!room) throw new HttpError(404, 'Sala não encontrada');
    const done = room.entries.filter((e) => e.status === 'done').sort(compareEntries);
    const others = room.entries.filter((e) => e.status !== 'done');
    const ranking = [...done, ...others].map((e, i) => ({
      place: e.status === 'done' ? i + 1 : null,
      name: e.name,
      score: e.score,
      status: e.status,
      you: e.playerId === player.id,
    }));
    const myPayout = room.payouts.find((p) => p.playerId === player.id) ?? null;
    return {
      id: room.id,
      status: room.status,
      capacity: room.capacity,
      players: room.entries.length,
      entryFee: room.entryFee,
      pool: room.pool,
      prize: room.status === 'finished' ? room.prize : Math.floor(room.pool * (1 - this.config.houseCut)),
      closesAt: room.closesAt,
      ranking,
      payouts: room.payouts.map(({ name, amount, kind, place }) => ({ name, amount, kind, place })),
      me: { payout: myPayout && { amount: myPayout.amount, kind: myPayout.kind, place: myPayout.place } },
      balance: player.balance,
    };
  }
}
