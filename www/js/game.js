'use strict';
/*
 * Vale Florido — lógica principal: cenas (fazenda, estufa, mina), tempo, jogador, ações, animais,
 * moradores, pedidos, projetos, festivais, combate e renderização. O conteúdo fica em data.js.
 *
 * Core loop: limpar/preparar o solo -> plantar e regar -> esperar os dias ->
 * colher -> vender na Caixa de Envio -> melhorar ferramentas / expandir.
 */
const TS = 16, FW = 52, FH = 40, GH_W = 12, GH_H = 10;
let MW = FW, MH = FH; // tamanho da cena atual
const G_GRASS = 0, G_PATH = 1, G_PLANK = 2, G_WATER = 3, G_STONE = 4, G_CAVE = 5, G_WALL = 6, G_EXIT = 7;
const SEASONS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
const DAYS_PER_SEASON = 28;
const DAY_START = 6 * 60, PASS_OUT = 26 * 60; // 06:00 e 02:00 do dia seguinte
const ANIMALS_IN = 19 * 60; // animais entram às 19h
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // baixo, cima, esquerda, direita
const SAVE_KEY = 'valeflorido_save_v1';
const SPEED = 70; // pixels de arte por segundo
const QMULT = [1, 1.25, 1.5]; // normal, prata, ouro
const QNAME = ['', ' (prata)', ' (ouro)'];
const MAX_LEVEL = 20;
const GEMS = ['amethyst', 'emerald', 'ruby', 'diamond'];

// Poder das ferramentas por nível (índice = nível)
const HOE_TILES = [1, 1, 3, 5], CAN_TILES = [1, 1, 3, 5], CAN_CAP = [0, 20, 40, 70];
const AXE_DMG = [0, 1, 2, 4], PICK_DMG = [0, 1, 2, 4], SWORD_DMG = [0, 3, 6, 11];

const HP = { tree: 4, stump: 3, rock: 2, copper: 3, iron: 4, gold: 5, gem: 4, weed: 1, branch: 1, pine: 999, fence: 999 };
const ROCKS = ['rock', 'copper', 'iron', 'gold'];
const isRock = t => ROCKS.includes(t) || t.startsWith('gem_');
// Objetos colocados que voltam para a mochila ao serem recolhidos
const PICKUP = {
  sprinkler: 'sprinkler', sprinkler2: 'sprinkler2', sprinkler3: 'sprinkler3', lamp: 'lamp', flowerbed: 'flowerbed', trophy: 'trophy',
  pfence: 'fence_item', keg: 'keg', jar: 'jar', cheese_press: 'cheese_press', mayo_machine: 'mayo_machine', statue: 'statue',
};
const SPRINKLER_R = { sprinkler: 1, sprinkler2: 2, sprinkler3: 3 };

const HOUSE = { x: 5, y: 3, w: 5, h: 4, door: { x: 7, y: 6 } };
const BIN = { x: 10, y: 6, w: 2, h: 1 };
const STALL = { x: 19, y: 5, w: 3, h: 2 };
const BOARD = { x: 17, y: 6, w: 1, h: 1 };
const ALTAR = { x: 13, y: 6, w: 1, h: 1 };
const COOP = { x: 3, y: 10, w: 3, h: 2, pen: { x0: 3, y0: 12, x1: 6, y1: 15 } };
const BARN = { x: 3, y: 18, w: 4, h: 3, pen: { x0: 3, y0: 21, x1: 6, y1: 25 } };
const FEST = { x: 22, y: 5, w: 3, h: 2 };
const MINE_ENT = { x: 43, y: 3, w: 3, h: 2, door: { x: 44, y: 4 } };
const GH_B = { x: 27, y: 4, w: 5, h: 4, door: { x: 29, y: 7 } };
const QUARRY = { x0: 37, y0: 3, x1: 48, y1: 10 };
const EXP = { x0: 36, y0: 12, x1: 48, y1: 37 };
const WAKE = { x: 7 * TS + 8, y: 7 * TS + 12 };

const TOOL_UPS = [
  ['hoe', 2, 'Enxada de Ferro', 'Ara 3 tiles em linha de uma vez.', 400, { copper: 5 }],
  ['hoe', 3, 'Enxada de Ouro', 'Ara 5 tiles em linha de uma vez.', 2000, { gold: 5 }],
  ['can', 2, 'Regador de Ferro', 'Guarda 40 de água e rega 3 tiles em linha.', 400, { copper: 5 }],
  ['can', 3, 'Regador de Ouro', 'Guarda 70 de água e rega 5 tiles em linha.', 2000, { gold: 5 }],
  ['axe', 2, 'Machado de Ferro', 'Dano dobrado em árvores e tocos.', 350, { iron: 3 }],
  ['axe', 3, 'Machado de Ouro', 'Derruba árvores num instante.', 1500, { gold: 5 }],
  ['pick', 2, 'Picareta de Ferro', 'Quebra pedras mais rápido e encontra mais minério.', 350, { iron: 3 }],
  ['pick', 3, 'Picareta de Ouro', 'Quebra quase tudo de uma vez e acha ainda mais minério.', 1500, { gold: 5 }],
  ['sword', 2, 'Espada de Ferro', 'Dano 6 nos monstros da mina.', 1000, { iron: 5 }],
  ['sword', 3, 'Espada de Ouro', 'Dano 11 nos monstros da mina.', 3000, { gold: 5 }],
];
const UPGRADES = [
  ...TOOL_UPS.map(([tool, lvl, name, desc, cost, mats]) => ({
    id: tool + lvl, shop: 'tiao', name, desc, cost, mats, icon: tool + lvl + (tool === 'can' ? 'f' : ''),
    need: () => S.tools[tool] >= lvl - 1, have: () => S.tools[tool] >= lvl,
    apply: () => { S.tools[tool] = lvl; if (tool === 'can') S.water = waterCap(); },
  })),
  { id: 'coop', shop: 'rosa', name: 'Galinheiro', icon: 'egg', desc: 'Casa para até 4 galinhas, a oeste da sua casa.', cost: 600, mats: { wood: 40, stone: 10 },
    have: () => S.coop, apply: () => buildAnimalHouse('coop') },
  { id: 'barn', shop: 'rosa', name: 'Estábulo', icon: 'milk', desc: 'Casa para até 3 vacas, perto do lago.', cost: 1500, mats: { wood: 80, stone: 30 },
    have: () => S.barn, apply: () => buildAnimalHouse('barn') },
  { id: 'bag1', shop: 'rosa', name: 'Mochila Maior', icon: 'crate', desc: '+6 espaços no inventário.', cost: 500, mats: {},
    have: () => S.bag >= 18, apply: () => growBag(18) },
  { id: 'bag2', shop: 'rosa', name: 'Mochila de Couro', icon: 'crate', desc: '+6 espaços no inventário.', cost: 1500, mats: {},
    need: () => S.bag >= 18, have: () => S.bag >= 24, apply: () => growBag(24) },
  { id: 'bag3', shop: 'rosa', name: 'Mochila do Aventureiro', icon: 'crate', desc: '+6 espaços no inventário.', cost: 5000, mats: { slime: 30 },
    need: () => S.bag >= 24, have: () => S.bag >= 30, apply: () => growBag(30) },
  { id: 'expand', shop: 'rosa', name: 'Expansão da Fazenda', icon: 'wood', desc: 'Remove a cerca a leste e libera um terreno novo.', cost: 1500, mats: { wood: 50 },
    have: () => S.expanded, apply: () => expandFarm() },
];

// ---------------------------------------------------------------- utilidades
const key = (x, y) => x + ',' + y;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pickOne = a => a[Math.random() * a.length | 0];
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const fmtTime = m => { const h = Math.floor(m / 60) % 24, mm = Math.floor(m % 60 / 10) * 10; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
const inRect = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

// Ids de item: "base@q" (qualidade 1 prata, 2 ouro); artesanais levam a origem: "juice~melon"
const baseOf = id => id.split('@')[0];
const qualOf = id => +(id.split('@')[1] || 0);
const withQ = (id, q) => (q ? `${id}@${q}` : id);
const kindOf = id => baseOf(id).split('~')[0];
const srcOf = id => baseOf(id).split('~')[1];
const def = id => ITEMS[kindOf(id)];
const nameOf = id => (srcOf(id) ? `${def(id).name} de ${ITEMS[srcOf(id)].name}` : def(id).name) + QNAME[qualOf(id)];
function sellOf(id) {
  const d = def(id), src = srcOf(id);
  let v = src ? ITEMS[src].sell * d.mult + (d.add || 0) : (d.sell || 0);
  if (d.kind === 'artisan' && S.perks.artisan) v *= 1.25;
  return Math.round(v * QMULT[qualOf(id)]);
}
const energyOf = id => Math.round((srcOf(id) ? ITEMS[srcOf(id)].energy * 1.5 : (def(id).energy || 0)) * QMULT[qualOf(id)]);
function matches(id, want) {
  if (want === 'fish') return def(id).kind === 'fish';
  if (want === 'goldcrop') return def(id).kind === 'crop' && qualOf(id) === 2;
  if (want === 'juice' || want === 'jam') return kindOf(id) === want;
  return baseOf(id) === want;
}
const ingName = id => ({ fish: 'Peixe (qualquer)', goldcrop: 'Colheita ★ ouro (qualquer)', juice: 'Suco (qualquer)', jam: 'Conserva (qualquer)' }[id] || ITEMS[id].name);
const ingIcon = id => ({ fish: 'fish_carp', goldcrop: 'pumpkin', juice: 'juice~strawberry', jam: 'jam~tomato' }[id] || id);

// ---------------------------------------------------------------- estado
let S = null;   // estado salvo (fazenda, inventário, data...)
let P = null;   // jogador em tempo real
let scene = 'farm';
let ground = [], farmGround = [], ghGround = [];
let OBJS = {}, FARM = {}, FLOOR = {}; // objetos, terra arada e pisos da cena atual
let mine = null; // andar atual da mina (não é salvo)
let particles = [], floaters = [], rain = [];
let animRT = {}; // posição dos animais na tela (não é salva)
let fishing = null;
let sleeping = false, transitioning = false;
let zoom = 4, camX = 0, camY = 0, viewW = 0, viewH = 0;
let lastT = 0, clock = 0, achTimer = 0;
const input = { keys: new Set(), joy: null, actionHeld: false, lastAction: 0 };

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');

function buildGround() {
  farmGround = [];
  for (let y = 0; y < FH; y++) farmGround.push(new Array(FW).fill(G_GRASS));
  const g = farmGround;
  for (let y = QUARRY.y0; y <= QUARRY.y1; y++) for (let x = QUARRY.x0; x <= QUARRY.x1; x++) g[y][x] = G_STONE;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const dx = (x - 10) / 5.2, dy = (y - 31) / 3.6;
    if (dx * dx + dy * dy <= 1) g[y][x] = G_WATER;
  }
  for (let x = 7; x <= 37; x++) g[8][x] = G_PATH;
  for (let y = 7; y <= 27; y++) g[y][7] = G_PATH;
  for (let x = 8; x <= 10; x++) g[27][x] = G_PATH;
  for (let y = 28; y <= 31; y++) g[y][10] = G_PLANK;
  // estufa: paredes de vidro, chão de terra e porta embaixo
  ghGround = [];
  for (let y = 0; y < GH_H; y++) {
    const row = [];
    for (let x = 0; x < GH_W; x++) {
      const wall = y === 0 || x === 0 || x === GH_W - 1 || y === GH_H - 1;
      row.push(y === GH_H - 1 && (x === 5 || x === 6) ? G_EXIT : wall ? G_WALL : G_GRASS);
    }
    ghGround.push(row);
  }
  ground = farmGround;
}

function setScene(name, x, y, dir) {
  scene = name;
  if (name === 'farm') { ground = farmGround; MW = FW; MH = FH; OBJS = S.objs; FARM = S.farm; FLOOR = S.floor; }
  else if (name === 'gh') { ground = ghGround; MW = GH_W; MH = GH_H; OBJS = S.ghObjs; FARM = S.ghFarm; FLOOR = S.ghFloor; }
  else { ground = mine.ground; MW = mine.w; MH = mine.h; OBJS = mine.objs; FARM = {}; FLOOR = {}; }
  if (P && x != null) { P.x = x; P.y = y; P.dir = dir; P.path = null; P.pathEnd = null; P.busy = false; P.anim = 'idle'; }
  fishing = null; particles = []; floaters = [];
}

const festivalToday = () => !!S && S.day === FESTIVAL_DAY;
function structs() {
  if (scene !== 'farm') return [];
  const a = [HOUSE, BIN, STALL, BOARD, ALTAR, MINE_ENT];
  if (S) {
    if (S.coop) a.push(COOP);
    if (S.barn) a.push(BARN);
    if (S.greenhouse) a.push(GH_B);
    if (festivalToday()) a.push(FEST);
  }
  return a;
}
const structAt = (x, y) => structs().find(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) || null;
const obj = (x, y) => OBJS[key(x, y)];
const farmTile = (x, y) => FARM[key(x, y)];
const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
const npcAt = (x, y) => (scene === 'farm' ? Object.keys(NPCS).find(id => NPCS[id].x === x && NPCS[id].y === y) || null : null);
const inPen = (x, y) => scene === 'farm' && ((S.coop && inRect(COOP.pen, x, y)) || (S.barn && inRect(BARN.pen, x, y)));

