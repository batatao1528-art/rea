'use strict';
/*
 * Vale Florido — lógica principal: mapa, fazenda, tempo, jogador, ações e renderização.
 *
 * Core loop: limpar/preparar o solo -> plantar e regar -> esperar os dias ->
 * colher -> vender na Caixa de Envio -> melhorar ferramentas / expandir.
 */
const TS = 16, MW = 52, MH = 40;
const G_GRASS = 0, G_PATH = 1, G_PLANK = 2, G_WATER = 3, G_STONE = 4;
const SEASONS = ['Primavera', 'Verão', 'Outono', 'Inverno'];
const DAYS_PER_SEASON = 28;
const DAY_START = 6 * 60, PASS_OUT = 26 * 60; // 06:00 e 02:00 do dia seguinte
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // baixo, cima, esquerda, direita
const SAVE_KEY = 'valeflorido_save_v1';
const SPEED = 70; // pixels de arte por segundo

const CROPS = {
  carrot: { name: 'Cenoura', days: 3, item: 'carrot', xp: 6 },
  corn: { name: 'Milho', days: 4, item: 'corn', xp: 10 },
  tomato: { name: 'Tomate', days: 5, regrow: 3, item: 'tomato', xp: 8 },
  strawberry: { name: 'Morango', days: 6, item: 'strawberry', xp: 14 },
};

const ITEMS = {
  hoe: { name: 'Enxada', kind: 'tool', desc: 'Ara a terra para plantar.' },
  can: { name: 'Regador', kind: 'tool', desc: 'Rega as plantas. Encha no lago.' },
  axe: { name: 'Machado', kind: 'tool', desc: 'Corta árvores, tocos e galhos.' },
  pick: { name: 'Picareta', kind: 'tool', desc: 'Quebra pedras e minérios. Também desfaz terra arada.' },
  rod: { name: 'Vara de Pesca', kind: 'tool', desc: 'Use virado para a água. Toque quando aparecer "!".' },
  seed_carrot: { name: 'Sementes de Cenoura', kind: 'seed', crop: 'carrot', price: 15, desc: 'Cresce em 3 dias.' },
  seed_corn: { name: 'Sementes de Milho', kind: 'seed', crop: 'corn', price: 30, desc: 'Cresce em 4 dias.' },
  seed_tomato: { name: 'Sementes de Tomate', kind: 'seed', crop: 'tomato', price: 50, desc: 'Cresce em 5 dias e produz de novo a cada 3.' },
  seed_strawberry: { name: 'Sementes de Morango', kind: 'seed', crop: 'strawberry', price: 60, desc: 'Cresce em 6 dias. Muito valioso!' },
  carrot: { name: 'Cenoura', kind: 'crop', sell: 40, energy: 12 },
  corn: { name: 'Milho', kind: 'crop', sell: 90, energy: 18 },
  tomato: { name: 'Tomate', kind: 'crop', sell: 60, energy: 14 },
  strawberry: { name: 'Morango', kind: 'crop', sell: 180, energy: 25 },
  fish_sardine: { name: 'Sardinha', kind: 'fish', sell: 30, energy: 10 },
  fish_carp: { name: 'Carpa', kind: 'fish', sell: 45, energy: 12 },
  fish_tilapia: { name: 'Tilápia', kind: 'fish', sell: 65, energy: 15 },
  fish_catfish: { name: 'Bagre', kind: 'fish', sell: 120, energy: 22 },
  wood: { name: 'Madeira', kind: 'res', sell: 2 },
  stone: { name: 'Pedra', kind: 'res', sell: 2 },
  copper: { name: 'Minério de Cobre', kind: 'res', sell: 15 },
  iron: { name: 'Minério de Ferro', kind: 'res', sell: 30 },
  bread: { name: 'Pão', kind: 'food', price: 40, sell: 12, energy: 35 },
  soup: { name: 'Sopa de Legumes', kind: 'food', price: 90, sell: 30, energy: 75 },
};

const FISH = [
  { id: 'fish_sardine', w: 40, lvl: 1 }, { id: 'fish_carp', w: 30, lvl: 1 },
  { id: 'fish_tilapia', w: 20, lvl: 2 }, { id: 'fish_catfish', w: 8, lvl: 3 },
];

