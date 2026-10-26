'use strict';

const $app = document.getElementById('app');
let state = null;
let authMode = 'login';
let events = null;

// ---------- Utilidades ----------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');
const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const toReais = (c) => c / state.settings.chipsPerReal;
const time = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = isError ? 'error' : ''; }, 3200);
}

async function api(path, body) {
  const res = await fetch('/api' + path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro de conexão.');
  return data;
}

// Executa uma ação, mostra o erro (se houver) e atualiza a tela.
async function act(path, body, success) {
  try {
    await api(path, body);
    if (success) toast(success);
    await refresh();
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

const val = (id) => document.getElementById(id)?.value.trim() ?? '';
const route = () => (location.hash.replace(/^#/, '') || '/');

// ---------- Carregamento e tempo real ----------

async function refresh() {
  try {
    state = await api('/state');
  } catch (err) {
    toast(err.message, true);
    return;
  }
  if (state.me && !events) {
    events = new EventSource('/api/events');
    events.addEventListener('update', () => refresh());
  } else if (!state.me && events) {
    events.close();
    events = null;
  }
  render();
}

// Re-renderiza preservando o que estava sendo digitado.
function render() {
  const active = document.activeElement;
  const focusId = active && active.id;
  const values = {};
  $app.querySelectorAll('input[id], select[id]').forEach((el) => {
    values[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  const openDetails = [...$app.querySelectorAll('details[id][open]')].map((el) => el.id);

  document.getElementById('club-name').textContent = state.settings.clubName;
  document.title = state.settings.clubName;
  renderUserbox();
  $app.innerHTML = state.me ? view() : authView();

  for (const [id, v] of Object.entries(values)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = v; else el.value = v;
  }
  openDetails.forEach((id) => document.getElementById(id)?.setAttribute('open', ''));
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) el.focus();
  }
}

function renderUserbox() {
  const box = document.getElementById('userbox');
  if (!state.me) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <span class="who">${esc(state.me.name)}</span>
    <span class="bal" title="Saldo na carteira">🪙 ${fmt(state.me.balance)}</span>
    <button class="sm ghost" data-action="logout">Sair</button>`;
}

// ---------- Telas ----------

function authView() {
  const first = !state.hasUsers;
  const register = authMode === 'register' || first;
  return `
    <div class="card auth">
      <h1>${register ? 'Criar conta' : 'Entrar'}</h1>
      ${first ? '<p class="muted">Primeiro acesso: esta conta será o <b>administrador</b> (quem confirma depósitos, saques e controla as mesas).</p>' : ''}
      <form data-form="${register ? 'register' : 'login'}">
        ${register ? '<label for="a-name">Seu nome (aparece na mesa)</label><input id="a-name" autocomplete="name" required maxlength="40">' : ''}
        <label for="a-user">Usuário</label>
        <input id="a-user" autocomplete="username" autocapitalize="none" required maxlength="24">
        <label for="a-pass">Senha</label>
        <input id="a-pass" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="6">
        <button class="primary block" type="submit">${register ? 'Criar conta' : 'Entrar'}</button>
      </form>
      ${first ? '' : `<p class="center small"><a href="#" data-action="toggle-auth">${register ? 'Já tenho conta' : 'Criar uma conta'}</a></p>`}
    </div>`;
}

function tabs(current) {
  const pending = state.pending?.length || 0;
  const items = [['/', 'Mesas'], ['/carteira', 'Carteira']];
  if (state.me.isAdmin) items.push(['/admin', `Admin${pending ? ` <span class="badge">${pending}</span>` : ''}`]);
  return `<nav class="tabs">${items.map(([href, label]) => `<a href="#${href}" class="${current === href ? 'active' : ''}">${label}</a>`).join('')}</nav>`;
}

function view() {
  const r = route();
  const m = r.match(/^\/mesa\/(\d+)$/);
  if (m) return tableView(Number(m[1]));
  if (r === '/carteira') return tabs(r) + walletView();
  if (r === '/admin' && state.me.isAdmin) return tabs(r) + adminView();
  return tabs('/') + lobbyView();
}

function lobbyView() {
  if (!state.tables.length) {
    return `<div class="card center"><p class="muted">Nenhuma mesa aberta.</p>${state.me.isAdmin ? '<p><a href="#/admin">Criar uma mesa no painel Admin</a></p>' : ''}</div>`;
  }
  return `<div class="grid">${state.tables.map((t) => {
    const seated = t.seats.some((s) => s.userId === state.me.id);
    return `
      <div class="card">
        <div class="spread"><h2>${esc(t.name)}</h2>${seated ? '<span class="status approved">Você está aqui</span>' : ''}</div>
        <p class="muted small">Blinds ${fmt(t.smallBlind)}/${fmt(t.bigBlind)} · Buy-in ${fmt(t.minBuyIn)}–${fmt(t.maxBuyIn)}</p>
        <p>${t.seats.length} jogador(es)${t.pot ? ` · Pote ${fmt(t.pot)}` : ''}</p>
        <a href="#/mesa/${t.id}"><button class="primary block">${seated ? 'Abrir mesa' : 'Ver / Sentar'}</button></a>
      </div>`;
  }).join('')}</div>`;
}

const STATUS = { pending: 'Pendente', approved: 'Aprovado', rejected: 'Recusado', cancelled: 'Cancelado' };
const LEDGER = { deposit: 'Depósito', withdraw: 'Saque', table_in: 'Entrada na mesa', table_out: 'Saída da mesa', admin_credit: 'Crédito', admin_debit: 'Débito' };
const LEDGER_SIGN = { deposit: 1, table_out: 1, admin_credit: 1, withdraw: -1, table_in: -1, admin_debit: -1 };

function walletView() {
  const rate = state.settings.chipsPerReal;
  return `
    <div class="card center">
      <h3>Saldo na carteira</h3>
      <div class="big">🪙 ${fmt(state.me.balance)}</div>
      <div class="muted">≈ ${brl(toReais(state.me.balance))} · ${fmt(rate)} fichas = R$ 1,00</div>
    </div>
    <div class="grid">
      <form class="card" data-form="deposit">
        <h2>Depositar</h2>
        <p class="muted small">Pague o administrador (Pix ou dinheiro) e registre aqui. As fichas entram quando ele confirmar.</p>
        <label for="d-reais">Valor em R$</label>
        <input id="d-reais" type="number" inputmode="decimal" min="0.01" step="0.01" required>
        <label for="d-note">Observação (opcional)</label>
        <input id="d-note" maxlength="100" placeholder="Ex.: Pix enviado às 21h">
        <button class="primary block" type="submit">Pedir fichas</button>
      </form>
      <form class="card" data-form="withdraw">
        <h2>Sacar</h2>
        <p class="muted small">As fichas ficam reservadas até o administrador te pagar.</p>
        <label for="w-chips">Fichas</label>
        <input id="w-chips" type="number" inputmode="numeric" min="1" step="1" max="${state.me.balance}" required>
        <label for="w-note">Chave Pix / observação</label>
        <input id="w-note" maxlength="100">
        <button class="block" type="submit">Pedir saque</button>
      </form>
    </div>
    <div class="card">
      <h2>Meus pedidos</h2>
      ${state.myRequests.length ? `<div class="scroll-x"><table class="list">
        <tr><th>Data</th><th>Tipo</th><th class="num">Fichas</th><th class="num">R$</th><th>Status</th><th></th></tr>
        ${state.myRequests.map((r) => `<tr>
          <td>${dateTime(r.createdAt)}</td>
          <td>${r.type === 'deposit' ? 'Depósito' : 'Saque'}</td>
          <td class="num">${fmt(r.chips)}</td>
          <td class="num">${brl(r.reais)}</td>
          <td><span class="status ${r.status}">${STATUS[r.status]}</span></td>
          <td>${r.status === 'pending' ? `<button class="sm ghost" data-action="cancel-request" data-id="${r.id}">Cancelar</button>` : ''}</td>
        </tr>`).join('')}
      </table></div>` : '<p class="muted">Nenhum pedido ainda.</p>'}
    </div>
    <div class="card">
      <h2>Extrato</h2>
      ${state.myLedger.length ? `<div class="scroll-x"><table class="list">
        ${state.myLedger.map((e) => `<tr>
          <td>${dateTime(e.at)}</td>
          <td>${LEDGER[e.type] || e.type}<div class="muted small">${esc(e.note)}</div></td>
          <td class="num ${LEDGER_SIGN[e.type] > 0 ? 'pos' : 'neg'}">${LEDGER_SIGN[e.type] > 0 ? '+' : '−'}${fmt(e.amount)}</td>
        </tr>`).join('')}
      </table></div>` : '<p class="muted">Sem movimentações.</p>'}
    </div>`;
}

function tableView(id) {
  const t = state.tables.find((x) => x.id === id);
  if (!t) return `${tabs('/')}<div class="card center"><p>Mesa não encontrada.</p><a href="#/">Voltar</a></div>`;
  const me = t.seats.find((s) => s.userId === state.me.id);
  const admin = state.me.isAdmin;
  const toCall = me ? Math.min(t.currentBet - me.bet, me.stack) : 0;

  const seats = t.seats.map((s) => `
    <div class="seat ${s.userId === state.me.id ? 'me' : ''} ${s.folded ? 'folded' : ''}">
      ${t.button === s.userId ? '<span class="dealer-btn" title="Botão do dealer">D</span>' : ''}
      <div class="nm">${esc(s.name)}</div>
      <div class="stack">🪙 ${fmt(s.stack)}</div>
      <div class="bet">${s.bet ? `Aposta: ${fmt(s.bet)}` : s.folded ? 'Fora da mão' : s.stack === 0 ? 'Sem fichas' : ''}</div>
    </div>`).join('');

  let mine = '';
  if (me) {
    const minRaise = Math.max(t.currentBet + t.bigBlind, t.bigBlind);
    mine = `
      <div class="card">
        <div class="spread"><h2>Suas fichas</h2><span class="muted small">Stack ${fmt(me.stack)} · na rodada ${fmt(me.bet)}</span></div>
        ${me.folded ? '<p class="muted">Você está fora desta mão. Aguarde a próxima.</p>' : `
        <div class="actions">
          ${toCall > 0
            ? `<button class="ok" data-action="play" data-play="call">Pagar ${fmt(toCall)}</button>`
            : '<button class="ok" data-action="play" data-play="check">Mesa (check)</button>'}
          <button class="danger" data-action="play" data-play="fold">Desistir</button>
          <button data-action="play" data-play="allin">All-in (${fmt(me.stack)})</button>
        </div>
        <label for="raise-to">${t.currentBet ? 'Aumentar para (total da sua aposta na rodada)' : 'Apostar'}</label>
        <div class="quick">
          ${[['Mín', minRaise], ['½ pote', t.currentBet + Math.round((t.pot + t.seats.reduce((a, s) => a + s.bet, 0)) / 2)], ['Pote', t.currentBet + t.pot + t.seats.reduce((a, s) => a + s.bet, 0)]]
            .filter(([, v]) => v > t.currentBet && v - me.bet <= me.stack)
            .map(([l, v]) => `<button type="button" class="sm" data-action="set-raise" data-value="${v}">${l} · ${fmt(v)}</button>`).join('')}
        </div>
        <form class="row" data-form="raise" data-table="${t.id}">
          <input id="raise-to" type="number" inputmode="numeric" min="${t.currentBet + 1}" step="1" placeholder="${fmt(minRaise)}" required>
          <button class="primary" type="submit">${t.currentBet ? 'Aumentar' : 'Apostar'}</button>
        </form>`}
        <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
        <form class="row" data-form="rebuy" data-table="${t.id}">
          <input id="rebuy" type="number" inputmode="numeric" min="1" step="1" placeholder="Recomprar fichas">
          <button type="submit">Recomprar</button>
          <button type="button" class="ghost" data-action="leave" data-id="${t.id}">Sair da mesa</button>
        </form>
      </div>`;
  } else {
    mine = `
      <form class="card" data-form="join" data-table="${t.id}">
        <h2>Sentar na mesa</h2>
        <p class="muted small">Buy-in entre ${fmt(t.minBuyIn)} e ${fmt(t.maxBuyIn)}. Você tem ${fmt(state.me.balance)} na carteira.</p>
        <div class="row">
          <input id="buyin" type="number" inputmode="numeric" min="${t.minBuyIn}" max="${t.maxBuyIn}" step="1" value="${Math.min(t.maxBuyIn, Math.max(t.minBuyIn, state.me.balance))}" required>
          <button class="primary" type="submit" ${state.me.balance < t.minBuyIn ? 'disabled' : ''}>Sentar</button>
        </div>
        ${state.me.balance < t.minBuyIn ? '<p class="small neg">Saldo insuficiente. <a href="#/carteira">Deposite na carteira</a>.</p>' : ''}
      </form>`;
  }

  const dealer = admin ? `
    <div class="card">
      <h2>Dealer (administrador)</h2>
      <div class="actions">
        <button class="primary" data-action="dealer" data-dealer="newHand">Nova mão + blinds</button>
        <button data-action="dealer" data-dealer="collect">Recolher apostas (próxima rua)</button>
      </div>
      <label for="win-user">Pagar pote para</label>
      <div class="row">
        <select id="win-user">${t.seats.map((s) => `<option value="${s.userId}">${esc(s.name)}</option>`).join('')}</select>
        <input id="win-chips" type="number" inputmode="numeric" min="1" step="1" placeholder="Tudo (${fmt(t.pot + t.seats.reduce((a, s) => a + s.bet, 0))})">
        <button class="ok" data-action="award" data-id="${t.id}">Pagar</button>
      </div>
      <p class="muted small">Deixe o valor em branco para pagar o pote inteiro. Para side pots, pague um valor de cada vez.</p>
      <details id="dealer-more">
        <summary class="muted small">Dividir pote / corrigir</summary>
        <div class="row" style="margin-top:8px">
          ${t.seats.map((s) => `<label class="row small" style="margin:0"><input type="checkbox" id="split-${s.userId}" class="split" value="${s.userId}" style="width:auto"> ${esc(s.name)}</label>`).join('')}
          <button class="sm" data-action="split" data-id="${t.id}">Dividir igualmente</button>
        </div>
        <div class="scroll-x"><table class="list" style="margin-top:8px">
          ${t.seats.map((s) => `<tr><td>${esc(s.name)}</td><td class="num">
            ${s.bet ? `<button class="sm" data-action="dealer" data-dealer="refund" data-user="${s.userId}">Devolver aposta</button>` : ''}
            <button class="sm danger" data-action="kick" data-user="${s.userId}" data-name="${esc(s.name)}">Remover</button>
          </td></tr>`).join('')}
        </table></div>
        ${t.seats.length || t.pot ? '' : `<button class="danger sm" data-action="close-table" data-id="${t.id}">Fechar mesa</button>`}
      </details>
    </div>` : '';

  return `
    <p><a href="#/">← Mesas</a></p>
    <div class="felt" data-table="${t.id}">
      <h1>${esc(t.name)}</h1>
      <div class="muted small" style="color:#cde7d9">Blinds ${fmt(t.smallBlind)}/${fmt(t.bigBlind)}${t.hand ? ` · Mão #${t.hand}` : ''}</div>
      <div class="pot-label" style="margin-top:12px">Pote</div>
      <div class="pot">${fmt(t.pot)}</div>
      ${t.currentBet ? `<div class="small" style="color:#cde7d9">Aposta atual na rodada: <b>${fmt(t.currentBet)}</b></div>` : ''}
      <div class="seats">${seats || '<p class="muted">Ninguém sentado ainda.</p>'}</div>
    </div>
    ${mine}
    ${dealer}
    <div class="card">
      <h2>Histórico da mesa</h2>
      <ul class="log">${t.log.map((l) => `<li><time>${time(l.at)}</time>${esc(l.message)}</li>`).join('')}</ul>
    </div>`;
}

function adminView() {
  const a = state.audit;
  const balanced = a.total === a.issued;
  return `
    <div class="card">
      <h2>Pedidos pendentes</h2>
      ${state.pending.length ? state.pending.map((r) => `
        <div class="item">
          <div class="spread">
            <div><b>${esc(r.name)}</b> · ${r.type === 'deposit' ? 'Depósito' : '<b class="neg">Saque</b>'}
              <div class="muted small">${dateTime(r.createdAt)}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
            <div class="num"><b>${brl(r.reais)}</b><div class="muted small">${fmt(r.chips)} fichas</div></div>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="sm ok" data-action="resolve" data-id="${r.id}" data-approve="1">${r.type === 'deposit' ? 'Recebi o dinheiro' : 'Já paguei'}</button>
            <button class="sm danger" data-action="resolve" data-id="${r.id}" data-approve="0">Recusar</button>
          </div>
        </div>`).join('') : '<p class="muted">Nada pendente.</p>'}
    </div>

    <div class="grid">
      <form class="card" data-form="create-table">
        <h2>Nova mesa</h2>
        <label for="t-name">Nome</label><input id="t-name" required maxlength="40" placeholder="Mesa 1">
        <div class="row">
          <div style="flex:1"><label for="t-sb">Small blind</label><input id="t-sb" type="number" min="1" step="1" value="5" required></div>
          <div style="flex:1"><label for="t-bb">Big blind</label><input id="t-bb" type="number" min="1" step="1" value="10" required></div>
        </div>
        <div class="row">
          <div style="flex:1"><label for="t-min">Buy-in mín.</label><input id="t-min" type="number" min="1" step="1" value="200" required></div>
          <div style="flex:1"><label for="t-max">Buy-in máx.</label><input id="t-max" type="number" min="1" step="1" value="1000" required></div>
        </div>
        <button class="primary block" type="submit">Criar mesa</button>
      </form>

      <form class="card" data-form="settings">
        <h2>Configurações</h2>
        <label for="s-club">Nome do clube</label><input id="s-club" maxlength="40" value="${esc(state.settings.clubName)}">
        <label for="s-rate">Fichas por R$ 1,00</label><input id="s-rate" type="number" min="1" step="1" value="${state.settings.chipsPerReal}">
        <p class="muted small">Mudar a cotação vale só para pedidos novos.</p>
        <button class="block" type="submit">Salvar</button>
      </form>

      <div class="card">
        <h2>Conferência de fichas</h2>
        <table class="list">
          <tr><td>Nas carteiras</td><td class="num">${fmt(a.wallets)}</td></tr>
          <tr><td>Nas mesas</td><td class="num">${fmt(a.onTables)}</td></tr>
          <tr><td>Saques aguardando</td><td class="num">${fmt(a.pendingWithdrawals)}</td></tr>
          <tr><td><b>Total em circulação</b></td><td class="num"><b>${fmt(a.total)}</b></td></tr>
          <tr><td>Emitidas (depósitos − saques)</td><td class="num">${fmt(a.issued)}</td></tr>
        </table>
        <p class="small ${balanced ? 'pos' : 'neg'}">${balanced ? '✔ Tudo bate.' : '⚠ Diferença encontrada.'} Em dinheiro: ${brl(toReais(a.total))}</p>
      </div>
    </div>

    <div class="card">
      <h2>Jogadores</h2>
      ${state.users.map((u) => `
        <div class="item">
          <div class="spread">
            <div>${esc(u.name)} <span class="muted small">@${esc(u.username)}</span>${u.isAdmin ? ' <span class="status approved">admin</span>' : ''}${u.active ? '' : ' <span class="status rejected">desativado</span>'}</div>
            <div class="num">🪙 <b>${fmt(u.balance)}</b></div>
          </div>
          <div class="row" style="margin-top:8px">
            <input id="adj-${u.id}" type="number" step="1" placeholder="+/- fichas" style="max-width:140px">
            <button class="sm" data-action="adjust" data-id="${u.id}">Ajustar</button>
            ${u.id === state.me.id ? '' : `
            <button class="sm ghost" data-action="toggle-admin" data-id="${u.id}" data-value="${u.isAdmin ? 0 : 1}">${u.isAdmin ? 'Tirar admin' : 'Tornar admin'}</button>
            <button class="sm ghost" data-action="toggle-active" data-id="${u.id}" data-value="${u.active ? 0 : 1}">${u.active ? 'Desativar' : 'Reativar'}</button>`}
          </div>
        </div>`).join('')}
      <p class="muted small">Ajuste manual: use para dinheiro recebido em mãos sem pedido no site (positivo credita, negativo debita).</p>
    </div>`;
}

// ---------- Eventos ----------

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const tableId = form.dataset.table;
  const clear = (...ids) => ids.forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
  switch (form.dataset.form) {
    case 'login':
      await act('/login', { username: val('a-user'), password: document.getElementById('a-pass').value });
      break;
    case 'register':
      await act('/register', { name: val('a-name'), username: val('a-user'), password: document.getElementById('a-pass').value }, 'Conta criada!');
      break;
    case 'deposit':
      if (await act('/requests/deposit', { reais: Number(val('d-reais').replace(',', '.')), note: val('d-note') }, 'Pedido enviado. Aguarde a confirmação.')) clear('d-reais', 'd-note');
      break;
    case 'withdraw':
      if (await act('/requests/withdraw', { chips: Number(val('w-chips')), note: val('w-note') }, 'Saque solicitado.')) clear('w-chips', 'w-note');
      break;
    case 'join':
      await act(`/tables/${tableId}/join`, { chips: Number(val('buyin')) }, 'Você sentou na mesa!');
      break;
    case 'rebuy':
      if (await act(`/tables/${tableId}/rebuy`, { chips: Number(val('rebuy')) }, 'Recompra feita.')) clear('rebuy');
      break;
    case 'raise':
      if (await act(`/tables/${tableId}/action`, { action: 'raise', to: Number(val('raise-to')) })) clear('raise-to');
      break;
    case 'create-table':
      if (await act('/admin/tables', {
        name: val('t-name'), smallBlind: Number(val('t-sb')), bigBlind: Number(val('t-bb')),
        minBuyIn: Number(val('t-min')), maxBuyIn: Number(val('t-max')),
      }, 'Mesa criada.')) clear('t-name');
      break;
    case 'settings':
      await act('/admin/settings', { clubName: val('s-club'), chipsPerReal: Number(val('s-rate')) }, 'Configurações salvas.');
      break;
  }
});

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  const tableId = document.querySelector('.felt')?.dataset.table;
  switch (d.action) {
    case 'toggle-auth':
      e.preventDefault();
      authMode = authMode === 'login' ? 'register' : 'login';
      render();
      break;
    case 'logout':
      await act('/logout', {});
      location.hash = '#/';
      break;
    case 'cancel-request':
      await act(`/requests/${d.id}/cancel`, {}, 'Pedido cancelado.');
      break;
    case 'play':
      await act(`/tables/${tableId}/action`, { action: d.play });
      break;
    case 'set-raise':
      document.getElementById('raise-to').value = d.value;
      break;
    case 'leave':
      if (confirm('Sair da mesa? Suas fichas voltam para a carteira.')) {
        if (await act(`/tables/${d.id}/leave`, {}, 'Fichas devolvidas para a carteira.')) location.hash = '#/';
      }
      break;
    case 'dealer':
      await act(`/admin/tables/${tableId}/dealer`, { action: d.dealer, userId: Number(d.user) });
      break;
    case 'award':
      await act(`/admin/tables/${d.id}/dealer`, { action: 'award', userId: Number(val('win-user')), chips: val('win-chips') === '' ? undefined : Number(val('win-chips')) })
        && (document.getElementById('win-chips').value = '');
      break;
    case 'split': {
      const ids = [...document.querySelectorAll('input.split:checked')].map((i) => Number(i.value));
      await act(`/admin/tables/${d.id}/dealer`, { action: 'split', userIds: ids });
      break;
    }
    case 'kick':
      if (confirm(`Remover ${d.name} da mesa? O stack volta para a carteira dele(a).`)) {
        await act(`/admin/tables/${tableId}/dealer`, { action: 'kick', userId: Number(d.user) });
      }
      break;
    case 'close-table':
      if (confirm('Fechar esta mesa?') && await act(`/admin/tables/${d.id}/close`, {}, 'Mesa fechada.')) location.hash = '#/';
      break;
    case 'resolve':
      await act(`/admin/requests/${d.id}`, { approve: d.approve === '1' }, d.approve === '1' ? 'Confirmado.' : 'Pedido recusado.');
      break;
    case 'adjust': {
      const amount = Number(val(`adj-${d.id}`));
      if (!amount) return toast('Informe quantas fichas (negativo para debitar).', true);
      const note = prompt('Motivo do ajuste:', amount > 0 ? 'Dinheiro recebido em mãos' : 'Pagamento em mãos');
      if (note === null) return;
      if (await act(`/admin/users/${d.id}/adjust`, { chips: amount, note }, 'Saldo ajustado.')) document.getElementById(`adj-${d.id}`).value = '';
      break;
    }
    case 'toggle-admin':
      await act(`/admin/users/${d.id}/role`, { isAdmin: d.value === '1' });
      break;
    case 'toggle-active':
      await act(`/admin/users/${d.id}/role`, { active: d.value === '1' });
      break;
  }
});

window.addEventListener('hashchange', () => { if (state) render(); window.scrollTo(0, 0); });
refresh();
