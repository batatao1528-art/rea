'use strict';
// Servidor do controle de fichas. Só usa módulos nativos do Node (>= 18).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_LIMIT = 200;

// ---------- Persistência ----------

function emptyDb() {
  return {
    settings: { chipsPerReal: 100, clubName: 'Poker Club' },
    users: [],
    sessions: {},
    requests: [],
    tables: [],
    ledger: [],
    nextId: 1,
  };
}

let db;
function load() {
  try {
    db = { ...emptyDb(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    db = emptyDb();
  }
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const newId = () => db.nextId++;
const now = () => new Date().toISOString();

// ---------- Erros e validação ----------

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (msg, status = 400) => { throw new HttpError(status, msg); };

function chips(value, field = 'Valor') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) fail(`${field} deve ser um número inteiro maior que zero.`);
  if (n > 1e12) fail(`${field} muito alto.`);
  return n;
}

function text(value, field, max = 40) {
  const s = String(value ?? '').trim();
  if (!s) fail(`${field} é obrigatório.`);
  if (s.length > max) fail(`${field} deve ter no máximo ${max} caracteres.`);
  return s;
}

// ---------- Usuários e sessões ----------

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

const findUser = (id) => db.users.find((u) => u.id === id);
const findTable = (id) => db.tables.find((t) => t.id === Number(id)) || fail('Mesa não encontrada.', 404);

function publicUser(u) {
  return { id: u.id, name: u.name, username: u.username, isAdmin: u.isAdmin, balance: u.balance, active: u.active !== false };
}

function addLedger(userId, type, amount, note = '') {
  db.ledger.push({ id: newId(), at: now(), userId, type, amount, note });
}

// ---------- Mesas ----------

function tableLog(table, message) {
  table.log.push({ at: now(), message });
  if (table.log.length > LOG_LIMIT) table.log.splice(0, table.log.length - LOG_LIMIT);
}

const seatOf = (table, userId) => table.seats.find((s) => s.userId === userId);
const nameOf = (userId) => findUser(userId)?.name ?? '?';
const maxBet = (table) => Math.max(0, ...table.seats.map((s) => s.bet));

function putIn(table, seat, amount) {
  const value = Math.min(amount, seat.stack);
  seat.stack -= value;
  seat.bet += value;
  return value;
}

function collectBets(table) {
  let total = 0;
  for (const s of table.seats) {
    total += s.bet;
    s.bet = 0;
  }
  table.pot += total;
  return total;
}

// Remove o jogador da mesa: a aposta em jogo fica no pote, o stack volta para a carteira.
function removeSeat(table, seat, reason) {
  table.pot += seat.bet;
  const user = findUser(seat.userId);
  user.balance += seat.stack;
  if (seat.stack) addLedger(user.id, 'table_out', seat.stack, `Saiu da mesa ${table.name}`);
  table.seats = table.seats.filter((s) => s !== seat);
  tableLog(table, `${user.name} ${reason} com ${seat.stack} fichas.`);
}

function nextHand(table) {
  if (table.seats.some((s) => s.bet > 0) || table.pot > 0) {
    fail('Ainda há fichas no pote ou em apostas. Pague o pote antes de começar uma nova mão.');
  }
  const players = table.seats.filter((s) => s.stack > 0);
  if (players.length < 2) fail('São necessários ao menos 2 jogadores com fichas.');
  for (const s of table.seats) s.folded = s.stack <= 0;

  // Gira o botão para o próximo jogador com fichas.
  const order = table.seats.map((s) => s.userId);
  const start = order.indexOf(table.button);
  let button = players[0].userId;
  for (let i = 1; i <= order.length; i++) {
    const candidate = table.seats[(start + i) % order.length];
    if (candidate.stack > 0) { button = candidate.userId; break; }
  }
  table.button = button;
  table.hand += 1;

  const active = players.map((s) => s.userId);
  const bi = active.indexOf(button);
  // Heads-up: o botão paga o small blind.
  const sbSeat = seatOf(table, active.length === 2 ? button : active[(bi + 1) % active.length]);
  const bbSeat = seatOf(table, active.length === 2 ? active[(bi + 1) % 2] : active[(bi + 2) % active.length]);
  const sb = putIn(table, sbSeat, table.smallBlind);
  const bb = putIn(table, bbSeat, table.bigBlind);
  tableLog(table, `Mão #${table.hand}: botão com ${nameOf(button)}. ${nameOf(sbSeat.userId)} paga SB ${sb}, ${nameOf(bbSeat.userId)} paga BB ${bb}.`);
}

function publicTable(t) {
  return {
    id: t.id,
    name: t.name,
    smallBlind: t.smallBlind,
    bigBlind: t.bigBlind,
    minBuyIn: t.minBuyIn,
    maxBuyIn: t.maxBuyIn,
    pot: t.pot,
    hand: t.hand,
    button: t.button,
    currentBet: maxBet(t),
    seats: t.seats.map((s) => ({ ...s, name: nameOf(s.userId) })),
    log: t.log.slice(-40).reverse(),
  };
}

// ---------- Tempo real (Server-Sent Events) ----------

const streams = new Set();
function broadcast() {
  for (const res of streams) res.write('event: update\ndata: {}\n\n');
}
setInterval(() => { for (const res of streams) res.write(': ping\n\n'); }, 25000).unref();

// ---------- Estatísticas de conferência ----------

function audit() {
  const wallets = db.users.reduce((a, u) => a + u.balance, 0);
  const pendingWithdrawals = db.requests
    .filter((r) => r.type === 'withdraw' && r.status === 'pending')
    .reduce((a, r) => a + r.chips, 0);
  const onTables = db.tables.reduce((a, t) => a + t.pot + t.seats.reduce((b, s) => b + s.stack + s.bet, 0), 0);
  const issued = db.ledger.reduce((a, e) => {
    if (e.type === 'deposit' || e.type === 'admin_credit') return a + e.amount;
    if (e.type === 'withdraw' || e.type === 'admin_debit') return a - e.amount;
    return a;
  }, 0);
  return { wallets, pendingWithdrawals, onTables, total: wallets + pendingWithdrawals + onTables, issued };
}

// ---------- Rotas ----------

const routes = [];
const route = (method, pattern, opts, handler) => {
  const keys = [];
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '(\\d+)'; }) + '$');
  routes.push({ method, regex, keys, handler, ...opts });
};
const PUBLIC = { auth: false };
const USER = { auth: true };
const ADMIN = { auth: true, admin: true };