function isBlocked(x, y) {
  if (!inMap(x, y)) return true;
  const g = ground[y][x];
  if (g === G_WATER || g === G_WALL) return true;
  return !!(obj(x, y) || structAt(x, y) || npcAt(x, y));
}

function newFarmTile(x, y) {
  return { tile_x: x, tile_y: y, is_tilled: true, is_watered: false, crop_type: null, growth_stage: 0, days_planted: 0, dry_days: 0, dead: false };
}

function genObjects(s) {
  const r = rng(20261023), g = farmGround;
  const put = (x, y, t) => { s.objs[key(x, y)] = { t, hp: HP[t] }; };
  const free = (x, y) => g[y][x] === G_GRASS && !s.objs[key(x, y)];
  const reserved = (x, y) => (y <= 9 && x <= 24) || (x >= 12 && x <= 17 && y >= 9 && y <= 13) ||
    (Math.abs(x - 7) <= 1 && y <= 28) || (y === 7 || y === 9) && x <= 37;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (x < 2 || y < 2 || x >= FW - 2 || y >= FH - 2) { if (g[y][x] !== G_PATH) put(x, y, 'pine'); continue; }
    const ring = x <= 2 || y <= 2 || x >= FW - 3 || y >= FH - 3;
    if (ring && free(x, y) && r() < 0.5 && !(x <= 12 && y <= 9)) put(x, y, 'pine');
  }
  for (let y = 11; y <= 37; y++) put(35, y, 'fence');
  for (let x = 36; x <= 48; x++) put(x, 11, 'fence');
  for (let y = 3; y < FH - 2; y++) for (let x = 3; x < FW - 3; x++) {
    if (!free(x, y) || reserved(x, y)) continue;
    const exp = x >= EXP.x0 && y >= EXP.y0;
    const north = y <= 9 && x > 24;
    const v = r();
    let t = null;
    if (north) t = v < 0.12 ? 'tree' : v < 0.2 ? 'weed' : v < 0.24 ? 'rock' : null;
    else if (exp) t = v < 0.14 ? 'weed' : v < 0.21 ? 'rock' : v < 0.26 ? 'branch' : v < 0.33 ? 'tree' : null;
    else t = v < 0.12 ? 'weed' : v < 0.17 ? 'rock' : v < 0.22 ? 'branch' : v < 0.25 ? 'tree' : v < 0.26 ? 'stump' : null;
    if (t) put(x, y, t);
  }
  for (let y = QUARRY.y0; y <= QUARRY.y1; y++) for (let x = QUARRY.x0; x <= QUARRY.x1; x++) {
    if (g[y][x] === G_STONE && !s.objs[key(x, y)] && r() < 0.4) put(x, y, oreRoll(r, 1));
  }
}

function oreRoll(r, pickLvl) {
  const v = r();
  const bonus = pickLvl >= 2 ? 0.06 : 0;
  return v < 0.05 + bonus ? 'iron' : v < 0.2 + bonus * 2 ? 'copper' : 'rock';
}

function newState() {
  const s = {
    v: 1, day: 1, season: 0, year: 1, time: DAY_START, gold: 250, energy: 100, level: 1, xp: 0,
    bag: 12, inv: [], sel: 0, tools: { hoe: 1, can: 1, axe: 1, pick: 1, sword: 1 }, water: 20,
    farm: {}, objs: {}, bin: [], expanded: false, weather: 'sun',
    px: WAKE.x, py: WAKE.y, dir: 0, seenIntro: false,
  };
  s.inv = new Array(s.bag).fill(null);
  [['hoe', 1], ['can', 1], ['seed_carrot', 12], ['axe', 1], ['pick', 1], ['rod', 1]]
    .forEach(([id, qty], i) => { s.inv[i] = { id, qty }; });
  genObjects(s);
  for (let x = 13; x <= 15; x++) for (let y = 10; y <= 11; y++) s.farm[key(x, y)] = newFarmTile(x, y);
  return migrate(s);
}

// Completa saves antigos com os campos das versões novas
function migrate(s) {
  const d = {
    stats: {}, flags: {}, ach: {}, floor: {}, animals: [], coop: false, barn: false,
    friends: {}, talked: {}, gifted: {}, npcGifts: {}, quests: [], festDone: '', nextId: 1,
    ghFarm: {}, ghObjs: {}, ghFloor: {}, greenhouse: false, bundles: {}, perks: {}, found: {}, colRewards: {},
    mineMax: 0, mineChests: {}, hp: 100, bestCandles: 0, evalKey: '', lastEval: null, ending: false,
  };
  for (const k in d) if (s[k] === undefined) s[k] = d[k];
  for (const k of ['harvest', 'fish', 'ore', 'earned', 'cooked', 'quests', 'kills', 'artisan']) if (s.stats[k] === undefined) s.stats[k] = 0;
  if (!s.tools.sword) s.tools.sword = 1;
  for (const id in NPCS) if (s.friends[id] === undefined) s.friends[id] = 0;
  for (const it of s.inv) if (it) s.found[kindOf(it.id)] = true;
  // garante que nada bloqueie moradores, quadro, santuário e a entrada da mina
  const clear = [[BOARD.x, BOARD.y], [BOARD.x, BOARD.y + 1], [ALTAR.x, ALTAR.y], [ALTAR.x, ALTAR.y + 1], [MINE_ENT.door.x, MINE_ENT.door.y + 1]];
  for (const id in NPCS) if (NPCS[id].x != null) clear.push([NPCS[id].x, NPCS[id].y]);
  for (let y = MINE_ENT.y; y < MINE_ENT.y + MINE_ENT.h; y++) for (let x = MINE_ENT.x; x < MINE_ENT.x + MINE_ENT.w; x++) clear.push([x, y]);
  for (const [x, y] of clear) { delete s.objs[key(x, y)]; delete s.farm[key(x, y)]; delete s.floor[key(x, y)]; }
  return s;
}

function newPlayer() {
  return { x: S.px, y: S.py, dir: S.dir || 0, anim: 'idle', frame: 0, animT: 0, invuln: 0,
    busy: false, actT: 0, dur: 0, frameDur: 0.11, frames: 1, hitAt: null, onHit: null, path: null, pathEnd: null };
}

const maxEnergy = () => 100 + (S.level - 1) * 5;
const maxHP = () => 100 + (S.level - 1) * 3 + (S.perks.miner ? 50 : 0);
const waterCap = () => CAN_CAP[S.tools.can];
const xpNeed = l => (l < 10 ? l * 100 : 1000 + (l - 9) * 300);
const playerTile = () => [Math.floor(P.x / TS), Math.floor((P.y - 3) / TS)];
const targetTile = () => { const [x, y] = playerTile(), v = DIRV[P.dir]; return [x + v[0], y + v[1]]; };
const selItem = () => S.inv[S.sel] || null;
const hearts = id => Math.floor(S.friends[id] / 100);
const discount = id => (hearts(id) >= 5 ? 0.9 : 1);
const dayIndex = () => (S.year - 1) * 112 + S.season * 28 + (S.day - 1);
const absMin = () => dayIndex() * 1440 + S.time;

function iconId(id) {
  switch (id) {
    case 'hoe': return 'hoe' + S.tools.hoe;
    case 'can': return 'can' + S.tools.can + (S.water > 0 ? 'f' : '');
    case 'axe': return 'axe' + S.tools.axe;
    case 'pick': return 'pick' + S.tools.pick;
    case 'sword': return 'sword' + S.tools.sword;
    default: return baseOf(id);
  }
}

// ---------------------------------------------------------------- inventário
function addItem(id, qty = 1) {
  const tool = def(id).kind === 'tool';
  S.found[kindOf(id)] = true;
  if (qualOf(id) === 2) S.flags.goldq = true;
  if (!tool) for (const it of S.inv) if (it && it.id === id) { it.qty += qty; UI.refresh(); return 0; }
  const i = S.inv.findIndex(v => !v);
  if (i < 0) { UI.refresh(); return qty; }
  S.inv[i] = { id, qty };
  UI.refresh();
  return 0;
}
// Contagem/remoção pelo item base (qualquer qualidade); veja matches() para os grupos
const countItem = want => S.inv.reduce((n, it) => n + (it && matches(it.id, want) ? it.qty : 0), 0);
function removeItem(want, qty) {
  const slots = S.inv.map((it, i) => ({ it, i })).filter(o => o.it && matches(o.it.id, want))
    .sort((a, b) => qualOf(a.it.id) - qualOf(b.it.id)); // gasta primeiro a qualidade mais baixa
  for (const { it, i } of slots) {
    if (qty <= 0) break;
    const take = Math.min(qty, it.qty);
    it.qty -= take; qty -= take;
    if (it.qty <= 0) S.inv[i] = null;
  }
  UI.refresh();
}
function removeAt(i, qty = 1) {
  const it = S.inv[i];
  if (!it) return;
  it.qty -= qty;
  if (it.qty <= 0) S.inv[i] = null;
  UI.refresh();
}
const hasRoom = id => S.inv.some(v => !v || (v.id === id && def(id).kind !== 'tool'));
const hasAll = ing => Object.entries(ing).every(([id, q]) => countItem(id) >= q);
function growBag(n) { while (S.inv.length < n) S.inv.push(null); S.bag = n; }
function expandFarm() {
  S.expanded = true;
  for (const k of Object.keys(S.objs)) if (S.objs[k].t === 'fence') delete S.objs[k];
}
function giveAll(list) {
  for (const [id, q] of list || []) if (addItem(id, q)) { S.bin.push({ id, qty: q }); UI.toast(`🎒 Mochila cheia: ${nameOf(id)} foi para a Caixa de Envio.`); }
}

function addXP(n) {
  if (S.level >= MAX_LEVEL) return;
  S.xp += n;
  while (S.level < MAX_LEVEL && S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++;
    S.energy = Math.min(maxEnergy(), S.energy + 20);
    S.hp = Math.min(maxHP(), S.hp + 20);
    Sound.play('level');
    UI.toast(`⭐ Subiu para o nível ${S.level}! Energia +5 e vida +3`);
  }
  if (S.level >= MAX_LEVEL) S.xp = 0;
}

function rollQuality(bonus = 0) {
  const r = Math.random(), g = 0.02 + S.level * 0.01 + bonus, s = 0.1 + S.level * 0.02 + bonus;
  return r < g ? 2 : r < g + s ? 1 : 0;
}

// ---------------------------------------------------------------- partículas
function burst(tx, ty, colors, n = 8, up = 40) {
  for (let i = 0; i < n; i++) {
    particles.push({ x: tx * TS + 8 + (Math.random() - 0.5) * 8, y: ty * TS + 10, vx: (Math.random() - 0.5) * 50,
      vy: -Math.random() * up - 10, life: 0.5 + Math.random() * 0.3, c: colors[i % colors.length], s: Math.random() < 0.5 ? 1 : 2 });
  }
}
function floatText(wx, wy, text, icon, color) { floaters.push({ x: wx, y: wy, text, icon, color, life: 1.2 }); }

// ---------------------------------------------------------------- ações com ferramentas
function startAnim(anim, frames, frameDur, hitFrame, onHit) {
  P.anim = anim; P.frames = frames; P.frameDur = frameDur; P.frame = 0; P.actT = 0;
  P.dur = frames * frameDur + 0.04; P.busy = true;
  P.hitAt = hitFrame == null ? null : hitFrame * frameDur; P.onHit = onHit || null;
  P.path = null;
}

function spend(cost) {
  if (S.energy < cost) {
    Sound.play('error');
    UI.toast('😫 Você está exausto! Coma algo ou vá dormir.');
    return false;
  }
  S.energy = Math.max(0, S.energy - cost);
  return true;
}

function lineTiles(n) {
  const [tx, ty] = targetTile(), v = DIRV[P.dir], out = [];
  for (let i = 0; i < n; i++) out.push([tx + v[0] * i, ty + v[1] * i]);
  return out;
}

function canTill(x, y) {
  return scene !== 'mine' && inMap(x, y) && ground[y][x] === G_GRASS && !obj(x, y) && !structAt(x, y) && !farmTile(x, y) &&
    !FLOOR[key(x, y)] && !inPen(x, y) && !npcAt(x, y);
}

function useHoe() {
  if (!spend(1 + S.tools.hoe)) return;
  startAnim('hoe', 3, 0.11, 2, () => {
    let done = 0;
    for (const [x, y] of lineTiles(HOE_TILES[S.tools.hoe])) {
      if (!canTill(x, y)) continue;
      FARM[key(x, y)] = newFarmTile(x, y);
      burst(x, y, ['#8f5d2e', '#6e4420', '#a8703c'], 7);
      done++;
    }
    if (done) Sound.play('hoe'); else Sound.play('swing');
  });
}

function useCan() {
  const [tx, ty] = targetTile();
  if (inMap(tx, ty) && ground[ty][tx] === G_WATER) {
    startAnim('water', 3, 0.12, 2, () => {
      S.water = waterCap();
      Sound.play('splash');
      burst(tx, ty, ['#8ad0ff', '#e8f6ff'], 10, 60);
      UI.toast('💧 Regador cheio!');
      UI.refresh();
    });
    return;
  }
  if (S.water <= 0) { Sound.play('error'); UI.toast('O regador está vazio! Encha no lago 💧'); return; }
  if (!spend(1)) return;
  startAnim('water', 3, 0.12, 2, () => {
    let any = false;
    for (const [x, y] of lineTiles(CAN_TILES[S.tools.can])) {
      if (S.water <= 0) break;
      const ft = farmTile(x, y);
      burst(x, y, ['#4aa8f0', '#8ad0ff'], 6, 20);
      if (ft && !ft.is_watered) { ft.is_watered = true; S.water--; any = true; }
    }
    if (!any) S.water = Math.max(0, S.water - 1);
    Sound.play('water');
    UI.refresh();
  });
}

