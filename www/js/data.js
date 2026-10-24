'use strict';
/* Vale Florido — conteúdo do jogo: plantas, itens, receitas, moradores, pedidos, conquistas e festivais. */

// Estações: 0 Primavera, 1 Verão, 2 Outono, 3 Inverno
const CROPS = {
  carrot: { name: 'Cenoura', days: 3, item: 'carrot', xp: 6, seasons: [0, 2] },
  strawberry: { name: 'Morango', days: 6, item: 'strawberry', xp: 14, seasons: [0] },
  sunflower: { name: 'Girassol', days: 5, item: 'sunflower', xp: 8, seasons: [0, 1] },
  corn: { name: 'Milho', days: 4, item: 'corn', xp: 10, seasons: [1, 2] },
  tomato: { name: 'Tomate', days: 5, regrow: 3, item: 'tomato', xp: 8, seasons: [1, 2] },
  melon: { name: 'Melancia', days: 9, item: 'melon', xp: 20, seasons: [1] },
  pumpkin: { name: 'Abóbora', days: 9, item: 'pumpkin', xp: 22, seasons: [2] },
};
const SEED_ORDER = ['seed_carrot', 'seed_strawberry', 'seed_sunflower', 'seed_corn', 'seed_tomato', 'seed_melon', 'seed_pumpkin'];