const HP = { tree: 4, stump: 3, rock: 2, copper: 3, iron: 4, weed: 1, branch: 1, pine: 999, fence: 999 };

const HOUSE = { x: 5, y: 3, w: 5, h: 4, door: { x: 7, y: 6 } };
const BIN = { x: 10, y: 6, w: 2, h: 1 };
const STALL = { x: 19, y: 5, w: 3, h: 2 };
const STRUCTS = [HOUSE, BIN, STALL];
const QUARRY = { x0: 37, y0: 3, x1: 48, y1: 10 };
const EXP = { x0: 36, y0: 12, x1: 48, y1: 37 };
const WAKE = { x: 7 * TS + 8, y: 7 * TS + 12 };

const UPGRADES = [
  { id: 'hoe', name: 'Enxada de Ferro', icon: 'hoe2', desc: 'Ara 3 tiles em linha de uma vez.', cost: 400, mats: { copper: 5 },
    have: () => S.tools.hoe >= 2, apply: () => { S.tools.hoe = 2; } },
  { id: 'can', name: 'Regador Grande', icon: 'can2f', desc: 'Guarda 40 de água e rega 3 tiles em linha.', cost: 400, mats: { copper: 5 },
    have: () => S.tools.can >= 2, apply: () => { S.tools.can = 2; S.water = waterCap(); } },
  { id: 'axe', name: 'Machado de Ferro', icon: 'axe2', desc: 'Dano dobrado em árvores e tocos.', cost: 350, mats: { iron: 3 },
    have: () => S.tools.axe >= 2, apply: () => { S.tools.axe = 2; } },
  { id: 'pick', name: 'Picareta de Ferro', icon: 'pick2', desc: 'Quebra pedras mais rápido e encontra mais minério.', cost: 350, mats: { iron: 3 },
    have: () => S.tools.pick >= 2, apply: () => { S.tools.pick = 2; } },
  { id: 'bag1', name: 'Mochila Maior', icon: 'crate', desc: '+6 espaços no inventário.', cost: 500, mats: {},
    have: () => S.bag >= 18, apply: () => growBag(18) },
  { id: 'bag2', name: 'Mochila de Couro', icon: 'crate', desc: '+6 espaços no inventário.', cost: 1500, mats: {},
    need: () => S.bag >= 18, have: () => S.bag >= 24, apply: () => growBag(24) },
  { id: 'expand', name: 'Expansão da Fazenda', icon: 'wood', desc: 'Remove a cerca a leste e libera um terreno novo.', cost: 1500, mats: { wood: 50 },
    have: () => S.expanded, apply: () => expandFarm() },
];

// ---------------------------------------------------------------- utilidades
const key = (x, y) => x + ',' + y;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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

// ---------------------------------------------------------------- estado
let S = null;   // estado salvo (fazenda, inventário, data...)
let P = null;   // jogador em tempo real
let ground = [];
let particles = [], floaters = [], rain = [];
let fishing = null;
let sleeping = false;
let zoom = 4, camX = 0, camY = 0, viewW = 0, viewH = 0;
let lastT = 0, clock = 0;
const input = { keys: new Set(), joy: null, actionHeld: false, lastAction: 0 };

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');

function buildGround() {
  ground = [];
  for (let y = 0; y < MH; y++) ground.push(new Array(MW).fill(G_GRASS));
  for (let y = QUARRY.y0; y <= QUARRY.y1; y++) for (let x = QUARRY.x0; x <= QUARRY.x1; x++) ground[y][x] = G_STONE;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const dx = (x - 10) / 5.2, dy = (y - 31) / 3.6;
    if (dx * dx + dy * dy <= 1) ground[y][x] = G_WATER;
  }
  for (let x = 7; x <= 37; x++) ground[8][x] = G_PATH;
  for (let y = 7; y <= 27; y++) ground[y][7] = G_PATH;
  for (let x = 8; x <= 10; x++) ground[27][x] = G_PATH;
  for (let y = 28; y <= 31; y++) ground[y][10] = G_PLANK;
}

const structAt = (x, y) => STRUCTS.find(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) || null;
const obj = (x, y) => S.objs[key(x, y)];
const farmTile = (x, y) => S.farm[key(x, y)];
const inMap = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;