function pickupDecor(tx, ty, o) {
  if (MACHINES[o.t] && o.input) { UI.toast('Espere a máquina terminar antes de recolher.'); return; }
  delete OBJS[key(tx, ty)];
  gain(PICKUP[o.t], 1, tx, ty);
  burst(tx, ty, ['#c89a62', '#8994a0'], 6);
  Sound.play('plant');
}

function useAxe() {
  const [tx, ty] = targetTile();
  const o = inMap(tx, ty) ? obj(tx, ty) : null;
  if (o && o.t === 'pine') { UI.toast('🌲 Essa árvore da floresta é grande demais para cortar.'); return; }
  if (o && o.t === 'pfence') { startAnim('axe', 3, 0.11, 2, () => pickupDecor(tx, ty, o)); return; }
  if (!spend(3)) return;
  startAnim('axe', 3, 0.11, 2, () => {
    const o2 = obj(tx, ty);
    if (!o2 || !['tree', 'stump', 'branch'].includes(o2.t)) { Sound.play('swing'); return; }
    o2.hp -= AXE_DMG[S.tools.axe];
    Sound.play('chop');
    burst(tx, ty, ['#c89a62', '#7a4c28', '#4caf3a'], 8);
    if (o2.hp > 0) return;
    if (o2.t === 'tree') {
      OBJS[key(tx, ty)] = { t: 'stump', hp: HP.stump };
      gain('wood', 4 + (Math.random() * 3 | 0), tx, ty); addXP(4);
    } else {
      delete OBJS[key(tx, ty)];
      gain('wood', o2.t === 'stump' ? 3 : 1, tx, ty); addXP(o2.t === 'stump' ? 3 : 1);
    }
  });
}

function usePick() {
  const [tx, ty] = targetTile();
  const o0 = inMap(tx, ty) ? obj(tx, ty) : null;
  if (o0 && PICKUP[o0.t]) { startAnim('pick', 3, 0.11, 2, () => pickupDecor(tx, ty, o0)); return; }
  if (!spend(3)) return;
  startAnim('pick', 3, 0.11, 2, () => {
    const o = inMap(tx, ty) ? obj(tx, ty) : null;
    if (o && isRock(o.t)) {
      o.hp -= PICK_DMG[S.tools.pick];
      Sound.play('rock');
      burst(tx, ty, ['#bab6b0', '#76726c', '#d8d4ce'], 8);
      if (o.hp > 0) return;
      delete OBJS[key(tx, ty)];
      breakRock(o, tx, ty);
      return;
    }
    const ft = inMap(tx, ty) ? farmTile(tx, ty) : null;
    if (ft && !ft.crop_type) { delete FARM[key(tx, ty)]; Sound.play('hoe'); burst(tx, ty, ['#6dbf3e', '#8f5d2e'], 6); return; }
    if (inMap(tx, ty) && FLOOR[key(tx, ty)] && !o) {
      delete FLOOR[key(tx, ty)];
      gain('stonepath', 1, tx, ty); Sound.play('rock');
      return;
    }
    Sound.play('swing');
  });
}

// Drops de pedras, minérios e gemas (na fazenda e na mina)
function breakRock(o, tx, ty) {
  if (o.t === 'rock') gain('stone', 1 + (Math.random() * 2 | 0), tx, ty);
  if (o.t.startsWith('gem_')) {
    gain(o.t.slice(4), 1, tx, ty); S.stats.ore++; addXP(15);
    burst(tx, ty, ['#ffffff', '#c86ad8', '#8ad0ff'], 10, 50);
  } else if (o.t !== 'rock') { gain(o.t, 1 + (S.tools.pick >= 3 && Math.random() < 0.3 ? 1 : 0), tx, ty); S.stats.ore++; addXP(o.t === 'gold' ? 14 : 10); }
  else addXP(scene === 'mine' ? 2 : 3);
  if (scene === 'mine') {
    if (o.t === 'rock') {
      const r = Math.random();
      if (r < 0.006) gain('fossil', 1, tx, ty);
      else if (mine.floor >= 15 && r < 0.01) gain('idol', 1, tx, ty);
    }
    mine.broken++;
    maybeLadder(tx, ty, 0.06 + mine.broken / Math.max(1, mine.total) * 0.25);
  }
}

function gain(id, qty, tx, ty) {
  const left = addItem(id, qty);
  if (left < qty) floatText(tx * TS + 8, ty * TS, `+${qty - left}`, iconId(id));
  if (left) UI.toast('🎒 Mochila cheia!');
}

function pickDebris(tx, ty, o) {
  startAnim('harvest', 2, 0.12, 1, () => {
    delete OBJS[key(tx, ty)];
    if (o.t === 'branch') gain('wood', 1, tx, ty);
    if (o.t === 'weed' && Math.random() < 0.35) gain('hay', 1, tx, ty);
    burst(tx, ty, o.t === 'weed' ? ['#4f9a2c', '#7ad35c'] : ['#7a4c28', '#c89a62'], 6);
    Sound.play('plant');
  });
}

function plant(tx, ty, it) {
  const ft = farmTile(tx, ty);
  if (!ft) { UI.toast('Use a enxada para arar a terra antes de plantar.'); return; }
  if (ft.crop_type) return;
  const crop = CROPS[def(it.id).crop];
  if (scene !== 'gh' && !crop.seasons.includes(S.season)) {
    Sound.play('error');
    UI.toast(S.season === 3 ? '❄️ Nada cresce lá fora no inverno. Na estufa pode!'
      : `🌱 ${crop.name} só cresce no ${crop.seasons.map(s => SEASONS[s]).join(' e no ')}.`);
    return;
  }
  Object.assign(ft, { crop_type: def(it.id).crop, growth_stage: 1, days_planted: 0, dry_days: 0, dead: false });
  removeAt(S.sel, 1);
  Sound.play('plant');
  burst(tx, ty, ['#6e4420', '#a8703c'], 4, 15);
  startAnim('harvest', 2, 0.08, null);
}

function harvest(tx, ty) {
  const ft = farmTile(tx, ty), crop = CROPS[ft.crop_type];
  if (!S.inv.some(v => !v || baseOf(v.id) === crop.item)) { Sound.play('error'); UI.toast('🎒 Mochila cheia!'); return; }
  startAnim('harvest', 2, 0.13, 1, () => {
    const qty = 1 + (Math.random() < S.level * 0.03 ? 1 : 0);
    const id = withQ(crop.item, rollQuality(S.perks.luck ? 0.04 : 0));
    gain(id, qty, tx, ty);
    if (qualOf(id)) floatText(tx * TS + 8, ty * TS - 10, qualOf(id) === 2 ? '★ Ouro!' : '★ Prata');
    addXP(crop.xp);
    S.stats.harvest += qty;
    Sound.play('pop');
    burst(tx, ty, ['#ffe14a', '#ffffff', '#7ad35c'], 10, 50);
    if (crop.regrow) { ft.days_planted = crop.days - crop.regrow; ft.growth_stage = stageFor(ft); }
    else Object.assign(ft, { crop_type: null, growth_stage: 0, days_planted: 0, dry_days: 0 });
  });
}

function clearDead(tx, ty) {
  startAnim('harvest', 2, 0.12, 1, () => {
    Object.assign(farmTile(tx, ty), { crop_type: null, growth_stage: 0, days_planted: 0, dry_days: 0, dead: false });
    burst(tx, ty, ['#9a8458', '#76603c'], 6);
    Sound.play('plant');
  });
}

function eat(i) {
  const it = S.inv[i];
  if (!it) return;
  if (S.energy >= maxEnergy() && S.hp >= maxHP()) { UI.toast('Você já está com a energia e a vida cheias.'); return; }
  const e = energyOf(it.id);
  const gainE = Math.min(e, maxEnergy() - S.energy), gainH = Math.min(e, maxHP() - S.hp);
  S.energy += gainE; S.hp += gainH;
  removeAt(i, 1);
  Sound.play('eat');
  floatText(P.x, P.y - 30, gainE > 0 ? `+${Math.round(gainE)} ⚡` : `+${Math.round(gainH)} ❤`, null, gainE > 0 ? null : '#ff6b8a');
}

// --- colocar decorações, aspersores e máquinas
function placeItem(tx, ty) {
  if (scene === 'mine') { UI.toast('Não dá para construir na mina.'); return; }
  const it = selItem(), d = def(it.id), k = key(tx, ty);
  const [px, py] = playerTile();
  const ft = inMap(tx, ty) ? farmTile(tx, ty) : null;
  let ok;
  if (d.floor) ok = inMap(tx, ty) && ground[ty][tx] === G_GRASS && !obj(tx, ty) && !ft && !FLOOR[k] && !structAt(tx, ty) && !npcAt(tx, ty);
  else ok = inMap(tx, ty) && !isBlocked(tx, ty) && [G_GRASS, G_PATH, G_STONE].includes(ground[ty][tx]) &&
    !(ft && ft.crop_type) && !(tx === px && ty === py);
  if (!ok) { Sound.play('error'); UI.toast('Não dá para colocar aqui.'); return; }
  if (d.floor) FLOOR[k] = d.floor;
  else {
    if (ft) delete FARM[k];
    OBJS[k] = { t: d.place, hp: 1 };
    if (d.place.startsWith('sprinkler')) S.flags.sprinkler = true;
  }
  removeAt(S.sel, 1);
  Sound.play('plant');
  burst(tx, ty, ['#c89a62', '#d8d4ce'], 5, 20);
  startAnim('harvest', 2, 0.08, null);
}

// --- máquinas artesanais
const machineReady = o => o.input && absMin() >= o.readyAt;
function loadMachine(o, slot) {
  const it = S.inv[slot], M = MACHINES[o.t];
  o.input = baseOf(it.id); o.out = M.out(it.id); o.readyAt = absMin() + M.hours * 60;
  removeAt(slot, 1);
  Sound.play('plant');
  UI.toast(`${M.emoji} ${nameOf(o.out)} fica pronto em ${M.hours >= 24 ? `${M.hours / 24} dia(s)` : `${M.hours} horas`}.`);
}
function collectMachine(o, tx, ty) {
  if (!hasRoom(o.out)) { UI.toast('🎒 Mochila cheia!'); return; }
  gain(o.out, 1, tx, ty);
  S.stats.artisan++;
  addXP(8);
  Sound.play('pop');
  delete o.input; delete o.out; delete o.readyAt;
}
function machineLeft(o) {
  const m = Math.max(0, o.readyAt - absMin());
  return m >= 1440 ? `${Math.ceil(m / 1440)} dia(s)` : m >= 60 ? `${Math.ceil(m / 60)} hora(s)` : 'poucos minutos';
}

// --- pesca
function startFishing(tx, ty) {
  if (!spend(4)) return;
  const bait = countItem('bait') > 0;
  if (bait) removeItem('bait', 1);
  startAnim('rod', 3, 0.13, 2, () => {
    fishing = { state: 'wait', t: (1.5 + Math.random() * 3.5) * (bait ? 0.5 : 1) * (S.perks.rod ? 0.7 : 1), tx, ty, bait };
    Sound.play('splash');
    burst(tx, ty, ['#8ad0ff', '#e8f6ff'], 5, 25);
  });
}
function reel() {
  if (!fishing) return;
  if (fishing.state === 'bite') {
    const { tx, ty, bait } = fishing;
    fishing = null;
    let fishId;
    const legendChance = S.level >= 6 ? 0.02 + (bait ? 0.04 : 0) + (S.perks.rod ? 0.04 : 0) : 0;
    if (Math.random() < legendChance) fishId = LEGENDS[S.season];
    else {
      const boost = bait ? { fish_tilapia: 1.6, fish_catfish: 2.5 } : {};
      const pool = FISH.filter(f => S.level >= f.lvl).map(f => ({ ...f, w: f.w * (boost[f.id] || 1) }));
      let w = pool.reduce((a, f) => a + f.w, 0) * Math.random();
      fishId = pool[0].id;
      for (const f of pool) { w -= f.w; if (w <= 0) { fishId = f.id; break; } }
    }
    const id = withQ(fishId, rollQuality(0.02));
    if (!hasRoom(id)) { UI.toast('🎒 Mochila cheia! O peixe escapou.'); }
    else {
      gain(id, 1, tx, ty);
      S.stats.fish++;
      if (fishId === 'fish_catfish') S.flags.catfish = true;
      const legend = LEGENDS.includes(fishId);
      addXP(legend ? 80 : 8 + FISH.findIndex(f => f.id === fishId) * 5);
      Sound.play(legend ? 'level' : 'pop');
      UI.toast(legend ? `🐉 LENDÁRIO! Você pescou: ${nameOf(id)}!` : `🎣 Você pescou: ${nameOf(id)}!`);
    }
  } else {
    fishing = null;
    UI.toast('Nada fisgou... tente de novo.');
  }
  startAnim('harvest', 2, 0.12, null);
}
function updateFishing(dt) {
  if (!fishing) return;
  fishing.t -= dt;
  if (fishing.state === 'wait' && fishing.t <= 0) {
    fishing.state = 'bite'; fishing.t = 0.9;
    Sound.play('bite');
    floatText(P.x, P.y - 40, '!');
  } else if (fishing.state === 'bite' && fishing.t <= 0) {
    fishing = null;
    P.anim = 'idle';
    UI.toast('🐟 O peixe escapou...');
  }
}

