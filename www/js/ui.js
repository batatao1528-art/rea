'use strict';
/* Vale Florido — interface: HUD, hotbar, botão de ação, loja, caixa de envio, mochila e menus. */
const UI = (() => {
  const $ = s => document.querySelector(s);
  let modalOpen = false, titleOpen = true, modalOnClose = null;
  let toastTimer = null, lastAction = '', hud = {};
  let swapFrom = null;

  const icon = (id, cls = 'px') => `<img class="${cls}" src="${Sprites.iconURL(id)}" alt="">`;
  const money = n => n.toLocaleString('pt-BR');

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
    set('lvlTxt', `Nv ${S.level}`);
    set('xpFill', S.level >= 10 ? '100%' : `${S.xp / xpNeed(S.level) * 100}%`, 'width');
    set('dateTxt', `${SEASONS[S.season]}, Dia ${S.day}`);
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

  function refresh() {
    if (!S) return;
    const slots = document.querySelectorAll('#hotbar .slot:not(.bag)');
    slots.forEach((b, i) => {
      const it = S.inv[i];
      let h = '';
      if (it) {
        h = icon(iconId(it.id));
        if (ITEMS[it.id].kind !== 'tool') h += `<span class="qty">${it.qty}</span>`;
        if (it.id === 'can') h += `<span class="meter"><i style="width:${S.water / waterCap() * 100}%"></i></span>`;
      }
      if (b.innerHTML !== h) b.innerHTML = h;
      b.classList.toggle('sel', S.sel === i);
    });
    lastAction = '';
    if (modalOpen && modalOnRefresh) modalOnRefresh();
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
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
  let modalOnRefresh = null;
  function openModal(title, html, { onClose = null, onRefresh = null, wide = false, noClose = false } = {}) {
    modalOpen = true;
    modalOnClose = onClose;
    modalOnRefresh = onRefresh;
    input.actionHeld = false; input.joy = null; joystick(null);
    $('#modalTitle').innerHTML = title;
    $('#modalBody').innerHTML = html;
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

  // ---------------------------------------------------------------- dormir
  function askSleep() {
    const late = S.time >= 18 * 60;
    openModal('🛏️ Sua cama', `<p class="center">${late ? 'Que dia longo! ' : ''}Dormir até amanhã?<br><small>O jogo é salvo e os itens da Caixa de Envio são vendidos.</small></p>
      <div class="row center"><button class="btn" data-a="y">😴 Dormir</button><button class="btn alt" data-a="n">Ainda não</button></div>`);
    $('#modalBody').onclick = e => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'y') { closeModal(true); sleep(false); } else if (a === 'n') closeModal(true);
    };
  }

  function fade(on, cb) {
    const f = $('#fade');
    f.classList.toggle('on', on);
    if (cb) setTimeout(cb, 650);
  }

  function daySummary(r, done) {
    const rows = r.sales.map(s => `<div class="line">${icon(iconId(s.id))}<span>${ITEMS[s.id].name} ×${s.qty}</span><b>${money(s.total)} 💰</b></div>`).join('');
    const w = { sun: '☀️ Sol', rain: '🌧️ Chuva (as plantas já amanhecem regadas!)', snow: '🌨️ Neve' }[S.weather];
    openModal(r.passedOut ? '😵 Você desmaiou...' : '🌙 Fim do dia', `
      ${r.passedOut ? `<p class="center warn">Alguém te levou para casa. Você perdeu ${money(r.lost)} 💰 e acordou cansado.</p>` : ''}
      <h3>📦 Caixa de Envio</h3>
      ${rows || '<p class="muted center">Nada foi enviado hoje.</p>'}
      <div class="line total"><span>Total de vendas</span><b>${money(r.total)} 💰</b></div>
      ${r.died ? `<p class="warn center">🥀 ${r.died} planta(s) secaram.</p>` : ''}
      ${r.newSeason ? `<p class="center big-note">Chegou o ${r.newSeason}! ${S.season === 3 ? '❄️ As plantações morreram com o frio.' : '🌱'}</p>` : ''}
      <p class="center">📅 ${SEASONS[S.season]}, Dia ${S.day} — Ano ${S.year}<br>Previsão: ${w}</p>
      <div class="row center"><button class="btn big" data-a="ok">☀️ Bom dia!</button></div>`, { noClose: true, onClose: done });
    $('#modalBody').onclick = e => { if (e.target.closest('button')?.dataset.a === 'ok') { Sound.play('click'); closeModal(true); } };
  }

  // ---------------------------------------------------------------- caixa de envio
  function openBin() {
    const render = () => {
      const sellable = S.inv.map((it, i) => ({ it, i })).filter(o => o.it && ITEMS[o.it.id].sell);
      const binTotal = S.bin.reduce((a, b) => a + ITEMS[b.id].sell * b.qty, 0);
      $('#modalBody').innerHTML = `
        <p class="muted center">Coloque itens aqui. Eles são vendidos durante a noite.</p>
        <div class="cols">
          <div><h3>🎒 Sua mochila</h3>${sellable.map(({ it, i }) => `
            <div class="line">${icon(iconId(it.id))}<span>${ITEMS[it.id].name} ×${it.qty}<small>${ITEMS[it.id].sell} 💰 cada</small></span>
              <button class="btn sm" data-a="one" data-i="${i}">+1</button><button class="btn sm" data-a="all" data-i="${i}">Tudo</button></div>`).join('') || '<p class="muted">Nada para vender.</p>'}
          </div>
          <div><h3>📦 Na caixa</h3>${S.bin.map((b, j) => `
            <div class="line">${icon(iconId(b.id))}<span>${ITEMS[b.id].name} ×${b.qty}</span><b>${money(ITEMS[b.id].sell * b.qty)}</b>
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
        const it = S.inv[+b.dataset.i]; if (!it) return;
        const q = a === 'one' ? 1 : it.qty;
        const ex = S.bin.find(x => x.id === it.id);
        if (ex) ex.qty += q; else S.bin.push({ id: it.id, qty: q });
        it.qty -= q; if (it.qty <= 0) S.inv[+b.dataset.i] = null;
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

  // ---------------------------------------------------------------- loja
  function openShop() {
    const h = Math.floor(S.time / 60);
    if (h < 7 || h >= 20) { toast('🌙 A Dona Rosa já foi descansar. A loja abre das 7h às 20h.'); return; }
    let tab = 'seeds';
    const render = () => {
      const tabs = [['seeds', '🌱 Sementes'], ['food', '🍞 Comida'], ['up', '🛠️ Melhorias']]
        .map(([id, l]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${l}</button>`).join('');
      let body = '';
      if (tab === 'seeds' || tab === 'food') {
        const ids = tab === 'seeds' ? ['seed_carrot', 'seed_corn', 'seed_tomato', 'seed_strawberry'] : ['bread', 'soup'];
        body = ids.map(id => {
          const d = ITEMS[id];
          const extra = d.kind === 'food' ? `+${d.energy} de energia` : d.desc;
          return `<div class="line">${icon(id)}<span>${d.name}<small>${extra}</small></span><b>${d.price} 💰</b>
            <button class="btn sm" data-buy="${id}" data-q="1" ${S.gold < d.price ? 'disabled' : ''}>×1</button>
            <button class="btn sm" data-buy="${id}" data-q="5" ${S.gold < d.price * 5 ? 'disabled' : ''}>×5</button></div>`;
        }).join('');
        if (tab === 'seeds' && S.season === 3) body = `<p class="warn center">❄️ É inverno: nada cresce agora. Volte na primavera!</p>` + body;
      } else {
        body = UPGRADES.filter(u => !u.need || u.need()).map(u => {
          const mats = Object.entries(u.mats).map(([m, q]) => `${icon(m, 'px tiny')}${countItem(m)}/${q}`).join(' ');
          const ok = S.gold >= u.cost && Object.entries(u.mats).every(([m, q]) => countItem(m) >= q);
          return `<div class="line">${icon(u.icon)}<span>${u.name}<small>${u.desc}</small><small class="mats">${mats}</small></span>
            ${u.have() ? '<b class="ok">✔ Comprado</b>' : `<b>${money(u.cost)} 💰</b><button class="btn sm" data-up="${u.id}" ${ok ? '' : 'disabled'}>Comprar</button>`}</div>`;
        }).join('');
      }
      $('#modalBody').innerHTML = `<p class="muted center">"Olá, querida(o)! O que vai levar hoje?" — Dona Rosa</p>
        <div class="tabs">${tabs}</div><div class="list">${body}</div>`;
    };
    openModal('🛒 Barraca da Dona Rosa', '', { wide: true, onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tab) { tab = b.dataset.tab; Sound.play('click'); render(); return; }
      if (b.dataset.buy) {
        const id = b.dataset.buy, q = +b.dataset.q, cost = ITEMS[id].price * q;
        if (S.gold < cost) return;
        if (!hasRoom(id)) { toast('🎒 Mochila cheia!'); Sound.play('error'); return; }
        S.gold -= cost; addItem(id, q); Sound.play('coin');
      }
      if (b.dataset.up) {
        const u = UPGRADES.find(x => x.id === b.dataset.up);
        if (!u || u.have()) return;
        S.gold -= u.cost;
        for (const [m, q] of Object.entries(u.mats)) removeItem(m, q);
        u.apply(); Sound.play('level'); toast(`✨ ${u.name} adquirida!`);
        save();
      }
      refresh();
    };
  }

  // ---------------------------------------------------------------- mochila
  function openBag() {
    swapFrom = null;
    const render = () => {
      const cell = i => {
        const it = S.inv[i];
        return `<button class="cell ${i < 6 ? 'hot' : ''} ${swapFrom === i ? 'pick' : ''} ${S.sel === i ? 'sel' : ''}" data-i="${i}">
          ${it ? icon(iconId(it.id)) + (ITEMS[it.id].kind !== 'tool' ? `<span class="qty">${it.qty}</span>` : '') : ''}</button>`;
      };
      const info = swapFrom != null && S.inv[swapFrom] ? (() => {
        const it = S.inv[swapFrom], d = ITEMS[it.id];
        return `<b>${d.name}</b> — ${d.desc || ''} ${d.sell ? `Vende por ${d.sell} 💰.` : ''} ${d.energy ? `Comer: +${d.energy} ❤️.` : ''}`;
      })() : 'Toque em um item e depois em outro espaço para trocar de lugar. A primeira linha é a hotbar.';
      $('#modalBody').innerHTML = `<div class="grid">${S.inv.map((_, i) => cell(i)).join('')}</div><p class="muted center info">${info}</p>
        <div class="stats">💰 ${money(S.gold)} · 🌾 ${S.stats.harvest} colhidos · 🐟 ${S.stats.fish} peixes · ⛏️ ${S.stats.ore} minérios</div>`;
    };
    openModal('🎒 Mochila', '', { onRefresh: render });
    render();
    $('#modalBody').onclick = e => {
      const b = e.target.closest('.cell'); if (!b) return;
      const i = +b.dataset.i;
      Sound.play('click');
      if (swapFrom == null) { if (S.inv[i]) swapFrom = i; }
      else {
        if (swapFrom !== i) { const t = S.inv[i]; S.inv[i] = S.inv[swapFrom]; S.inv[swapFrom] = t; }
        swapFrom = null;
      }
      refresh();
    };
  }

  // ---------------------------------------------------------------- menu / ajuda
  function openMenu() {
    const render = () => {
      $('#modalBody').innerHTML = `
        <div class="menu">
          <button class="btn" data-a="resume">▶ Continuar</button>
          <button class="btn" data-a="save">💾 Salvar agora</button>
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
      if (a === 'sfx') { Sound.toggleSfx(); render(); }
      if (a === 'mus') { Sound.toggleMusic(); render(); }
      if (a === 'help') help();
      if (a === 'title') { save(); closeModal(true); showTitle(); }
    };
  }

  function help() {
    openModal('❓ Como jogar', `
      <div class="help">
        <p><b>Objetivo:</b> transforme o terreno abandonado numa fazenda próspera!</p>
        <ol>
          <li>🪓 <b>Limpe</b> o terreno: arranque mato, corte galhos e árvores, quebre pedras.</li>
          <li>⛏️ <b>Are</b> a terra com a enxada.</li>
          <li>🌱 <b>Plante</b> sementes e 💧 <b>regue</b> todo dia (encha o regador no lago).</li>
          <li>🛏️ <b>Durma</b> para os dias passarem e as plantas crescerem.</li>
          <li>🖐️ <b>Colha</b> e coloque na 📦 <b>Caixa de Envio</b> ao lado da casa: vende de noite.</li>
          <li>🛒 Compre sementes e <b>melhorias</b> na barraca da Dona Rosa. Expanda a fazenda!</li>
        </ol>
        <p><b>Controles (toque):</b> arraste no mapa para andar (D-pad aparece onde o dedo toca) ou toque num tile para ir até lá. Toque num tile ao seu lado para usar o item nele. O <b>botão grande</b> faz a ação do momento. Toque na hotbar para trocar de item.</p>
        <p><b>Teclado:</b> WASD/setas andam · Espaço/E ação · 1–6 hotbar · I mochila · Esc menu.</p>
        <p><b>Dicas:</b> cada ação gasta ❤️ energia — coma para recuperar. 1 minuto real = 1 hora no jogo. Às 2h você desmaia! Planta sem água por 3 dias seca. No inverno nada cresce: pesque e minere na pedreira (nordeste).</p>
      </div>`, { wide: true });
  }

  function intro() {
    openModal('🌻 Bem-vindo ao Vale Florido!', `
      <p class="center">Você herdou a velha fazenda do seu avô. O terreno está tomado pelo mato, mas com trabalho e carinho ela vai voltar a florescer!</p>
      <p class="center">Comece arando a terra ao lado da casa, plante as <b>sementes de cenoura</b> e regue.<br>Você tem <b>250 💰</b> e muita disposição.</p>
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
    init, tick, refresh, toast, joystick, askSleep, fade, daySummary, openBin, openShop, openBag, openMenu, intro, handleKey,
    blocking: () => modalOpen || titleOpen,
    inGame: () => !titleOpen,
  };
})();