route('GET', '/api/state', PUBLIC, ({ user }) => {
  const state = {
    settings: db.settings,
    hasUsers: db.users.length > 0,
    me: user ? publicUser(user) : null,
  };
  if (!user) return state;
  state.tables = db.tables.map(publicTable);
  state.myRequests = db.requests.filter((r) => r.userId === user.id).slice(-20).reverse();
  state.myLedger = db.ledger.filter((e) => e.userId === user.id).slice(-30).reverse();
  if (user.isAdmin) {
    state.users = db.users.map(publicUser);
    state.pending = db.requests.filter((r) => r.status === 'pending').map((r) => ({ ...r, name: nameOf(r.userId) }));
    state.audit = audit();
  }
  return state;
});

route('POST', '/api/register', PUBLIC, ({ body, res }) => {
  const name = text(body.name, 'Nome');
  const username = text(body.username, 'Usuário', 24).toLowerCase();
  if (!/^[a-z0-9_.-]+$/.test(username)) fail('Usuário pode ter apenas letras, números, ponto, hífen e _.');
  const password = String(body.password ?? '');
  if (password.length < 6) fail('A senha deve ter ao menos 6 caracteres.');
  if (db.users.some((u) => u.username === username)) fail('Esse usuário já existe.');
  const { salt, hash } = hashPassword(password);
  // A primeira conta criada vira o administrador (o dono da mesa).
  const user = { id: newId(), name, username, salt, hash, isAdmin: db.users.length === 0, balance: 0, active: true, createdAt: now() };
  db.users.push(user);
  startSession(res, user);
  return { ok: true };
});

route('POST', '/api/login', PUBLIC, ({ body, res }) => {
  const user = db.users.find((u) => u.username === String(body.username ?? '').trim().toLowerCase());
  if (!user || !checkPassword(user, String(body.password ?? ''))) fail('Usuário ou senha incorretos.', 401);
  if (user.active === false) fail('Conta desativada. Fale com o administrador.', 403);
  startSession(res, user);
  return { ok: true };
});