// ---------------------------------------------------------------- animais
const animalsOut = () => scene === 'farm' && S.time < ANIMALS_IN && S.weather !== 'snow';
const animalHouse = type => (type === 'chicken' ? COOP : BARN);

function clearArea(b, extra) {
  const clr = (x, y) => {
    const k = key(x, y), o = S.objs[k];
    if (o && o.t !== 'pine') { if (PICKUP[o.t]) giveAll([[PICKUP[o.t], 1]]); delete S.objs[k]; }
    delete S.farm[k]; delete S.floor[k];
  };
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) clr(x, y);
  if (extra) for (let y = extra.y0; y <= extra.y1; y++) for (let x = extra.x0; x <= extra.x1; x++) clr(x, y);
}

function buildAnimalHouse(which) {
  S[which] = true;
  const b = which === 'coop' ? COOP : BARN;
  clearArea(b, b.pen);
  UI.toast(`🔨 ${which === 'coop' ? 'Galinheiro' : 'Estábulo'} construído a oeste da casa!`);
}

function buyAnimal(type) {
  const A = ANIMALS[type];
  const name = pickOne(ANIMAL_NAMES.filter(n => !S.animals.some(a => a.name === n))) || A.name;
  const a = { id: S.nextId++, type, name, love: 100, fed: false, petted: false, ready: null };
  S.animals.push(a);
  spawnAnimal(a);
  return a;
}

function spawnAnimal(a) {
  const pen = animalHouse(a.type).pen;
  const x = (pen.x0 + Math.random() * (pen.x1 - pen.x0 + 1)) * TS, y = (pen.y0 + Math.random() * (pen.y1 - pen.y0 + 1)) * TS;
  animRT[a.id] = { x: x + 8, y: y + 12, tx: x + 8, ty: y + 12, wait: Math.random() * 2, dir: Math.random() < 0.5 ? 2 : 3, t: 0 };
}

function updateAnimals(dt) {
  if (scene !== 'farm') return;
  for (const a of S.animals) {
    let r = animRT[a.id];
    if (!r) { spawnAnimal(a); r = animRT[a.id]; }
    r.t += dt;
    if (r.wait > 0) { r.wait -= dt; continue; }
    const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy), sp = (a.type === 'cow' ? 9 : 14) * dt;
    if (d <= sp) {
      r.x = r.tx; r.y = r.ty; r.wait = 1 + Math.random() * 4;
      const pen = animalHouse(a.type).pen;
      r.tx = (pen.x0 + Math.random() * (pen.x1 - pen.x0 + 1)) * TS + 8 * Math.random() + 4;
      r.ty = (pen.y0 + Math.random() * (pen.y1 - pen.y0 + 1)) * TS + 6 + Math.random() * 8;
    } else {
      r.x += dx / d * sp; r.y += dy / d * sp;
      if (Math.abs(dx) > 1) r.dir = dx > 0 ? 3 : 2;
    }
  }
}

function animalAt(tx, ty) {
  if (!animalsOut()) return null;
  const cx = tx * TS + 8, cy = ty * TS + 10;
  let best = null, bd = 13;
  for (const a of S.animals) {
    const r = animRT[a.id];
    if (!r) continue;
    const d = Math.hypot(r.x - cx, r.y - 4 - cy);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

function petAnimal(a) {
  const r = animRT[a.id];
  if (a.petted) { UI.toast(`${a.name} já ganhou carinho hoje 💕`); return; }
  a.petted = true;
  a.love = Math.min(1000, a.love + 30);
  if (r) { r.wait = 1.5; floatText(r.x, r.y - 22, '❤'); }
  Sound.play('pop');
  startAnim('harvest', 2, 0.12, null);
}

function collectProduct(a) {
  if (!hasRoom(a.ready)) { UI.toast('🎒 Mochila cheia!'); return false; }
  const r = animRT[a.id];
  addItem(a.ready, 1);
  if (r && scene === 'farm') floatText(r.x, r.y - 20, '+1', baseOf(a.ready));
  a.ready = null;
  addXP(5);
  Sound.play('pop');
  return true;
}

function feedAnimals(type) {
  let fed = 0;
  for (const a of S.animals) {
    if (a.type !== type || a.fed) continue;
    if (countItem('hay') < 1) break;
    removeItem('hay', 1);
    a.fed = true; fed++;
  }
  return fed;
}

// ---------------------------------------------------------------- cozinha e fabricação
function cook(recipe) {
  if (!hasAll(recipe.ing) || !hasRoom(recipe.id)) return false;
  for (const [id, q] of Object.entries(recipe.ing)) removeItem(id, q);
  addItem(recipe.id, 1);
  S.stats.cooked++;
  S.flags['cook_' + recipe.id] = true;
  Sound.play('eat');
  return true;
}
function craft(c) {
  if (!hasAll(c.ing) || !hasRoom(c.id)) return false;
  for (const [id, q] of Object.entries(c.ing)) removeItem(id, q);
  addItem(c.id, c.qty);
  Sound.play('rock');
  return true;
}

// ---------------------------------------------------------------- moradores
function npcLine(id) {
  const h = hearts(id), L = NPCS[id].lines, set = L[h >= 6 ? 2 : h >= 3 ? 1 : 0];
  return set[(S.day + S.season * 7 + id.length) % set.length];
}

function addFriend(id, n) {
  const before = hearts(id);
  S.friends[id] = clamp(S.friends[id] + n, 0, 1000);
  const h = hearts(id);
  if (h > before) UI.toast(`💖 Você e ${NPCS[id].name} agora têm ${h} coração(ões)!`);
  for (const t of Object.keys(NPCS[id].gifts)) {
    const k = id + t;
    if (h >= +t && !S.npcGifts[k]) {
      const [item, qty] = NPCS[id].gifts[t];
      if (addItem(item, qty) === 0) { S.npcGifts[k] = true; UI.toast(`💌 ${NPCS[id].name} te deu um presente: ${nameOf(item)} ×${qty}!`); }
    }
  }
}

function talkTo(id) {
  if (!S.talked[id]) { S.talked[id] = true; addFriend(id, 20); }
  return npcLine(id);
}

// Devolve a reação do morador ao presente (texto) ou null se não deu
function giftTo(id, slot) {
  const it = S.inv[slot];
  if (!it || def(it.id).kind === 'tool') return null;
  if (S.gifted[id]) return 'Você já me deu um presente hoje. Obrigado(a)!';
  const b = kindOf(it.id), N = NPCS[id], kind = def(it.id).kind;
  let pts = 20, msg = 'Oh, obrigado(a)!';
  if (N.loves.includes(b) || (kind === 'gem' && id !== 'ze') || LEGENDS.includes(b)) { pts = 80; msg = 'EU AMEI! Como você sabia?! 😍'; }
  else if (N.likes.includes(b) || kind === 'artisan') { pts = 45; msg = 'Que gentil! Gostei muito. 😊'; }
  else if (N.hates.includes(b)) { pts = -30; msg = 'Hm... isso não é muito a minha cara. 😕'; }
  pts += qualOf(it.id) * 10;
  removeAt(slot, 1);
  S.gifted[id] = true;
  addFriend(id, pts);
  Sound.play(pts > 0 ? 'pop' : 'error');
  return msg;
}

// ---------------------------------------------------------------- pedidos do quadro
function genQuest() {
  const pool = [];
  for (const c of Object.values(CROPS)) if (c.seasons.includes(S.season)) pool.push([c.item, 3, 8]);
  pool.push(['fish', 1, 3], ['copper', 3, 8], ['iron', 2, 5], ['wood', 20, 40], ['stone', 15, 30]);
  if (S.animals.some(a => a.type === 'chicken')) pool.push(['egg', 2, 5]);
  if (S.animals.some(a => a.type === 'cow')) pool.push(['milk', 1, 3]);
  if (S.mineMax >= 10) pool.push(['gold', 2, 5], ['slime', 10, 25]);
  if (S.mineMax >= 5) pool.push(['amethyst', 1, 2]);
  if (Object.values(S.objs).some(o => MACHINES[o.t])) pool.push(['juice', 1, 2], ['jam', 1, 3]);
  const [item, mn, mx] = pickOne(pool);
  const qty = mn + (Math.random() * (mx - mn + 1) | 0);
  const unit = item === 'fish' ? 50 : item === 'juice' || item === 'jam' ? 200 : Math.max(6, ITEMS[item].sell);
  return { id: S.nextId++, item, qty, reward: Math.round((unit * qty * 1.8 + 60) / 10) * 10, days: 3 + (Math.random() * 4 | 0), from: pickOne(Object.keys(NPCS)) };
}

function deliverQuest(qid) {
  const q = S.quests.find(x => x.id === qid);
  if (!q || countItem(q.item) < q.qty) return false;
  removeItem(q.item, q.qty);
  S.gold += q.reward;
  S.stats.quests++;
  S.quests = S.quests.filter(x => x !== q);
  addFriend(q.from, 60);
  addXP(15);
  Sound.play('coin');
  return true;
}

// ---------------------------------------------------------------- projetos do vale
const bundleState = id => S.bundles[id] || (S.bundles[id] = { got: {}, done: false });
const bundleNeed = (b, i) => b.items[i][1] - (bundleState(b.id).got[i] || 0);
// Doa o que tiver de um item da cesta; devolve quantos foram doados
function donate(bid, i) {
  const b = BUNDLES.find(x => x.id === bid), st = bundleState(bid);
  if (st.done) return 0;
  const n = Math.min(countItem(b.items[i][0]), bundleNeed(b, i));
  if (n <= 0) return 0;
  removeItem(b.items[i][0], n);
  st.got[i] = (st.got[i] || 0) + n;
  Sound.play('coin');
  if (b.items.every((_, j) => bundleNeed(b, j) <= 0)) completeBundle(b);
  return n;
}
function completeBundle(b) {
  bundleState(b.id).done = true;
  S.gold += b.gold;
  giveAll(b.give);
  if (b.perk) S.perks[b.perk] = true;
  if (b.perk === 'miner') S.hp = maxHP();
  Sound.play('level');
  UI.toast(`${b.icon} ${b.name} completa! +${b.gold} 💰${b.perkDesc ? ' · ' + b.perkDesc : ''}`);
  if (b.gh && !S.greenhouse && BUNDLES.filter(x => x.gh).every(x => bundleState(x.id).done)) {
    S.greenhouse = true;
    clearArea(GH_B, { x0: GH_B.door.x, y0: GH_B.door.y + 1, x1: GH_B.door.x, y1: GH_B.door.y + 1 });
    UI.toast('🏡 A ESTUFA foi restaurada! Lá dentro você planta qualquer semente em qualquer estação.');
  }
  if (!S.ending && BUNDLES.every(x => bundleState(x.id).done)) {
    S.ending = true;
    S.gold += 10000;
    setTimeout(() => UI.ending(), 400);
  }
}

// ---------------------------------------------------------------- avaliação do vovô
function evaluate() {
  const st = S.stats, done = BUNDLES.filter(b => bundleState(b.id).done).length;
  const col = COLLECTION.filter(i => S.found[i]).length / COLLECTION.length;
  const rows = [
    ['💰 Dinheiro ganho', st.earned >= 1e6 ? 3 : st.earned >= 2e5 ? 2 : st.earned >= 5e4 ? 1 : 0, 3],
    ['📚 Coleção', col >= 1 ? 2 : col >= 0.5 ? 1 : 0, 2],
    ['💞 Amigos com 8♥', Object.keys(NPCS).filter(id => hearts(id) >= 8).length, 3],
    ['🧺 Projetos do Vale', done === BUNDLES.length ? 2 : done >= 4 ? 1 : 0, 2],
    ['🐔 5+ animais', S.animals.length >= 5 ? 1 : 0, 1],
    ['⭐ Nível', S.level >= 20 ? 2 : S.level >= 15 ? 1 : 0, 2],
    ['⛏️ Fundo da mina', S.mineMax >= MINE_DEPTH ? 1 : 0, 1],
    ['🏡 Estufa', S.greenhouse ? 1 : 0, 1],
  ];
  const total = rows.reduce((a, r) => a + r[1], 0);
  const candles = total >= 12 ? 4 : total >= 8 ? 3 : total >= 4 ? 2 : 1;
  return { rows, total, candles };
}
const evalKey = () => `${S.year}-${S.season}`;
function doEvaluation() {
  const ev = evaluate();
  S.evalKey = evalKey();
  S.lastEval = ev;
  let reward = null;
  if (ev.candles >= 4 && S.bestCandles < 4) { reward = 'statue'; giveAll([['statue', 1]]); }
  S.bestCandles = Math.max(S.bestCandles, ev.candles);
  Sound.play(ev.candles >= 3 ? 'level' : 'coin');
  return { ...ev, reward };
}

// ---------------------------------------------------------------- festivais
const festKey = () => `${S.year}-${S.season}`;
function festJudge(fest, id) {
  const q = qualOf(id);
  if (fest.entry === 'fish') { const sc = def(id).sell * QMULT[q]; return sc >= 150 ? 0 : sc >= 70 ? 1 : 2; }
  return q === 2 ? 0 : q === 1 ? 1 : 2;
}
// Inscreve um item; devolve o prêmio obtido
function festEnter(slot) {
  const fest = FESTIVALS[S.season], it = S.inv[slot];
  if (!it || S.festDone === festKey()) return null;
  const place = festJudge(fest, it.id), prize = FEST_PRIZES[place];
  removeAt(slot, 1);
  S.gold += prize.gold;
  if (prize.item) addItem(prize.item, 1);
  if (place === 0) S.flags.champion = true;
  S.festDone = festKey();
  for (const id in NPCS) addFriend(id, 30);
  Sound.play(place === 0 ? 'level' : 'coin');
  return prize;
}
function festLanterns() {
  if (S.festDone === festKey()) return false;
  S.festDone = festKey();
  addItem('lamp', 2);
  for (const id in NPCS) addFriend(id, 50);
  Sound.play('level');
  return true;
}
const lanternNight = () => scene === 'farm' && festivalToday() && S.season === 3 && S.time >= 18 * 60;

// ---------------------------------------------------------------- conquistas e coleção
function checkAch() {
  const pct = COLLECTION.filter(i => S.found[i]).length / COLLECTION.length * 100;
  for (const r of COLLECTION_REWARDS) {
    if (S.colRewards[r.pct] || pct < r.pct) continue;
    S.colRewards[r.pct] = true;
    S.gold += r.gold;
    giveAll(r.items);
    Sound.play('level');
    UI.toast(`📚 Coleção ${r.pct}% completa! Recompensa recebida${r.gold ? `: ${r.gold} 💰` : '!'}`);
    return;
  }
  for (const a of ACHIEVEMENTS) {
    if (S.ach[a.id] || !a.test(S)) continue;
    S.ach[a.id] = true;
    Sound.play('level');
    UI.toast(`🏆 Conquista: ${a.name}!`);
    return; // uma por vez para não empilhar avisos
  }
}

// ---------------------------------------------------------------- cenas: estufa e mina
function transition(fn) {
  if (transitioning) return;
  transitioning = true;
  UI.fade(true, () => { fn(); UI.fade(false); setTimeout(() => { transitioning = false; }, 300); });
}
function enterGreenhouse() { transition(() => setScene('gh', 5 * TS + 8, 8 * TS + 12, 1)); }
function exitGreenhouse() { transition(() => setScene('farm', GH_B.door.x * TS + 8, (GH_B.door.y + 1) * TS + 12, 0)); }

function enterMine(floor) {
  if (!S.inv.some(it => it && it.id === 'sword')) {
    if (addItem('sword', 1)) { UI.toast('🎒 Abra espaço na mochila: o Tião quer te dar uma espada!'); return; }
    UI.toast('⚔️ Tião: "Leve esta espada, a mina tem monstros!"');
  }
  transition(() => {
    genMineFloor(floor);
    setScene('mine', mine.spawn.x, mine.spawn.y, 0);
    S.mineMax = Math.max(S.mineMax, floor);
    Sound.play('rock');
  });
}
function leaveMine() {
  transition(() => { mine = null; setScene('farm', MINE_ENT.door.x * TS + 8, (MINE_ENT.door.y + 1) * TS + 12, 0); });
}
// Andares disponíveis no elevador da entrada
const elevatorFloors = () => {
  const out = [1];
  for (let f = 2; f <= S.mineMax; f++) if (f % 5 === 0 || S.perks.miner) out.push(f);
  return out;
};

function mineRock(n, r) {
  const v = r();
  const table = [
    ['gem_diamond', n >= 30 ? 0.01 : 0], ['gem_ruby', n >= 20 ? 0.015 : 0], ['gem_emerald', n >= 10 ? 0.015 : 0], ['gem_amethyst', 0.02],
    ['gold', n < 10 ? 0 : n < 20 ? 0.04 : n < 30 ? 0.1 : 0.14],
    ['iron', n < 10 ? 0.04 : n < 20 ? 0.14 : 0.1],
    ['copper', n < 10 ? 0.18 : n < 20 ? 0.1 : 0.05],
  ];
  let acc = 0;
  for (const [t, p] of table) { acc += p; if (v < acc) return { t, hp: t.startsWith('gem_') ? HP.gem : HP[t] }; }
  return { t: 'rock', hp: n >= 20 ? 3 : 2 };
}

function genMineFloor(n) {
  const W = 30, H = 22, r = rng(n * 7919 + dayIndex() * 104729 + 17);
  const g = [];
  for (let y = 0; y < H; y++) g.push(Array.from({ length: W }, (_, x) => (x < 1 || y < 2 || x >= W - 1 || y >= H - 1 ? G_WALL : G_CAVE)));
  const blobs = 5 + (r() * 6 | 0);
  for (let i = 0; i < blobs; i++) {
    const cx = 3 + r() * (W - 6), cy = 5 + r() * (H - 8), rx = 1 + r() * 3, ry = 1 + r() * 2.2;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x > 0 && y > 1 && x < W - 1 && y < H - 1 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) g[y][x] = G_WALL;
    }
  }
  const sx = 3 + (r() * (W - 6) | 0), sy = 2;
  for (let y = sy; y <= sy + 3; y++) g[y][sx] = G_CAVE;
  // tudo que não é alcançável a partir da entrada vira parede
  const dist = new Map([[key(sx, sy + 1), 0]]), q = [[sx, sy + 1]];
  while (q.length) {
    const [x, y] = q.shift(), d = dist.get(key(x, y));
    for (const [dx, dy] of DIRV) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (g[ny] && g[ny][nx] === G_CAVE && !dist.has(k)) { dist.set(k, d + 1); q.push([nx, ny]); }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === G_CAVE && !dist.has(key(x, y)) && !(x === sx && y === sy)) g[y][x] = G_WALL;
  const objs = { [key(sx, sy)]: { t: 'ladder_up', hp: 999 } };
  const cells = [...dist.entries()].map(([k, d]) => [...k.split(',').map(Number), d]);
  const far = cells.filter(c => c[2] > 6).sort(() => r() - 0.5);
  let ladder = false;
  if (n % 10 === 0 && !S.mineChests[n] && far.length) { const [x, y] = far.pop(); objs[key(x, y)] = { t: 'chest', hp: 999 }; }
  if (n % 10 === 0 && n < MINE_DEPTH && far.length) { const [x, y] = far.pop(); objs[key(x, y)] = { t: 'ladder_down', hp: 999 }; ladder = true; }
  let total = 0;
  for (const [x, y, d] of cells) {
    if (d <= 2 || objs[key(x, y)] || r() > 0.32) continue;
    objs[key(x, y)] = mineRock(n, r); total++;
  }
  const monsters = [], tier = n >= 30 ? 'red' : n >= 15 ? 'blue' : 'green';
  const count = Math.min(10, 3 + Math.floor(n / 4));
  const freeFar = far.filter(([x, y]) => !objs[key(x, y)]);
  for (let i = 0; i < count && freeFar.length; i++) {
    const [x, y] = freeFar.pop();
    const type = r() < 0.75 ? tier : (tier === 'red' ? 'blue' : 'green');
    monsters.push({ type, x: x * TS + 8, y: y * TS + 10, hp: SLIMES[type].hp, t: r() * 5, hurt: 0, kb: null, wt: 0, wa: 0 });
  }
  mine = { floor: n, w: W, h: H, ground: g, objs, monsters, total, broken: 0, ladder, spawn: { x: sx * TS + 8, y: (sy + 1) * TS + 12 } };
}

