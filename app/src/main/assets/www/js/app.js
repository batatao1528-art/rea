// Interface: seleção de cartas, configuração da mão e exibição da análise.
(function () {
  'use strict';

  var P = window.Poker;
  var ITERATIONS = 15000;
  var ACTIONS = {
    raise: { text: 'AUMENTE', cls: 'good' },
    bet: { text: 'APOSTE', cls: 'good' },
    call: { text: 'PAGUE', cls: 'ok' },
    check: { text: 'PASSE (CHECK)', cls: 'ok' },
    fold: { text: 'DESISTA (FOLD)', cls: 'bad' }
  };

  // 7 vagas: 0-1 = sua mão, 2-6 = mesa.
  var slots = [null, null, null, null, null, null, null];
  var activeSlot = 0;
  var $ = function (id) { return document.getElementById(id); };

  function buildSlots() {
    var hole = $('hole-slots'), board = $('board-slots');
    for (var i = 0; i < 7; i++) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'slot';
      el.dataset.index = i;
      el.addEventListener('click', onSlotClick);
      (i < 2 ? hole : board).appendChild(el);
    }
  }

  function buildDeck() {
    var deck = $('deck');
    for (var s = 0; s < 4; s++) {
      var row = document.createElement('div');
      row.className = 'deck-row';
      for (var r = 12; r >= 0; r--) {
        var c = P.makeCard(r, s);
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'card suit-' + P.SUITS[s];
        el.dataset.card = c;
        el.textContent = P.cardLabel(c);
        el.addEventListener('click', onDeckClick);
        row.appendChild(el);
      }
      deck.appendChild(row);
    }
  }

  var position = 'btn';
  var POSITION_SHORT = { utg: 'UTG', mp: 'MP', co: 'CO', btn: 'BTN', sb: 'SB', bb: 'BB' };

  function buildPositions() {
    var group = $('position');
    Object.keys(P.POSITIONS).forEach(function (k) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.position = k;
      b.title = P.POSITIONS[k].label;
      b.setAttribute('role', 'radio');
      b.textContent = POSITION_SHORT[k];
      b.addEventListener('click', function () {
        position = k;
        renderPositions();
        scheduleAnalysis();
      });
      group.appendChild(b);
    });
    renderPositions();
  }

  function renderPositions() {
    document.querySelectorAll('#position button').forEach(function (b) {
      var on = b.dataset.position === position;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
  }

  function onDeckClick(e) {
    var c = Number(e.currentTarget.dataset.card);
    var at = slots.indexOf(c);
    if (at >= 0) { // carta já usada: remove
      slots[at] = null;
      activeSlot = at;
    } else {
      slots[activeSlot] = c;
      activeSlot = nextEmpty(activeSlot);
    }
    render();
  }

  function onSlotClick(e) {
    var i = Number(e.currentTarget.dataset.index);
    if (activeSlot === i && slots[i] !== null) slots[i] = null;
    activeSlot = i;
    render();
  }

  // Próxima vaga vazia respeitando a ordem: mão, depois flop/turn/river.
  function nextEmpty(from) {
    for (var k = 1; k <= 7; k++) {
      var i = (from + k) % 7;
      if (slots[i] === null) return i;
    }
    return from;
  }

  function streetOf(boardCount) {
    return ['preflop', null, null, 'flop', 'turn', 'river'][boardCount];
  }

  function render() {
    document.querySelectorAll('.slot').forEach(function (el) {
      var i = Number(el.dataset.index), c = slots[i];
      el.textContent = c === null ? '' : P.cardLabel(c);
      el.className = 'slot' + (c === null ? ' empty' : ' card suit-' + P.SUITS[P.suitOf(c)]) +
        (i === activeSlot ? ' active' : '');
    });
    document.querySelectorAll('#deck .card').forEach(function (el) {
      el.classList.toggle('used', slots.indexOf(Number(el.dataset.card)) >= 0);
    });
    scheduleAnalysis();
  }

  var timer = null;
  function scheduleAnalysis() {
    clearTimeout(timer);
    timer = setTimeout(analyze, 60);
  }

  function analyze() {
    var hole = slots.slice(0, 2).filter(isCard);
    var board = slots.slice(2).filter(isCard);
    var street = streetOf(board.length);
    $('street-label').textContent = { preflop: 'Pré-flop', flop: 'Flop', turn: 'Turn', river: 'River' }[street] ||
      'Incompleta (' + board.length + ' cartas)';

    var result = $('result');
    // Mesa precisa estar preenchida em ordem: 0, 3, 4 ou 5 cartas.
    if (hole.length < 2 || !street) {
      result.hidden = true;
      return;
    }
    var opponents = clamp(parseInt($('opponents').value, 10) || 1, 1, 9);
    var pot = Math.max(0, parseFloat($('pot').value) || 0);
    var toCall = Math.max(0, parseFloat($('to-call').value) || 0);

    var eq = P.equity(hole, board, opponents, ITERATIONS);
    var rec = P.recommend({
      hole: hole, equity: eq.equity, opponents: opponents, street: street,
      position: position, pot: pot, toCall: toCall
    });

    var action = ACTIONS[rec.action];
    var verdict = $('verdict');
    verdict.textContent = action.text;
    verdict.className = 'verdict ' + action.cls;

    $('equity').textContent = P.pct(eq.equity);
    $('win').textContent = P.pct(eq.win);
    $('tie').textContent = P.pct(eq.tie);
    $('pot-odds').textContent = toCall > 0 ? P.pct(rec.potOdds) : '—';
    $('meter-fill').style.width = (eq.equity * 100) + '%';
    $('meter-fill').className = 'meter-fill ' + action.cls;
    var mark = $('meter-mark');
    mark.hidden = toCall <= 0;
    mark.style.left = (rec.potOdds * 100) + '%';

    if (board.length >= 3) {
      $('made-hand').textContent = 'Você tem agora: ' + P.describeHand(P.evaluate(hole.concat(board)));
    } else {
      var chen = P.chenScore(hole);
      $('made-hand').textContent = 'Mão inicial ' + P.handCode(hole) + ' · ' + P.preflopTier(chen).name;
    }

    fillList($('draws'), P.detectDraws(hole, board));
    fillList($('reasons'), rec.reasons);

    var table = $('categories');
    table.innerHTML = '';
    for (var k = P.CATEGORY_NAMES_PT.length - 1; k >= 0; k--) {
      var tr = document.createElement('tr');
      var p = eq.categories[k];
      tr.innerHTML = '<td>' + P.CATEGORY_NAMES_PT[k] + '</td><td class="bar"><span style="width:' +
        (p * 100) + '%"></span></td><td class="num">' + P.pct(p) + '</td>';
      table.appendChild(tr);
    }

    result.hidden = false;
  }

  function fillList(ul, items) {
    ul.innerHTML = '';
    items.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
  }

  function isCard(c) { return c !== null; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

  $('clear').addEventListener('click', function () {
    slots = [null, null, null, null, null, null, null];
    activeSlot = 0;
    $('pot').value = 0;
    $('to-call').value = 0;
    render();
  });
  ['opponents', 'pot', 'to-call'].forEach(function (id) {
    $(id).addEventListener('input', scheduleAnalysis);
  });

  // Modo compacto: usado dentro da janela flutuante do app Android.
  if (/[?&]compact\b/.test(location.search)) document.body.classList.add('compact');

  // Dentro do APK, o Android expõe window.Android para abrir a janela flutuante.
  if (window.Android && window.Android.openOverlay && !document.body.classList.contains('compact')) {
    $('overlay').hidden = false;
    $('overlay').addEventListener('click', function () { window.Android.openOverlay(); });
  }

  buildSlots();
  buildDeck();
  buildPositions();
  render();
})();
