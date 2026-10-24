'use strict';
/* Vale Florido — interface: HUD, hotbar, botão de ação e todas as janelas (loja, moradores, animais, pedidos...). */
const UI = (() => {
  const $ = s => document.querySelector(s);
  let modalOpen = false, titleOpen = true, modalOnClose = null, modalOnRefresh = null;
  let toastTimer = null, toastQueue = [], lastAction = '', hud = {};
  let swapFrom = null;

  const icon = (id, cls = 'px') => `<img class="${cls}" src="${Sprites.iconURL(iconId(id))}" alt="">`;
  const qBadge = id => (qualOf(id) ? `<span class="q q${qualOf(id)}">★</span>` : '');
  const money = n => Math.round(n).toLocaleString('pt-BR');
  const heartsHTML = (n, max = 10) => `<span class="hearts">${'♥'.repeat(n)}<i>${'♥'.repeat(Math.max(0, max - n))}</i></span>`;
  const ingHTML = ing => Object.entries(ing).map(([id, q]) => {
    const have = countItem(id);
    return `<span class="ing ${have >= q ? 'ok' : 'no'}">${icon(ingIcon(id), 'px tiny')}${have}/${q}</span>`;
  }).join(' ');

  function init() {
    // hotbar: 6 espaços + mochila
    const hb = $('#hotbar');
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('button');
      b.className = 'slot'; b.dataset.i = i;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); Sound.init(); S.sel = i; Sound.play('click'); refresh(); });
      hb.appendChild(b);
    }
    const bag = document.createElement('button');
    bag.className = 'slot bag'; bag.innerHTML = '🎒';
    bag.addEventListener('pointerdown', e => { e.stopPropagation(); Sound.init(); openBag(); });
    hb.appendChild(bag);

    const ab = $('#actionBtn');
    ab.addEventListener('pointerdown', e => {
      e.preventDefault(); Sound.init();
      ab.setPointerCapture(e.pointerId);
      input.actionHeld = true; doAction();
    });
    const up = () => { input.actionHeld = false; };
    ab.addEventListener('pointerup', up); ab.addEventListener('pointercancel', up);

    $('#menuBtn').addEventListener('click', () => { Sound.init(); openMenu(); });
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
    showTitle();
  }

  // ---------------------------------------------------------------- título
  function showTitle() {
    titleOpen = true;
    const has = !!loadSave();
    $('#title').classList.remove('hidden');
    $('#hud').classList.add('hidden'); $('#hotbar').classList.add('hidden'); $('#actionBtn').classList.add('hidden');
    $('#titleBtns').innerHTML =
      (has ? `<button class="btn big" data-a="cont">▶ Continuar</button>` : '') +
      `<button class="btn big ${has ? 'alt' : ''}" data-a="new">🌱 Novo Jogo</button>` +
      `<button class="btn" data-a="help">❓ Como jogar</button>`;
    $('#titleBtns').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (!a) return;
      Sound.init(); Sound.play('click');
      if (a === 'help') { help(); return; }
      if (a === 'new' && has) {
        confirmBox('Começar um jogo novo? O progresso salvo será perdido.', () => enterGame(true));
        return;
      }
      enterGame(a === 'new');
    };
  }
  function enterGame(fresh) {
    closeModal(true);
    titleOpen = false;
    $('#title').classList.add('hidden');
    $('#hud').classList.remove('hidden'); $('#hotbar').classList.remove('hidden'); $('#actionBtn').classList.remove('hidden');
    startGame(fresh);
  }

  // ---------------------------------------------------------------- HUD
  function set(id, val, prop = 'textContent') {
    if (hud[id + prop] === val) return;
    hud[id + prop] = val;
    const el = document.getElementById(id);
    if (prop === 'width') el.style.width = val; else el[prop] = val;
  }

  function tick() {
    const me = maxEnergy();
    set('energyFill', `${Math.max(0, S.energy / me * 100)}%`, 'width');
    set('energyTxt', `${Math.ceil(S.energy)}/${me}`);
    document.getElementById('energyPill').classList.toggle('low', S.energy < me * 0.2);
    set('goldTxt', money(S.gold));
    const mh = maxHP(), showHP = scene === 'mine' || S.hp < mh;
    document.getElementById('hpPill').classList.toggle('hidden', !showHP);
    if (showHP) { set('hpFill', `${S.hp / mh * 100}%`, 'width'); set('hpTxt', `${Math.ceil(S.hp)}/${mh}`); }
    document.getElementById('floorPill').classList.toggle('hidden', scene !== 'mine');
    if (scene === 'mine' && mine) set('floorTxt', `Andar ${mine.floor}`);
    set('lvlTxt', `Nv ${S.level}`);
    set('xpFill', S.level >= MAX_LEVEL ? '100%' : `${S.xp / xpNeed(S.level) * 100}%`, 'width');
    set('dateTxt', `${SEASONS[S.season]}, Dia ${S.day}${festivalToday() ? ' 🎪' : ''}`);
    set('timeTxt', fmtTime(S.time));
    set('weatherIco', S.weather === 'rain' ? '🌧️' : S.weather === 'snow' ? '🌨️' : (S.time % 1440 >= 1140 || S.time >= 1440 ? '🌙' : '☀️'));
    if (!isPaused()) {
      const a = resolveAction();
      const sig = (a.icon || a.emoji) + a.label + (a.run ? 1 : 0);
      if (sig !== lastAction) {
        lastAction = sig;
        $('#actionIco').innerHTML = a.icon ? icon(a.icon) : `<span class="emo">${a.emoji}</span>`;
        $('#actionLbl').textContent = a.label;
        $('#actionBtn').classList.toggle('dim', !a.run);
        $('#actionBtn').classList.toggle('urgent', a.label === 'PUXAR!');
      }
    }
  }

  function slotHTML(it) {
    if (!it) return '';
    let h = icon(it.id) + qBadge(it.id);
    if (def(it.id).kind !== 'tool') h += `<span class="qty">${it.qty}</span>`;
    if (it.id === 'can') h += `<span class="meter"><i style="width:${S.water / waterCap() * 100}%"></i></span>`;
    return h;
  }

  function refresh() {
    if (!S) return;
    document.querySelectorAll('#hotbar .slot:not(.bag)').forEach((b, i) => {
      const h = slotHTML(S.inv[i]);
      if (b.innerHTML !== h) b.innerHTML = h;
      b.classList.toggle('sel', S.sel === i);
    });
    lastAction = '';
    if (modalOpen && modalOnRefresh) modalOnRefresh();
  }

  // Avisos em fila para um não apagar o outro
  function toast(msg) {
    if (toastQueue.length > 4) toastQueue.shift();
    toastQueue.push(msg);
    if (!toastTimer) nextToast();
  }
  function nextToast() {
    const t = $('#toast');
    if (!toastQueue.length) { t.classList.remove('show'); toastTimer = null; return; }
    t.textContent = toastQueue.shift();
    t.classList.add('show');
    toastTimer = setTimeout(nextToast, toastQueue.length ? 1800 : 2600);
  }

  function joystick(j) {
    const base = $('#joy');
    if (!j) { base.classList.remove('on'); return; }
    base.classList.add('on');
    const s = j.r * 2;
    Object.assign(base.style, { width: s + 'px', height: s + 'px', left: (j.bx - j.r) + 'px', top: (j.by - j.r) + 'px' });
    $('#joyKnob').style.transform = `translate(${j.kx - j.bx}px, ${j.ky - j.by}px)`;
  }

  // ---------------------------------------------------------------- modais
  function openModal(title, html, { onClose = null, onRefresh = null, wide = false, noClose = false } = {}) {
    modalOpen = true;
    modalOnClose = onClose;
    modalOnRefresh = onRefresh;
    input.actionHeld = false; input.joy = null; joystick(null);
    $('#modalTitle').innerHTML = title;
    $('#modalBody').innerHTML = html;
    $('#modalBody').onclick = null;
    $('#modal .panel').classList.toggle('wide', wide);
    $('#modalClose').classList.toggle('hidden', noClose);
    $('#modal').classList.remove('hidden');
    $('#modal').dataset.noclose = noClose ? '1' : '';
  }
  function closeModal(force) {
    if (!modalOpen) return;
    if (force !== true && $('#modal').dataset.noclose) return;
    modalOpen = false;
    modalOnRefresh = null;
    $('#modal').classList.add('hidden');
    swapFrom = null;
    const cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
  }
  function confirmBox(msg, yes) {
    openModal('Confirmar', `<p class="center">${msg}</p><div class="row center"><button class="btn" data-a="y">Sim</button><button class="btn alt" data-a="n">Não</button></div>`);
    $('#modalBody').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'y') { closeModal(true); yes(); } else if (a === 'n') closeModal(true);
    };
  }
  const tabsHTML = (tabs, cur) => `<div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${cur === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('')}</div>`;

  // ---------------------------------------------------------------- casa: dormir e cozinhar
  function openHouse() {
    const late = S.time >= 18 * 60;
    openModal('🏠 Sua casa', `<p class="center">${late ? 'Que dia longo! ' : ''}O que vai fazer?</p>
      <div class="menu">
        <button class="btn" data-a="sleep">😴 Dormir até amanhã</button>
        <button class="btn alt" data-a="cook">🍳 Cozinhar no fogão</button>
      </div>
      <p class="muted center">Dormir salva o jogo e vende os itens da Caixa de Envio.</p>`);
    $('#modalBody').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'sleep') { closeModal(true); sleep(false); }
      if (a === 'cook') { Sound.play('click'); openCook(); }
    };
  }

  function openCook() {
    const render = () => {
      $('#modalBody').innerHTML = `<p class="muted center">Comida caseira dá muita energia e vale bem mais na venda!</p>` +
        RECIPES.map((r, i) => {
          const d = ITEMS[r.id];
          return `<div class="line">${icon(r.id)}<span>${d.name}${S.flags['cook_' + r.id] ? '' : ' <em class="new">novo!</em>'}
            <small>+${d.energy} ❤️ · vende ${d.sell} 💰</small><small class="mats">${ingHTML(r.ing)}</small></span>
            <button class="btn sm" data-i="${i}" ${hasAll(r.ing) ? '' : 'disabled'}>Cozinhar</button></div>`;
        }).join('');
    };
    openModal('🍳 Fogão', '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      const r = RECIPES[+b.dataset.i];
      if (!hasRoom(r.id)) { toast('🎒 Mochila cheia!'); return; }
      if (cook(r)) toast(`🍳 Você fez: ${ITEMS[r.id].name}!`);
      refresh();
    };
  }

  function fade(on, cb) {
    $('#fade').classList.toggle('on', on);
    if (cb) setTimeout(cb, 650);
  }

  function daySummary(r, done) {
    const rows = r.sales.map(s => `<div class="line">${icon(s.id)}${qBadge(s.id)}<span>${nameOf(s.id)} ×${s.qty}</span><b>${money(s.total)} 💰</b></div>`).join('');
    const w = { sun: '☀️ Sol', rain: '🌧️ Chuva (as plantas já amanhecem regadas!)', snow: '🌨️ Neve (os animais ficam dentro de casa)' }[S.weather];
    const notes = [];
    if (r.inMine && r.passedOut) notes.push(`<p class="warn center">⛏️ Você desmaiou na mina.</p>`);
    if (r.altar) notes.push(`<p class="center big-note">🕯️ Uma luz brilha no santuário ao lado da casa... O vovô quer ver como você está indo!</p>`);
    if (r.died) notes.push(`<p class="warn center">🥀 ${r.died} planta(s) morreram.</p>`);
    if (r.products) notes.push(`<p class="center">🥚 Seus animais produziram ${r.products} item(ns). Vá coletar!</p>`);
    if (r.expired) notes.push(`<p class="warn center">📋 ${r.expired} pedido(s) do quadro expiraram.</p>`);
    if (r.festival) notes.push(`<p class="center big-note">${r.festival.icon} Hoje é dia de ${r.festival.name}! Vá até a praça ao lado da barraca.</p>`);
    if (r.festivalTomorrow) notes.push(`<p class="center">${r.festivalTomorrow.icon} Amanhã tem ${r.festivalTomorrow.name}!</p>`);
    openModal(r.passedOut ? '😵 Você desmaiou...' : '🌙 Fim do dia', `
      ${r.passedOut ? `<p class="center warn">Alguém te levou para casa. Você perdeu ${money(r.lost)} 💰 e acordou cansado.</p>` : ''}
      <h3>📦 Caixa de Envio</h3>
      ${rows || '<p class="muted center">Nada foi enviado hoje.</p>'}
      <div class="line total"><span>Total de vendas</span><b>${money(r.total)} 💰</b></div>
      ${notes.join('')}
      ${r.newSeason ? `<p class="center big-note">Chegou o ${r.newSeason}! 🌱 Confira as sementes da estação na Dona Rosa.</p>` : ''}
      <p class="center">📅 ${SEASONS[S.season]}, Dia ${S.day} — Ano ${S.year}<br>Previsão: ${w}</p>
      <div class="row center"><button class="btn big" data-a="ok">☀️ Bom dia!</button></div>`, { noClose: true, onClose: done });
    $('#modalBody').onclick = e => { if (e.target.closest('button')?.dataset.a === 'ok') { Sound.play('click'); closeModal(true); } };
  }

  // ---------------------------------------------------------------- caixa de envio
  function openBin() {
    const render = () => {
      const sellable = S.inv.map((it, i) => ({ it, i })).filter(o => o.it && def(o.it.id).sell);
      const binTotal = S.bin.reduce((a, b) => a + sellOf(b.id) * b.qty, 0);
      $('#modalBody').innerHTML = `
        <p class="muted center">Coloque itens aqui. Eles são vendidos durante a noite. Qualidade ★ prata vale +25%, ★ ouro +50%.</p>
        <div class="cols">
          <div><h3>🎒 Sua mochila</h3>${sellable.map(({ it, i }) => `
            <div class="line">${icon(it.id)}${qBadge(it.id)}<span>${nameOf(it.id)} ×${it.qty}<small>${sellOf(it.id)} 💰 cada</small></span>
              <button class="btn sm" data-a="one" data-i="${i}">+1</button><button class="btn sm" data-a="all" data-i="${i}">Tudo</button></div>`).join('') || '<p class="muted">Nada para vender.</p>'}
          </div>
          <div><h3>📦 Na caixa</h3>${S.bin.map((b, j) => `
            <div class="line">${icon(b.id)}${qBadge(b.id)}<span>${nameOf(b.id)} ×${b.qty}</span><b>${money(sellOf(b.id) * b.qty)}</b>
              <button class="btn sm alt" data-a="back" data-j="${j}">↩</button></div>`).join('') || '<p class="muted">Vazia.</p>'}
            <div class="line total"><span>Valor amanhã</span><b>${money(binTotal)} 💰</b></div>
          </div>
        </div>`;
    };
    openModal('📦 Caixa de Envio', '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'one' || a === 'all') {
        const i = +b.dataset.i, it = S.inv[i]; if (!it) return;
        const q = a === 'one' ? 1 : it.qty;
        const ex = S.bin.find(x => x.id === it.id);
        if (ex) ex.qty += q; else S.bin.push({ id: it.id, qty: q });
        removeAt(i, q);
        Sound.play('coin');
      } else if (a === 'back') {
        const j = +b.dataset.j, bi = S.bin[j];
        const left = addItem(bi.id, bi.qty);
        if (left) { bi.qty = left; toast('🎒 Mochila cheia!'); } else S.bin.splice(j, 1);
        Sound.play('click');
      }
      refresh();
    };
  }

  // ---------------------------------------------------------------- moradores e lojas
  const SHOP_TABS = {
    rosa: [['talk', '💬 Conversar'], ['seeds', '🌱 Sementes'], ['food', '🍞 Comida'], ['animals', '🐔 Animais'], ['up', '🛠️ Melhorias']],
    ze: [['talk', '💬 Conversar'], ['shop', '🎣 Loja do Zé']],
    tiao: [['talk', '💬 Conversar'], ['shop', '⚒️ Ferraria'], ['up', '🛠️ Ferramentas']],
  };
  const NPC_STOCK = { ze: [['bait', 5]], tiao: [['sprinkler', 300], ['sprinkler2', 800], ['lamp', 250], ['fence_item', 10]] };
  const NPC_BUYS = { ze: id => def(id).kind === 'fish', tiao: id => ['copper', 'iron'].includes(baseOf(id)) };

  function openNPC(id) {
    const N = NPCS[id];
    let tab = id === 'rosa' ? 'seeds' : 'talk', line = null, giftMode = false;
    const open = () => { const h = Math.floor(S.time / 60); return h >= N.hours[0] && h < N.hours[1]; };
    const price = p => Math.round(p * discount(id));
    const buyRow = (itemId, p, extra) => {
      const d = ITEMS[itemId], pp = price(p);
      return `<div class="line">${icon(itemId)}<span>${d.name}<small>${extra || d.desc || ''}</small></span><b>${pp} 💰</b>
        <button class="btn sm" data-buy="${itemId}" data-p="${pp}" data-q="1" ${S.gold < pp ? 'disabled' : ''}>×1</button>
        <button class="btn sm" data-buy="${itemId}" data-p="${pp}" data-q="5" ${S.gold < pp * 5 ? 'disabled' : ''}>×5</button></div>`;
    };
    const render = () => {
      let body = '';
      if (tab === 'talk') {
        const h = hearts(id);
        const hint = h >= 2 ? `Adora: ${N.loves.map(x => icon(x, 'px tiny')).join('')}` : 'Dê presentes para descobrir do que gosta...';
        if (giftMode) {
          const items = S.inv.map((it, i) => ({ it, i })).filter(o => o.it && def(o.it.id).kind !== 'tool');
          body = `<p class="center">Escolha um presente para ${N.name}:</p><div class="grid">${items.map(({ it, i }) =>
            `<button class="cell" data-gift="${i}">${icon(it.id)}${qBadge(it.id)}<span class="qty">${it.qty}</span></button>`).join('') || '<p class="muted">Nada para dar.</p>'}</div>
            <div class="row center"><button class="btn alt sm" data-a="back">↩ Voltar</button></div>`;
        } else {
          body = `<div class="npc-head"><img class="portrait" src="${Sprites.npc(id, 0, 0).toDataURL()}" alt="">
            <div><b>${N.name}</b> <small>— ${N.role}</small><br>${heartsHTML(h)}<br><small class="muted">${hint}</small></div></div>
            <div class="speech">${line || (S.talked[id] ? npcLine(id) : 'Olá! Como vai?')}</div>
            <div class="row center">
              <button class="btn" data-a="talk">💬 Conversar${S.talked[id] ? '' : ' (+♥)'}</button>
              <button class="btn alt" data-a="gift" ${S.gifted[id] ? 'disabled' : ''}>🎁 Presentear${S.gifted[id] ? ' (amanhã)' : ''}</button>
            </div>
            <p class="muted center">${h >= 5 ? '💖 Por serem amigos, você tem 10% de desconto aqui!' : 'Com 5 corações você ganha 10% de desconto.'}</p>`;
        }
      } else if (!open()) {
        body = `<p class="center warn">🌙 ${N.name} atende das ${N.hours[0]}h às ${N.hours[1]}h.</p>`;
      } else if (tab === 'seeds') {
        body = SEED_ORDER.map(sid => {
          const c = CROPS[ITEMS[sid].crop], inSeason = c.seasons.includes(S.season);
          const info = `${c.days} dias${c.regrow ? `, produz de novo a cada ${c.regrow}` : ''} · ${c.seasons.map(s => SEASONS[s]).join(', ')}`;
          return inSeason ? buyRow(sid, ITEMS[sid].price, info) : '';
        }).join('') || `<p class="warn center">❄️ É inverno: nada cresce agora. Volte na primavera!</p>`;
        const off = SEED_ORDER.filter(sid => !CROPS[ITEMS[sid].crop].seasons.includes(S.season)).map(sid => icon(sid, 'px tiny')).join('');
        if (off) body += `<p class="muted center">Fora de estação: ${off}</p>`;
      } else if (tab === 'food') {
        body = ['bread', 'soup'].map(fid => buyRow(fid, ITEMS[fid].price, `+${ITEMS[fid].energy} de energia`)).join('');
      } else if (tab === 'animals') {
        body = Object.entries(ANIMALS).map(([type, A]) => {
          const n = S.animals.filter(a => a.type === type).length, house = S[A.house], pp = price(A.price);
          const why = !house ? `Precisa de ${A.house === 'coop' ? 'Galinheiro' : 'Estábulo'} (aba Melhorias)` : n >= A.max ? 'Casa cheia' : '';
          return `<div class="line">${icon(A.product)}<span>${A.name}<small>Dá ${ITEMS[A.product].name.toLowerCase()} todo dia se alimentada. ${n}/${A.max}</small>${why ? `<small class="warn">${why}</small>` : ''}</span>
            <b>${money(pp)} 💰</b><button class="btn sm" data-animal="${type}" data-p="${pp}" ${why || S.gold < pp ? 'disabled' : ''}>Comprar</button></div>`;
        }).join('') + buyRow('hay', ITEMS.hay.price);
      } else if (tab === 'up') {
        body = UPGRADES.filter(u => u.shop === id && (!u.need || u.need())).map(u => {
          const mats = Object.entries(u.mats).map(([m, q]) => `<span class="ing ${countItem(m) >= q ? 'ok' : 'no'}">${icon(m, 'px tiny')}${countItem(m)}/${q}</span>`).join(' ');
          const ok = S.gold >= u.cost && hasAll(u.mats);
          return `<div class="line">${icon(u.icon)}<span>${u.name}<small>${u.desc}</small><small class="mats">${mats}</small></span>
            ${u.have() ? '<b class="ok">✔ Feito</b>' : `<b>${money(u.cost)} 💰</b><button class="btn sm" data-up="${u.id}" ${ok ? '' : 'disabled'}>Comprar</button>`}</div>`;
        }).join('');
      } else if (tab === 'shop') {
        body = NPC_STOCK[id].map(([sid, p]) => buyRow(sid, p)).join('');
        const sellable = S.inv.map((it, i) => ({ it, i })).filter(o => o.it && NPC_BUYS[id](o.it.id));
        body += `<h3>${id === 'ze' ? '🐟 Vender peixes' : '⛏️ Vender minérios'} <small class="muted">(paga 15% a mais, na hora)</small></h3>` +
          (sellable.map(({ it, i }) => `<div class="line">${icon(it.id)}${qBadge(it.id)}<span>${nameOf(it.id)} ×${it.qty}</span>
            <b>${Math.round(sellOf(it.id) * 1.15)} 💰</b><button class="btn sm" data-sell="${i}">Vender 1</button></div>`).join('') || '<p class="muted center">Nada para vender agora.</p>');
      }
      $('#modalBody').innerHTML = tabsHTML(SHOP_TABS[id], tab) + `<div class="list">${body}</div>`;
    };
    openModal(id === 'rosa' ? '🛒 Barraca da Dona Rosa' : `${id === 'ze' ? '🎣' : '⚒️'} ${N.name}`, '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; giftMode = false; Sound.play('click'); render(); return; }
      const a = b.dataset.a;
      if (a === 'talk') { line = talkTo(id); Sound.play('click'); }
      if (a === 'gift') { giftMode = true; Sound.play('click'); }
      if (a === 'back') giftMode = false;
      if (b.dataset.gift) { const r = giftTo(id, +b.dataset.gift); if (r) line = r; giftMode = false; }
      if (b.dataset.buy) {
        const sid = b.dataset.buy, q = +b.dataset.q, cost = +b.dataset.p * q;
        if (S.gold < cost) return;
        if (!hasRoom(sid)) { toast('🎒 Mochila cheia!'); Sound.play('error'); return; }
        S.gold -= cost; addItem(sid, q); Sound.play('coin');
      }
      if (b.dataset.animal) {
        const p = +b.dataset.p; if (S.gold < p) return;
        S.gold -= p; const an = buyAnimal(b.dataset.animal);
        Sound.play('level'); toast(`🐾 ${an.name} chegou na fazenda! Não esqueça do feno.`);
      }
      if (b.dataset.up) {
        const u = UPGRADES.find(x => x.id === b.dataset.up);
        if (!u || u.have() || S.gold < u.cost || !hasAll(u.mats)) return;
        S.gold -= u.cost;
        for (const [m, q] of Object.entries(u.mats)) removeItem(m, q);
        u.apply(); Sound.play('level'); toast(`✨ ${u.name}: feito!`);
        save();
      }
      if (b.dataset.sell) {
        const i = +b.dataset.sell, it = S.inv[i]; if (!it) return;
        const p = Math.round(sellOf(it.id) * 1.15);
        S.gold += p; S.stats.earned += p; removeAt(i, 1); Sound.play('coin');
      }
      refresh(); render();
    };
  }

  // ---------------------------------------------------------------- quadro de pedidos
  function openBoard(startTab) {
    let tab = startTab || 'quests';
    const render = () => {
      let body;
      if (tab === 'quests') {
        body = `<p class="muted center">Os vizinhos deixam pedidos aqui. Entregue a tempo para ganhar ouro e amizade!</p>` +
          (S.quests.map(q => {
            const have = countItem(q.item), N = NPCS[q.from];
            return `<div class="line">${icon(ingIcon(q.item))}<span>${N.name} precisa de ${q.qty}× ${ingName(q.item)}
              <small>Você tem ${have}/${q.qty} · ⏳ ${q.days} dia(s) · +♥ ${N.name}</small></span>
              <b>${money(q.reward)} 💰</b><button class="btn sm" data-q="${q.id}" ${have >= q.qty ? '' : 'disabled'}>Entregar</button></div>`;
          }).join('') || '<p class="center">Nenhum pedido hoje. Volte amanhã!</p>') +
          `<p class="muted center">Pedidos concluídos: ${S.stats.quests}</p>`;
      } else {
        const done = BUNDLES.filter(b => bundleState(b.id).done).length;
        body = `<p class="muted center">Restaure o vale entregando cestas de itens. As três cestas de colheita restauram a <b>Estufa</b>. Completas: ${done}/${BUNDLES.length}</p>` +
          BUNDLES.map(b => {
            const st = bundleState(b.id);
            const rows = b.items.map(([want, need], i) => {
              const left = bundleNeed(b, i), have = countItem(want);
              return `<div class="line">${icon(ingIcon(want))}<span>${ingName(want)}<small>${need - left}/${need} entregue · você tem ${have}</small></span>
                ${left > 0 ? `<button class="btn sm" data-b="${b.id}" data-i="${i}" ${have > 0 ? '' : 'disabled'}>Doar</button>` : '<b class="ok">✔</b>'}</div>`;
            }).join('');
            const reward = [`${money(b.gold)} 💰`, ...(b.give || []).map(([g, q]) => `${ITEMS[g].name} ×${q}`), b.perkDesc].filter(Boolean).join(' · ');
            return `<div class="bundle ${st.done ? 'done' : ''}"><h4><span>${b.icon} ${b.name}</span>${st.done ? '<span class="ok">✔ Completa</span>' : ''}</h4>
              ${st.done ? '' : rows}<small class="muted">Recompensa: ${reward}</small></div>`;
          }).join('');
      }
      $('#modalBody').innerHTML = tabsHTML([['quests', '📋 Pedidos'], ['bundles', '🧺 Projetos do Vale']], tab) + body;
    };
    openModal('📋 Quadro do Vale', '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; Sound.play('click'); render(); return; }
      const q = e.target.closest('button[data-q]');
      if (q && deliverQuest(+q.dataset.q)) toast('📋 Pedido entregue! Obrigado(a)!');
      const b = e.target.closest('button[data-b]');
      if (b) { const n = donate(b.dataset.b, +b.dataset.i); if (n) toast(`🧺 Você doou ${n} item(ns).`); }
      refresh(); render();
    };
  }

  // ---------------------------------------------------------------- mina (elevador)
  function openMine() {
    const floors = elevatorFloors();
    openModal('⛏️ Mina do Vale', `
      <p class="center">Uma mina antiga com ${MINE_DEPTH} andares. Quebre pedras para achar a <b>escada</b> que desce.
      Quanto mais fundo, mais <b>ouro</b> e <b>gemas</b>... e monstros mais fortes!</p>
      <p class="muted center">Vida ❤️ ${Math.ceil(S.hp)}/${maxHP()} · Mais fundo já alcançado: ${S.mineMax || 0} · Baús a cada 10 andares</p>
      <h3>🛗 Elevador</h3>
      <div class="elev">${floors.map(f => `<button class="btn sm ${f % 10 === 0 ? '' : 'alt'}" data-f="${f}">${f === 1 ? 'Entrada' : 'Andar ' + f}</button>`).join('')}</div>
      <p class="muted center">Dica: leve comida! Comer recupera a vida. Desmaiar na mina custa ouro.</p>`, { wide: true });
    $('#modalBody').onclick = e => {
      const b = e.target.closest('button[data-f]'); if (!b) return;
      closeModal(true); enterMine(+b.dataset.f);
    };
  }

  // ---------------------------------------------------------------- santuário do vovô
  function openAltar() {
    if (S.year < 2) {
      openModal('🕯️ Santuário do Vovô', `<p class="center">Uma pequena homenagem ao seu avô, com quatro velas apagadas.</p>
        <p class="center muted">"Quando chegar a primavera do segundo ano, venha me mostrar o que fez da fazenda." — bilhete do vovô</p>`);
      return;
    }
    const can = S.evalKey !== evalKey();
    const show = ev => `<div class="candles">${'🕯️'.repeat(ev.candles)}${'▫️'.repeat(4 - ev.candles)}</div>` +
      ev.rows.map(([l, v, m]) => `<div class="line"><span>${l}</span><b>${v}/${m}</b></div>`).join('') +
      `<div class="line total"><span>Pontuação</span><b>${ev.total}/15</b></div>`;
    const render = (ev, fresh) => {
      const letter = !ev ? '' : ev.candles >= 4 ? 'Meu neto(a)... você superou todos os meus sonhos. A fazenda está mais linda do que nunca. Tenho muito orgulho de você! Guarde esta estátua como lembrança minha.'
        : ev.candles === 3 ? 'Que trabalho bonito! A fazenda está prosperando. Continue assim, falta pouco!'
        : ev.candles === 2 ? 'Bom começo! Mas ainda há muito a fazer. Cuide dos vizinhos, explore a mina e complete os projetos do vale.'
        : 'A fazenda ainda precisa de muito carinho. Não desanime: plante, colha e faça amigos!';
      $('#modalBody').innerHTML = (ev ? show(ev) + `<div class="speech">${letter}</div>` : '<p class="center">O santuário espera sua visita.</p>') +
        (fresh && fresh.reward ? '<p class="center big-note">🗿 Você recebeu a Estátua do Vovô! Coloque na fazenda: toda manhã aparece uma gema nela.</p>' : '') +
        `<div class="row center">${can ? '<button class="btn big" data-a="eval">🕯️ Pedir avaliação</button>' : '<p class="muted center">Você pode pedir uma nova avaliação a cada estação.</p>'}</div>`;
    };
    openModal('🕯️ Santuário do Vovô', '', { wide: true });
    render(S.lastEval, null);
    $('#modalBody').onclick = e => {
      if (e.target.closest('button')?.dataset.a !== 'eval' || S.evalKey === evalKey()) return;
      const r = doEvaluation();
      render(r, r);
      refresh();
    };
  }

  function ending() {
    openModal('🌻 O Vale Floresceu!', `<div class="ending">
      <p>Com o seu trabalho, o Vale Florido voltou a ser o lugar mais bonito da região.</p>
      <p>A Dona Rosa, o Seu Zé e o Tião prepararam uma grande festa em sua homenagem! 🎉</p>
      <p><b>+10.000 💰</b> de presente dos vizinhos.</p>
      <p class="muted">O jogo continua: complete a coleção, chegue ao nível 20, explore o fundo da mina e conquiste as 4 velas do vovô no santuário!</p>
      <div class="row center"><button class="btn big" data-a="ok">Obrigado, vale! 💚</button></div></div>`, { noClose: true });
    Sound.play('level');
    $('#modalBody').onclick = e => { if (e.target.closest('button')?.dataset.a === 'ok') closeModal(true); };
  }

  // ---------------------------------------------------------------- animais
  function openAnimals(type) {
    const A = ANIMALS[type];
    const render = () => {
      const list = S.animals.filter(a => a.type === type);
      const unfed = list.filter(a => !a.fed).length, ready = list.filter(a => a.ready).length;
      $('#modalBody').innerHTML = (list.length ? list.map(a => `
        <div class="line">${icon(A.product)}<span>${a.name}
          <small>${heartsHTML(Math.floor(a.love / 200), 5)} · ${a.fed ? '🌾 alimentada' : '<b class="warn">com fome</b>'} · ${a.petted ? '💕 carinho feito' : 'quer carinho'}</small></span>
          ${a.ready ? `<b>${icon(a.ready, 'px tiny')}${qBadge(a.ready)} pronto</b>` : ''}</div>`).join('')
        : `<p class="center">Nenhum animal ainda. Compre ${type === 'chicken' ? 'galinhas' : 'vacas'} com a Dona Rosa (aba 🐔 Animais).</p>`) +
        `<div class="row center">
          <button class="btn" data-a="feed" ${unfed ? '' : 'disabled'}>🌾 Alimentar (${unfed}) · feno: ${countItem('hay')}</button>
          <button class="btn alt" data-a="collect" ${ready ? '' : 'disabled'}>🧺 Coletar (${ready})</button>
        </div>
        <p class="muted center">Animais alimentados produzem todo dia. Carinho diário aumenta a amizade e a qualidade dos produtos.
        Faça carinho tocando neles lá fora (eles entram às 19h).</p>`;
    };
    openModal(type === 'chicken' ? '🐔 Galinheiro' : '🐄 Estábulo', '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'feed') {
        const n = feedAnimals(type);
        if (n) { toast(`🌾 ${n} animal(is) alimentado(s)!`); Sound.play('plant'); } else toast('Sem feno! Compre com a Dona Rosa ou arranque mato.');
      }
      if (a === 'collect') {
        let n = 0;
        for (const an of S.animals) if (an.type === type && an.ready) { if (collectProduct(an)) n++; else break; }
        if (n) toast(`🧺 Coletou ${n} item(ns)!`);
      }
      refresh(); render();
    };
  }

  // ---------------------------------------------------------------- festival
  function openFestival() {
    const F = FESTIVALS[S.season], done = S.festDone === festKey();
    let result = null;
    const render = () => {
      let body = `<p class="center big-note">${F.icon} ${F.name}</p><p class="center">${F.desc}</p>`;
      if (result) body += `<p class="center big-note">${result}</p>`;
      else if (done) body += `<p class="center ok">Você já participou deste festival. Até a próxima!</p>`;
      else if (!F.entry) {
        body += lanternNight()
          ? `<div class="row center"><button class="btn big" data-a="lantern">🏮 Soltar lanterna</button></div>`
          : `<p class="center warn">A festa começa às 18h. Volte mais tarde!</p>`;
      } else {
        const items = S.inv.map((it, i) => ({ it, i })).filter(o => o.it && matches(o.it.id, F.entry));
        body += `<h3>Escolha sua inscrição:</h3>` + (items.map(({ it, i }) => `<div class="line">${icon(it.id)}${qBadge(it.id)}<span>${nameOf(it.id)}</span>
          <button class="btn sm" data-enter="${i}">Inscrever</button></div>`).join('') ||
          `<p class="muted center">Você não tem ${F.entry === 'fish' ? 'nenhum peixe' : ingName(F.entry).toLowerCase()} na mochila.</p>`);
        body += `<p class="muted center">Prêmios: 🥇 ${money(FEST_PRIZES[0].gold)} 💰 + Troféu · 🥈 ${money(FEST_PRIZES[1].gold)} 💰 · 🥉 ${money(FEST_PRIZES[2].gold)} 💰</p>`;
      }
      $('#modalBody').innerHTML = body;
    };
    openModal('🎪 Festival', '', { onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.enter) {
        const p = festEnter(+b.dataset.enter);
        if (p) result = `${p.place === '1º lugar' ? '🥇' : p.place === '2º lugar' ? '🥈' : '🥉'} ${p.place}! Você ganhou ${money(p.gold)} 💰${p.item ? ' e um Troféu' : ''}!`;
      }
      if (b.dataset.a === 'lantern' && festLanterns()) result = '🏮 Que noite linda! Os vizinhos te deram 2 Lampiões.';
      refresh(); render();
    };
  }

  // ---------------------------------------------------------------- mochila e fabricação
  function openBag() {
    swapFrom = null;
    let tab = 'items';
    const render = () => {
      let body;
      if (tab === 'items') {
        const cell = i => `<button class="cell ${i < 6 ? 'hot' : ''} ${swapFrom === i ? 'pick' : ''} ${S.sel === i ? 'sel' : ''}" data-i="${i}">${slotHTML(S.inv[i])}</button>`;
        const info = swapFrom != null && S.inv[swapFrom] ? (() => {
          const it = S.inv[swapFrom], d = def(it.id);
          return `<b>${nameOf(it.id)}</b> — ${d.desc || ''} ${d.sell ? `Vende por ${sellOf(it.id)} 💰.` : ''} ${d.energy ? `Comer: +${energyOf(it.id)} ❤️.` : ''}`;
        })() : 'Toque em um item e depois em outro espaço para trocar de lugar. A primeira linha é a hotbar.';
        body = `<div class="grid">${S.inv.map((_, i) => cell(i)).join('')}</div><p class="muted center info">${info}</p>
          <div class="stats">💰 ${money(S.gold)} · 🌾 ${S.stats.harvest} colhidos · 🐟 ${S.stats.fish} peixes · ⛏️ ${S.stats.ore} minérios</div>`;
      } else {
        body = `<p class="muted center">Fabrique com materiais coletados. Depois selecione na hotbar e use o botão de ação para colocar.</p>` +
          CRAFTS.map((c, i) => {
            const d = ITEMS[c.id];
            return `<div class="line">${icon(c.id)}<span>${d.name}${c.qty > 1 ? ` ×${c.qty}` : ''}<small>${d.desc}</small><small class="mats">${ingHTML(c.ing)}</small></span>
              <button class="btn sm" data-craft="${i}" ${hasAll(c.ing) ? '' : 'disabled'}>Fabricar</button></div>`;
          }).join('');
      }
      $('#modalBody').innerHTML = tabsHTML([['items', '🎒 Itens'], ['craft', '🔨 Fabricar']], tab) + body;
    };
    openModal('🎒 Mochila', '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; swapFrom = null; Sound.play('click'); render(); return; }
      const c = e.target.closest('[data-craft]');
      if (c) {
        const cr = CRAFTS[+c.dataset.craft];
        if (!hasRoom(cr.id)) toast('🎒 Mochila cheia!');
        else if (craft(cr)) toast(`🔨 Você fabricou: ${ITEMS[cr.id].name}!`);
        refresh(); render(); return;
      }
      const b = e.target.closest('.cell'); if (!b) return;
      const i = +b.dataset.i;
      Sound.play('click');
      if (swapFrom == null) { if (S.inv[i]) swapFrom = i; }
      else {
        if (swapFrom !== i) { const tmp = S.inv[i]; S.inv[i] = S.inv[swapFrom]; S.inv[swapFrom] = tmp; }
        swapFrom = null;
      }
      refresh(); render();
    };
  }

  // ---------------------------------------------------------------- menu, conquistas e ajuda
  function openMenu() {
    const render = () => {
      const got = ACHIEVEMENTS.filter(a => S.ach[a.id]).length;
      $('#modalBody').innerHTML = `
        <div class="menu">
          <button class="btn" data-a="resume">▶ Continuar</button>
          <button class="btn" data-a="save">💾 Salvar agora</button>
          <button class="btn alt" data-a="ach">🏆 Conquistas e diário (${got}/${ACHIEVEMENTS.length})</button>
          <button class="btn alt" data-a="sfx">${Sound.sfxOn ? '🔊' : '🔈'} Efeitos: ${Sound.sfxOn ? 'ligados' : 'desligados'}</button>
          <button class="btn alt" data-a="mus">${Sound.musOn ? '🎵' : '🔇'} Música: ${Sound.musOn ? 'ligada' : 'desligada'}</button>
          <button class="btn alt" data-a="help">❓ Como jogar</button>
          <button class="btn alt" data-a="title">🏠 Tela inicial</button>
        </div>
        <p class="muted center">Ano ${S.year} · ${SEASONS[S.season]}, Dia ${S.day} · Nível ${S.level} · Total vendido: ${money(S.stats.earned)} 💰</p>`;
    };
    openModal('⚙️ Menu', '');
    render();
    $('#modalBody').onclick = e => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      Sound.play('click');
      if (a === 'resume') closeModal();
      if (a === 'save') { save(); toast('💾 Jogo salvo!'); closeModal(); }
      if (a === 'ach') openAchievements();
      if (a === 'sfx') { Sound.toggleSfx(); render(); }
      if (a === 'mus') { Sound.toggleMusic(); render(); }
      if (a === 'help') help();
      if (a === 'title') { save(); closeModal(true); showTitle(); }
    };
  }

  function openAchievements() {
    let tab = 'ach';
    const render = () => {
      let body;
      const st = S.stats;
      if (tab === 'ach') {
        body = ACHIEVEMENTS.map(a => {
          const ok = S.ach[a.id], pr = !ok && a.prog ? a.prog(S) : null;
          return `<div class="line ach ${ok ? 'got' : ''}"><span class="emo">${ok ? '🏆' : '🔒'}</span><span>${a.name}<small>${a.desc}${pr ? ` (${money(Math.min(pr[0], pr[1]))}/${money(pr[1])})` : ''}</small></span></div>`;
        }).join('');
      } else if (tab === 'col') {
        const got = COLLECTION.filter(i => S.found[i]).length, pct = Math.floor(got / COLLECTION.length * 100);
        const next = COLLECTION_REWARDS.find(r => !S.colRewards[r.pct]);
        body = `<p class="center"><b>${got}/${COLLECTION.length}</b> itens descobertos (${pct}%)${next ? ` · próxima recompensa em ${next.pct}%` : ' · coleção completa! 🎉'}</p>
          <div class="colgrid">${COLLECTION.map(i => `<div class="cell ${S.found[i] ? '' : 'miss'}" title="${S.found[i] ? ingName(i) : '???'}">${icon(ingIcon(i))}</div>`).join('')}</div>
          <p class="muted center">Toque nos itens que já tem para ver o nome. Peixes lendários aparecem a partir do nível 6, um por estação.</p>`;
      } else {
        const friends = Object.keys(NPCS).map(id => `<div class="line"><span>${NPCS[id].name}<small>${NPCS[id].role}</small></span>${heartsHTML(hearts(id))}</div>`).join('');
        body = `<div class="cols"><div>
          <div class="line"><span>Dias na fazenda</span><b>${dayIndex() + 1}</b></div>
          <div class="line"><span>Plantas colhidas</span><b>${st.harvest}</b></div>
          <div class="line"><span>Peixes pescados</span><b>${st.fish}</b></div>
          <div class="line"><span>Minérios e gemas</span><b>${st.ore}</b></div>
          <div class="line"><span>Monstros derrotados</span><b>${st.kills}</b></div>
          <div class="line"><span>Andar mais fundo da mina</span><b>${S.mineMax}</b></div>
          <div class="line"><span>Pratos cozinhados</span><b>${st.cooked}</b></div>
          <div class="line"><span>Produtos artesanais</span><b>${st.artisan}</b></div>
          <div class="line"><span>Pedidos entregues</span><b>${st.quests}</b></div>
          <div class="line"><span>Total vendido</span><b>${money(st.earned)} 💰</b></div>
        </div><div><h3>💞 Amizades</h3>${friends}
          <h3>✨ Bênçãos do vale</h3>${BUNDLES.filter(b => b.perk && S.perks[b.perk]).map(b => `<div class="line"><span>${b.icon} ${b.perkDesc}</span></div>`).join('') || '<p class="muted">Complete Projetos do Vale para ganhar bênçãos.</p>'}
        </div></div>`;
      }
      $('#modalBody').innerHTML = tabsHTML([['ach', '🏆 Conquistas'], ['col', '📚 Coleção'], ['diary', '📖 Diário']], tab) + body;
    };
    openModal('🏆 Conquistas e diário', '', { wide: true });
    render();
    $('#modalBody').onclick = e => {
      const t = e.target.closest('[data-tab]');
      if (t) { tab = t.dataset.tab; Sound.play('click'); render(); return; }
      const c = e.target.closest('.colgrid .cell');
      if (c) toast(c.title);
    };
  }

  function help() {
    openModal('❓ Como jogar', `
      <div class="help">
        <p><b>Objetivo:</b> transforme o terreno abandonado numa fazenda próspera!</p>
        <ol>
          <li>🪓 <b>Limpe</b> o terreno: arranque mato, corte galhos e árvores, quebre pedras.</li>
          <li>⛏️ <b>Are</b> a terra com a enxada, 🌱 <b>plante</b> sementes da estação e 💧 <b>regue</b> todo dia.</li>
          <li>🛏️ <b>Durma</b> (porta da casa) para os dias passarem. Lá também fica o 🍳 <b>fogão</b>.</li>
          <li>🖐️ <b>Colha</b> e venda na 📦 <b>Caixa de Envio</b>. Itens ★ prata e ★ ouro valem mais!</li>
          <li>🛒 Na <b>Dona Rosa</b>: sementes, comida, animais e melhorias (galinheiro, estábulo, expansão...).</li>
          <li>🔨 Na mochila, aba <b>Fabricar</b>: aspersores (regam sozinhos!), cercas, caminhos, canteiros e lampiões.</li>
          <li>🐔 <b>Animais</b>: alimente com feno no galinheiro/estábulo, faça carinho e colete ovos e leite.</li>
          <li>📋 <b>Quadro de Pedidos</b> ao lado da barraca: entregue itens para ganhar ouro e amizade.</li>
          <li>💬 Converse e dê presentes ao <b>Seu Zé</b> (lago) e ao <b>Tião</b> (pedreira). Amigos dão presentes e descontos.</li>
          <li>🎪 Todo <b>dia 14</b> tem festival na praça. Participe dos concursos!</li>
          <li>⛏️ A <b>mina</b> fica na pedreira (nordeste): 40 andares com ouro, gemas, baús e monstros. Use a espada!</li>
          <li>🛢️ Fabrique <b>máquinas</b> (barril, pote, prensa, maionese) para transformar produtos em itens valiosos.</li>
          <li>🧺 No quadro, os <b>Projetos do Vale</b> restauram a <b>estufa</b> (planta o ano todo) e dão bênçãos.</li>
          <li>🕯️ A partir do 2º ano, peça a <b>avaliação do vovô</b> no santuário ao lado da casa. Consegue as 4 velas?</li>
        </ol>
        <p><b>Controles (toque):</b> arraste no mapa para andar ou toque num tile para ir até lá. Toque num tile ao seu lado para usar o item nele. O <b>botão grande</b> faz a ação do momento.</p>
        <p><b>Teclado:</b> WASD/setas andam · Espaço/E ação · 1–6 hotbar · I mochila · Esc menu.</p>
        <p><b>Dicas:</b> cada ação gasta ❤️ energia — coma para recuperar. 1 minuto real = 1 hora no jogo. Às 2h você desmaia! Planta sem água por 3 dias seca, e plantas fora de estação morrem na virada.</p>
      </div>`, { wide: true });
  }

  function intro() {
    openModal('🌻 Bem-vindo ao Vale Florido!', `
      <p class="center">Você herdou a velha fazenda do seu avô. O terreno está tomado pelo mato, mas com trabalho e carinho ela vai voltar a florescer!</p>
      <p class="center">Comece arando a terra ao lado da casa, plante as <b>sementes de cenoura</b> e regue.<br>Você tem <b>250 💰</b> e muita disposição.
      Dê uma olhada no 📋 <b>quadro de pedidos</b> perto da barraca!</p>
      <div class="row center"><button class="btn big" data-a="ok">Vamos lá! 🌱</button><button class="btn alt" data-a="help">Como jogar</button></div>`);
    $('#modalBody').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'ok') { Sound.play('click'); closeModal(true); }
      if (a === 'help') help();
    };
  }

  function handleKey(e) {
    if (titleOpen) return false;
    if (modalOpen) {
      if (e.code === 'Escape') closeModal();
      return true;
    }
    if (e.code === 'Escape') { openMenu(); return true; }
    if (e.code === 'KeyI' || e.code === 'Tab' || e.code === 'KeyB') { openBag(); return true; }
    return false;
  }

  return {
    init, tick, refresh, toast, joystick, fade, daySummary, openHouse, openBin, openNPC, openBoard, openAnimals,
    openFestival, openBag, openMenu, openMine, openAltar, ending, intro, handleKey,
    blocking: () => modalOpen || titleOpen,
    inGame: () => !titleOpen,
  };
})();
