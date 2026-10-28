import { GAME_DURATION_MS } from '/shared/engine.js';
import { GameView } from '/game.js';

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'blocoRush.token';
const ROOM_POLL_MS = 3000;

const ui = {
  menu: $('screen-menu'),
  game: $('screen-game'),
  result: $('screen-result'),
};

let player = null;
let lastMode = 'practice';
let pollTimer = null;
let inRoomGame = false;

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem localStorage o jogador só precisa entrar de novo na próxima visita.
  }
}

let token = readToken();

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    token = null;
    writeToken(null);
    showLogin();
  }
  if (!res.ok) throw new Error(data.error || 'Erro de conexão');
  return data;
}

function show(screen) {
  for (const el of Object.values(ui)) el.hidden = el !== screen;
  window.scrollTo(0, 0);
}

function showLogin() {
  $('login').hidden = false;
  $('lobby').hidden = true;
  show(ui.menu);
}

function renderPlayer() {
  $('login').hidden = true;
  $('lobby').hidden = false;
  $('player-name').textContent = player.name;
  $('balance').textContent = player.balance;
  const wait = player.nextBonusAt - Date.now();
  const bonus = $('bonus');
  bonus.disabled = wait > 0;
  bonus.textContent = wait > 0 ? `Bônus em ${Math.ceil(wait / 3_600_000)}h` : 'Pegar bônus diário';
}

async function showMenu() {
  stopPolling();
  show(ui.menu);
  $('lobby-error').textContent = '';
  if (!token) return showLogin();
  try {
    player = await api('GET', '/api/me');
    renderPlayer();
  } catch (err) {
    if (token) $('lobby-error').textContent = err.message;
  }
}

$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('login-error').textContent = '';
  try {
    const data = await api('POST', '/api/players', { name: $('name').value });
    token = data.token;
    writeToken(token);
    player = data.player;
    renderPlayer();
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

$('bonus').addEventListener('click', async () => {
  try {
    player = await api('POST', '/api/bonus');
    renderPlayer();
  } catch (err) {
    $('lobby-error').textContent = err.message;
  }
});

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function startGame({ seed, durationMs, mode, room }) {
  lastMode = mode;
  inRoomGame = mode === 'room';
  show(ui.game);
  $('game-mode').textContent = mode === 'room'
    ? 'Sala valendo fichas: todos jogam com estas mesmas peças'
    : 'Treino: peças aleatórias, sem ranking';
  const timer = document.querySelector('.timer');
  new GameView($('board'), {
    seed,
    durationMs,
    onUpdate({ score, streak, remainingMs }) {
      $('hud-score').textContent = score;
      $('hud-time').textContent = formatTime(remainingMs);
      $('hud-streak').textContent = streak > 1 ? `x${Math.min(streak, 8)}` : '–';
      timer.classList.toggle('low', remainingMs <= 15_000);
    },
    onEnd: (result) => endGame(result, room),
  });
}

async function endGame({ score, moves, endReason }, room) {
  $('result-score').textContent = score;
  $('result-title').textContent = endReason === 'tempo' ? 'Tempo esgotado!' : 'Sem espaço!';
  $('result-detail').textContent = endReason === 'tempo'
    ? 'O relógio chegou a zero.'
    : 'Nenhuma das peças cabia mais no tabuleiro.';
  $('room-panel').hidden = !room;
  show(ui.result);
  if (!room) return;

  $('room-status').textContent = 'Enviando partida…';
  $('room-meta').textContent = '';
  $('ranking').replaceChildren();
  try {
    const res = await api('POST', `/api/rooms/${room.roomId}/submit`, {
      attemptId: room.attemptId,
      moves,
      clientScore: score,
    });
    if (res.status === 'invalid') $('result-detail').textContent = `Partida recusada: ${res.error}`;
  } catch (err) {
    $('result-detail').textContent = err.message;
  } finally {
    inRoomGame = false;
  }
  pollRoom(room.roomId);
}

const STATUS_LABEL = { playing: 'jogando…', invalid: 'recusada', abandoned: 'não terminou' };

function renderRoom(view) {
  const finished = view.status === 'finished';
  $('room-status').textContent = finished ? 'Sala encerrada' : `Sala aberta · ${view.players}/${view.capacity}`;
  $('room-meta').textContent = `Prêmio: ${view.prize} fichas`;
  const prizes = new Map(view.payouts.filter((p) => p.kind === 'premio').map((p) => [p.place, p.amount]));
  const items = view.ranking.map((row) => {
    const li = document.createElement('li');
    if (row.you) li.className = 'you';
    const place = document.createElement('span');
    place.className = 'place';
    place.textContent = row.place ? `${row.place}º` : '–';
    const name = document.createElement('span');
    name.textContent = row.you ? `${row.name} (você)` : row.name;
    const score = document.createElement('span');
    score.textContent = row.status === 'done' ? row.score : STATUS_LABEL[row.status];
    if (prizes.has(row.place)) {
      const prize = document.createElement('span');
      prize.className = 'prize';
      prize.textContent = `+${prizes.get(row.place)}`;
      score.append(prize);
    }
    li.append(place, name, score);
    return li;
  });
  $('ranking').replaceChildren(...items);
  if (finished && view.me.payout) {
    const { kind, amount, place } = view.me.payout;
    $('result-detail').textContent = kind === 'premio'
      ? `Você ficou em ${place}º e ganhou ${amount} fichas!`
      : `Sala sem adversários suficientes: ${amount} fichas devolvidas.`;
  }
}

function stopPolling() {
  clearTimeout(pollTimer);
  pollTimer = null;
}

async function pollRoom(roomId) {
  stopPolling();
  try {
    const view = await api('GET', `/api/rooms/${roomId}`);
    renderRoom(view);
    if (view.status === 'finished') return;
  } catch (err) {
    $('room-status').textContent = err.message;
  }
  pollTimer = setTimeout(() => pollRoom(roomId), ROOM_POLL_MS);
}

$('play-practice').addEventListener('click', () => {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  startGame({ seed, durationMs: GAME_DURATION_MS, mode: 'practice' });
});

async function playRoom() {
  $('lobby-error').textContent = '';
  try {
    const room = await api('POST', '/api/rooms/join');
    startGame({ seed: room.seed, durationMs: room.durationMs, mode: 'room', room });
  } catch (err) {
    await showMenu();
    $('lobby-error').textContent = err.message;
  }
}

$('play-room').addEventListener('click', playRoom);

$('again').addEventListener('click', () => {
  stopPolling();
  if (lastMode === 'room') playRoom();
  else $('play-practice').click();
});

$('back').addEventListener('click', showMenu);

window.addEventListener('beforeunload', (e) => {
  if (inRoomGame) e.preventDefault();
});

showMenu();