function maybeLadder(tx, ty, chance) {
  if (!mine || mine.ladder || mine.floor >= MINE_DEPTH) return;
  const left = Object.values(mine.objs).filter(o => isRock(o.t)).length;
  if (Math.random() < chance || left <= 2) {
    if (obj(tx, ty)) return;
    OBJS[key(tx, ty)] = { t: 'ladder_down', hp: 999 };
    mine.ladder = true;
    Sound.play('bite');
    floatText(tx * TS + 8, ty * TS, 'Escada!');
  }
}

function nextFloor() {
  const n = mine.floor + 1;
  transition(() => {
    genMineFloor(n);
    setScene('mine', mine.spawn.x, mine.spawn.y, 0);
    S.mineMax = Math.max(S.mineMax, n);
    if (n % 5 === 0) UI.toast(`🛗 Andar ${n}: o elevador da entrada agora vem até aqui!`);
    if (n === MINE_DEPTH) UI.toast('💎 Você chegou ao FUNDO DA MINA!');
  });
}

function openChest(tx, ty) {
  const rw = MINE_CHESTS[mine.floor];
  OBJS[key(tx, ty)] = { t: 'chest_open', hp: 999 };
  S.mineChests[mine.floor] = true;
  if (!rw) return;
  S.gold += rw.gold;
  if (rw.sword && S.tools.sword < rw.sword) S.tools.sword = rw.sword;
  giveAll(rw.items);
  Sound.play('level');
  burst(tx, ty, ['#ffe14a', '#ffffff', '#f2c230'], 16, 70);
  UI.toast(`🎁 Baú do andar ${mine.floor}: +${rw.gold} 💰${rw.sword ? ` e ${UPGRADES.find(u => u.id === 'sword' + rw.sword).name}` : ''}!`);
}

// --- combate
function useSword() {
  startAnim('sword', 3, 0.08, 1, () => {
    const v = DIRV[P.dir], hx = P.x + v[0] * 14, hy = P.y - 6 + v[1] * 14;
    let hit = false;
    if (mine) for (const m of mine.monsters) {
      if (m.hp <= 0 || Math.hypot(m.x - hx, m.y - hy) > 16) continue;
      hit = true;
      m.hp -= SWORD_DMG[S.tools.sword];
      m.hurt = 0.25;
      m.kb = { x: v[0] * 90, y: v[1] * 90, t: 0.15 };
      floatText(m.x, m.y - 14, `-${SWORD_DMG[S.tools.sword]}`, null, '#ffe14a');
      if (m.hp <= 0) killMonster(m);
    }
    if (mine) mine.monsters = mine.monsters.filter(m => m.hp > 0);
    Sound.play(hit ? 'chop' : 'swing');
  });
}
function killMonster(m) {
  const T = SLIMES[m.type], tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS);
  burst(tx, ty, T.color, 14, 50);
  Sound.play('pop');
  S.stats.kills++;
  addXP(T.xp);
  if (Math.random() < 0.7) gain('slime', 1 + (m.type === 'red' ? 1 : 0), tx, ty);
  if (Math.random() < 0.08) gain(mine.floor >= 20 ? 'gold' : mine.floor >= 10 ? 'iron' : 'copper', 1, tx, ty);
  if (Math.random() < 0.03) gain(pickOne(GEMS.slice(0, 1 + Math.min(3, Math.floor(mine.floor / 10)))), 1, tx, ty);
  maybeLadder(tx, ty, 0.12);
}
function hurtPlayer(dmg, dx, dy, d) {
  S.hp = Math.max(0, S.hp - dmg);
  P.invuln = 1;
  const nx = P.x + dx / (d || 1) * 14, ny = P.y + dy / (d || 1) * 14;
  if (!boxBlocked(nx, P.y)) P.x = nx;
  if (!boxBlocked(P.x, ny)) P.y = ny;
  fishing = null;
  Sound.play('error');
  floatText(P.x, P.y - 34, `-${dmg}`, null, '#ff5050');
  if (S.hp <= 0) {
    UI.toast('😵 Você desmaiou na mina! Alguém te levou para casa...');
    sleep(true);
  }
}
function updateMonsters(dt) {
  if (scene !== 'mine' || !mine) return;
  P.invuln = Math.max(0, P.invuln - dt);
  const solid = (x, y) => isBlocked(Math.floor(x / TS), Math.floor(y / TS));
  for (const m of mine.monsters) {
    const T = SLIMES[m.type];
    m.t += dt; m.hurt = Math.max(0, m.hurt - dt);
    const dx = P.x - m.x, dy = (P.y - 4) - m.y, d = Math.hypot(dx, dy);
    let vx = 0, vy = 0;
    if (m.kb) { vx = m.kb.x; vy = m.kb.y; m.kb.t -= dt; if (m.kb.t <= 0) m.kb = null; }
    else if (d < 100) { const sp = T.speed * (0.4 + 0.8 * Math.abs(Math.sin(m.t * 4))); vx = dx / d * sp; vy = dy / d * sp; }
    else {
      if ((m.wt -= dt) <= 0) { m.wa = Math.random() * Math.PI * 2; m.wt = 1 + Math.random() * 2; }
      vx = Math.cos(m.wa) * 10; vy = Math.sin(m.wa) * 10;
    }
    const nx = m.x + vx * dt, ny = m.y + vy * dt;
    if (!solid(nx, m.y)) m.x = nx; else m.wa += Math.PI;
    if (!solid(m.x, ny)) m.y = ny; else m.wa += Math.PI;
    if (d < 10 && P.invuln <= 0 && !transitioning && !sleeping) { hurtPlayer(T.dmg, dx, dy, d); if (sleeping) return; }
  }
}