const ITEMS = {
  hoe: { name: 'Enxada', kind: 'tool', desc: 'Ara a terra para plantar.' },
  can: { name: 'Regador', kind: 'tool', desc: 'Rega as plantas. Encha no lago.' },
  axe: { name: 'Machado', kind: 'tool', desc: 'Corta árvores, tocos, galhos e cercas.' },
  pick: { name: 'Picareta', kind: 'tool', desc: 'Quebra pedras e minérios. Recolhe decorações e desfaz terra arada.' },
  rod: { name: 'Vara de Pesca', kind: 'tool', desc: 'Use virado para a água. Toque quando aparecer "!".' },

  seed_carrot: { name: 'Sementes de Cenoura', kind: 'seed', crop: 'carrot', price: 15 },
  seed_strawberry: { name: 'Sementes de Morango', kind: 'seed', crop: 'strawberry', price: 60 },
  seed_sunflower: { name: 'Sementes de Girassol', kind: 'seed', crop: 'sunflower', price: 25 },
  seed_corn: { name: 'Sementes de Milho', kind: 'seed', crop: 'corn', price: 30 },
  seed_tomato: { name: 'Sementes de Tomate', kind: 'seed', crop: 'tomato', price: 50 },
  seed_melon: { name: 'Sementes de Melancia', kind: 'seed', crop: 'melon', price: 80 },
  seed_pumpkin: { name: 'Sementes de Abóbora', kind: 'seed', crop: 'pumpkin', price: 100 },

  carrot: { name: 'Cenoura', kind: 'crop', sell: 40, energy: 12 },
  strawberry: { name: 'Morango', kind: 'crop', sell: 180, energy: 25 },
  sunflower: { name: 'Girassol', kind: 'crop', sell: 80, energy: 8 },
  corn: { name: 'Milho', kind: 'crop', sell: 90, energy: 18 },
  tomato: { name: 'Tomate', kind: 'crop', sell: 60, energy: 14 },
  melon: { name: 'Melancia', kind: 'crop', sell: 280, energy: 35 },
  pumpkin: { name: 'Abóbora', kind: 'crop', sell: 340, energy: 30 },

  egg: { name: 'Ovo', kind: 'animal', sell: 50, energy: 20 },
  milk: { name: 'Leite', kind: 'animal', sell: 125, energy: 30 },

  fish_sardine: { name: 'Sardinha', kind: 'fish', sell: 30, energy: 10 },
  fish_carp: { name: 'Carpa', kind: 'fish', sell: 45, energy: 12 },
  fish_tilapia: { name: 'Tilápia', kind: 'fish', sell: 65, energy: 15 },
  fish_catfish: { name: 'Bagre', kind: 'fish', sell: 120, energy: 22 },

  wood: { name: 'Madeira', kind: 'res', sell: 2 },
  stone: { name: 'Pedra', kind: 'res', sell: 2 },
  copper: { name: 'Minério de Cobre', kind: 'res', sell: 15 },
  iron: { name: 'Minério de Ferro', kind: 'res', sell: 30 },
  hay: { name: 'Feno', kind: 'res', price: 15, sell: 1, desc: 'Comida dos animais. Também sai às vezes ao arrancar mato.' },
  bait: { name: 'Isca', kind: 'res', price: 5, sell: 1, desc: 'Usada sozinha ao pescar: o peixe morde mais rápido e vêm peixes melhores.' },

  bread: { name: 'Pão', kind: 'food', price: 40, sell: 12, energy: 35 },
  soup: { name: 'Sopa de Legumes', kind: 'food', price: 90, sell: 30, energy: 75 },
  salad: { name: 'Salada', kind: 'food', sell: 150, energy: 45 },
  omelet: { name: 'Omelete', kind: 'food', sell: 170, energy: 50 },
  grilled_fish: { name: 'Peixe Assado', kind: 'food', sell: 160, energy: 55 },
  pamonha: { name: 'Pamonha', kind: 'food', sell: 330, energy: 70 },
  pumpkin_soup: { name: 'Sopa de Abóbora', kind: 'food', sell: 560, energy: 95 },
  cake: { name: 'Bolo de Morango', kind: 'food', sell: 720, energy: 120 },

  sprinkler: { name: 'Aspersor', kind: 'place', place: 'sprinkler', sell: 40, desc: 'Rega sozinho os 8 tiles em volta toda manhã.' },
  sprinkler2: { name: 'Aspersor de Ferro', kind: 'place', place: 'sprinkler2', sell: 100, desc: 'Rega sozinho uma área de 5x5 toda manhã.' },
  fence_item: { name: 'Cerca', kind: 'place', place: 'pfence', sell: 2, desc: 'Decoração. Recolha com o machado ou a picareta.' },
  stonepath: { name: 'Caminho de Pedra', kind: 'place', floor: 'stone', sell: 2, desc: 'Piso decorativo. Recolha com a picareta.' },
  flowerbed: { name: 'Canteiro de Flores', kind: 'place', place: 'flowerbed', sell: 30, desc: 'Decoração florida.' },
  lamp: { name: 'Lampião', kind: 'place', place: 'lamp', sell: 50, desc: 'Ilumina a fazenda à noite.' },
  trophy: { name: 'Troféu', kind: 'place', place: 'trophy', sell: 1, desc: 'Prêmio de campeão do festival!' },
};

const FISH = [
  { id: 'fish_sardine', w: 40, lvl: 1 }, { id: 'fish_carp', w: 30, lvl: 1 },
  { id: 'fish_tilapia', w: 20, lvl: 2 }, { id: 'fish_catfish', w: 8, lvl: 3 },
];

// Ingrediente 'fish' aceita qualquer peixe
const RECIPES = [
  { id: 'salad', ing: { carrot: 1, tomato: 1 } },
  { id: 'omelet', ing: { egg: 1, tomato: 1 } },
  { id: 'grilled_fish', ing: { fish: 1, carrot: 1 } },
  { id: 'pamonha', ing: { corn: 2, milk: 1 } },
  { id: 'pumpkin_soup', ing: { pumpkin: 1, milk: 1 } },
  { id: 'cake', ing: { strawberry: 2, egg: 1, milk: 1 } },
];

const CRAFTS = [
  { id: 'sprinkler', qty: 1, ing: { copper: 3, stone: 5 } },
  { id: 'sprinkler2', qty: 1, ing: { iron: 2, copper: 2, stone: 5 } },
  { id: 'fence_item', qty: 2, ing: { wood: 2 } },
  { id: 'stonepath', qty: 2, ing: { stone: 2 } },
  { id: 'flowerbed', qty: 1, ing: { wood: 2, sunflower: 1 } },
  { id: 'lamp', qty: 1, ing: { wood: 3, iron: 1 } },
];