route('POST', '/api/logout', USER, ({ token, res }) => {
  delete db.sessions[token];
  res.setHeader('Set-Cookie', 'sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  return { ok: true };
});

// Depósito: o jogador avisa quanto pagou (Pix/dinheiro) e o administrador confirma.
route('POST', '/api/requests/deposit', USER, ({ user, body }) => {
  const reais = Number(body.reais);
  if (!Number.isFinite(reais) || reais <= 0) fail('Informe um valor em reais maior que zero.');
  const amount = Math.round(reais * db.settings.chipsPerReal);
  if (amount <= 0) fail('Valor muito baixo para gerar fichas.');
  db.requests.push({ id: newId(), userId: user.id, type: 'deposit', reais: Math.round(reais * 100) / 100, chips: amount, status: 'pending', createdAt: now(), note: String(body.note ?? '').slice(0, 100) });
  return { ok: true };
});

// Saque: as fichas ficam reservadas até o administrador pagar ou recusar.
route('POST', '/api/requests/withdraw', USER, ({ user, body }) => {
  const amount = chips(body.chips, 'Fichas');
  if (amount > user.balance) fail('Saldo insuficiente na carteira.');
  user.balance -= amount;
  db.requests.push({ id: newId(), userId: user.id, type: 'withdraw', chips: amount, reais: Math.round((amount / db.settings.chipsPerReal) * 100) / 100, status: 'pending', createdAt: now(), note: String(body.note ?? '').slice(0, 100) });
  return { ok: true };
});

route('POST', '/api/requests/:id/cancel', USER, ({ user, params }) => {
  const r = db.requests.find((x) => x.id === Number(params.id) && x.userId === user.id) || fail('Pedido não encontrado.', 404);
  if (r.status !== 'pending') fail('Esse pedido já foi resolvido.');
  r.status = 'cancelled';
  r.resolvedAt = now();
  if (r.type === 'withdraw') user.balance += r.chips;
  return { ok: true };
});

route('POST', '/api/admin/requests/:id', ADMIN, ({ user, params, body }) => {
  const r = db.requests.find((x) => x.id === Number(params.id)) || fail('Pedido não encontrado.', 404);
  if (r.status !== 'pending') fail('Esse pedido já foi resolvido.');
  const owner = findUser(r.userId);
  const approve = body.approve === true;
  r.status = approve ? 'approved' : 'rejected';
  r.resolvedAt = now();
  r.resolvedBy = user.id;
  if (r.type === 'deposit' && approve) {
    owner.balance += r.chips;
    addLedger(owner.id, 'deposit', r.chips, `Depósito de R$ ${r.reais.toFixed(2)}`);
  } else if (r.type === 'withdraw') {
    if (approve) addLedger(owner.id, 'withdraw', r.chips, `Saque de R$ ${r.reais.toFixed(2)}`);
    else owner.balance += r.chips;
  }
  return { ok: true };
});

route('POST', '/api/admin/users/:id/adjust', ADMIN, ({ user, params, body }) => {
  const target = findUser(Number(params.id)) || fail('Jogador não encontrado.', 404);
  const amount = Number(body.chips);
  if (!Number.isInteger(amount) || amount === 0) fail('Informe um número inteiro de fichas (negativo para debitar).');
  if (target.balance + amount < 0) fail('O saldo não pode ficar negativo.');
  target.balance += amount;
  const note = String(body.note ?? '').slice(0, 100) || 'Ajuste manual';
  addLedger(target.id, amount > 0 ? 'admin_credit' : 'admin_debit', Math.abs(amount), `${note} (por ${user.name})`);
  return { ok: true };
});

route('POST', '/api/admin/users/:id/role', ADMIN, ({ user, params, body }) => {
  const target = findUser(Number(params.id)) || fail('Jogador não encontrado.', 404);
  if (target.id === user.id) fail('Você não pode alterar a sua própria conta.');
  if ('isAdmin' in body) target.isAdmin = body.isAdmin === true;
  if ('active' in body) {
    target.active = body.active === true;
    if (!target.active) {
      for (const [token, uid] of Object.entries(db.sessions)) if (uid === target.id) delete db.sessions[token];
    }
  }
  return { ok: true };
});

route('POST', '/api/admin/settings', ADMIN, ({ body }) => {
  if ('chipsPerReal' in body) db.settings.chipsPerReal = chips(body.chipsPerReal, 'Fichas por real');
  if ('clubName' in body) db.settings.clubName = text(body.clubName, 'Nome do clube');
  return { ok: true };
});

route('POST', '/api/admin/tables', ADMIN, ({ body }) => {
  const smallBlind = chips(body.smallBlind, 'Small blind');
  const bigBlind = chips(body.bigBlind, 'Big blind');
  const minBuyIn = chips(body.minBuyIn, 'Buy-in mínimo');
  const maxBuyIn = chips(body.maxBuyIn, 'Buy-in máximo');
  if (bigBlind < smallBlind) fail('O big blind deve ser maior ou igual ao small blind.');
  if (maxBuyIn < minBuyIn) fail('O buy-in máximo deve ser maior ou igual ao mínimo.');
  const table = { id: newId(), name: text(body.name, 'Nome da mesa'), smallBlind, bigBlind, minBuyIn, maxBuyIn, seats: [], pot: 0, hand: 0, button: null, log: [], createdAt: now() };
  tableLog(table, 'Mesa criada.');
  db.tables.push(table);
  return { ok: true, id: table.id };
});

route('POST', '/api/admin/tables/:id/close', ADMIN, ({ params }) => {
  const table = findTable(params.id);
  if (table.seats.length || table.pot) fail('Só é possível fechar uma mesa vazia e sem pote.');
  db.tables = db.tables.filter((t) => t !== table);
  return { ok: true };
});

route('POST', '/api/tables/:id/join', USER, ({ user, params, body }) => {
  const table = findTable(params.id);
  if (seatOf(table, user.id)) fail('Você já está nessa mesa.');
  const amount = chips(body.chips, 'Buy-in');
  if (amount < table.minBuyIn || amount > table.maxBuyIn) fail(`O buy-in deve ser entre ${table.minBuyIn} e ${table.maxBuyIn}.`);
  if (amount > user.balance) fail('Saldo insuficiente na carteira.');
  user.balance -= amount;
  addLedger(user.id, 'table_in', amount, `Entrou na mesa ${table.name}`);
  // Quem senta no meio de uma mão espera a próxima.
  table.seats.push({ userId: user.id, stack: amount, bet: 0, folded: table.hand > 0 });
  tableLog(table, `${user.name} sentou com ${amount} fichas.`);
  return { ok: true };
});

route('POST', '/api/tables/:id/rebuy', USER, ({ user, params, body }) => {
  const table = findTable(params.id);
  const seat = seatOf(table, user.id) || fail('Você não está nessa mesa.');
  const amount = chips(body.chips, 'Recompra');
  if (seat.stack + seat.bet + amount > table.maxBuyIn) fail(`Seu stack não pode passar de ${table.maxBuyIn}.`);
  if (amount > user.balance) fail('Saldo insuficiente na carteira.');
  user.balance -= amount;
  seat.stack += amount;
  addLedger(user.id, 'table_in', amount, `Recompra na mesa ${table.name}`);
  tableLog(table, `${user.name} recomprou ${amount} fichas.`);
  return { ok: true };
});

route('POST', '/api/tables/:id/leave', USER, ({ user, params }) => {
  const table = findTable(params.id);
  const seat = seatOf(table, user.id) || fail('Você não está nessa mesa.');
  if (seat.bet > 0) fail('Você tem uma aposta em jogo. Desista (fold) ou espere o fim da mão.');
  if (table.pot > 0 && !seat.folded) fail('Há um pote em disputa. Desista (fold) ou espere o pagamento do pote.');
  removeSeat(table, seat, 'saiu da mesa');
  return { ok: true };
});

route('POST', '/api/tables/:id/action', USER, ({ user, params, body }) => {
  const table = findTable(params.id);
  const seat = seatOf(table, user.id) || fail('Você não está nessa mesa.');
  if (seat.folded) fail('Você não está nessa mão.');
  const top = maxBet(table);
  switch (body.action) {
    case 'check':
      if (seat.bet < top && seat.stack > 0) fail(`Há uma aposta de ${top}. Pague, aumente ou desista.`);
      tableLog(table, `${user.name} passou (check).`);
      break;
    case 'call': {
      if (seat.bet >= top) fail('Não há aposta para pagar.');
      const paid = putIn(table, seat, top - seat.bet);
      tableLog(table, `${user.name} pagou ${paid}${seat.stack === 0 ? ' (all-in)' : ''}.`);
      break;
    }
    case 'raise': {
      // "to" é o total da aposta do jogador nesta rodada (ex.: aumentar para 400).
      const to = chips(body.to, 'Aposta');
      if (to <= top) fail(`A aposta deve ser maior que ${top}.`);
      if (to - seat.bet > seat.stack) fail('Você não tem fichas suficientes. Use all-in.');
      putIn(table, seat, to - seat.bet);
      tableLog(table, `${user.name} ${top === 0 ? 'apostou' : 'aumentou para'} ${to}${seat.stack === 0 ? ' (all-in)' : ''}.`);
      break;
    }
    case 'allin': {
      if (seat.stack <= 0) fail('Você não tem fichas no stack.');
      putIn(table, seat, seat.stack);
      tableLog(table, `${user.name} foi all-in (${seat.bet}).`);
      break;
    }
    case 'fold':
      seat.folded = true;
      tableLog(table, `${user.name} desistiu (fold).`);
      break;
    default:
      fail('Ação inválida.');
  }
  return { ok: true };
});

// Controles do dealer (administrador).
route('POST', '/api/admin/tables/:id/dealer', ADMIN, ({ params, body }) => {
  const table = findTable(params.id);
  switch (body.action) {
    case 'newHand':
      nextHand(table);
      break;
    case 'collect': {
      const total = collectBets(table);
      tableLog(table, `Apostas recolhidas para o pote (+${total}). Pote: ${table.pot}.`);
      break;
    }
    case 'award': {
      collectBets(table);
      const seat = seatOf(table, Number(body.userId)) || fail('Jogador não está na mesa.');
      const amount = body.chips === undefined || body.chips === '' ? table.pot : chips(body.chips, 'Fichas');
      if (amount <= 0) fail('O pote está vazio.');
      if (amount > table.pot) fail(`O pote tem apenas ${table.pot} fichas.`);
      table.pot -= amount;
      seat.stack += amount;
      tableLog(table, `${nameOf(seat.userId)} ganhou ${amount} fichas.${table.pot ? ` Restam ${table.pot} no pote.` : ''}`);
      break;
    }
    case 'split': {
      collectBets(table);
      const winners = (Array.isArray(body.userIds) ? body.userIds : []).map((id) => seatOf(table, Number(id)) || fail('Jogador não está na mesa.'));
      if (winners.length < 2) fail('Selecione ao menos 2 jogadores para dividir.');
      if (!table.pot) fail('O pote está vazio.');
      const share = Math.floor(table.pot / winners.length);
      let rest = table.pot - share * winners.length;
      for (const w of winners) {
        w.stack += share + (rest > 0 ? 1 : 0);
        rest--;
      }
      tableLog(table, `Pote de ${table.pot} dividido entre ${winners.map((w) => nameOf(w.userId)).join(', ')}.`);
      table.pot = 0;
      break;
    }
    case 'refund': {
      // Devolve a aposta da rodada de um jogador (corrigir erro de clique).
      const seat = seatOf(table, Number(body.userId)) || fail('Jogador não está na mesa.');
      if (!seat.bet) fail('Esse jogador não tem aposta na rodada.');
      tableLog(table, `Aposta de ${seat.bet} devolvida para ${nameOf(seat.userId)}.`);
      seat.stack += seat.bet;
      seat.bet = 0;
      break;
    }
    case 'kick': {
      const seat = seatOf(table, Number(body.userId)) || fail('Jogador não está na mesa.');
      removeSeat(table, seat, 'foi removido da mesa');
      break;
    }
    default:
      fail('Ação inválida.');
  }
  return { ok: true };
});

// ---------- HTTP ----------

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((c) => c.trim().split('=')).filter(([k]) => k).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

function startSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = user.id;
  const secure = process.env.SECURE_COOKIES === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sid=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure}`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e5) { reject(new HttpError(413, 'Requisição muito grande.')); req.destroy(); }
      else parts.push(c);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); }
      catch { reject(new HttpError(400, 'JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: 'Proibido.' });
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA: qualquer rota desconhecida devolve a página principal.
      return fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) return sendJson(res, 404, { error: 'Não encontrado.' });
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.sid;
  const sessionUser = token && db.sessions[token] ? findUser(db.sessions[token]) : null;
  const user = sessionUser && sessionUser.active !== false ? sessionUser : null;

  if (url.pathname === '/api/events' && req.method === 'GET') {
    if (!user) return sendJson(res, 401, { error: 'Faça login.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 3000\n\n');
    streams.add(res);
    req.on('close', () => streams.delete(res));
    return;
  }

  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);

  try {
    let match;
    const r = routes.find((x) => x.method === req.method && (match = x.regex.exec(url.pathname)));
    if (!r) fail('Rota não encontrada.', 404);
    if (req.method !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json')) {
      fail('Envie os dados como JSON.', 415);
    }
    if (r.auth && !user) fail('Faça login para continuar.', 401);
    if (r.admin && !user.isAdmin) fail('Apenas o administrador pode fazer isso.', 403);
    const params = Object.fromEntries(r.keys.map((k, i) => [k, match[i + 1]]));
    const body = req.method === 'GET' ? {} : await readBody(req);
    const result = r.handler({ req, res, user, token, params, body });
    if (req.method !== 'GET') {
      save();
      broadcast();
    }
    sendJson(res, 200, result);
  } catch (err) {
    // Uma operação que falhou no meio pode ter alterado a memória; volta ao último estado salvo.
    if (req.method !== 'GET') load();
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    console.error(err);
    sendJson(res, 500, { error: 'Erro interno.' });
  }
}

load();
const server = http.createServer(handle);
if (require.main === module) {
  server.listen(PORT, () => console.log(`Controle de fichas rodando em http://localhost:${PORT}`));
}
module.exports = { server };