// ---------------------------------------------------------------- ação contextual (botão grande)
function resolveAction() {
  if (fishing) return { icon: 'rod', label: fishing.state === 'bite' ? 'PUXAR!' : 'Puxar', run: reel };
  const [tx, ty] = targetTile();
  const st = structAt(tx, ty);
  if (st === HOUSE && tx === HOUSE.door.x && ty === HOUSE.door.y) return { emoji: '🏠', label: 'Casa', run: () => UI.openHouse() };
  if (st === BIN) return { emoji: '📦', label: 'Enviar', run: () => UI.openBin() };
  if (st === STALL && ty === STALL.y + STALL.h - 1) return { emoji: '🛒', label: 'Loja', run: () => UI.openNPC('rosa') };
  if (st === BOARD) return { emoji: '📋', label: 'Quadro', run: () => UI.openBoard() };
  if (st === ALTAR) return { emoji: '🕯️', label: 'Santuário', run: () => UI.openAltar() };
  if (st === COOP) return { emoji: '🐔', label: 'Galinheiro', run: () => UI.openAnimals('chicken') };
  if (st === BARN) return { emoji: '🐄', label: 'Estábulo', run: () => UI.openAnimals('cow') };
  if (st === FEST) return { emoji: '🎪', label: 'Festival', run: () => UI.openFestival() };
  if (st === MINE_ENT) return { emoji: '⛏️', label: 'Mina', run: () => UI.openMine() };
  if (st === GH_B) return { emoji: '🏡', label: 'Estufa', run: enterGreenhouse };
  const npc = inMap(tx, ty) ? npcAt(tx, ty) : null;
  if (npc) return { emoji: '💬', label: NPCS[npc].name.split(' ').pop(), run: () => UI.openNPC(npc) };
  const an = animalAt(tx, ty);
  if (an) {
    if (an.ready) return { icon: baseOf(an.ready), label: 'Coletar', run: () => collectProduct(an) };
    return { emoji: '❤️', label: 'Carinho', run: an.petted ? null : () => petAnimal(an) };
  }
  const ft = inMap(tx, ty) ? farmTile(tx, ty) : null;
  if (ft && ft.crop_type) {
    if (ft.dead) return { emoji: '🧹', label: 'Limpar', run: () => clearDead(tx, ty) };
    if (ft.growth_stage >= 4) return { emoji: '🖐️', label: 'Colher', run: () => harvest(tx, ty) };
  }
  const o = inMap(tx, ty) ? obj(tx, ty) : null;
  const it = selItem();
  if (o) {
    if (o.t === 'weed' || o.t === 'branch') return { emoji: '🖐️', label: o.t === 'weed' ? 'Arrancar' : 'Pegar', run: () => pickDebris(tx, ty, o) };
    if (o.t === 'ladder_down') return { emoji: '🪜', label: 'Descer', run: nextFloor };
    if (o.t === 'ladder_up') return { emoji: '🪜', label: 'Sair', run: leaveMine };
    if (o.t === 'chest') return { emoji: '🎁', label: 'Abrir', run: () => openChest(tx, ty) };
    if (o.t === 'statue' && o.ready) return { icon: o.ready, label: 'Coletar', run: () => { gain(o.ready, 1, tx, ty); o.ready = null; Sound.play('pop'); } };
    if (MACHINES[o.t] && !(it && it.id === 'pick' && !o.input)) {
      const M = MACHINES[o.t];
      if (machineReady(o)) return { icon: o.out, label: 'Coletar', run: () => collectMachine(o, tx, ty) };
      if (o.input) return { emoji: '⏳', label: 'Fazendo', run: () => UI.toast(`${M.emoji} ${nameOf(o.out)}: pronto em ${machineLeft(o)}.`) };
      if (it && M.accepts(it.id)) return { icon: baseOf(it.id), label: 'Colocar', run: () => loadMachine(o, S.sel) };
      return { emoji: M.emoji, label: ITEMS[o.t].name.split(' ')[0], run: () => UI.toast(`${M.emoji} ${M.hint}`) };
    }
  }
  if (!it) return { emoji: '🖐️', label: 'Mão', run: null };
  const d = def(it.id);
  const water = inMap(tx, ty) && ground[ty][tx] === G_WATER;
  switch (it.id) {
    case 'hoe': return { icon: iconId('hoe'), label: 'Arar', run: useHoe };
    case 'can': return { icon: iconId('can'), label: water ? 'Encher' : 'Regar', run: useCan };
    case 'axe': return { icon: iconId('axe'), label: o && o.t === 'pfence' ? 'Recolher' : 'Cortar', run: useAxe };
    case 'pick': return { icon: iconId('pick'), label: o && PICKUP[o.t] ? 'Recolher' : 'Quebrar', run: usePick };
    case 'sword': return { icon: iconId('sword'), label: 'Atacar', run: useSword };
    case 'rod': return { icon: 'rod', label: 'Pescar', run: water ? () => startFishing(tx, ty) : () => UI.toast('Fique de frente para a água para pescar 🎣') };
  }
  if (d.kind === 'seed') return { icon: baseOf(it.id), label: 'Plantar', run: () => plant(tx, ty, it) };
  if (d.kind === 'place') return { icon: baseOf(it.id), label: 'Colocar', run: () => placeItem(tx, ty) };
  if (energyOf(it.id)) return { emoji: '🍽️', label: 'Comer', run: () => eat(S.sel) };
  return { icon: baseOf(it.id), label: d.name, run: null };
}

// Ações que se repetem enquanto o botão fica pressionado
const REPEATABLE = new Set(['Arar', 'Regar', 'Cortar', 'Quebrar', 'Colher', 'Arrancar', 'Pegar', 'Limpar', 'Atacar']);

function doAction() {
  if (isPaused() || P.busy) return;
  const a = resolveAction();
  input.lastAction = clock;
  if (a.run) a.run();
}

// ---------------------------------------------------------------- tempo e dias
function stageFor(ft) {
  const c = CROPS[ft.crop_type];
  if (ft.days_planted >= c.days) return 4;
  return 1 + Math.floor(ft.days_planted * 3 / c.days);
}

// Tiles cobertos pelos aspersores (3x3 cobre, 5x5 ferro, 7x7 ouro)
function sprinklerTiles(objs) {
  const out = new Set();
  for (const [k, o] of Object.entries(objs)) {
    const r = SPRINKLER_R[o.t];
    if (!r) continue;
    const [x, y] = k.split(',').map(Number);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.add(key(x + dx, y + dy));
  }
  return out;
}

// Crescimento de uma área de plantio (fazenda ou estufa)
function growFarm(farm, objs, inside, report) {
  const sprinkled = sprinklerTiles(objs);
  for (const k of Object.keys(farm)) {
    const ft = farm[k];
    if (ft.crop_type && !ft.dead) {
      if (ft.is_watered) { ft.days_planted++; ft.dry_days = 0; }
      else if (++ft.dry_days >= 3) { ft.dead = true; ft.growth_stage = 5; report.died++; }
      if (!ft.dead) ft.growth_stage = stageFor(ft);
    } else if (!inside && !ft.crop_type && !ft.is_watered && !sprinkled.has(k) && Math.random() < 0.08) {
      delete farm[k];
      continue;
    }
    ft.is_watered = false;
  }
  return sprinkled;
}

function nextDay(passedOut) {
  const report = { sales: [], total: 0, passedOut, lost: 0, died: 0, products: 0, expired: 0, inMine: scene === 'mine' };
  // venda da Caixa de Envio
  for (const it of S.bin) {
    const price = sellOf(it.id) * it.qty;
    report.sales.push({ id: it.id, qty: it.qty, total: price });
    report.total += price;
  }
  S.bin = [];
  S.gold += report.total;
  S.stats.earned += report.total;

  const sprFarm = growFarm(S.farm, S.objs, false, report);
  const sprGh = growFarm(S.ghFarm, S.ghObjs, true, report);

  // animais: produzem se foram alimentados
  for (const a of S.animals) {
    if (a.fed) {
      if (!a.ready) {
        const l = a.love / 1000, r = Math.random();
        a.ready = withQ(ANIMALS[a.type].product, r < l * 0.35 ? 2 : r < l * 0.85 ? 1 : 0);
        report.products++;
      }
      a.love = Math.min(1000, a.love + 10);
    } else a.love = Math.max(0, a.love - 60);
    a.fed = false; a.petted = false;
  }

  // avança o calendário
  S.day++;
  if (S.day > DAYS_PER_SEASON) {
    S.day = 1;
    S.season = (S.season + 1) % 4;
    if (S.season === 0) { S.year++; if (S.year === 2) report.altar = true; }
    report.newSeason = SEASONS[S.season];
    for (const ft of Object.values(S.farm)) {
      if (ft.crop_type && !ft.dead && !CROPS[ft.crop_type].seasons.includes(S.season)) { ft.dead = true; ft.growth_stage = 5; report.died++; }
    }
  }
  S.weather = Math.random() < (S.season === 3 ? 0.25 : 0.18) ? (S.season === 3 ? 'snow' : 'rain') : 'sun';
  if (festivalToday()) S.weather = 'sun';
  if (S.weather === 'rain') for (const ft of Object.values(S.farm)) ft.is_watered = true;

  // aspersores regam toda manhã
  for (const k of sprFarm) if (S.farm[k]) S.farm[k].is_watered = true;
  for (const k of sprGh) if (S.ghFarm[k]) S.ghFarm[k].is_watered = true;

  // estátua do vovô: uma gema por dia
  for (const o of [...Object.values(S.objs), ...Object.values(S.ghObjs)]) {
    if (o.t === 'statue' && !o.ready) { const r = Math.random(); o.ready = r < 0.08 ? 'diamond' : r < 0.25 ? 'ruby' : r < 0.5 ? 'emerald' : 'amethyst'; }
  }

  // pedidos do quadro
  for (const q of S.quests) q.days--;
  report.expired = S.quests.filter(q => q.days <= 0).length;
  S.quests = S.quests.filter(q => q.days > 0);
  if (S.quests.length < 3 && (S.quests.length === 0 || Math.random() < 0.6)) S.quests.push(genQuest());

  S.talked = {}; S.gifted = {};
  if (festivalToday()) report.festival = FESTIVALS[S.season];
  else if (S.day === FESTIVAL_DAY - 1) report.festivalTomorrow = FESTIVALS[S.season];

  mine = null;
  setScene('farm');
  spawnDebris();
  refillQuarry();

  if (passedOut) {
    report.lost = Math.min(500, Math.floor(S.gold * 0.1));
    S.gold -= report.lost;
    S.energy = Math.round(maxEnergy() * 0.6);
  } else S.energy = maxEnergy();
  S.hp = maxHP();
  S.time = DAY_START;
  setScene('farm', WAKE.x, WAKE.y, 0);
  P.invuln = 0;
  animRT = {};
  save();
  return report;
}

function spawnDebris() {
  const r = Math.random;
  let placed = 0, tries = 0;
  const debris = Object.values(S.objs).filter(o => o.t === 'weed' || o.t === 'branch').length;
  if (debris > 220) return;
  while (placed < 6 && tries++ < 200) {
    const x = 3 + (r() * (S.expanded ? 46 : 32) | 0), y = 9 + (r() * 29 | 0);
    if (!canTill(x, y) || (x >= 12 && x <= 17 && y <= 13) || Math.abs(x - 7) <= 1) continue;
    if (x >= 35 && !S.expanded) continue;
    const v = r();
    S.objs[key(x, y)] = { t: v < 0.6 ? 'weed' : v < 0.85 ? 'branch' : 'rock', hp: 1 };
    if (S.objs[key(x, y)].t === 'rock') S.objs[key(x, y)].hp = HP.rock;
    placed++;
  }
}

function refillQuarry() {
  const r = Math.random;
  for (let y = QUARRY.y0; y <= QUARRY.y1; y++) for (let x = QUARRY.x0; x <= QUARRY.x1; x++) {
    if (farmGround[y][x] !== G_STONE || S.objs[key(x, y)] || structAt(x, y)) continue;
    if (x === MINE_ENT.door.x && y === MINE_ENT.door.y + 1) continue;
    if (r() < 0.12) { const t = oreRoll(r, S.tools.pick); S.objs[key(x, y)] = { t, hp: HP[t] }; }
  }
}

function sleep(passedOut) {
  if (sleeping) return;
  sleeping = true;
  UI.fade(true, () => {
    const report = nextDay(passedOut);
    if (report.total > 0) Sound.play('coin');
    UI.daySummary(report, () => { UI.fade(false); sleeping = false; UI.refresh(); });
  });
}