function isBlocked(x, y) {
  if (!inMap(x, y)) return true;
  if (ground[y][x] === G_WATER) return true;
  return !!(obj(x, y) || structAt(x, y));
}

function newFarmTile(x, y) {
  return { tile_x: x, tile_y: y, is_tilled: true, is_watered: false, crop_type: null, growth_stage: 0, days_planted: 0, dry_days: 0, dead: false };
}

function genObjects(s) {
  const r = rng(20261023);
  const put = (x, y, t) => { s.objs[key(x, y)] = { t, hp: HP[t] }; };
  const free = (x, y) => ground[y][x] === G_GRASS && !structAt(x, y) && !s.objs[key(x, y)];
  const reserved = (x, y) => (y <= 9 && x <= 24) || (x >= 12 && x <= 17 && y >= 9 && y <= 13) ||
    (Math.abs(x - 7) <= 1 && y <= 28) || (y === 7 || y === 9) && x <= 37;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (x < 2 || y < 2 || x >= MW - 2 || y >= MH - 2) { if (ground[y][x] !== G_PATH) put(x, y, 'pine'); continue; }
    const ring = x <= 2 || y <= 2 || x >= MW - 3 || y >= MH - 3;
    if (ring && free(x, y) && r() < 0.5 && !(x <= 12 && y <= 9)) put(x, y, 'pine');
  }
  for (let y = 11; y <= 37; y++) put(35, y, 'fence');
  for (let x = 36; x <= 48; x++) put(x, 11, 'fence');
  for (let y = 3; y < MH - 2; y++) for (let x = 3; x < MW - 3; x++) {
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
    if (ground[y][x] === G_STONE && !s.objs[key(x, y)] && r() < 0.4) put(x, y, oreRoll(r, 1));
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
    bag: 12, inv: [], sel: 0, tools: { hoe: 1, can: 1, axe: 1, pick: 1 }, water: 20,
    farm: {}, objs: {}, bin: [], expanded: false, weather: 'sun',
    px: WAKE.x, py: WAKE.y, dir: 0, seenIntro: false,
    stats: { harvest: 0, fish: 0, ore: 0, earned: 0 },
  };
  s.inv = new Array(s.bag).fill(null);
  [['hoe', 1], ['can', 1], ['seed_carrot', 12], ['axe', 1], ['pick', 1], ['rod', 1]]
    .forEach(([id, qty], i) => { s.inv[i] = { id, qty }; });
  genObjects(s);
  for (let x = 13; x <= 15; x++) for (let y = 10; y <= 11; y++) s.farm[key(x, y)] = newFarmTile(x, y);
  return s;
}

function newPlayer() {
  return { x: S.px, y: S.py, dir: S.dir || 0, anim: 'idle', frame: 0, animT: 0,
    busy: false, actT: 0, dur: 0, frameDur: 0.11, frames: 1, hitAt: null, onHit: null, path: null, pathEnd: null };
}

const maxEnergy = () => 100 + (S.level - 1) * 5;
const waterCap = () => S.tools.can >= 2 ? 40 : 20;
const xpNeed = l => l * 100;
const playerTile = () => [Math.floor(P.x / TS), Math.floor((P.y - 3) / TS)];
const targetTile = () => { const [x, y] = playerTile(), v = DIRV[P.dir]; return [x + v[0], y + v[1]]; };
const selItem = () => S.inv[S.sel] || null;

function iconId(id) {
  switch (id) {
    case 'hoe': return 'hoe' + S.tools.hoe;
    case 'can': return 'can' + S.tools.can + (S.water > 0 ? 'f' : '');
    case 'axe': return 'axe' + S.tools.axe;
    case 'pick': return 'pick' + S.tools.pick;
    default: return id;
  }
}

