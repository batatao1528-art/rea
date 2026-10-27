// Núcleo de lógica de poker (Texas Hold'em): avaliação de mãos, equidade e recomendações.
// Funciona no navegador (window.Poker) e no Node (module.exports) para os testes.
(function (root) {
  'use strict';

  var RANKS = '23456789TJQKA';
  var SUITS = 'shdc'; // espadas, copas, ouros, paus
  var SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
  var RANK_NAMES_PT = ['Dois', 'Três', 'Quatro', 'Cinco', 'Seis', 'Sete', 'Oito', 'Nove', 'Dez', 'Valete', 'Dama', 'Rei', 'Ás'];
  var RANK_PLURAL_PT = ['Dois', 'Três', 'Quatros', 'Cincos', 'Seis', 'Setes', 'Oitos', 'Noves', 'Dez', 'Valetes', 'Damas', 'Reis', 'Ases'];

  var CATEGORY = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, TRIPS: 3, STRAIGHT: 4,
    FLUSH: 5, FULL_HOUSE: 6, QUADS: 7, STRAIGHT_FLUSH: 8
  };
  var CATEGORY_NAMES_PT = [
    'Carta alta', 'Par', 'Dois pares', 'Trinca', 'Sequência',
    'Flush', 'Full house', 'Quadra', 'Straight flush'
  ];

  // Carta = inteiro 0..51: rank = c >> 2 (0 = 2 ... 12 = Ás), naipe = c & 3.
  function makeCard(rank, suit) { return (rank << 2) | suit; }
  function rankOf(c) { return c >> 2; }
  function suitOf(c) { return c & 3; }

  function parseCard(str) {
    var r = RANKS.indexOf(str[0].toUpperCase());
    var s = SUITS.indexOf(str[1].toLowerCase());
    if (r < 0 || s < 0 || str.length !== 2) throw new Error('Carta inválida: ' + str);
    return makeCard(r, s);
  }
  function cardToString(c) { return RANKS[rankOf(c)] + SUITS[suitOf(c)]; }
  function cardLabel(c) { return RANKS[rankOf(c)].replace('T', '10') + SUIT_SYMBOLS[SUITS[suitOf(c)]]; }

  // Retorna o rank mais alto de uma sequência contida na máscara de ranks, ou -1.
  function straightHigh(mask) {
    for (var high = 12; high >= 4; high--) {
      var m = 0x1f << (high - 4);
      if ((mask & m) === m) return high;
    }
    // Roda (A-2-3-4-5): Ás conta como 1.
    if ((mask & 0x100f) === 0x100f) return 3;
    return -1;
  }

  function topBits(mask, n) {
    var out = [];
    for (var r = 12; r >= 0 && out.length < n; r--) if (mask & (1 << r)) out.push(r);
    return out;
  }

  function score(category, kickers) {
    var s = category;
    for (var i = 0; i < 5; i++) s = s * 16 + (kickers[i] !== undefined ? kickers[i] : 0);
    return s;
  }

  // Avalia de 5 a 7 cartas e retorna { score, category, ranks }. Maior score = mão melhor.
  function evaluate(cards) {
    var rankCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    var suitCount = [0, 0, 0, 0];
    var suitMask = [0, 0, 0, 0];
    var rankMask = 0;
    for (var i = 0; i < cards.length; i++) {
      var r = rankOf(cards[i]), s = suitOf(cards[i]);
      rankCount[r]++;
      suitCount[s]++;
      suitMask[s] |= 1 << r;
      rankMask |= 1 << r;
    }

    var flushSuit = -1;
    for (s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;
    if (flushSuit >= 0) {
      var sfHigh = straightHigh(suitMask[flushSuit]);
      if (sfHigh >= 0) return result(CATEGORY.STRAIGHT_FLUSH, [sfHigh]);
    }

    var quads = -1, trips = [], pairs = [];
    for (r = 12; r >= 0; r--) {
      if (rankCount[r] === 4) quads = r;
      else if (rankCount[r] === 3) trips.push(r);
      else if (rankCount[r] === 2) pairs.push(r);
    }

    if (quads >= 0) {
      return result(CATEGORY.QUADS, [quads].concat(topBits(rankMask & ~(1 << quads), 1)));
    }
    if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
      var pairPart = trips.length > 1 ? trips[1] : pairs[0];
      if (pairs.length > 0 && pairs[0] > pairPart) pairPart = pairs[0];
      return result(CATEGORY.FULL_HOUSE, [trips[0], pairPart]);
    }
    if (flushSuit >= 0) return result(CATEGORY.FLUSH, topBits(suitMask[flushSuit], 5));

    var stHigh = straightHigh(rankMask);
    if (stHigh >= 0) return result(CATEGORY.STRAIGHT, [stHigh]);

    if (trips.length > 0) {
      return result(CATEGORY.TRIPS, [trips[0]].concat(topBits(rankMask & ~(1 << trips[0]), 2)));
    }
    if (pairs.length >= 2) {
      var rest = rankMask & ~(1 << pairs[0]) & ~(1 << pairs[1]);
      return result(CATEGORY.TWO_PAIR, [pairs[0], pairs[1]].concat(topBits(rest, 1)));
    }
    if (pairs.length === 1) {
      return result(CATEGORY.PAIR, [pairs[0]].concat(topBits(rankMask & ~(1 << pairs[0]), 3)));
    }
    return result(CATEGORY.HIGH_CARD, topBits(rankMask, 5));

    function result(category, ranks) {
      return { score: score(category, ranks), category: category, ranks: ranks };
    }
  }

  function describeHand(ev) {
    var k = ev.ranks;
    switch (ev.category) {
      case CATEGORY.STRAIGHT_FLUSH: return k[0] === 12 ? 'Royal flush' : 'Straight flush até ' + RANK_NAMES_PT[k[0]];
      case CATEGORY.QUADS: return 'Quadra de ' + RANK_PLURAL_PT[k[0]];
      case CATEGORY.FULL_HOUSE: return 'Full house: ' + RANK_PLURAL_PT[k[0]] + ' com ' + RANK_PLURAL_PT[k[1]];
      case CATEGORY.FLUSH: return 'Flush, ' + RANK_NAMES_PT[k[0]] + ' alto';
      case CATEGORY.STRAIGHT: return 'Sequência até ' + RANK_NAMES_PT[k[0]];
      case CATEGORY.TRIPS: return 'Trinca de ' + RANK_PLURAL_PT[k[0]];
      case CATEGORY.TWO_PAIR: return 'Dois pares: ' + RANK_PLURAL_PT[k[0]] + ' e ' + RANK_PLURAL_PT[k[1]];
      case CATEGORY.PAIR: return 'Par de ' + RANK_PLURAL_PT[k[0]];
      default: return RANK_NAMES_PT[k[0]] + ' alto';
    }
  }

  // Simulação de Monte Carlo: sorteia as cartas dos oponentes e o resto da mesa.
  // Retorna a equidade (vitórias + empates divididos) e a chance de terminar com cada tipo de mão.
  function equity(hole, board, opponents, iterations, rng) {
    rng = rng || Math.random;
    var used = {};
    var known = hole.concat(board);
    for (var i = 0; i < known.length; i++) used[known[i]] = true;
    var deck = [];
    for (var c = 0; c < 52; c++) if (!used[c]) deck.push(c);

    var need = (5 - board.length) + opponents * 2;
    var wins = 0, ties = 0, share = 0;
    var categories = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    var heroCards = hole.concat(board, [0, 0, 0, 0, 0]).slice(0, 7);
    var villainCards = [0, 0, 0, 0, 0, 0, 0];

    for (var it = 0; it < iterations; it++) {
      // Fisher–Yates parcial: só embaralha as cartas que vamos usar.
      for (i = 0; i < need; i++) {
        var j = i + Math.floor(rng() * (deck.length - i));
        var tmp = deck[i]; deck[i] = deck[j]; deck[j] = tmp;
      }
      var p = 0;
      var fullBoard = board.slice();
      while (fullBoard.length < 5) fullBoard.push(deck[p++]);
      for (i = 0; i < 5; i++) heroCards[2 + i] = fullBoard[i];

      var hero = evaluate(heroCards);
      categories[hero.category]++;

      var best = -1, bestCount = 0;
      for (var o = 0; o < opponents; o++) {
        villainCards[0] = deck[p++];
        villainCards[1] = deck[p++];
        for (i = 0; i < 5; i++) villainCards[2 + i] = fullBoard[i];
        var v = evaluate(villainCards).score;
        if (v > best) { best = v; bestCount = 1; } else if (v === best) bestCount++;
      }

      if (hero.score > best) { wins++; share += 1; }
      else if (hero.score === best) { ties++; share += 1 / (bestCount + 1); }
    }

    return {
      equity: share / iterations,
      win: wins / iterations,
      tie: ties / iterations,
      categories: categories.map(function (n) { return n / iterations; }),
      iterations: iterations
    };
  }

  // Fórmula de Chen: pontuação clássica de força de mão pré-flop (de -1 a 20).
  function chenScore(hole) {
    var r1 = rankOf(hole[0]), r2 = rankOf(hole[1]);
    var hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    var base = function (r) {
      if (r === 12) return 10;
      if (r === 11) return 8;
      if (r === 10) return 7;
      if (r === 9) return 6;
      return (r + 2) / 2;
    };
    var pts = base(hi);
    if (r1 === r2) return Math.max(5, pts * 2);
    if (suitOf(hole[0]) === suitOf(hole[1])) pts += 2;
    var gap = hi - lo - 1;
    if (gap === 1) pts -= 1;
    else if (gap === 2) pts -= 2;
    else if (gap === 3) pts -= 4;
    else if (gap >= 4) pts -= 5;
    if (gap <= 1 && hi < 10) pts += 1; // conectores baixos ganham bônus
    return Math.ceil(pts);
  }

  // Notação curta da mão inicial: "AKs", "QJo", "77".
  function handCode(hole) {
    var r1 = rankOf(hole[0]), r2 = rankOf(hole[1]);
    var hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    if (hi === lo) return RANKS[hi] + RANKS[lo];
    return RANKS[hi] + RANKS[lo] + (suitOf(hole[0]) === suitOf(hole[1]) ? 's' : 'o');
  }

  var POSITIONS = {
    utg: { label: 'Início (UTG)', minChen: 10 },
    mp: { label: 'Meio (MP)', minChen: 9 },
    co: { label: 'Cutoff (CO)', minChen: 8 },
    btn: { label: 'Botão (BTN)', minChen: 7 },
    sb: { label: 'Small blind', minChen: 8 },
    bb: { label: 'Big blind', minChen: 7 }
  };

  function preflopTier(chen) {
    if (chen >= 12) return { name: 'Premium', level: 4 };
    if (chen >= 10) return { name: 'Forte', level: 3 };
    if (chen >= 8) return { name: 'Jogável', level: 2 };
    if (chen >= 6) return { name: 'Marginal', level: 1 };
    return { name: 'Fraca', level: 0 };
  }

  // Monta a recomendação final combinando equidade, pot odds e (no pré-flop) posição.
  // pot = valor no pote antes da sua decisão; toCall = quanto você precisa pagar (0 = ninguém apostou).
  function recommend(opts) {
    var eq = opts.equity;
    var opponents = opts.opponents;
    var fairShare = 1 / (opponents + 1);
    var pot = opts.pot || 0, toCall = opts.toCall || 0;
    var potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    var reasons = [];
    var action;

    reasons.push('Sua equidade é ' + pct(eq) + ' contra ' + opponents +
      (opponents === 1 ? ' oponente' : ' oponentes') + ' (a média da mesa seria ' + pct(fairShare) + ').');

    if (opts.street === 'preflop' && opts.position) {
      var pos = POSITIONS[opts.position];
      var chen = chenScore(opts.hole);
      var tier = preflopTier(chen);
      reasons.push(handCode(opts.hole) + ' é uma mão ' + tier.name.toLowerCase() + ' (pontuação Chen ' + chen + ').');
      if (chen < pos.minChen && toCall === 0 && opts.position !== 'bb') {
        reasons.push('Da posição ' + pos.label + ' o recomendado é entrar com pontuação ' + pos.minChen + ' ou mais.');
      }
    }

    if (toCall > 0) {
      reasons.push('Pagar ' + fmt(toCall) + ' para um pote de ' + fmt(pot + toCall) +
        ' exige pelo menos ' + pct(potOdds) + ' de equidade (pot odds).');
      if (eq >= Math.max(potOdds + 0.15, fairShare * 1.6)) {
        action = 'raise';
        reasons.push('Você está bem à frente do necessário: aumente para cobrar dos oponentes.');
      } else if (eq >= potOdds) {
        action = 'call';
        reasons.push('A equidade cobre o preço: pagar é lucrativo no longo prazo.');
      } else {
        action = 'fold';
        reasons.push('A equidade não cobre o preço da aposta: desistir economiza fichas.');
      }
    } else if (opts.street === 'preflop' && opts.position) {
      var c = chenScore(opts.hole), min = POSITIONS[opts.position].minChen;
      if (c >= min) action = 'raise';
      else action = opts.position === 'bb' ? 'check' : 'fold';
      if (action === 'raise') reasons.push('Mão boa o bastante para abrir com aumento desta posição.');
      else if (action === 'check') reasons.push('No big blind você vê o flop de graça: passe.');
    } else {
      if (eq >= fairShare * 1.5) {
        action = 'bet';
        reasons.push('Você provavelmente tem a melhor mão: aposte para ganhar valor.');
      } else {
        action = 'check';
        reasons.push('Mão não é forte o suficiente para apostar: passe e veja a próxima carta de graça.');
      }
    }

    return { action: action, potOdds: potOdds, reasons: reasons };
  }

  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }
  function fmt(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }

  // Detecta projetos (draws) com base nas cartas atuais.
  function detectDraws(hole, board) {
    if (board.length < 3 || board.length >= 5) return [];
    var cards = hole.concat(board);
    var draws = [];
    var current = evaluate(cards);
    var suitCount = [0, 0, 0, 0], holeSuits = [0, 0, 0, 0];
    cards.forEach(function (c) { suitCount[suitOf(c)]++; });
    hole.forEach(function (c) { holeSuits[suitOf(c)]++; });
    for (var s = 0; s < 4; s++) {
      if (suitCount[s] === 4 && holeSuits[s] > 0 && current.category < CATEGORY.FLUSH) {
        draws.push('Projeto de flush (9 outs)');
      }
    }
    if (current.category < CATEGORY.STRAIGHT) {
      var mask = 0;
      cards.forEach(function (c) { mask |= 1 << rankOf(c); });
      var outs = 0;
      for (var r = 0; r < 13; r++) {
        if (!(mask & (1 << r)) && straightHigh(mask | (1 << r)) >= 0) outs++;
      }
      if (outs >= 2) draws.push('Projeto de sequência aberta (8 outs)');
      else if (outs === 1) draws.push('Sequência de barriga / gutshot (4 outs)');
    }
    return draws;
  }

  var Poker = {
    RANKS: RANKS, SUITS: SUITS, CATEGORY: CATEGORY, CATEGORY_NAMES_PT: CATEGORY_NAMES_PT, POSITIONS: POSITIONS,
    makeCard: makeCard, rankOf: rankOf, suitOf: suitOf, parseCard: parseCard,
    cardToString: cardToString, cardLabel: cardLabel,
    evaluate: evaluate, describeHand: describeHand, equity: equity,
    chenScore: chenScore, handCode: handCode, preflopTier: preflopTier,
    recommend: recommend, detectDraws: detectDraws, pct: pct
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Poker;
  else root.Poker = Poker;
})(this);