function save() {
  try {
    if (P) {
      // fora da fazenda, o jogo salva a posição da porta da cena
      if (scene === 'farm') { S.px = P.x; S.py = P.y; S.dir = P.dir; }
      else if (scene === 'gh') { S.px = GH_B.door.x * TS + 8; S.py = (GH_B.door.y + 1) * TS + 12; S.dir = 0; }
      else { S.px = MINE_ENT.door.x * TS + 8; S.py = (MINE_ENT.door.y + 1) * TS + 12; S.dir = 0; }
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch (e) { /* sem armazenamento disponível */ }
}
function loadSave() {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return null;
    const s = JSON.parse(t);
    return s && s.v === 1 ? migrate(s) : null;
  } catch (e) { return null; }
}

// ---------------------------------------------------------------- movimento
function boxBlocked(x, y) {
  const x0 = Math.floor((x - 5) / TS), x1 = Math.floor((x + 5) / TS);
  const y0 = Math.floor((y - 5) / TS), y1 = Math.floor((y - 1) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isBlocked(tx, ty)) return true;
  return false;
}

function findPath(sx, sy, goals) {
  const start = key(sx, sy);
  if (goals.has(start)) return [];
  const prev = new Map([[start, null]]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRV) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || isBlocked(nx, ny)) continue;
      prev.set(k, key(x, y));
      if (goals.has(k)) {
        const out = [];
        let c = k;
        while (c && c !== start) { const [a, b] = c.split(',').map(Number); out.unshift([a, b]); c = prev.get(c); }
        return out;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

function faceTo(tx, ty) {
  const [px, py] = playerTile();
  const dx = tx - px, dy = ty - py;
  if (Math.abs(dx) > Math.abs(dy)) P.dir = dx > 0 ? 3 : 2; else if (dy) P.dir = dy > 0 ? 0 : 1;
}

function handleTap(wx, wy) {
  if (isPaused() || P.busy) return;
  const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
  if (!inMap(tx, ty)) return;
  const [px, py] = playerTile();
  if (tx === px && ty === py) return;
  if (fishing) { reel(); return; }
  if (Math.abs(tx - px) + Math.abs(ty - py) === 1) { faceTo(tx, ty); doAction(); return; }
  const st = structAt(tx, ty);
  const goals = new Set();
  const target = st && st.door ? [st.door.x, st.door.y] : st === STALL ? [STALL.x + 1, STALL.y + 1] : [tx, ty];
  const special = !!(st || npcAt(tx, ty));
  if (isBlocked(...target) || special) {
    for (const [dx, dy] of DIRV) { const nx = target[0] + dx, ny = target[1] + dy; if (!isBlocked(nx, ny)) goals.add(key(nx, ny)); }
  } else goals.add(key(tx, ty));
  const path = findPath(px, py, goals);
  if (!path) return;
  P.path = path.map(([x, y]) => ({ x: x * TS + 8, y: y * TS + 11 }));
  P.pathEnd = (isBlocked(...target) || special) ? { face: target, act: special } : null;
  if (!P.path.length) arrive();
}

function arrive() {
  P.path = null;
  if (P.pathEnd) {
    faceTo(...P.pathEnd.face);
    const act = P.pathEnd.act;
    P.pathEnd = null;
    if (act) doAction();
  }
}

function updatePlayer(dt) {
  P.animT += dt;
  if (P.busy) {
    P.actT += dt;
    P.frame = Math.min(P.frames - 1, Math.floor(P.actT / P.frameDur));
    if (P.hitAt != null && P.actT >= P.hitAt) { const f = P.onHit; P.hitAt = null; P.onHit = null; if (f) f(); }
    if (P.actT >= P.dur) { P.busy = false; P.anim = fishing ? 'rod' : 'idle'; }
    return;
  }
  let mx = 0, my = 0;
  if (input.joy && input.joy.mag > 0.25) { mx = input.joy.x; my = input.joy.y; }
  const k = input.keys;
  if (k.has('ArrowLeft') || k.has('KeyA')) mx -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) mx += 1;
  if (k.has('ArrowUp') || k.has('KeyW')) my -= 1;
  if (k.has('ArrowDown') || k.has('KeyS')) my += 1;
  const manual = mx || my;
  if (manual) {
    P.path = null; P.pathEnd = null;
    if (fishing) { fishing = null; UI.toast('Você recolheu a linha.'); }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const nx = P.x + mx * SPEED * dt, ny = P.y + my * SPEED * dt;
    if (!boxBlocked(nx, P.y)) P.x = nx;
    if (!boxBlocked(P.x, ny)) P.y = ny;
    if (Math.abs(mx) > Math.abs(my)) P.dir = mx > 0 ? 3 : 2; else P.dir = my > 0 ? 0 : 1;
  } else if (P.path && P.path.length) {
    const t = P.path[0];
    const dx = t.x - P.x, dy = t.y - P.y, d = Math.hypot(dx, dy), step = SPEED * dt;
    if (d <= step) { P.x = t.x; P.y = t.y; P.path.shift(); if (!P.path.length) arrive(); }
    else { P.x += dx / d * step; P.y += dy / d * step; }
    if (Math.abs(dx) > Math.abs(dy)) P.dir = dx > 0 ? 3 : 2; else if (dy) P.dir = dy > 0 ? 0 : 1;
  }
  const moving = manual || (P.path && P.path.length);
  if (fishing) { P.anim = 'rod'; P.frame = 2; }
  else if (moving) { P.anim = 'walk'; P.frame = Math.floor(P.animT * 8) % 4; }
  else { P.anim = 'idle'; P.frame = Math.floor(P.animT * 1.6) % 2; }
  // porta da estufa
  if (scene === 'gh') { const [x, y] = playerTile(); if (inMap(x, y) && ground[y][x] === G_EXIT) exitGreenhouse(); }
}

function isPaused() { return sleeping || transitioning || UI.blocking(); }

// ---------------------------------------------------------------- loop
function update(dt) {
  clock += dt;
  if (isPaused()) return;
  S.time += dt; // 1 segundo real = 1 minuto no jogo (1 minuto real = 1 hora)
  if (S.time >= PASS_OUT) { UI.toast('😵 Você desmaiou de cansaço às 2h...'); sleep(true); return; }
  updatePlayer(dt);
  updateFishing(dt);
  updateAnimals(dt);
  updateMonsters(dt);
  if (isPaused()) return;
  if (input.actionHeld && !P.busy && clock - input.lastAction > 0.3) {
    const a = resolveAction();
    if (a.run && REPEATABLE.has(a.label)) doAction();
  }
  if ((achTimer += dt) > 1) { achTimer = 0; checkAch(); }
  for (const p of particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; }
  particles = particles.filter(p => p.life > 0);
  for (const f of floaters) { f.life -= dt; f.y -= 18 * dt; }
  floaters = floaters.filter(f => f.life > 0);
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cvs.width = Math.floor(window.innerWidth * dpr);
  cvs.height = Math.floor(window.innerHeight * dpr);
  zoom = Math.max(2, Math.round(Math.min(cvs.width / (TS * 11), cvs.height / (TS * 11.5))));
}

function drawImg(img, x, y) { ctx.drawImage(img, Math.round(x * zoom) / zoom, Math.round(y * zoom) / zoom); }

function maskOf(x, y, test) {
  let m = 0;
  if (test(x, y - 1)) m |= 1; if (test(x + 1, y)) m |= 2; if (test(x, y + 1)) m |= 4; if (test(x - 1, y)) m |= 8;
  return m;
}

function drawGroundTile(x, y, wf) {
  const g = ground[y][x], X = x * TS, Y = y * TS;
  const floorMask = () => maskOf(x, y, (a, b) => !!FLOOR[key(a, b)]);
  if (scene === 'mine') {
    if (g === G_WALL) ctx.drawImage(Sprites.caveWall(inMap(x, y + 1) && ground[y + 1][x] !== G_WALL), X, Y);
    else ctx.drawImage(Sprites.caveFloor(hash(x, y) % 4), X, Y);
    return;
  }
  if (scene === 'gh') {
    if (g === G_WALL) ctx.drawImage(Sprites.glassWall(y === 0 ? 0 : y === GH_H - 1 ? 2 : 1), X, Y);
    else if (g === G_EXIT) ctx.drawImage(Sprites.doormat(), X, Y);
    else ctx.drawImage(Sprites.ghFloor(hash(x, y) % 3), X, Y);
    if (FLOOR[key(x, y)]) ctx.drawImage(Sprites.cobble(floorMask()), X, Y);
    return;
  }
  const isG = (a, b, t) => inMap(a, b) && ground[b][a] === t;
  if (g === G_WATER || g === G_PLANK) {
    ctx.drawImage(Sprites.water(wf, maskOf(x, y, (a, b) => !inMap(a, b) || ground[b][a] === G_WATER || ground[b][a] === G_PLANK)), X, Y);
    if (g === G_PLANK) ctx.drawImage(Sprites.plank(), X, Y);
    return;
  }
  if (g === G_STONE) { ctx.drawImage(Sprites.stone(hash(x, y) % 5 === 0 ? 1 : 0), X, Y); return; }
  const h = hash(x, y) % 16;
  ctx.drawImage(Sprites.grass(S.season, h < 1 ? 2 : h < 4 ? 1 : h === 5 ? 3 : 0), X, Y);
  if (g === G_PATH) ctx.drawImage(Sprites.path(maskOf(x, y, (a, b) => isG(a, b, G_PATH) || isG(a, b, G_PLANK))), X, Y);
  if (FLOOR[key(x, y)]) ctx.drawImage(Sprites.cobble(floorMask()), X, Y);
}

function render() {
  const W = cvs.width, H = cvs.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = scene === 'mine' ? '#0e0c0a' : scene === 'gh' ? '#2a4a2e' : '#16301c';
  ctx.fillRect(0, 0, W, H);
  if (!S || !P) return;
  viewW = W / zoom; viewH = H / zoom;
  let cx = P.x - viewW / 2, cy = P.y - 12 - viewH / 2;
  cx = viewW >= MW * TS ? (MW * TS - viewW) / 2 : clamp(cx, 0, MW * TS - viewW);
  cy = viewH >= MH * TS ? (MH * TS - viewH) / 2 : clamp(cy, 0, MH * TS - viewH);
  const ox = Math.round(cx * zoom), oy = Math.round(cy * zoom);
  camX = ox / zoom; camY = oy / zoom;
  ctx.setTransform(zoom, 0, 0, zoom, -ox, -oy);

  const x0 = Math.max(0, Math.floor(camX / TS) - 1), x1 = Math.min(MW - 1, Math.ceil((camX + viewW) / TS) + 1);
  const y0 = Math.max(0, Math.floor(camY / TS) - 1), y1 = Math.min(MH - 1, Math.ceil((camY + viewH) / TS) + 2);
  const season = S.season, wf = Math.floor(clock * 2.5) % 4;

  // camada 1: chão da cena
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) drawGroundTile(x, y, wf);
  // camada 2: terra arada
  const tilled = (a, b) => !!FARM[key(a, b)];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ft = FARM[key(x, y)];
    if (ft) ctx.drawImage(Sprites.soil(maskOf(x, y, tilled), ft.is_watered), x * TS, y * TS);
  }
  // cursor do tile alvo
  if (!isPaused()) {
    const [tx, ty] = targetTile();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1 / zoom * Math.max(1, Math.round(zoom / 3));
    ctx.strokeRect(tx * TS + 0.5, ty * TS + 0.5, TS - 1, TS - 1);
  }

  // camada 3: tudo que tem altura, ordenado por profundidade
  const list = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = OBJS[key(x, y)];
    if (o) list.push({ z: y * TS + 15, o, x, y });
    const ft = FARM[key(x, y)];
    if (ft && ft.crop_type) list.push({ z: y * TS + 8, ft, x, y });
  }
  if (scene === 'farm') {
    const addStruct = (s, img, h) => list.push({ z: (s.y + s.h) * TS, img, x: s.x * TS, y: (s.y + s.h) * TS - h });
    addStruct(HOUSE, Sprites.house(), 84);
    addStruct(BIN, Sprites.bin(), 26);
    addStruct(STALL, Sprites.stall(), 56);
    addStruct(BOARD, Sprites.board(), 26);
    addStruct(ALTAR, Sprites.altar(S.bestCandles), 26);
    addStruct(MINE_ENT, Sprites.mineEntrance(), 40);
    if (S.coop) addStruct(COOP, Sprites.coop(), 46);
    if (S.barn) addStruct(BARN, Sprites.barn(), 62);
    if (S.greenhouse) addStruct(GH_B, Sprites.greenhouse(), 80);
    if (festivalToday()) addStruct(FEST, Sprites.festTent(S.season), 52);
    for (const id in NPCS) {
      const n = NPCS[id];
      if (n.x != null) list.push({ z: n.y * TS + 12, npc: id, x: n.x * TS + 8, y: n.y * TS + 12 });
    }
    if (animalsOut()) for (const a of S.animals) { const r = animRT[a.id]; if (r) list.push({ z: r.y, animal: a, r }); }
  }
  if (mine && scene === 'mine') for (const m of mine.monsters) list.push({ z: m.y, monster: m });
  list.push({ z: P.y, player: true });
  list.sort((a, b) => a.z - b.z);
  const isFence = (a, b) => { const o = inMap(a, b) && OBJS[key(a, b)]; return !!(o && (o.t === 'fence' || o.t === 'pfence')); };
  for (const d of list) {
    if (d.img) { ctx.drawImage(d.img, d.x, d.y); continue; }
    if (d.player) { drawPlayer(); continue; }
    if (d.npc) {
      shadow(d.x, d.y);
      ctx.drawImage(Sprites.npc(d.npc, NPCS[d.npc].dir, Math.floor(clock * 1.4 + d.x) % 2), d.x - 16, d.y - 36);
      continue;
    }
    if (d.animal) { drawAnimal(d.animal, d.r); continue; }
    if (d.monster) {
      const m = d.monster;
      shadow(m.x, m.y + 2, 5);
      if (m.hurt > 0 && Math.floor(clock * 30) % 2) continue;
      drawImg(Sprites.slime(m.type, Math.floor(m.t * 5) % 2), m.x - 8, m.y - 12);
      continue;
    }
    const X = d.x * TS, Y = d.y * TS;
    if (d.ft) {
      ctx.drawImage(Sprites.crop(d.ft.crop_type, d.ft.dead ? 5 : d.ft.growth_stage), X, Y - 8);
      continue;
    }
    const o = d.o;
    let bubble = null;
    switch (o.t) {
      case 'tree': ctx.drawImage(Sprites.tree(season), X - 4, Y - 16); break;
      case 'pine': ctx.drawImage(Sprites.pine(season), X - 4, Y - 16); break;
      case 'stump': ctx.drawImage(Sprites.stump(), X, Y); break;
      case 'rock': case 'copper': case 'iron': case 'gold': ctx.drawImage(Sprites.rock(o.t), X, Y); break;
      case 'weed': ctx.drawImage(Sprites.weed(season), X, Y); break;
      case 'branch': ctx.drawImage(Sprites.branch(), X, Y); break;
      case 'fence': case 'pfence': ctx.drawImage(Sprites.fence(maskOf(d.x, d.y, isFence)), X, Y); break;
      case 'sprinkler': case 'sprinkler2': case 'sprinkler3': ctx.drawImage(Sprites.sprinklerObj(SPRINKLER_R[o.t]), X, Y); break;
      case 'lamp': ctx.drawImage(Sprites.lampObj(), X, Y - 16); break;
      case 'flowerbed': ctx.drawImage(Sprites.flowerbedObj(), X, Y); break;
      case 'trophy': ctx.drawImage(Sprites.trophyObj(), X, Y); break;
      case 'statue': ctx.drawImage(Sprites.statueObj(), X, Y - 16); bubble = o.ready; break;
      case 'ladder_down': case 'ladder_up': ctx.drawImage(Sprites.ladder(o.t === 'ladder_up'), X, Y); break;
      case 'chest': case 'chest_open': ctx.drawImage(Sprites.chest(o.t === 'chest_open'), X, Y); break;
      default:
        if (o.t.startsWith('gem_')) ctx.drawImage(Sprites.gemNode(o.t.slice(4)), X, Y);
        else if (MACHINES[o.t]) { ctx.drawImage(Sprites.machine(o.t, !!o.input), X, Y - 8); if (machineReady(o)) bubble = o.out; }
    }
    if (bubble) drawBubble(X + 8, Y - (o.t === 'statue' ? 20 : 12), iconId(bubble));
  }

  if (scene === 'farm' && festivalToday()) drawBunting();

  // boia de pesca
  if (fishing && fishing.state !== 'cast') {
    const bx = fishing.tx * TS + 8, by = fishing.ty * TS + 8 + (fishing.state === 'bite' ? 2 : Math.sin(clock * 4));
    const hand = handPos();
    ctx.strokeStyle = 'rgba(240,240,240,0.8)'; ctx.lineWidth = 1 / zoom;
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]); ctx.lineTo(bx, by - 1); ctx.stroke();
    ctx.fillStyle = '#e8303e'; ctx.fillRect(bx - 1, by - 2, 3, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1, by, 3, 1);
  }

  for (const p of particles) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillRect(p.x, p.y, p.s, p.s); }
  ctx.globalAlpha = 1;

  const lanterns = lanternNight() ? lanternList() : [];
  for (const l of lanterns) {
    ctx.fillStyle = '#f08a24'; ctx.fillRect(l.x - 2, l.y - 3, 4, 5);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(l.x - 1, l.y - 2, 2, 3);
  }

  // tela: escuridão com luzes, chuva e textos flutuantes
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dark = scene === 'mine' ? 0.62 : darkness() * (scene === 'gh' ? 0.6 : 1);
  if (dark > 0) drawLighting(W, H, dark, x0, x1, y0, y1, lanterns);
  if (scene === 'farm' && S.weather !== 'sun') drawWeather(W, H);
  if (P.invuln > 0.7) { ctx.fillStyle = `rgba(255,40,40,${(P.invuln - 0.7) * 0.8})`; ctx.fillRect(0, 0, W, H); }
  drawFloaters();
}