// ---------------------------------------------------------------- inventário
function addItem(id, qty = 1) {
  const tool = ITEMS[id].kind === 'tool';
  if (!tool) for (const it of S.inv) if (it && it.id === id) { it.qty += qty; UI.refresh(); return 0; }
  const i = S.inv.findIndex(v => !v);
  if (i < 0) { UI.refresh(); return qty; }
  S.inv[i] = { id, qty };
  UI.refresh();
  return 0;
}
const countItem = id => S.inv.reduce((n, it) => n + (it && it.id === id ? it.qty : 0), 0);
function removeItem(id, qty) {
  for (let i = 0; i < S.inv.length && qty > 0; i++) {
    const it = S.inv[i];
    if (!it || it.id !== id) continue;
    const take = Math.min(qty, it.qty);
    it.qty -= take; qty -= take;
    if (it.qty <= 0) S.inv[i] = null;
  }
  UI.refresh();
}
const hasRoom = id => S.inv.some(v => !v || (v.id === id && ITEMS[id].kind !== 'tool'));
function growBag(n) { while (S.inv.length < n) S.inv.push(null); S.bag = n; }
function expandFarm() {
  S.expanded = true;
  for (const k of Object.keys(S.objs)) if (S.objs[k].t === 'fence') delete S.objs[k];
}

function addXP(n) {
  if (S.level >= 10) return;
  S.xp += n;
  while (S.level < 10 && S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level);
    S.level++;
    S.energy = Math.min(maxEnergy(), S.energy + 20);
    Sound.play('level');
    UI.toast(`⭐ Subiu para o nível ${S.level}! Energia máxima +5`);
  }
  if (S.level >= 10) S.xp = 0;
}

// ---------------------------------------------------------------- partículas
function burst(tx, ty, colors, n = 8, up = 40) {
  for (let i = 0; i < n; i++) {
    particles.push({ x: tx * TS + 8 + (Math.random() - 0.5) * 8, y: ty * TS + 10, vx: (Math.random() - 0.5) * 50,
      vy: -Math.random() * up - 10, life: 0.5 + Math.random() * 0.3, c: colors[i % colors.length], s: Math.random() < 0.5 ? 1 : 2 });
  }
}
function floatText(wx, wy, text, icon) { floaters.push({ x: wx, y: wy, text, icon, life: 1.2 }); }

// ---------------------------------------------------------------- ações
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
  return inMap(x, y) && ground[y][x] === G_GRASS && !obj(x, y) && !structAt(x, y) && !farmTile(x, y);
}