const ANIMALS = {
  chicken: { name: 'Galinha', price: 400, product: 'egg', max: 4, house: 'coop' },
  cow: { name: 'Vaca', price: 1000, product: 'milk', max: 3, house: 'barn' },
};
const ANIMAL_NAMES = ['Pipoca', 'Mimosa', 'Pintada', 'Estrela', 'Bolinha', 'Cocada', 'Malhada', 'Paçoca', 'Jujuba', 'Fubá', 'Canjica', 'Tapioca'];

// Moradores. Rosa fica na barraca; Zé e Tião ficam parados nos seus cantos do mapa.
const NPCS = {
  rosa: {
    name: 'Dona Rosa', role: 'Vendedora', hours: [7, 20],
    pal: { hair: '#c8c0b8', hairD: '#a8a098', hat: '#c8c0b8', hatL: '#e0dad4', hatD: '#a8a098', band: '#e86a8a', shirt: '#f2eadc', over: '#5aa05a', overD: '#3f7f3f', shoe: '#6a4a2a' },
    loves: ['strawberry', 'cake', 'sunflower', 'flowerbed'], likes: ['bread', 'tomato', 'salad', 'egg', 'melon'], hates: ['stone', 'hay', 'bait'],
    lines: [
      ['Bem-vinda(o) ao vale! Seu avô sempre comprava sementes comigo.', 'Plante de acordo com a estação, viu? Morango só na primavera!', 'Mato cresce rápido por aqui. Arranque sempre!'],
      ['Que bom te ver! Sua fazenda está ficando linda.', 'Já experimentou cozinhar? O fogão da casa do seu avô ainda funciona.', 'Os aspersores economizam um tempão. Pergunte ao Tião!'],
      ['Você é como família pra mim, sabia?', 'Guardei as melhores sementes pra você, querida(o)!', 'Ver o vale florido de novo me enche o coração.'],
    ],
    gifts: { 3: ['seed_pumpkin', 3], 7: ['cake', 2] },
  },
  ze: {
    name: 'Seu Zé', role: 'Pescador', x: 12, y: 27, dir: 0, hours: [6, 19],
    pal: { skin: '#e0a880', hair: '#e8e8e8', hairD: '#c8c8c8', hat: '#e8c840', hatL: '#fff080', hatD: '#b89820', band: '#b89820', shirt: '#6a8aa8', over: '#4a5a6a', overD: '#343e4a', shoe: '#3a2a1a' },
    loves: ['fish_catfish', 'grilled_fish', 'pamonha'], likes: ['corn', 'fish_tilapia', 'bread', 'milk'], hates: ['sunflower', 'flowerbed'],
    lines: [
      ['Shhh... vai espantar os peixes.', 'O segredo é paciência. Quando aparecer o "!", puxa na hora!', 'Bagre só aparece pra quem já tem experiência.'],
      ['Ô, rapaz! Senta aí e pesca comigo.', 'Com isca o peixe morde bem mais rápido.', 'No verão tem o Festival da Pesca. Traga seu melhor peixe!'],
      ['Você virou um baita pescador. Tenho orgulho!', 'Esse lago guarda segredos... e uns bagres enormes.', 'Amigo de pescaria é amigo pra vida toda.'],
    ],
    gifts: { 3: ['bait', 25], 7: ['fish_catfish@2', 1] },
  },
  tiao: {
    name: 'Tião', role: 'Ferreiro', x: 36, y: 7, dir: 0, hours: [8, 18],
    pal: { skin: '#b87850', hair: '#2a1a12', hairD: '#1a0e08', hat: '#4a4a4a', hatL: '#6a6a6a', hatD: '#2a2a2a', band: '#2a2a2a', shirt: '#c84a3a', over: '#6a4a30', overD: '#4a3220', shoe: '#2a1a12' },
    loves: ['iron', 'pumpkin_soup', 'omelet'], likes: ['copper', 'milk', 'corn', 'pamonha'], hates: ['sunflower', 'strawberry'],
    lines: [
      ['Hm. Precisa de alguma coisa de metal?', 'A pedreira aqui do lado tem cobre e ferro. Pega a picareta.', 'Aspersor bom é de cobre. De ferro, então, nem se fala.'],
      ['E aí, parceiro. Trabalho honesto, né?', 'Com minério e pedra você mesmo faz um aspersor na mochila.', 'Lampião ilumina a fazenda inteira de noite. Bonito demais.'],
      ['Você é dos meus. Martelo e suor!', 'Se precisar de qualquer ferramenta, é só falar.', 'Nunca vi alguém trabalhar tanto quanto você.'],
    ],
    gifts: { 3: ['sprinkler', 2], 7: ['sprinkler2', 2] },
  },
};

