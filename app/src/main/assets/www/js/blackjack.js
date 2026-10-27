// Núcleo de lógica do 21 (blackjack): estratégia básica e probabilidades.
// Funciona no navegador (window.Blackjack) e no Node (module.exports) para os testes.
(function (root) {
  'use strict';

  // Carta = valor 1..10 (1 = Ás; 10 = 10, J, Q ou K). Naipe não importa no 21.
  var LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  // Baralho infinito: cada valor tem 1/13, exceto o 10 (10, J, Q, K) com 4/13.
  function cardProb(v) { return v === 10 ? 4 / 13 : 1 / 13; }

  // Soma da mão: { total, soft } — soft quando um Ás está contando como 11.
  function handValue(cards) {
    var total = 0, aces = 0;
    for (var i = 0; i < cards.length; i++) {
      total += cards[i];
      if (cards[i] === 1) aces++;
    }
    var soft = aces > 0 && total + 10 <= 21;
    return { total: soft ? total + 10 : total, soft: soft };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handValue(cards).total === 21;
  }

  // Distribuição final do dealer a partir da carta aberta (baralho infinito).
  // Com Ás ou 10 aberto, condiciona a que ele não tenha blackjack (o dealer confere antes).
  // Retorna { 17, 18, 19, 20, 21, bust }.
  function dealerOutcomes(up, hitSoft17) {
    var memo = {};
    function play(total, aces, nCards) {
      var soft = aces > 0 && total + 10 <= 21;
      var best = soft ? total + 10 : total;
      if (best > 21) return { bust: 1 };
      if (best > 17 || (best === 17 && !(soft && hitSoft17))) {
        var done = {};
        done[best] = 1;
        return done;
      }
      var key = total + ':' + aces + ':' + (nCards === 1 ? 1 : 2);
      if (memo[key]) return memo[key];
      var out = {};
      for (var v = 1; v <= 10; v++) {
        // Segunda carta que daria blackjack é descartada (condicionamento acima).
        if (nCards === 1 && ((up === 1 && v === 10) || (up === 10 && v === 1))) continue;
        var sub = play(total + v, aces + (v === 1 ? 1 : 0), nCards + 1);
        for (var k in sub) out[k] = (out[k] || 0) + cardProb(v) * sub[k];
      }
      if (nCards === 1 && (up === 1 || up === 10)) {
        var norm = 1 - (up === 1 ? cardProb(10) : cardProb(1));
        for (k in out) out[k] /= norm;
      }
      memo[key] = out;
      return out;
    }
    var res = play(up, up === 1 ? 1 : 0, 1);
    var full = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0 };
    for (var k in res) full[k] += res[k];
    return full;
  }

  // Chance de ganhar/empatar/perder se parar agora com esse total.
  function standOdds(total, up, hitSoft17) {
    var d = dealerOutcomes(up, hitSoft17);
    var win = d.bust, tie = 0, lose = 0;
    for (var t = 17; t <= 21; t++) {
      if (total > t) win += d[t];
      else if (total === t) tie += d[t];
      else lose += d[t];
    }
    return { win: win, tie: tie, lose: lose, dealerBust: d.bust };
  }

  // Chance de estourar ao pedir mais uma carta.
  function bustChance(cards) {
    var hv = handValue(cards);
    if (hv.soft) return 0;
    var p = 0;
    for (var v = 1; v <= 10; v++) if (hv.total + v > 21) p += cardProb(v);
    return p;
  }

  // Tabelas de estratégia básica (vários baralhos), indexadas pela carta do dealer: 2..10, A.
  // H = pedir, S = parar, D = dobrar (senão pedir), Ds = dobrar (senão parar),
  // P = dividir, Ph = dividir se puder dobrar depois (DAS), senão pedir.
  var UP = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
  function row(s) { return s.split(' '); }

  var HARD = {
    8: row('H H H H H H H H H H'),
    9: row('H D D D D H H H H H'),
    10: row('D D D D D D D D H H'),
    11: row('D D D D D D D D D H'),
    12: row('H H S S S H H H H H'),
    13: row('S S S S S H H H H H'),
    14: row('S S S S S H H H H H'),
    15: row('S S S S S H H H H H'),
    16: row('S S S S S H H H H H')
  };
  var SOFT = {
    12: row('H H H H H H H H H H'),
    13: row('H H H D D H H H H H'),
    14: row('H H H D D H H H H H'),
    15: row('H H D D D H H H H H'),
    16: row('H H D D D H H H H H'),
    17: row('H D D D D H H H H H'),
    18: row('S Ds Ds Ds Ds S S H H H'),
    19: row('S S S S S S S S S S')
  };
  var PAIRS = {
    1: row('P P P P P P P P P P'),
    2: row('Ph Ph P P P P H H H H'),
    3: row('Ph Ph P P P P H H H H'),
    4: row('H H H Ph Ph H H H H H'),
    6: row('Ph P P P P H H H H H'),
    7: row('P P P P P P H H H H'),
    8: row('P P P P P P P P P P'),
    9: row('P P P P P S P P S S')
  };

  function cell(table, total, up) {
    return table[total][UP.indexOf(up)];
  }

  // Recomendação para a mão atual.
  // opts: { cards, up, hitSoft17, das, surrender }. Retorna { action, reasons }.
  // action: hit | stand | double | split | surrender | blackjack | bust
  function recommend(opts) {
    var cards = opts.cards, up = opts.up;
    var hv = handValue(cards);
    var first = cards.length === 2;
    var h17 = !!opts.hitSoft17;
    var reasons = [];
    var upName = up === 1 ? 'Ás' : String(up);

    if (hv.total > 21) return { action: 'bust', reasons: ['Sua mão passou de 21.'] };
    if (isBlackjack(cards)) return { action: 'blackjack', reasons: ['Ás + carta de 10 nas duas primeiras: blackjack, paga 3 para 2.'] };
    if (hv.total === 21) return { action: 'stand', reasons: ['21 não tem como melhorar.'] };

    // Desistência (late surrender): só nas duas primeiras cartas.
    if (first && opts.surrender && !hv.soft) {
      var pair8 = cards[0] === 8 && cards[1] === 8;
      var surr = (!pair8 && hv.total === 16 && (up === 9 || up === 10 || up === 1)) ||
        (hv.total === 15 && up === 10) ||
        (h17 && up === 1 && (hv.total === 15 || hv.total === 17 || pair8));
      if (surr) {
        reasons.push(hv.total + ' contra ' + upName + ' perde na maioria das vezes: devolver metade da aposta sai mais barato.');
        return { action: 'surrender', reasons: reasons };
      }
    }

    // Pares.
    if (first && cards[0] === cards[1] && PAIRS[cards[0]]) {
      var pc = cell(PAIRS, cards[0], up);
      if (pc === 'P' || (pc === 'Ph' && opts.das)) {
        reasons.push(cards[0] === 1 ? 'Par de Ases sempre se divide: cada Ás pode virar 21.'
          : cards[0] === 8 ? 'Par de 8 soma 16, o pior total; dividido, cada 8 tem chance melhor.'
          : 'Dividir esse par contra ' + upName + ' rende mais que jogar o total junto.');
        return { action: 'split', reasons: reasons };
      }
    }

    var action;
    if (hv.soft && hv.total <= 19) {
      action = cell(SOFT, hv.total, up);
      if (h17 && first && hv.total === 19 && up === 6) action = 'Ds';
      if (h17 && hv.total === 18 && up === 2) action = 'Ds';
    } else if (hv.soft) {
      action = 'S';
    } else if (hv.total >= 17) {
      action = 'S';
    } else if (hv.total <= 8) {
      action = 'H';
    } else {
      action = cell(HARD, hv.total, up);
      if (h17 && hv.total === 11 && up === 1) action = 'D';
    }

    if (action === 'D' || action === 'Ds') {
      if (first) {
        reasons.push(!hv.soft && hv.total >= 10
          ? 'Com ' + hv.total + ' uma carta só já deixa você bem perto de 21: dobre a aposta.'
          : 'Dealer com ' + upName + ' está fraco e tende a estourar: dobre a aposta enquanto pode.');
        return { action: 'double', reasons: reasons };
      }
      action = action === 'D' ? 'H' : 'S';
      reasons.push('Dobrar seria o ideal, mas só dá com as duas primeiras cartas.');
    }

    if (action === 'S') {
      if (!hv.soft && hv.total <= 16) reasons.push('Dealer com ' + upName + ' tem boa chance de estourar: deixe o risco com ele.');
      return { action: 'stand', reasons: reasons };
    }
    if (hv.soft) reasons.push('Mão macia (Ás contando 11): pedir mais uma carta não tem como estourar.');
    else if (hv.total >= 12) reasons.push('Contra ' + upName + ' o dealer costuma chegar a 17 ou mais: parar com ' + hv.total + ' perde com frequência.');
    return { action: 'hit', reasons: reasons };
  }

  function pct(x) { return (x * 100).toFixed(1).replace('.', ',') + '%'; }

  var Blackjack = {
    LABELS: LABELS, handValue: handValue, isBlackjack: isBlackjack,
    dealerOutcomes: dealerOutcomes, standOdds: standOdds, bustChance: bustChance,
    recommend: recommend, pct: pct
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Blackjack;
  else root.Blackjack = Blackjack;
})(this);
