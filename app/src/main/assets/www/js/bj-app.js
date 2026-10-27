// Interface do 21: troca de jogo, marcação das cartas e exibição da recomendação.
(function () {
  'use strict';

  var B = window.Blackjack;
  var ACTIONS = {
    hit: { text: 'PEÇA CARTA', cls: 'ok' },
    stand: { text: 'PARE (MANTENHA)', cls: 'good' },
    double: { text: 'DOBRE', cls: 'good' },
    split: { text: 'DIVIDA O PAR', cls: 'good' },
    surrender: { text: 'DESISTA (SURRENDER)', cls: 'bad' },
    blackjack: { text: 'BLACKJACK!', cls: 'good' },
    bust: { text: 'ESTOUROU', cls: 'bad' }
  };
  var $ = function (id) { return document.getElementById(id); };

  // --- Troca entre Poker e 21 (lembrada entre aberturas e na janela flutuante) ---
  function storedMode() {
    try { return localStorage.getItem('mode') || 'poker'; } catch (e) { return 'poker'; }
  }
  function setMode(mode) {
    try { localStorage.setItem('mode', mode); } catch (e) { /* sem armazenamento: só não lembra */ }
    document.querySelectorAll('[data-for]').forEach(function (el) {
      el.hidden = el.dataset.for !== mode;
    });
    document.querySelectorAll('.modes button').forEach(function (b) {
      var on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
  }
  document.querySelectorAll('.modes button').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
  window.addEventListener('storage', function (e) {
    if (e.key === 'mode' && e.newValue) setMode(e.newValue);
  });

  // --- Mão: cartas do jogador (valores 1..10) e carta aberta do dealer ---
  var hand = [];
  var dealer = null;
  var history = []; // ordem das marcações, para o "Desfazer"

  function buildKeys() {
    var keys = $('bj-keys');
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'card';
      b.textContent = v === 10 ? '10 J Q K' : B.LABELS[v];
      if (v === 10) b.classList.add('ten');
      b.addEventListener('click', function () { addCard(v); });
      keys.appendChild(b);
    });
  }

  // Ordem da distribuição: suas duas cartas, a do dealer, depois as que você pedir.
  function addCard(v) {
    if (hand.length >= 2 && dealer === null) {
      dealer = v;
      history.push('dealer');
    } else {
      hand.push(v);
      history.push('hand');
    }
    render();
  }

  function undo() {
    var last = history.pop();
    if (last === 'dealer') dealer = null;
    else if (last === 'hand') hand.pop();
    render();
  }

  function removeHandCard(i) {
    hand.splice(i, 1);
    var at = history.lastIndexOf('hand');
    if (at >= 0) history.splice(at, 1);
    render();
  }

  function slot(label, onClick, active) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot' + (label === null ? ' empty' : ' card') + (active ? ' active' : '');
    el.textContent = label === null ? '' : label;
    el.addEventListener('click', onClick);
    return el;
  }

  function render() {
    var handEl = $('bj-hand'), dealerEl = $('bj-dealer');
    handEl.innerHTML = '';
    dealerEl.innerHTML = '';
    var next = hand.length >= 2 && dealer === null ? 'dealer' : 'hand';
    hand.forEach(function (v, i) {
      handEl.appendChild(slot(B.LABELS[v], function () { removeHandCard(i); }, false));
    });
    for (var k = hand.length; k < 2; k++) handEl.appendChild(slot(null, function () {}, next === 'hand' && k === hand.length));
    if (hand.length >= 2) handEl.appendChild(slot(null, function () {}, next === 'hand'));
    dealerEl.appendChild(slot(dealer === null ? null : B.LABELS[dealer], function () {
      if (dealer === null) return;
      dealer = null;
      var at = history.lastIndexOf('dealer');
      if (at >= 0) history.splice(at, 1);
      render();
    }, next === 'dealer'));

    var hv = B.handValue(hand);
    $('bj-total').textContent = hand.length ? (hv.soft ? hv.total - 10 + '/' + hv.total : String(hv.total)) : '—';
    analyze();
  }

  function analyze() {
    var result = $('bj-result');
    if (hand.length < 2 || dealer === null) {
      result.hidden = true;
      return;
    }
    var h17 = $('bj-h17').checked;
    var rec = B.recommend({
      cards: hand, up: dealer, hitSoft17: h17,
      das: $('bj-das').checked, surrender: $('bj-surrender').checked
    });
    var action = ACTIONS[rec.action];
    $('bj-verdict').textContent = action.text;
    $('bj-verdict').className = 'verdict ' + action.cls;

    var hv = B.handValue(hand);
    var odds = B.standOdds(hv.total > 21 ? 0 : hv.total, dealer, h17);
    var busted = hv.total > 21;
    $('bj-bust').textContent = busted ? '—' : B.pct(B.bustChance(hand));
    $('bj-win').textContent = busted ? '0%' : B.pct(odds.win);
    $('bj-push').textContent = busted ? '0%' : B.pct(odds.tie);
    $('bj-dealer-bust').textContent = B.pct(odds.dealerBust);

    var ul = $('bj-reasons');
    ul.innerHTML = '';
    rec.reasons.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    result.hidden = false;
  }

  $('bj-undo').addEventListener('click', undo);
  $('bj-clear').addEventListener('click', function () {
    hand = [];
    dealer = null;
    history = [];
    render();
  });
  ['bj-h17', 'bj-das', 'bj-surrender'].forEach(function (id) {
    $(id).addEventListener('change', analyze);
  });

  if (window.Android && window.Android.openOverlay && !document.body.classList.contains('compact')) {
    $('bj-overlay').hidden = false;
    $('bj-overlay').addEventListener('click', function () { window.Android.openOverlay(); });
  }

  buildKeys();
  setMode(storedMode());
  render();
})();