const ACHIEVEMENTS = [
  { id: 'harvest1', name: 'Primeira Colheita', desc: 'Colha sua primeira planta.', test: s => s.stats.harvest >= 1 },
  { id: 'harvest100', name: 'Mão Verde', desc: 'Colha 100 plantas.', test: s => s.stats.harvest >= 100, prog: s => [s.stats.harvest, 100] },
  { id: 'fish1', name: 'Primeira Pesca', desc: 'Pesque um peixe.', test: s => s.stats.fish >= 1 },
  { id: 'catfish', name: 'O Grande Bagre', desc: 'Pesque um Bagre.', test: s => s.flags.catfish },
  { id: 'ore25', name: 'Minerador', desc: 'Encontre 25 minérios.', test: s => s.stats.ore >= 25, prog: s => [s.stats.ore, 25] },
  { id: 'gold1k', name: 'Pé-de-Meia', desc: 'Venda 1.000 💰 no total.', test: s => s.stats.earned >= 1000, prog: s => [s.stats.earned, 1000] },
  { id: 'gold10k', name: 'Fazendeiro Rico', desc: 'Venda 10.000 💰 no total.', test: s => s.stats.earned >= 10000, prog: s => [s.stats.earned, 10000] },
  { id: 'goldq', name: 'Qualidade Ouro', desc: 'Consiga um item de qualidade ouro.', test: s => s.flags.goldq },
  { id: 'animal1', name: 'Primeiro Bichinho', desc: 'Compre um animal.', test: s => s.animals.length >= 1 },
  { id: 'animal7', name: 'Fazenda Cheia', desc: 'Tenha 4 galinhas e 3 vacas.', test: s => s.animals.length >= 7, prog: s => [s.animals.length, 7] },
  { id: 'cook1', name: 'Chef da Roça', desc: 'Cozinhe uma receita.', test: s => s.stats.cooked >= 1 },
  { id: 'cookall', name: 'Mestre Cuca', desc: 'Cozinhe todas as receitas.', test: s => RECIPES.every(r => s.flags['cook_' + r.id]),
    prog: s => [RECIPES.filter(r => s.flags['cook_' + r.id]).length, RECIPES.length] },
  { id: 'quest5', name: 'Bom Vizinho', desc: 'Complete 5 pedidos do quadro.', test: s => s.stats.quests >= 5, prog: s => [s.stats.quests, 5] },
  { id: 'friend', name: 'Melhores Amigos', desc: 'Chegue a 8 corações com um morador.', test: s => Object.values(s.friends).some(v => v >= 800) },
  { id: 'sprinkler', name: 'Automação', desc: 'Coloque um aspersor.', test: s => s.flags.sprinkler },
  { id: 'champion', name: 'Campeão do Vale', desc: 'Ganhe o 1º lugar num festival.', test: s => s.flags.champion },
  { id: 'expand', name: 'Terra à Vista', desc: 'Compre a expansão da fazenda.', test: s => s.expanded },
  { id: 'level10', name: 'Lenda do Vale', desc: 'Chegue ao nível 10.', test: s => s.level >= 10, prog: s => [s.level, 10] },
];