function useHoe() {
  if (!spend(S.tools.hoe >= 2 ? 3 : 2)) return;
  startAnim('hoe', 3, 0.11, 2, () => {
    let done = 0;
    for (const [x, y] of lineTiles(S.tools.hoe >= 2 ? 3 : 1)) {
      if (!canTill(x, y)) continue;
      S.farm[key(x, y)] = newFarmTile(x, y);
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
    for (const [x, y] of lineTiles(S.tools.can >= 2 ? 3 : 1)) {
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

function useAxe() {
  const [tx, ty] = targetTile();
  const o = inMap(tx, ty) ? obj(tx, ty) : null;
  if (o && o.t === 'pine') { UI.toast('🌲 Essa árvore da floresta é grande demais para cortar.'); return; }
  if (!spend(3)) return;
  startAnim('axe', 3, 0.11, 2, () => {
    const o2 = obj(tx, ty);
    if (!o2 || !['tree', 'stump', 'branch'].includes(o2.t)) { Sound.play('swing'); return; }
    o2.hp -= S.tools.axe >= 2 ? 2 : 1;
    Sound.play('chop');
    burst(tx, ty, ['#c89a62', '#7a4c28', '#4caf3a'], 8);
    if (o2.hp > 0) return;
    if (o2.t === 'tree') {
      S.objs[key(tx, ty)] = { t: 'stump', hp: HP.stump };
      gain('wood', 4 + (Math.random() * 3 | 0), tx, ty); addXP(4);
    } else {
      delete S.objs[key(tx, ty)];
      gain('wood', o2.t === 'stump' ? 3 : 1, tx, ty); addXP(o2.t === 'stump' ? 3 : 1);
    }
  });
}

function usePick() {
  const [tx, ty] = targetTile();
  if (!spend(3)) return;
  startAnim('pick', 3, 0.11, 2, () => {
    const o = inMap(tx, ty) ? obj(tx, ty) : null;
    if (o && ['rock', 'copper', 'iron'].includes(o.t)) {
      o.hp -= S.tools.pick >= 2 ? 2 : 1;
      Sound.play('rock');
      burst(tx, ty, ['#bab6b0', '#76726c', '#d8d4ce'], 8);
      if (o.hp > 0) return;
      delete S.objs[key(tx, ty)];
      gain('stone', 1 + (Math.random() * 2 | 0), tx, ty);
      if (o.t !== 'rock') { gain(o.t, 1, tx, ty); S.stats.ore++; addXP(10); } else addXP(3);
      return;
    }
    const ft = inMap(tx, ty) ? farmTile(tx, ty) : null;
    if (ft && !ft.crop_type) { delete S.farm[key(tx, ty)]; Sound.play('hoe'); burst(tx, ty, ['#6dbf3e', '#8f5d2e'], 6); return; }
    Sound.play('swing');
  });
}

function gain(id, qty, tx, ty) {
  const left = addItem(id, qty);
  if (left < qty) floatText(tx * TS + 8, ty * TS, `+${qty - left}`, iconId(id));
  if (left) UI.toast('🎒 Mochila cheia!');
}

function pickDebris(tx, ty, o) {
  startAnim('harvest', 2, 0.12, 1, () => {
    delete S.objs[key(tx, ty)];
    if (o.t === 'branch') gain('wood', 1, tx, ty);
    burst(tx, ty, o.t === 'weed' ? ['#4f9a2c', '#7ad35c'] : ['#7a4c28', '#c89a62'], 6);
    Sound.play('plant');
  });
}

function plant(tx, ty, it) {
  const ft = farmTile(tx, ty);
  if (!ft) { UI.toast('Use a enxada para arar a terra antes de plantar.'); return; }
  if (ft.crop_type) return;
  if (S.season === 3) { Sound.play('error'); UI.toast('❄️ Nada cresce no inverno. Espere a primavera!'); return; }
  const def = ITEMS[it.id];
  Object.assign(ft, { crop_type: def.crop, growth_stage: 1, days_planted: 0, dry_days: 0, dead: false });
  removeItem(it.id, 1);
  Sound.play('plant');
  burst(tx, ty, ['#6e4420', '#a8703c'], 4, 15);
  startAnim('harvest', 2, 0.08, null);
}

function harvest(tx, ty) {
  const ft = farmTile(tx, ty), crop = CROPS[ft.crop_type];
  if (!hasRoom(crop.item)) { Sound.play('error'); UI.toast('🎒 Mochila cheia!'); return; }
  startAnim('harvest', 2, 0.13, 1, () => {
    const qty = 1 + (Math.random() < S.level * 0.04 ? 1 : 0);
    gain(crop.item, qty, tx, ty);
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

function eat(it) {
  const def = ITEMS[it.id];
  if (S.energy >= maxEnergy()) { UI.toast('Você já está com a energia cheia.'); return; }
  const gainE = Math.min(def.energy, maxEnergy() - S.energy);
  S.energy += gainE;
  removeItem(it.id, 1);
  Sound.play('eat');
  floatText(P.x, P.y - 30, `+${Math.round(gainE)} ❤️`);
}

// --- pesca
function startFishing(tx, ty) {
  if (!spend(4)) return;
  startAnim('rod', 3, 0.13, 2, () => {
    fishing = { state: 'wait', t: 1.5 + Math.random() * 3.5, tx, ty };
    Sound.play('splash');
    burst(tx, ty, ['#8ad0ff', '#e8f6ff'], 5, 25);
  });
}
function reel() {
  if (!fishing) return;
  if (fishing.state === 'bite') {
    const pool = FISH.filter(f => S.level >= f.lvl);
    let w = pool.reduce((a, f) => a + f.w, 0) * Math.random(), pick = pool[0];
    for (const f of pool) { w -= f.w; if (w <= 0) { pick = f; break; } }
    const { tx, ty } = fishing;
    fishing = null;
    if (!hasRoom(pick.id)) { UI.toast('🎒 Mochila cheia! O peixe escapou.'); }
    else {
      gain(pick.id, 1, tx, ty);
      S.stats.fish++;
      addXP(8 + FISH.indexOf(pick) * 5);
      Sound.play('pop');
      UI.toast(`🎣 Você pescou: ${ITEMS[pick.id].name}!`);
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

// --- resolução da ação contextual (botão grande)
function resolveAction() {
  if (fishing) return { icon: 'rod', label: fishing.state === 'bite' ? 'PUXAR!' : 'Puxar', run: reel };
  const [tx, ty] = targetTile();
  const st = structAt(tx, ty);
  if (st === HOUSE && tx === HOUSE.door.x && ty === HOUSE.door.y) return { emoji: '🛏️', label: 'Dormir', run: () => UI.askSleep() };
  if (st === BIN) return { emoji: '📦', label: 'Enviar', run: () => UI.openBin() };
  if (st === STALL && ty === STALL.y + STALL.h - 1) return { emoji: '🛒', label: 'Loja', run: () => UI.openShop() };
  const ft = inMap(tx, ty) ? farmTile(tx, ty) : null;
  if (ft && ft.crop_type) {
    if (ft.dead) return { emoji: '🧹', label: 'Limpar', run: () => clearDead(tx, ty) };
    if (ft.growth_stage >= 4) return { emoji: '🖐️', label: 'Colher', run: () => harvest(tx, ty) };
  }
  const o = inMap(tx, ty) ? obj(tx, ty) : null;
  if (o && (o.t === 'weed' || o.t === 'branch')) {
    return { emoji: '🖐️', label: o.t === 'weed' ? 'Arrancar' : 'Pegar', run: () => pickDebris(tx, ty, o) };
  }
  const it = selItem();
  if (!it) return { emoji: '🖐️', label: 'Mão', run: null };
  const def = ITEMS[it.id];
  const water = inMap(tx, ty) && ground[ty][tx] === G_WATER;
  switch (it.id) {
    case 'hoe': return { icon: iconId('hoe'), label: 'Arar', run: useHoe };
    case 'can': return { icon: iconId('can'), label: water ? 'Encher' : 'Regar', run: useCan };
    case 'axe': return { icon: iconId('axe'), label: 'Cortar', run: useAxe };
    case 'pick': return { icon: iconId('pick'), label: 'Quebrar', run: usePick };
    case 'rod': return { icon: 'rod', label: 'Pescar', run: water ? () => startFishing(tx, ty) : () => UI.toast('Fique de frente para a água para pescar 🎣') };
  }
  if (def.kind === 'seed') return { icon: it.id, label: 'Plantar', run: () => plant(tx, ty, it) };
  if (def.energy) return { emoji: '🍽️', label: 'Comer', run: () => eat(it) };
  return { icon: it.id, label: def.name, run: null };
}

// Ações que se repetem enquanto o botão fica pressionado
const REPEATABLE = new Set(['Arar', 'Regar', 'Cortar', 'Quebrar', 'Colher', 'Arrancar', 'Pegar', 'Limpar']);

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

function nextDay(passedOut) {
  const report = { sales: [], total: 0, passedOut, lost: 0, died: 0 };
  // venda da Caixa de Envio
  for (const it of S.bin) {
    const price = ITEMS[it.id].sell * it.qty;
    report.sales.push({ id: it.id, qty: it.qty, total: price });
    report.total += price;
  }
  S.bin = [];
  S.gold += report.total;
  S.stats.earned += report.total;

  // crescimento das plantas
  for (const k of Object.keys(S.farm)) {
    const ft = S.farm[k];
    if (ft.crop_type && !ft.dead) {
      if (ft.is_watered) { ft.days_planted++; ft.dry_days = 0; }
      else if (++ft.dry_days >= 3) { ft.dead = true; ft.growth_stage = 5; report.died++; }
      if (!ft.dead) ft.growth_stage = stageFor(ft);
    } else if (!ft.crop_type && !ft.is_watered && Math.random() < 0.08) {
      delete S.farm[k];
      continue;
    }
    ft.is_watered = false;
  }

  // avança o calendário
  S.day++;
  if (S.day > DAYS_PER_SEASON) {
    S.day = 1;
    S.season = (S.season + 1) % 4;
    if (S.season === 0) S.year++;
    report.newSeason = SEASONS[S.season];
    if (S.season === 3) {
      for (const ft of Object.values(S.farm)) {
        if (ft.crop_type && !ft.dead) { ft.dead = true; ft.growth_stage = 5; report.died++; }
      }
    }
  }
  S.weather = Math.random() < (S.season === 3 ? 0.25 : 0.18) ? (S.season === 3 ? 'snow' : 'rain') : 'sun';
  if (S.weather === 'rain') for (const ft of Object.values(S.farm)) ft.is_watered = true;

  spawnDebris();
  refillQuarry();

  if (passedOut) {
    report.lost = Math.min(500, Math.floor(S.gold * 0.1));
    S.gold -= report.lost;
    S.energy = Math.round(maxEnergy() * 0.6);
  } else S.energy = maxEnergy();
  S.time = DAY_START;
  P.x = WAKE.x; P.y = WAKE.y; P.dir = 0; P.anim = 'idle'; P.busy = false; P.path = null;
  fishing = null;
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
    if (ground[y][x] !== G_STONE || obj(x, y)) continue;
    const [px, py] = playerTile();
    if (x === px && y === py) continue;
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
    if (P) { S.px = P.x; S.py = P.y; S.dir = P.dir; }
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch (e) { /* sem armazenamento disponível */ }
}
function loadSave() {
  try {
    const t = localStorage.getItem(SAVE_KEY);
    if (!t) return null;
    const s = JSON.parse(t);
    return s && s.v === 1 ? s : null;
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
  let goals = new Set();
  let target = st === HOUSE ? [HOUSE.door.x, HOUSE.door.y] : st === STALL ? [STALL.x + 1, STALL.y + 1] : [tx, ty];
  if (isBlocked(...target) || st) {
    for (const [dx, dy] of DIRV) { const nx = target[0] + dx, ny = target[1] + dy; if (!isBlocked(nx, ny)) goals.add(key(nx, ny)); }
  } else goals.add(key(tx, ty));
  const path = findPath(px, py, goals);
  if (!path) return;
  P.path = path.map(([x, y]) => ({ x: x * TS + 8, y: y * TS + 11 }));
  P.pathEnd = (isBlocked(...target) || st) ? { face: target, act: !!st } : null;
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
}

function isPaused() { return sleeping || UI.blocking(); }

// ---------------------------------------------------------------- loop
function update(dt) {
  clock += dt;
  if (isPaused()) return;
  S.time += dt; // 1 segundo real = 1 minuto no jogo (1 minuto real = 1 hora)
  if (S.time >= PASS_OUT) { UI.toast('😵 Você desmaiou de cansaço às 2h...'); sleep(true); return; }
  updatePlayer(dt);
  updateFishing(dt);
  if (input.actionHeld && !P.busy && clock - input.lastAction > 0.3) {
    const a = resolveAction();
    if (a.run && REPEATABLE.has(a.label)) doAction();
  }
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

function render() {
  const W = cvs.width, H = cvs.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#16301c';
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
  const isG = (x, y, g) => inMap(x, y) && ground[y][x] === g;
  const isWaterish = (x, y) => !inMap(x, y) || ground[y][x] === G_WATER || ground[y][x] === G_PLANK;

  // camada 1: fundo (grama, água, caminhos)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const g = ground[y][x], X = x * TS, Y = y * TS;
    if (g === G_WATER || g === G_PLANK) {
      ctx.drawImage(Sprites.water(wf, maskOf(x, y, isWaterish)), X, Y);
      if (g === G_PLANK) ctx.drawImage(Sprites.plank(), X, Y);
      continue;
    }
    if (g === G_STONE) { ctx.drawImage(Sprites.stone(hash(x, y) % 5 === 0 ? 1 : 0), X, Y); continue; }
    const h = hash(x, y) % 16;
    ctx.drawImage(Sprites.grass(season, h < 1 ? 2 : h < 4 ? 1 : h === 5 ? 3 : 0), X, Y);
    if (g === G_PATH) ctx.drawImage(Sprites.path(maskOf(x, y, (a, b) => isG(a, b, G_PATH) || isG(a, b, G_PLANK))), X, Y);
  }
  // camada 2: terra arada
  const tilled = (a, b) => !!S.farm[key(a, b)];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const ft = S.farm[key(x, y)];
    if (ft) ctx.drawImage(Sprites.soil(maskOf(x, y, tilled), ft.is_watered), x * TS, y * TS);
  }
  // cursor do tile alvo
  if (!isPaused()) {
    const [tx, ty] = targetTile();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1 / zoom * Math.max(1, Math.round(zoom / 3));
    ctx.strokeRect(tx * TS + 0.5, ty * TS + 0.5, TS - 1, TS - 1);
  }

  // camada 3: objetos, plantas, estruturas e jogador ordenados por profundidade
  const list = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = S.objs[key(x, y)];
    if (o) list.push({ z: y * TS + 15, o, x, y });
    const ft = S.farm[key(x, y)];
    if (ft && ft.crop_type) list.push({ z: y * TS + 8, ft, x, y });
  }
  list.push({ z: (HOUSE.y + HOUSE.h) * TS, img: Sprites.house(), x: HOUSE.x * TS, y: (HOUSE.y + HOUSE.h) * TS - 84 });
  list.push({ z: (BIN.y + 1) * TS, img: Sprites.bin(), x: BIN.x * TS, y: (BIN.y + 1) * TS - 26 });
  list.push({ z: (STALL.y + STALL.h) * TS, img: Sprites.stall(), x: STALL.x * TS, y: (STALL.y + STALL.h) * TS - 56 });
  list.push({ z: P.y, player: true });
  list.sort((a, b) => a.z - b.z);
  const isFence = (a, b) => { const o = inMap(a, b) && S.objs[key(a, b)]; return !!(o && o.t === 'fence'); };
  for (const d of list) {
    if (d.img) { ctx.drawImage(d.img, d.x, d.y); continue; }
    if (d.player) { drawPlayer(); continue; }
    const X = d.x * TS, Y = d.y * TS;
    if (d.ft) {
      ctx.drawImage(Sprites.crop(d.ft.crop_type, d.ft.dead ? 5 : d.ft.growth_stage), X, Y - 8);
      continue;
    }
    const o = d.o;
    switch (o.t) {
      case 'tree': ctx.drawImage(Sprites.tree(season), X - 4, Y - 16); break;
      case 'pine': ctx.drawImage(Sprites.pine(season), X - 4, Y - 16); break;
      case 'stump': ctx.drawImage(Sprites.stump(), X, Y); break;
      case 'rock': case 'copper': case 'iron': ctx.drawImage(Sprites.rock(o.t), X, Y); break;
      case 'weed': ctx.drawImage(Sprites.weed(season), X, Y); break;
      case 'branch': ctx.drawImage(Sprites.branch(), X, Y); break;
      case 'fence': ctx.drawImage(Sprites.fence(maskOf(d.x, d.y, isFence)), X, Y); break;
    }
  }

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

  // tela: noite, chuva e textos flutuantes
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dark = darkness();
  if (dark > 0) { ctx.fillStyle = `rgba(16,20,64,${dark})`; ctx.fillRect(0, 0, W, H); }
  if (S.weather !== 'sun') drawWeather(W, H);
  drawFloaters();
}

function handPos() {
  const v = DIRV[P.dir];
  return [P.x + v[0] * 12, P.y - 14 + v[1] * 8];
}

function drawPlayer() {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(P.x, P.y - 1, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  const toolAnims = { hoe: 'hoe', water: 'can', axe: 'axe', pick: 'pick', rod: 'rod' };
  const ic = toolAnims[P.anim] ? iconId(toolAnims[P.anim]) : null;
  drawImg(Sprites.player(P.anim, P.dir, P.frame, ic), P.x - 16, P.y - 36);
}

function darkness() {
  const m = S.time % (24 * 60), t = S.time;
  if (t >= 24 * 60) return 0.55;
  if (m >= 18 * 60) return Math.min(0.55, (m - 18 * 60) / 180 * 0.45 + (m >= 21 * 60 ? (m - 21 * 60) / 180 * 0.1 : 0));
  if (m < 7 * 60) return 0.2 * (1 - (m - 6 * 60) / 60);
  return 0;
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
    ctx.fillStyle = f.text === '!' ? '#ffe14a' : '#ffffff';
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
  particles = []; floaters = []; fishing = null; rain = [];
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
  UI.init();
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