function drawBubble(x, y, icon) {
  const by = y + Math.sin(clock * 3) * 1.5;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.arc(x, by, 6, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(Sprites.icon(icon), Math.round(x - 5), Math.round(by - 5), 10, 10);
}

function shadow(x, y, w = 6) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(x, y - 1, w, w * 0.42, 0, 0, Math.PI * 2); ctx.fill();
}

function drawAnimal(a, r) {
  const moving = r.wait <= 0, f = moving ? Math.floor(r.t * 6) % 2 : 0;
  if (a.type === 'chicken') {
    shadow(r.x, r.y, 4);
    drawImg(Sprites.chicken(r.dir === 3, f), r.x - 8, r.y - 15);
  } else {
    shadow(r.x, r.y, 9);
    drawImg(Sprites.cow(r.dir === 3, f), r.x - 12, r.y - 20);
  }
  if (a.ready) drawBubble(r.x, r.y - (a.type === 'cow' ? 32 : 26), baseOf(a.ready));
}

function drawBunting() {
  const xA = 16 * TS, xB = 26 * TS, y = 4 * TS + 6, cols = ['#e8303e', '#ffd84a', '#4aa8f0', '#5cc64a', '#c86ad8'];
  ctx.strokeStyle = '#5a3418'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(xA, y);
  ctx.quadraticCurveTo((xA + xB) / 2, y + 10, xB, y); ctx.stroke();
  for (let i = 1, n = 22; i < n; i++) {
    const t = i / n, x = xA + (xB - xA) * t, yy = y + 20 * t * (1 - t);
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(x - 2.5, yy); ctx.lineTo(x + 2.5, yy); ctx.lineTo(x, yy + 5); ctx.fill();
  }
}

function lanternList() {
  const out = [];
  for (let i = 0; i < 24; i++) {
    const h = hash(i, 7);
    out.push({ x: 15 * TS + (h % 190) + Math.sin(clock + i) * 3, y: 7 * TS - ((clock * (6 + h % 5) + h % 160) % 170) });
  }
  return out;
}

function handPos() {
  const v = DIRV[P.dir];
  return [P.x + v[0] * 12, P.y - 14 + v[1] * 8];
}

function drawPlayer() {
  shadow(P.x, P.y);
  if (P.invuln > 0 && Math.floor(clock * 20) % 2) return;
  const toolAnims = { hoe: 'hoe', water: 'can', axe: 'axe', pick: 'pick', rod: 'rod', sword: 'sword' };
  const ic = toolAnims[P.anim] ? iconId(toolAnims[P.anim]) : null;
  drawImg(Sprites.player(P.anim, P.dir, P.frame, ic), P.x - 16, P.y - 36);
}

function darkness() {
  const m = S.time % (24 * 60), t = S.time;
  if (t >= 24 * 60) return 0.6;
  if (m >= 18 * 60) return Math.min(0.6, (m - 18 * 60) / 180 * 0.45 + (m >= 21 * 60 ? (m - 21 * 60) / 180 * 0.15 : 0));
  if (m < 7 * 60) return 0.2 * (1 - (m - 6 * 60) / 60);
  return 0;
}

// Escurece a tela e "recorta" a luz de lampiões, janelas, lanternas, gemas e do jogador na mina
function drawLighting(W, H, dark, x0, x1, y0, y1, lanterns) {
  if (lightCv.width !== W || lightCv.height !== H) { lightCv.width = W; lightCv.height = H; }
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = scene === 'mine' ? `rgba(8,6,4,${dark + 0.25})` : `rgba(16,20,64,${dark})`;
  lctx.fillRect(0, 0, W, H);
  const lights = [];
  if (dark > 0.12) {
    for (let y = y0 - 3; y <= y1 + 3; y++) for (let x = x0 - 3; x <= x1 + 3; x++) {
      const o = inMap(x, y) && OBJS[key(x, y)];
      if (!o) continue;
      if (o.t === 'lamp') lights.push([x * TS + 8, y * TS - 6, 46]);
      else if (o.t.startsWith('gem_') || o.t === 'ladder_down' || o.t === 'chest') lights.push([x * TS + 8, y * TS + 8, 12]);
    }
    if (scene === 'farm' && S.time >= 18 * 60) {
      const hx = HOUSE.x * TS, hy = (HOUSE.y + HOUSE.h) * TS - 84;
      lights.push([hx + 18, hy + 60, 20], [hx + 62, hy + 60, 20]);
    }
    if (scene === 'mine') lights.push([P.x, P.y - 10, 70]);
    for (const l of lanterns) lights.push([l.x, l.y, 14]);
  }
  lctx.globalCompositeOperation = 'destination-out';
  for (const [wx, wy, r] of lights) {
    const sx = (wx - camX) * zoom, sy = (wy - camY) * zoom, rr = r * zoom;
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
  }
  ctx.drawImage(lightCv, 0, 0);
  if (lights.length) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [wx, wy, r] of lights) {
      const sx = (wx - camX) * zoom, sy = (wy - camY) * zoom, rr = r * zoom * 0.7;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
      g.addColorStop(0, `rgba(255,170,70,${0.22 * Math.min(1, dark / 0.6)})`); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawWeather(W, H) {
  const snow = S.weather === 'snow';
  if (rain.length < (snow ? 90 : 140)) for (let i = 0; i < 6; i++) rain.push({ x: Math.random() * W, y: Math.random() * -H, s: 0.6 + Math.random() * 0.6 });
  ctx.fillStyle = snow ? 'rgba(220,230,255,0.06)' : 'rgba(40,60,90,0.12)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(190,215,255,0.55)';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, zoom / 3);
  const dt = 1 / 60;
  for (const d of rain) {
    if (!isPaused()) { d.y += (snow ? 40 : 520) * d.s * dt * zoom / 3; d.x += (snow ? Math.sin(clock + d.s * 9) * 20 : -60) * dt; }
    if (d.y > H) { d.y = -10; d.x = Math.random() * W; }
    if (d.x < 0) d.x += W;
    if (snow) ctx.fillRect(d.x, d.y, zoom * 0.8, zoom * 0.8);
    else { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2 * zoom / 3, d.y + 7 * zoom / 3); ctx.stroke(); }
  }
}

function drawFloaters() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fs = Math.round(zoom * 5);
  ctx.font = `bold ${fs}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.imageSmoothingEnabled = false;
  for (const f of floaters) {
    const sx = (f.x - camX) * zoom, sy = (f.y - camY) * zoom;
    ctx.globalAlpha = Math.min(1, f.life * 2);
    let tx = sx;
    if (f.icon) {
      const size = zoom * 10;
      ctx.drawImage(Sprites.icon(f.icon), Math.round(sx - size / 2 - fs * 0.6), Math.round(sy - size / 2), size, size);
      tx = sx + fs * 0.8;
    }
    ctx.lineWidth = Math.max(2, zoom * 0.9);
    ctx.strokeStyle = '#2a1c14';
    ctx.strokeText(f.text, tx, sy);
    ctx.fillStyle = f.color || (f.text === '!' || f.text.startsWith('★') || f.text === 'Escada!' ? '#ffe14a' : f.text === '❤' ? '#ff6b8a' : '#ffffff');
    ctx.fillText(f.text, tx, sy);
  }
  ctx.globalAlpha = 1;
}

function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  update(dt);
  render();
  if (S && P) UI.tick();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- controles
function setupInput() {
  window.addEventListener('keydown', e => {
    if (e.repeat && !e.code.startsWith('Arrow') && !'KeyWKeyAKeySKeyD'.includes(e.code)) return;
    Sound.init();
    if (UI.handleKey(e)) { e.preventDefault(); return; }
    input.keys.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { input.actionHeld = true; doAction(); }
    if (/^Digit[1-6]$/.test(e.code)) { S.sel = +e.code.slice(5) - 1; UI.refresh(); }
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', e => {
    input.keys.delete(e.code);
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') input.actionHeld = false;
  });
  window.addEventListener('blur', () => { input.keys.clear(); input.actionHeld = false; input.joy = null; UI.joystick(null); });

  // Toque/arraste no mapa: arrastar = D-pad dinâmico; toque rápido = tap-to-move / interagir
  let pid = null, sx = 0, sy = 0, st = 0, dragging = false;
  const R = () => Math.min(60, Math.max(40, Math.min(window.innerWidth, window.innerHeight) * 0.12));
  cvs.addEventListener('pointerdown', e => {
    Sound.init();
    if (pid !== null) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now(); dragging = false;
    cvs.setPointerCapture(pid);
  });
  cvs.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, d = Math.hypot(dx, dy);
    if (!dragging && d > 12) dragging = true;
    if (dragging) {
      const r = R(), m = Math.min(1, d / r);
      input.joy = { x: d ? dx / d * m : 0, y: d ? dy / d * m : 0, mag: m };
      UI.joystick({ bx: sx, by: sy, kx: sx + (d ? dx / d : 0) * Math.min(d, r), ky: sy + (d ? dy / d : 0) * Math.min(d, r), r });
    }
  });
  const end = e => {
    if (e.pointerId !== pid) return;
    if (!dragging && performance.now() - st < 450 && e.type === 'pointerup') {
      const dpr = cvs.width / window.innerWidth;
      handleTap(camX + e.clientX * dpr / zoom, camY + e.clientY * dpr / zoom);
    }
    pid = null; dragging = false; input.joy = null;
    UI.joystick(null);
  };
  cvs.addEventListener('pointerup', end);
  cvs.addEventListener('pointercancel', end);
  cvs.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (S && UI.inGame()) save(); Sound.suspend(); } else Sound.resume();
  });
  window.addEventListener('pagehide', () => { if (S && UI.inGame()) save(); });
  window.addEventListener('resize', resize);
}

// ---------------------------------------------------------------- início
function startGame(fresh) {
  if (fresh) S = newState();
  else { S = loadSave() || newState(); }
  P = newPlayer();
  mine = null;
  setScene('farm');
  if (fresh) S.quests.push(genQuest());
  particles = []; floaters = []; fishing = null; rain = []; animRT = {};
  UI.refresh();
  if (!S.seenIntro) { S.seenIntro = true; UI.intro(); }
  save();
}

function boot() {
  buildGround();
  resize();
  setupInput();
  S = loadSave() || newState();
  P = newPlayer();
  setScene('farm');
  UI.init();
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