// Festivais acontecem no dia 14 de cada estação, na praça ao lado da barraca.
const FESTIVAL_DAY = 14;
const FESTIVALS = [
  { name: 'Festa das Flores', icon: '🌻', entry: 'sunflower', desc: 'Concurso do girassol mais bonito! Traga um girassol: a qualidade decide o prêmio.' },
  { name: 'Festival da Pesca', icon: '🎣', entry: 'fish', desc: 'Quem traz o melhor peixe? Espécie e qualidade contam pontos.' },
  { name: 'Feira da Colheita', icon: '🎃', entry: 'pumpkin', desc: 'Concurso da maior abóbora do vale! A qualidade decide o prêmio.' },
  { name: 'Noite das Lanternas', icon: '🏮', entry: null, desc: 'Venha à praça depois das 18h para soltar lanternas com os vizinhos.' },
];
const FEST_PRIZES = [
  { place: '1º lugar', gold: 1000, item: 'trophy' },
  { place: '2º lugar', gold: 500 },
  { place: '3º lugar', gold: 200 },
];

// ======================================================================
// Conteúdo de fim de jogo: mina, ouro, gemas, máquinas, projetos, coleção
// ======================================================================
Object.assign(ITEMS, {
  sword: { name: 'Espada', kind: 'tool', desc: 'Para se defender dos monstros da mina.' },
  gold: { name: 'Minério de Ouro', kind: 'res', sell: 60 },
  amethyst: { name: 'Ametista', kind: 'gem', sell: 100 },
  emerald: { name: 'Esmeralda', kind: 'gem', sell: 250 },
  ruby: { name: 'Rubi', kind: 'gem', sell: 300 },
  diamond: { name: 'Diamante', kind: 'gem', sell: 750 },
  slime: { name: 'Gosma', kind: 'res', sell: 5 },
  fossil: { name: 'Fóssil', kind: 'artifact', sell: 300, desc: 'Um osso muito, muito antigo.' },
  idol: { name: 'Ídolo Antigo', kind: 'artifact', sell: 600, desc: 'Esculpido por um povo esquecido.' },
  crown: { name: 'Coroa do Rei Anão', kind: 'artifact', sell: 3000, desc: 'Tesouro do fundo da mina.' },
  fish_legend0: { name: 'Carpa Dourada', kind: 'fish', sell: 1500, energy: 40, desc: 'Lendária da primavera.' },
  fish_legend1: { name: 'Dourado Rei', kind: 'fish', sell: 2000, energy: 45, desc: 'Lendário do verão.' },
  fish_legend2: { name: 'Pirarucu', kind: 'fish', sell: 2500, energy: 50, desc: 'Lendário do outono.' },
  fish_legend3: { name: 'Peixe-Gelo', kind: 'fish', sell: 1800, energy: 40, desc: 'Lendário do inverno.' },
  juice: { name: 'Suco', kind: 'artisan', mult: 2.25, desc: 'Feito no barril.' },
  jam: { name: 'Conserva', kind: 'artisan', mult: 2, add: 50, desc: 'Feita no pote de conserva.' },
  cheese: { name: 'Queijo', kind: 'artisan', sell: 230, energy: 50 },
  mayo: { name: 'Maionese', kind: 'artisan', sell: 110, energy: 35 },
  keg: { name: 'Barril', kind: 'place', place: 'keg', sell: 50, desc: 'Transforma qualquer colheita em suco (2 dias). Vale 2,25x.' },
  jar: { name: 'Pote de Conserva', kind: 'place', place: 'jar', sell: 50, desc: 'Transforma qualquer colheita em conserva (1 dia). Vale 2x + 50.' },
  cheese_press: { name: 'Prensa de Queijo', kind: 'place', place: 'cheese_press', sell: 50, desc: 'Leite vira queijo em 4 horas.' },
  mayo_machine: { name: 'Máquina de Maionese', kind: 'place', place: 'mayo_machine', sell: 50, desc: 'Ovo vira maionese em 3 horas.' },
  sprinkler3: { name: 'Aspersor de Ouro', kind: 'place', place: 'sprinkler3', sell: 300, desc: 'Rega sozinho uma área de 7x7 toda manhã.' },
  statue: { name: 'Estátua do Vovô', kind: 'place', place: 'statue', sell: 1, desc: 'Presente do vovô. Toda manhã aparece uma gema nela.' },
});

CRAFTS.push(
  { id: 'sprinkler3', qty: 1, ing: { gold: 2, iron: 2, amethyst: 1 } },
  { id: 'keg', qty: 1, ing: { wood: 30, copper: 1, iron: 1 } },
  { id: 'jar', qty: 1, ing: { wood: 20, stone: 10, copper: 2 } },
  { id: 'cheese_press', qty: 1, ing: { wood: 25, stone: 25, copper: 3 } },
  { id: 'mayo_machine', qty: 1, ing: { wood: 15, stone: 15, copper: 1, iron: 1 } },
);

// Máquinas: o que aceitam, o que produzem e em quantas horas de jogo
const MACHINES = {
  keg: { emoji: '🛢️', hint: 'Coloque qualquer colheita para fazer suco.', accepts: id => def(id).kind === 'crop', out: id => `juice~${baseOf(id)}`, hours: 48 },
  jar: { emoji: '🫙', hint: 'Coloque qualquer colheita para fazer conserva.', accepts: id => def(id).kind === 'crop', out: id => `jam~${baseOf(id)}`, hours: 24 },
  cheese_press: { emoji: '🧀', hint: 'Coloque leite para fazer queijo.', accepts: id => baseOf(id) === 'milk', out: () => 'cheese', hours: 4 },
  mayo_machine: { emoji: '🥚', hint: 'Coloque um ovo para fazer maionese.', accepts: id => baseOf(id) === 'egg', out: () => 'mayo', hours: 3 },
};

const LEGENDS = ['fish_legend0', 'fish_legend1', 'fish_legend2', 'fish_legend3']; // um por estação
const MINE_DEPTH = 40;
// Recompensas dos baús a cada 10 andares
const MINE_CHESTS = {
  10: { gold: 500, sword: 2, items: [['gold', 5]] },
  20: { gold: 1000, items: [['sprinkler3', 2], ['emerald', 2]] },
  30: { gold: 2000, sword: 3, items: [['ruby', 3]] },
  40: { gold: 5000, items: [['crown', 1], ['diamond', 3]] },
};
const SLIMES = {
  green: { hp: 6, dmg: 8, speed: 22, xp: 5, color: ['#7ad35c', '#4caf3a', '#2f7a26'] },
  blue: { hp: 14, dmg: 14, speed: 26, xp: 10, color: ['#8ad0ff', '#4a90e0', '#2a5aa8'] },
  red: { hp: 26, dmg: 22, speed: 30, xp: 18, color: ['#ff8a80', '#e2402e', '#9a2018'] },
};

// Projetos do Vale: cestas de itens que restauram o vale. As três de colheita liberam a Estufa.
// 'goldcrop' = colheita qualidade ouro; 'juice'/'jam' = qualquer suco/conserva
const BUNDLES = [
  { id: 'spring', name: 'Cesta da Primavera', icon: '🌸', items: [['carrot', 5], ['strawberry', 3], ['sunflower', 3]], gold: 800, give: [['seed_strawberry', 10]], gh: true },
  { id: 'summer', name: 'Cesta do Verão', icon: '☀️', items: [['corn', 5], ['tomato', 5], ['melon', 2]], gold: 800, give: [['sprinkler2', 2]], gh: true },
  { id: 'fall', name: 'Cesta do Outono', icon: '🍂', items: [['pumpkin', 2], ['corn', 5], ['carrot', 5]], gold: 800, give: [['sprinkler2', 2]], gh: true },
  { id: 'fish', name: 'Cesta do Pescador', icon: '🎣', items: [['fish_sardine', 1], ['fish_carp', 1], ['fish_tilapia', 1], ['fish_catfish', 1]], gold: 500,
    perk: 'rod', perkDesc: 'Vara de Fibra: o peixe morde mais rápido e lendários aparecem mais' },
  { id: 'mine', name: 'Cesta do Minerador', icon: '⛏️', items: [['copper', 20], ['iron', 10], ['gold', 5], ['amethyst', 1]], gold: 1000,
    perk: 'miner', perkDesc: '+50 de vida máxima e elevador para qualquer andar já alcançado' },
  { id: 'artisan', name: 'Cesta do Artesão', icon: '🛢️', items: [['juice', 1], ['jam', 1], ['cheese', 1], ['mayo', 1]], gold: 1500,
    perk: 'artisan', perkDesc: 'Produtos artesanais valem +25%' },
  { id: 'quality', name: 'Cesta da Qualidade', icon: '⭐', items: [['goldcrop', 5]], gold: 2000, give: [['sprinkler3', 2]],
    perk: 'luck', perkDesc: 'Mais chance de colher com qualidade ★' },
];

// Itens da coleção (o diário marca tudo que você já conseguiu)
const COLLECTION = [
  'carrot', 'strawberry', 'sunflower', 'corn', 'tomato', 'melon', 'pumpkin', 'egg', 'milk',
  'fish_sardine', 'fish_carp', 'fish_tilapia', 'fish_catfish', ...LEGENDS,
  'copper', 'iron', 'gold', 'amethyst', 'emerald', 'ruby', 'diamond', 'fossil', 'idol', 'crown',
  'juice', 'jam', 'cheese', 'mayo',
  'bread', 'soup', 'salad', 'omelet', 'grilled_fish', 'pamonha', 'pumpkin_soup', 'cake',
];
const COLLECTION_REWARDS = [
  { pct: 25, gold: 1000 },
  { pct: 50, gold: 0, items: [['sprinkler3', 2]] },
  { pct: 75, gold: 5000 },
  { pct: 100, gold: 20000 },
];

ACHIEVEMENTS.push(
  { id: 'mine20', name: 'Explorador', desc: 'Chegue ao andar 20 da mina.', test: s => s.mineMax >= 20, prog: s => [s.mineMax, 20] },
  { id: 'mine40', name: 'Fundo da Mina', desc: 'Chegue ao andar 40 da mina.', test: s => s.mineMax >= 40, prog: s => [s.mineMax, 40] },
  { id: 'slayer', name: 'Caçador de Gosmas', desc: 'Derrote 50 monstros.', test: s => s.stats.kills >= 50, prog: s => [s.stats.kills, 50] },
  { id: 'legend', name: 'Pescador Lendário', desc: 'Pesque um peixe lendário.', test: s => LEGENDS.some(l => s.found[l]) },
  { id: 'artisan10', name: 'Artesão', desc: 'Produza 10 itens artesanais.', test: s => s.stats.artisan >= 10, prog: s => [s.stats.artisan, 10] },
  { id: 'greenhouse', name: 'Estufa', desc: 'Restaure a estufa.', test: s => s.greenhouse },
  { id: 'vale', name: 'Vale Restaurado', desc: 'Complete todos os Projetos do Vale.', test: s => BUNDLES.every(b => s.bundles[b.id] && s.bundles[b.id].done) },
  { id: 'collector', name: 'Colecionador', desc: 'Complete a coleção.', test: s => COLLECTION.every(i => s.found[i]),
    prog: s => [COLLECTION.filter(i => s.found[i]).length, COLLECTION.length] },
  { id: 'candles', name: 'Orgulho do Vovô', desc: 'Receba 4 velas na avaliação do vovô.', test: s => s.bestCandles >= 4 },
  { id: 'level20', name: 'Lenda Viva', desc: 'Chegue ao nível 20.', test: s => s.level >= 20, prog: s => [s.level, 20] },
);
