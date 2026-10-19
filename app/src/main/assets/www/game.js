'use strict';
/* =====================================================================
   O Cuidador Caótico — bichinho de estimação bagunceiro
   Tudo desenhado em Canvas 2D, sons sintetizados com WebAudio (offline).
   ===================================================================== */

const $ = (id) => document.getElementById(id);
const cv = $('c');
const g = cv.getContext('2d');
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const ease = (t) => t * t * (3 - 2 * t);

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mix(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' + Math.round(lerp(a[1], b[1], t)) + ',' + Math.round(lerp(a[2], b[2], t)) + ')';
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

/* ------------------------------------------------------------------ */
/* Som                                                                  */
/* ------------------------------------------------------------------ */
const Snd = (() => {
  let ac = null, master = null, noiseBuf = null, on = true;
  const loops = {};
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = on ? 0.8 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function tone(f, d, type, vol, slideTo, delay) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + d);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(d, vol, ftype, freq, delay, q) {
    if (!ac) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype || 'highpass'; f.frequency.value = freq || 1500; f.Q.value = q || 0.8;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(gn); gn.connect(master); s.start(t, Math.random()); s.stop(t + d + 0.02);
  }
  function loopStart(name, ftype, freq, vol, hum) {
    if (!ac || loops[name]) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.value = freq;
    const gn = ac.createGain(); gn.gain.value = 0.0001;
    s.connect(f); f.connect(gn); gn.connect(master); s.start();
    gn.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.12);
    let o = null;
    if (hum) {
      o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hum;
      const og = ac.createGain(); og.gain.value = 0.04; o.connect(og); og.connect(gn); o.start();
    }
    loops[name] = { s, gn, o };
  }
  function loopStop(name) {
    const l = loops[name]; if (!l || !ac) return;
    delete loops[name];
    const t = ac.currentTime;
    l.gn.gain.cancelScheduledValues(t); l.gn.gain.setValueAtTime(l.gn.gain.value, t);
    l.gn.gain.linearRampToValueAtTime(0.0001, t + 0.15);
    l.s.stop(t + 0.2); if (l.o) l.o.stop(t + 0.2);
  }
  return {
    init, on: () => on,
    toggle() { on = !on; if (master) master.gain.value = on ? 0.8 : 0; if (!on) this.stopAll(); return on; },
    stopAll() { Object.keys(loops).forEach(loopStop); },
    showerOn() { loopStart('shower', 'highpass', 1800, 0.22); },
    showerOff() { loopStop('shower'); },
    dryerOn() { loopStart('dryer', 'lowpass', 700, 0.4, 110); },
    dryerOff() { loopStop('dryer'); },
    scrub() { noise(0.14, 0.18, 'bandpass', 2600 + Math.random() * 800, 0, 1.4); tone(900 + Math.random() * 300, 0.06, 'sine', 0.05); },
    pop() { tone(500 + Math.random() * 300, 0.09, 'sine', 0.18, 1400); },
    foamPop() { tone(1200 + Math.random() * 600, 0.05, 'sine', 0.08, 2400); },
    splat() { noise(0.25, 0.35, 'lowpass', 900, 0, 0.7); tone(180, 0.18, 'sine', 0.3, 60); },
    boop() { tone(420, 0.12, 'sine', 0.3, 760); tone(760, 0.1, 'triangle', 0.15, 520, 0.08); },
    giggle() {
      const b = 620 + Math.random() * 120;
      for (let i = 0; i < 5; i++) tone(b + (i % 2) * 220 + i * 25, 0.07, 'triangle', 0.17, null, i * 0.085);
    },
    ouch() { tone(900, 0.28, 'sawtooth', 0.12, 330); tone(1100, 0.2, 'square', 0.05, 420, 0.03); },
    bandage() { tone(350, 0.07, 'square', 0.1, 600); tone(700, 0.12, 'triangle', 0.22, 1200, 0.07); },
    swoosh() { noise(0.3, 0.2, 'bandpass', 1800, 0, 0.5); },
    sneezeWind() { tone(260, 0.55, 'triangle', 0.12, 520); },
    sneeze() { noise(0.35, 0.5, 'highpass', 900, 0, 0.5); tone(700, 0.3, 'sawtooth', 0.18, 140); },
    tick() { tone(660, 0.05, 'sine', 0.12, 880); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.28, 'triangle', 0.22, null, i * 0.11)); },
    sparkle() { tone(1600 + Math.random() * 1200, 0.12, 'sine', 0.07); },
  };
})();

/* ------------------------------------------------------------------ */
/* Dados                                                                */
/* ------------------------------------------------------------------ */
const SPECIES = {
  capi: { name: 'Capivara', icon: '🐹', fur: '#b98445', dark: '#8d5f2e', belly: '#e0b476', ear: '#f4a99b', nose: '#4b2e1b' },
  dog:  { name: 'Cachorrinho', icon: '🐶', fur: '#f0cf9a', dark: '#a56a37', belly: '#fff3dc', ear: '#f4a99b', nose: '#2b1a10' },
  dino: { name: 'Dino', icon: '🦖', fur: '#6fd16a', dark: '#46a84a', belly: '#e3f7a5', ear: '#f4a99b', nose: '#2e6b2f', accent: '#ff9d3c' },
};
const SPECIES_ORDER = ['capi', 'dog', 'dino'];

const MESS = [
  { name: 'lama',      cols: ['#6b4423', '#7d5330', '#5c3a1c'], hi: '#9a6b3f' },
  { name: 'tinta',     cols: ['#ff4f9a', '#38bdf8', '#facc15', '#84cc16', '#a78bfa'], hi: '#ffffff' },
  { name: 'gosma',     cols: ['#7bd34a', '#9be15d', '#62b83a'], hi: '#d8ffb8' },
  { name: 'chocolate', cols: ['#4a2c17', '#5d3a1f', '#3b2210'], hi: '#8a5a33' },
];

const TOOLS = [
  { id: 'sponge', label: 'Esponja' },
  { id: 'shower', label: 'Chuveiro' },
  { id: 'bandage', label: 'Curativo' },
  { id: 'dryer', label: 'Secador' },
  { id: 'hand', label: 'Carinho' },
];

/* ------------------------------------------------------------------ */
/* Estado                                                               */
/* ------------------------------------------------------------------ */
let W = 0, H = 0, DPR = 1;
let cx = 0, cy = 0, S = 1, floorY = 0;
let scene = 'menu'; // menu | play | win | ba
let tool = 'sponge';
let cleanedCount = parseInt(store('cc_count') || '0', 10) || 0;
let time = 0;

const ptr = { x: 0, y: 0, lx: 0, ly: 0, down: false, speed: 0, moved: false };
let P = null;            // bichinho atual
let particles = [];
let glass = [];          // gotas na "tela" (espirro)
let floaters = [];       // textos flutuantes
let drops = [];          // gotas do chuveiro
let puddle = 0;
let beforeImg = '', afterImg = '';
let sndCool = 0;
let showerActive = false, dryerActive = false;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const top = 72, bottom = 112;
  const areaH = Math.max(200, H - top - bottom);
  S = Math.min(W / 440, areaH / 520);
  cx = W / 2;
  cy = top + areaH * 0.5 - 4 * S;
  floorY = cy + 238 * S;
}
window.addEventListener('resize', resize);

/* ------------------------------------------------------------------ */
/* Criação da bagunça                                                   */
/* ------------------------------------------------------------------ */
const REGIONS = [
  { x: 0, y: -105, rx: 108, ry: 82, w: 5, head: true, r: [16, 28] },
  { x: 0, y: 100, rx: 108, ry: 96, w: 7, r: [20, 36] },
  { x: -122, y: 108, rx: 14, ry: 38, w: 1, r: [14, 20] },
  { x: 122, y: 108, rx: 14, ry: 38, w: 1, r: [14, 20] },
  { x: -72, y: 196, rx: 30, ry: 14, w: 1, r: [14, 22] },
  { x: 72, y: 196, rx: 30, ry: 14, w: 1, r: [14, 22] },
];

function makeBlob(reg, mess) {
  for (let tries = 0; tries < 20; tries++) {
    const a = rand(0, TAU), d = Math.sqrt(Math.random());
    const x = reg.x + Math.cos(a) * reg.rx * d, y = reg.y + Math.sin(a) * reg.ry * d;
    if (reg.head && Math.abs(x) < 64 && y > -152 && y < -40) continue; // não cobrir o rosto todo
    const wob = []; for (let i = 0; i < 10; i++) wob.push(rand(0.78, 1.18));
    return { x, y, r: rand(reg.r[0], reg.r[1]), mud: 1, foam: 0, wob, col: pick(mess.cols), seed: Math.random() * 10 };
  }
  return null;
}

function newPet(sp) {
  const mess = pick(MESS);
  const blobs = [];
  const total = Math.round(rand(14, 18));
  const wsum = REGIONS.reduce((s, r) => s + r.w, 0);
  for (let i = 0; i < total; i++) {
    let k = Math.random() * wsum, reg = REGIONS[0];
    for (const r of REGIONS) { if ((k -= r.w) <= 0) { reg = r; break; } }
    const b = makeBlob(reg, mess); if (b) blobs.push(b);
  }
  const scrPos = [[-98, -150, 0.5], [104, -62, -0.4], [74, 38, 0.3], [-66, 150, -0.6], [-108, 70, 0.7]];
  const scratches = scrPos.sort(() => Math.random() - 0.5).slice(0, 3).map(([x, y, rot]) => ({ x, y, rot, on: false, pop: 0 }));
  const leafPos = [[-44, -204, -0.6], [76, -192, 0.8], [-96, 40, 2.4], [96, 150, 1.4]];
  const leaves = leafPos.sort(() => Math.random() - 0.5).slice(0, 2).map(([x, y, rot]) => ({
    x, y, rot, gone: false, vx: 0, vy: 0, vr: 0, a: 1, ph: Math.random() * 6, hp: 1, col: pick(['#4caf50', '#7cb342', '#f9a825', '#ef6c00']),
  }));
  const tufts = []; for (let i = 0; i < 46; i++) tufts.push({ a: (i / 46) * TAU + rand(-0.05, 0.05), l: rand(0.6, 1.2), ph: rand(0, 6) });
  return {
    sp, mess, blobs, scratches, leaves, tufts,
    t: 0, py: -700, vy: 0, sq: 0, lean: 0, shake: 0,
    wet: 0, rinsed: false, fluff: 0,
    ready: false, settle: 0, win: false, winT: 0, jumpT: 0,
    sponging: 0, showering: 0, drying: 0, petting: 0, ouch: 0, proud: 0, giggle: 0,
    sneeze: 0, sneezeDone: false, sneezeCool: 0, showerTime: 0, blink: 0, blinkT: rand(1.5, 3.5),
    hit: false, hintTool: 'sponge',
  };
}

/* ------------------------------------------------------------------ */
/* Desenho — utilitários                                                */
/* ------------------------------------------------------------------ */
function ell(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function fillStroke(c, fill, stroke, lw) {
  c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 4; c.lineJoin = 'round'; c.stroke(); }
}

function drawBackground(c, w, h, cyPet, sc) {
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#8fdcff'); gr.addColorStop(0.62, '#d9f4ff'); gr.addColorStop(0.62, '#ffe9b8'); gr.addColorStop(1, '#ffd48a');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  // azulejos
  const fy = cyPet + 238 * sc;
  c.save(); c.beginPath(); c.rect(0, 0, w, fy); c.clip();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2;
  const ts = 64 * Math.max(sc, 0.7);
  for (let x = 0; x < w + ts; x += ts) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, fy); c.stroke(); }
  for (let y = 0; y < fy + ts; y += ts) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.35)';
  for (let x = ts / 2, i = 0; x < w + ts; x += ts, i++) for (let y = ts / 2, j = 0; y < fy; y += ts, j++) if ((i + j) % 3 === 0) { c.beginPath(); c.arc(x, y, ts * 0.12, 0, TAU); c.fill(); }
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, fy - 4, w, 6);
  // tapete
  c.fillStyle = 'rgba(255,120,160,.55)';
  ell(c, w / 2, fy + 14 * sc, 190 * sc, 34 * sc); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)';
  ell(c, w / 2, fy + 14 * sc, 160 * sc, 24 * sc); c.fill();
}

/* ------------------------------------------------------------------ */
/* Desenho — bichinho                                                   */
/* ------------------------------------------------------------------ */
function wetCol(c, wet) { return mix(c, '#34506e', 0.42 * wet); }

function silhouette(c, sp) {
  c.beginPath();
  if (sp === 'capi') {
    // cabeça quadradona
    c.moveTo(-130, -150); c.arcTo(-130, -200, -80, -200, 60);
    c.lineTo(80, -200); c.arcTo(130, -200, 130, -150, 60);
    c.lineTo(130, -60); c.arcTo(130, -10, 80, -10, 60);
    c.lineTo(-80, -10); c.arcTo(-130, -10, -130, -60, 60); c.closePath();
  } else {
    c.ellipse(0, -105, sp === 'dog' ? 125 : 128, sp === 'dog' ? 105 : 100, 0, 0, TAU);
  }
  c.moveTo(135, 100); c.ellipse(0, 100, 135, 120, 0, 0, TAU);
  c.moveTo(-96, 108); c.ellipse(-122, 108, 26, 56, 0.25, 0, TAU);
  c.moveTo(148, 108); c.ellipse(122, 108, 26, 56, -0.25, 0, TAU);
  c.moveTo(-28, 196); c.ellipse(-72, 196, 44, 28, 0, 0, TAU);
  c.moveTo(116, 196); c.ellipse(72, 196, 44, 28, 0, 0, TAU);
}

function drawBlob(c, b, mess) {
  const m = clamp(b.mud, 0, 1);
  if (m <= 0.01) return;
  const k = 0.5 + 0.5 * m;
  c.save(); c.translate(b.x, b.y); c.scale(k, k);
  c.globalAlpha = clamp(m * 1.6, 0, 1);
  c.beginPath();
  const n = b.wob.length;
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * TAU, rr = b.r * b.wob[i % n];
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.9;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.fillStyle = b.col; c.fill();
  c.lineJoin = 'round'; c.lineWidth = 6; c.strokeStyle = b.col; c.stroke();
  // brilho
  c.globalAlpha *= 0.5; c.fillStyle = mess.hi;
  ell(c, -b.r * 0.3, -b.r * 0.35, b.r * 0.28, b.r * 0.16, -0.5); c.fill();
  c.restore();
}

function drawFoam(c, b, t) {
  const f = clamp(b.foam, 0, 1);
  if (f <= 0.02) return;
  const k = 0.45 + 0.55 * f;
  c.save(); c.translate(b.x, b.y); c.scale(k, k); c.globalAlpha = clamp(f * 2, 0, 1);
  const r = b.r;
  const bub = [[0, 0, 1], [-0.7, 0.2, 0.7], [0.7, -0.1, 0.75], [-0.25, -0.6, 0.6], [0.35, 0.55, 0.62], [0.05, -0.15, 0.5]];
  bub.forEach((q, i) => {
    const bob = Math.sin(t * 2 + b.seed + i) * 1.5;
    const x = q[0] * r * 0.9, y = q[1] * r * 0.9 + bob, rr = q[2] * r * 0.62 + 6;
    c.beginPath(); c.arc(x, y, rr, 0, TAU);
    c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = '#a9dcf5'; c.stroke();
    c.fillStyle = 'rgba(160,215,245,.55)'; c.beginPath(); c.arc(x + rr * 0.2, y + rr * 0.25, rr * 0.55, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x - rr * 0.35, y - rr * 0.38, rr * 0.22, 0, TAU); c.fill();
  });
  c.restore();
}

function drawLeaf(c, l, t) {
  c.save(); c.translate(l.x, l.y); c.rotate(l.rot + Math.sin(t * 2 + l.ph) * 0.06 + (P && P.drying > 0 ? Math.sin(t * 40 + l.ph) * 0.25 : 0));
  c.globalAlpha = l.a;
  c.strokeStyle = '#6d4c2a'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 22); c.stroke();
  c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(26, -4, 26, -42, 0, -58); c.bezierCurveTo(-26, -42, -26, -4, 0, 8); c.closePath();
  c.fillStyle = l.col; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.25)'; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -48); c.stroke();
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, -8 - i * 14); c.lineTo(10, -18 - i * 14); c.moveTo(0, -8 - i * 14); c.lineTo(-10, -18 - i * 14); c.stroke(); }
  c.restore();
}

function drawScratch(c, s, t) {
  c.save(); c.translate(s.x, s.y); c.rotate(s.rot);
  if (!s.on) {
    c.strokeStyle = '#e53935'; c.lineWidth = 5; c.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-18 + i * 3, i * 9 - 8); c.lineTo(20 + i * 3, i * 9 + 8); c.stroke(); }
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(-17 + i * 3, i * 9 - 9); c.lineTo(19 + i * 3, i * 9 + 7); c.stroke(); }
    // balãozinho "ai"
    const pu = 1 + Math.sin(t * 6) * 0.12;
    c.rotate(-s.rot); c.translate(18, -30); c.scale(pu, pu);
    c.fillStyle = '#fff'; c.strokeStyle = '#e53935'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#e53935'; c.font = '900 20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 1);
  } else {
    const k = s.pop > 0 ? 1 + Math.sin(s.pop * 10) * s.pop * 0.5 : 1;
    c.scale(k, k);
    rrect(c, -34, -14, 68, 28, 12); fillStroke(c, '#f6d3a2', '#c99a63', 3);
    c.fillStyle = '#fbe6c4'; rrect(c, -12, -10, 24, 20, 5); c.fill();
    c.fillStyle = 'rgba(190,140,90,.55)';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(-26 + i * 4, -6 + j * 12, 1.6, 0, TAU); c.fill(); c.beginPath(); c.arc(22 + i * 4, -6 + j * 12, 1.6, 0, TAU); c.fill(); }
  }
  c.restore();
}

function drawEye(c, x, y, k, f, side) {
  const o = f.open;
  if (f.eyes === 'happy') {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y + 8, 15 * k, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
  } else if (f.eyes === 'squeeze') {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - side * 14, y - 14); c.lineTo(x + side * 8, y); c.lineTo(x - side * 14, y + 14); c.stroke();
  } else if (f.eyes === 'closed') {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y - 4, 14 * k, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  } else if (f.eyes === 'wide') {
    ell(c, x, y, 25 * k, 27 * k); fillStroke(c, '#fff', '#2b1a10', 3);
    c.fillStyle = '#2b1a10'; ell(c, x + side * 1, y + 1, 9 * k, 10 * k); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 3, y - 3, 3, 0, TAU); c.fill();
  } else {
    const big = f.eyes === 'sparkle' ? 1.18 : 1;
    const ry = 19 * big * o * k + 1.5;
    c.fillStyle = '#2b1a10'; ell(c, x, y, 15 * big * k, ry); c.fill();
    if (o > 0.4) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 5 * big, y - 6 * big, 5.5 * big, 0, TAU); c.fill();
      c.beginPath(); c.arc(x + 5 * big, y + 6 * big, 2.6 * big, 0, TAU); c.fill();
      if (f.eyes === 'sparkle') {
        c.fillStyle = '#fff7a8'; c.save(); c.translate(x + 6, y - 8); c.rotate(P ? P.t * 2 : 0);
        c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 2.2 : 7; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.restore();
      }
    }
  }
}

function drawMouth(c, x, y, f, sp) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  const m = f.mouth;
  const dark = '#5a1f2b';
  if (m === 'smile') {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(x - 24, y - 4); c.quadraticCurveTo(x - 12, y + 14, x, y + 2); c.quadraticCurveTo(x + 12, y + 14, x + 24, y - 4); c.stroke();
  } else if (m === 'frown') {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(x - 18, y + 8); c.quadraticCurveTo(x, y - 8, x + 18, y + 8); c.stroke();
  } else if (m === 'o') {
    ell(c, x, y + 4, 11, 15); fillStroke(c, dark, '#2b1a10', 4);
  } else if (m === 'open' || m === 'big' || m === 'tongue') {
    const w = m === 'big' ? 34 : 24, h = m === 'big' ? 34 : 20 + (f.talk || 0) * 8;
    c.beginPath(); c.moveTo(x - w, y - 8); c.quadraticCurveTo(x, y - 2, x + w, y - 8); c.quadraticCurveTo(x + w * 0.8, y + h, x, y + h); c.quadraticCurveTo(x - w * 0.8, y + h, x - w, y - 8); c.closePath();
    fillStroke(c, dark, '#2b1a10', 4);
    c.save(); c.clip(); c.fillStyle = '#ff7f95'; ell(c, x, y + h, w * 0.7, h * 0.55); c.fill();
    if (sp !== 'dog') { c.fillStyle = '#fff'; c.fillRect(x - w * 0.5, y - 10, w, 6); }
    c.restore();
  } else if (m === 'wave') {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 6; c.beginPath();
    for (let i = 0; i <= 10; i++) { const px = x - 30 + i * 6, py = y + Math.sin(i * 1.3 + (P ? P.t * 40 : 0)) * 6 + 2; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  }
}

function computeFace(pet) {
  const f = { eyes: 'round', mouth: 'smile', open: 1, brow: 0, blush: 0, tear: false, talk: 0 };
  const dirty = pet.blobs.reduce((s, b) => s + Math.max(b.mud, b.foam * 0.5), 0) / pet.blobs.length;
  if (pet.blink > 0) f.open = 0.12;
  if (pet.sneeze > 0.5) { f.eyes = 'closed'; f.mouth = 'o'; f.brow = 0.5; }
  else if (pet.sneeze > 0.2) { f.eyes = 'squeeze'; f.mouth = 'big'; }
  else if (pet.ouch > 0) { f.eyes = 'squeeze'; f.mouth = 'big'; f.brow = -1; f.tear = true; }
  else if (pet.drying > 0) { f.eyes = 'wide'; f.mouth = 'wave'; f.blush = 0.5; }
  else if (pet.showering > 0) { f.eyes = 'squeeze'; f.mouth = 'open'; f.talk = Math.sin(pet.t * 18) * 0.5 + 0.5; }
  else if (pet.sponging > 0) { f.eyes = 'happy'; f.mouth = 'big'; f.blush = 1; f.talk = Math.sin(pet.t * 22) * 0.5 + 0.5; }
  else if (pet.petting > 0 || pet.giggle > 0) { f.eyes = 'happy'; f.mouth = 'open'; f.blush = 1; f.talk = Math.sin(pet.t * 20) * 0.5 + 0.5; }
  else if (pet.win || pet.proud > 0) { f.eyes = 'sparkle'; f.mouth = 'big'; f.blush = 1; }
  else if (dirty > 0.55 && !pet.rinsed) { f.mouth = 'frown'; f.brow = -0.8; f.tear = pet.t % 6 < 1.2; }
  else if (pet.wet > 0.5) { f.mouth = 'frown'; f.brow = -0.4; f.blush = 0.2; }
  else { f.mouth = 'smile'; f.blush = 0.3; }
  return f;
}

function drawFace(c, f, sp, P) {
  const eyeY = sp === 'capi' ? -134 : -122;
  const eyeX = sp === 'capi' ? 58 : 52;
  const k = sp === 'capi' ? 0.9 : 1;
  // bochechas
  if (f.blush > 0) {
    c.fillStyle = 'rgba(255,90,120,' + (0.35 * f.blush) + ')';
    ell(c, -eyeX - 14, eyeY + 32, 20, 12); c.fill(); ell(c, eyeX + 14, eyeY + 32, 20, 12); c.fill();
  }
  drawEye(c, -eyeX, eyeY, k, f, 1);
  drawEye(c, eyeX, eyeY, k, f, -1);
  // sobrancelhas
  if (Math.abs(f.brow) > 0.05) {
    c.strokeStyle = '#2b1a10'; c.lineWidth = 6; c.lineCap = 'round';
    const s = -f.brow; // brow<0 triste (pontas internas p/ cima)
    c.beginPath(); c.moveTo(-eyeX - 20, eyeY - 32 + s * 8); c.lineTo(-eyeX + 18, eyeY - 32 - s * 10); c.stroke();
    c.beginPath(); c.moveTo(eyeX + 20, eyeY - 32 + s * 8); c.lineTo(eyeX - 18, eyeY - 32 - s * 10); c.stroke();
  }
  if (f.tear) {
    const ty = ((P ? P.t : 0) * 40) % 40;
    c.fillStyle = '#7fd4ff'; c.strokeStyle = '#3aa3d8'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-eyeX - 8, eyeY + 18 + ty); c.quadraticCurveTo(-eyeX - 18, eyeY + 34 + ty, -eyeX - 8, eyeY + 38 + ty); c.quadraticCurveTo(-eyeX + 2, eyeY + 34 + ty, -eyeX - 8, eyeY + 18 + ty); c.fill(); c.stroke();
  }
  // focinho / nariz por espécie
  const mY = sp === 'capi' ? -52 : -56;
  if (sp === 'capi') {
    rrect(c, -34, -112, 68, 38, 16); fillStroke(c, SPECIES.capi.nose, null);
    c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -12, -104, 10, 4, -0.2); c.fill();
    c.fillStyle = 'rgba(0,0,0,.45)'; ell(c, -12, -92, 5, 4); c.fill(); ell(c, 12, -92, 5, 4); c.fill();
    c.strokeStyle = '#4b2e1b'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -74); c.lineTo(0, mY - 6); c.stroke();
  } else if (sp === 'dog') {
    ell(c, 0, -92, 24, 17); fillStroke(c, '#2b1a10', null);
    c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, -8, -98, 8, 4, -0.2); c.fill();
    c.strokeStyle = '#2b1a10'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -76); c.lineTo(0, mY - 8); c.stroke();
  } else {
    c.fillStyle = '#2e6b2f'; ell(c, -20, -92, 7, 5, 0.3); c.fill(); ell(c, 20, -92, 7, 5, -0.3); c.fill();
  }
  drawMouth(c, 0, mY, f, sp);
  if (f.mouth === 'big' && sp === 'dog') { /* língua já desenhada */ }
}

function drawFluff(c, P, rx, ry, cxx, cyy, col) {
  if (P.fluff < 0.04) return;
  c.fillStyle = col;
  const n = P.tufts.length;
  for (let i = 0; i < n; i++) {
    const tf = P.tufts[i];
    const a = tf.a + Math.sin(P.t * 30 + tf.ph) * 0.05 * P.fluff;
    const len = (6 + 20 * P.fluff * tf.l) * (1 + Math.sin(P.t * 25 + tf.ph) * 0.15 * (P.drying > 0 ? 1 : 0));
    const px = cxx + Math.cos(a) * rx, py = cyy + Math.sin(a) * ry;
    const nx = Math.cos(a), ny = Math.sin(a);
    c.beginPath(); c.moveTo(px - ny * 9, py + nx * 9); c.lineTo(px + nx * len, py + ny * len); c.lineTo(px + ny * 9, py - nx * 9); c.closePath(); c.fill();
  }
}

/* V = parâmetros de visualização (permite tirar foto "antes/depois") */
function drawPet(c, ox, oy, sc, pet, V) {
  const sp = SPECIES[pet.sp];
  const wet = V.wet !== undefined ? V.wet : pet.wet;
  const t = V.t !== undefined ? V.t : pet.t;
  const fur = wetCol(sp.fur, wet), dark = wetCol(sp.dark, wet), belly = wetCol(sp.belly, wet);
  c.save();
  c.translate(ox, oy); c.scale(sc, sc);
  c.translate(0, V.py);
  // squash & stretch + respiração
  const breath = Math.sin(t * 2.2) * 0.012;
  c.translate(V.shake, 0);
  c.translate(0, 225); c.rotate(V.lean); c.scale(1 + V.sq * 0.2 - breath, 1 - V.sq * 0.2 + breath); c.translate(0, -225);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const OUT = 'rgba(70,40,15,.35)';

  // ---- partes de trás
  if (pet.sp === 'dino') {
    // cauda
    c.beginPath(); c.moveTo(100, 150); c.quadraticCurveTo(220, 170, 215, 70); c.quadraticCurveTo(190, 125, 110, 110); c.closePath();
    fillStroke(c, fur, OUT, 4);
    c.fillStyle = sp.accent;
    [[190, 120, 12], [212, 92, 11], [212, 66, 9]].forEach(([x, y, s], i) => { c.beginPath(); c.moveTo(x - s, y + 4); c.lineTo(x + 2, y - s * 1.7); c.lineTo(x + s, y - 2); c.closePath(); c.fill(); });
    // espinhos das costas
    for (let i = 0; i < 4; i++) { const yy = -200 + 0; c.beginPath(); c.moveTo(-68 + i * 46 - 18, -196); c.lineTo(-68 + i * 46, -230 + (i === 1 || i === 2 ? -8 : 0)); c.lineTo(-68 + i * 46 + 18, -196); c.closePath(); fillStroke(c, sp.accent, OUT, 3); }
  } else if (pet.sp === 'dog') {
    const wag = Math.sin(t * (V.happy ? 14 : 4)) * (V.happy ? 0.45 : 0.15);
    c.save(); c.translate(-118, 150); c.rotate(-0.5 + wag);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-60, -20, -50, -85); c.quadraticCurveTo(-30, -40, 14, -22); c.closePath(); fillStroke(c, dark, OUT, 4); c.restore();
  } else {
    c.beginPath(); c.arc(-112, 168, 20, 0, TAU); fillStroke(c, dark, OUT, 3);
  }

  // ---- pés
  [-72, 72].forEach((x) => {
    ell(c, x, 196, 44, 28); fillStroke(c, dark, OUT, 4);
    c.fillStyle = 'rgba(0,0,0,.18)';
    [-14, 0, 14].forEach((d) => { c.beginPath(); c.arc(x + d, 204, 4, 0, TAU); c.fill(); });
  });
  // ---- corpo
  ell(c, 0, 100, 135, 120); fillStroke(c, fur, OUT, 5);
  ell(c, 0, 122, 88, 84); fillStroke(c, belly, null);
  if (pet.sp === 'dino') {
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 4;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0, 60 + i * 36, 60 - i * 4, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke(); }
  }
  drawFluff(c, pet, 135, 120, 0, 100, fur);
  // ---- braços
  const armSwing = V.arms || 0;
  [-1, 1].forEach((s) => {
    c.save(); c.translate(s * 122, 80); c.rotate(s * (-0.25 - armSwing));
    ell(c, 0, 30, 26, 56); fillStroke(c, fur, OUT, 4);
    c.fillStyle = 'rgba(0,0,0,.12)'; ell(c, 0, 76, 15, 8); c.fill();
    c.restore();
  });

  // ---- cabeça (atrás)
  if (pet.sp === 'dog') {
    [-1, 1].forEach((s) => {
      c.save(); c.translate(s * 116, -140); c.rotate(s * (0.38 + V.ear * 0.5 + wet * 0.2));
      ell(c, 0, 44, 36, 76); fillStroke(c, dark, OUT, 4); c.restore();
    });
  } else if (pet.sp === 'dino') {
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 44 - 16, -192); c.lineTo(i * 44, -226 + Math.abs(i) * 12); c.lineTo(i * 44 + 16, -192); c.closePath(); fillStroke(c, sp.accent, OUT, 3); }
  } else {
    [-1, 1].forEach((s) => {
      c.save(); c.translate(s * 96, -196); c.rotate(s * V.ear * 0.6);
      c.beginPath(); c.arc(0, 0, 30, 0, TAU); fillStroke(c, dark, OUT, 4);
      c.fillStyle = sp.ear; c.beginPath(); c.arc(0, 2, 16, 0, TAU); c.fill(); c.restore();
    });
  }
  // ---- cabeça
  if (pet.sp === 'capi') {
    silhouetteHead(c, 'capi'); fillStroke(c, fur, OUT, 5);
    drawFluff(c, pet, 128, 98, 0, -105, fur);
    rrect(c, -80, -100, 160, 86, 42); fillStroke(c, belly, null);
  } else if (pet.sp === 'dog') {
    ell(c, 0, -105, 125, 105); fillStroke(c, fur, OUT, 5);
    drawFluff(c, pet, 125, 105, 0, -105, fur);
    c.fillStyle = dark; ell(c, -52, -125, 42, 40, 0.2); c.fill();
    ell(c, 0, -66, 76, 56); fillStroke(c, belly, null);
  } else {
    ell(c, 0, -105, 128, 100); fillStroke(c, fur, OUT, 5);
    drawFluff(c, pet, 128, 100, 0, -105, fur);
    ell(c, 0, -62, 82, 54); fillStroke(c, belly, null);
    c.fillStyle = 'rgba(0,0,0,.08)'; ell(c, -86, -90, 14, 10); c.fill(); ell(c, 86, -80, 12, 9); c.fill(); ell(c, 80, -150, 10, 8); c.fill();
  }

  // ---- bagunça (lama) recortada na silhueta
  c.save(); silhouette(c, pet.sp); c.clip();
  pet.blobs.forEach((b) => drawBlob(c, b, pet.mess));
  c.restore();
  // ---- rosto
  drawFace(c, V.face, pet.sp, pet);
  // ---- orelhas da frente (dino: bolinhas laterais)
  if (pet.sp === 'dino') { /* sem orelhas */ }
  // ---- espuma
  pet.blobs.forEach((b) => drawFoam(c, b, t));
  // ---- arranhões / curativos
  pet.scratches.forEach((s) => drawScratch(c, s, t));
  // ---- folhas
  pet.leaves.forEach((l) => { if (!l.gone) drawLeaf(c, l, t); });
  // ---- moscas
  if (V.flies > 0) {
    for (let i = 0; i < V.flies; i++) {
      const a = t * (2.2 + i * 0.5) + i * 2.1, fx = Math.cos(a) * (150 + i * 12), fy = -60 + Math.sin(a * 1.7) * 150 - i * 30;
      c.fillStyle = '#222'; ell(c, fx, fy, 6, 4.5); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; const fl = Math.sin(t * 60) * 3; ell(c, fx - 3, fy - 5 - fl, 5, 3, -0.5); c.fill(); ell(c, fx + 3, fy - 5 + fl, 5, 3, 0.5); c.fill();
    }
    // linhas de fedor
    c.strokeStyle = 'rgba(120,170,60,.7)'; c.lineWidth = 5;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); const bx = i * 70, by = -225 + 0;
      for (let k = 0; k <= 8; k++) { const yy = by - k * 8 - ((t * 30) % 16), xx = bx + Math.sin(k * 1.2 + t * 4 + i) * 7; if (k) c.lineTo(xx, yy); else c.moveTo(xx, yy); }
      c.globalAlpha = 0.7 * V.stink; c.stroke(); c.globalAlpha = 1;
    }
  }
  c.restore();
}

function silhouetteHead(c, sp) {
  c.beginPath();
  c.moveTo(-130, -150); c.arcTo(-130, -200, -80, -200, 60);
  c.lineTo(80, -200); c.arcTo(130, -200, 130, -150, 60);
  c.lineTo(130, -60); c.arcTo(130, -10, 80, -10, 60);
  c.lineTo(-80, -10); c.arcTo(-130, -10, -130, -60, 60); c.closePath();
}

function dirtLevel(pet) {
  return pet.blobs.reduce((s, b) => s + b.mud, 0) / pet.blobs.length;
}
function viewFor(pet) {
  const dl = dirtLevel(pet);
  const earFlap = pet.drying > 0 ? Math.sin(pet.t * 38) * 0.5 * pet.fluff : Math.sin(pet.t * 3) * 0.04;
  return {
    py: pet.py, sq: pet.sq, lean: pet.lean, shake: pet.shake, face: computeFace(pet),
    ear: earFlap, arms: pet.giggle > 0 || pet.win ? Math.sin(pet.t * 14) * 0.5 : (pet.showering > 0 ? Math.sin(pet.t * 40) * 0.1 : 0),
    flies: Math.ceil(dl * 3), stink: clamp(dl * 1.4, 0, 1), happy: pet.win || pet.petting > 0,
  };
}

/* foto do "antes" / "depois" */
function snapshot(pet, mood) {
  const w = 540, h = 720, c0 = document.createElement('canvas');
  c0.width = w; c0.height = h;
  const c = c0.getContext('2d');
  const sc = 1.28, ocy = 400;
  drawBackground(c, w, h, ocy, sc);
  const f = { eyes: 'round', mouth: 'smile', open: 1, brow: 0, blush: 0, tear: false, talk: 0 };
  if (mood === 'sad') { f.mouth = 'frown'; f.brow = -1; f.tear = true; }
  else { f.eyes = 'sparkle'; f.mouth = 'big'; f.blush = 1; }
  const V = { py: 0, sq: 0, lean: 0, shake: 0, face: f, ear: 0, arms: mood === 'sad' ? 0 : 0.3, flies: mood === 'sad' ? 3 : 0, stink: mood === 'sad' ? 1 : 0, happy: mood !== 'sad', wet: mood === 'sad' ? 0 : 0, t: 1.3 };
  const keepFluff = pet.fluff;
  pet.fluff = 0;
  drawPet(c, w / 2, ocy, sc, pet, V);
  pet.fluff = keepFluff;
  if (mood !== 'sad') {
    // brilhos
    c.fillStyle = '#fff7a8';
    [[110, 190, 20], [440, 230, 26], [400, 120, 14], [90, 420, 16], [460, 460, 20], [150, 90, 12]].forEach(([x, y, r]) => {
      c.save(); c.translate(x, y); c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * 0.25 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.restore();
    });
  }
  return c0.toDataURL('image/jpeg', 0.9);
}

/* ------------------------------------------------------------------ */
/* Ferramentas (ícones e cursor)                                        */
/* ------------------------------------------------------------------ */
function drawToolIcon(c, id, t, dir) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  if (id === 'sponge') {
    rrect(c, -30, -18, 60, 40, 11); fillStroke(c, '#ffd93d', '#c99a00', 3);
    rrect(c, -30, -18, 60, 14, 8); fillStroke(c, '#5fce6b', '#2f9d3b', 3);
    c.fillStyle = 'rgba(176,130,0,.55)';
    [[-16, 8, 4], [4, 12, 3.5], [16, 5, 4.5], [-4, 4, 3], [-20, 15, 2.6]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
  } else if (id === 'shower') {
    c.strokeStyle = '#9aa7b3'; c.lineWidth = 7; c.beginPath(); c.moveTo(14, -30); c.quadraticCurveTo(30, -22, 24, -8); c.stroke();
    c.save(); c.translate(0, 8); c.rotate(0.15);
    c.beginPath(); c.moveTo(-8, -18); c.lineTo(8, -18); c.lineTo(32, 10); c.lineTo(-32, 10); c.closePath(); fillStroke(c, '#c8d3dd', '#7d8a96', 3);
    ell(c, 0, 12, 32, 10); fillStroke(c, '#e6eef5', '#7d8a96', 3);
    c.fillStyle = '#4a90c9'; [-20, -10, 0, 10, 20].forEach((x) => { c.beginPath(); c.arc(x, 12, 2.6, 0, TAU); c.fill(); });
    c.restore();
  } else if (id === 'bandage') {
    c.save(); c.rotate(-0.5);
    rrect(c, -36, -14, 72, 28, 13); fillStroke(c, '#f6d3a2', '#c99a63', 3);
    c.fillStyle = '#fbe6c4'; rrect(c, -13, -10, 26, 20, 5); c.fill();
    c.fillStyle = 'rgba(190,140,90,.6)'; [-27, -21, 21, 27].forEach((x) => [-6, 6].forEach((y) => { c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill(); }));
    c.restore();
  } else if (id === 'dryer') {
    c.save(); c.scale(-(dir || -1), 1);
    rrect(c, -34, -22, 56, 38, 16); fillStroke(c, '#ff7eb3', '#c24a80', 3);
    c.beginPath(); c.moveTo(-34, -12); c.lineTo(-48, -16); c.lineTo(-48, 10); c.lineTo(-34, 6); c.closePath(); fillStroke(c, '#d6dde3', '#7d8a96', 3);
    rrect(c, 2, 12, 18, 36, 8); fillStroke(c, '#ffb3d1', '#c24a80', 3);
    c.fillStyle = '#fff'; ell(c, -4, -8, 10, 4, -0.1); c.fill();
    c.fillStyle = '#ffe14d'; c.beginPath(); c.arc(10, -4, 4, 0, TAU); c.fill();
    c.restore();
  } else if (id === 'hand') {
    c.fillStyle = '#ffd2a8'; c.strokeStyle = '#d99a6c'; c.lineWidth = 3;
    [[-18, -16, -0.3], [-6, -24, -0.1], [8, -24, 0.1], [20, -16, 0.3]].forEach(([x, y, r]) => { c.save(); c.translate(x, y); c.rotate(r); rrect(c, -6, -14, 12, 28, 6); c.fill(); c.stroke(); c.restore(); });
    c.save(); c.translate(-26, 6); c.rotate(-0.9); rrect(c, -6, -14, 12, 26, 6); c.fill(); c.stroke(); c.restore();
    ell(c, 0, 6, 26, 24); fillStroke(c, '#ffd2a8', '#d99a6c', 3);
    c.fillStyle = '#ff6b8b'; c.font = '20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('❤', 0, 8);
  }
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Partículas                                                           */
/* ------------------------------------------------------------------ */
function spawn(p) { if (particles.length < 700) particles.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 1, max: 1, size: 6, col: '#fff', type: 'dot', rot: 0, vr: 0, drag: 0 }, p)); }
function sparkleAt(x, y, n, cols) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(60, 260); spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 220, max: rand(0.5, 1.0), size: rand(8, 16), col: pick(cols || ['#fff7a8', '#ffffff', '#ffd23f']), type: 'star', vr: rand(-6, 6) }); } }
function heartAt(x, y) { spawn({ x, y, vx: rand(-30, 30), vy: rand(-120, -70), max: rand(0.9, 1.4), size: rand(16, 28), col: pick(['#ff5c8a', '#ff7aa2', '#ff3d71']), type: 'heart', drag: 0.3 }); }
function bubbleAt(x, y) { spawn({ x, y, vx: rand(-40, 40), vy: rand(-110, -50), max: rand(0.7, 1.3), size: rand(6, 16), col: '#ffffff', type: 'bubble', drag: 0.5 }); }
function splashAt(x, y, n, col) { for (let i = 0; i < n; i++) spawn({ x, y, vx: rand(-110, 110), vy: rand(-170, -40), g: 700, max: rand(0.25, 0.5), size: rand(3, 6), col: col || 'rgba(120,200,255,.9)', type: 'dot' }); }
function confetti(n) { for (let i = 0; i < n; i++) spawn({ x: rand(0, W), y: rand(-H * 0.2, 0), vx: rand(-60, 60), vy: rand(120, 340), g: 80, max: rand(2.2, 4), size: rand(8, 15), col: pick(['#ff5c8a', '#ffd23f', '#4cc9f0', '#7be05a', '#a78bfa', '#ff9f1c']), type: 'conf', rot: rand(0, TAU), vr: rand(-8, 8) }); }
function say(text, x, y, col, size) { floaters.push({ text, x, y, life: 0, max: 1.2, col: col || '#ff4d6d', size: size || 40 }); }

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt / p.max;
    if (p.life >= 1) { particles.splice(i, 1); continue; }
    p.vy += p.g * dt;
    if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
  for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].life += dt / floaters[i].max; if (floaters[i].life >= 1) floaters.splice(i, 1); }
  for (let i = glass.length - 1; i >= 0; i--) {
    const q = glass[i]; q.life += dt; q.y += q.vy * dt; q.vy *= 1 + dt * 0.25;
    if (q.life > q.max) glass.splice(i, 1);
  }
}

function drawParticles(c) {
  particles.forEach((p) => {
    const a = p.type === 'conf' ? 1 : clamp(1 - p.life * p.life, 0, 1);
    c.globalAlpha = a;
    if (p.type === 'dot') { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); }
    else if (p.type === 'bubble') {
      c.strokeStyle = 'rgba(120,190,235,.9)'; c.lineWidth = 2; c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.arc(p.x, p.y, p.size * (1 + p.life * 0.4), 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.2, 0, TAU); c.fill();
    } else if (p.type === 'heart') {
      c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); const s = p.size / 16; c.scale(s, s);
      c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(-18, -6, -10, -20, 0, -10); c.bezierCurveTo(10, -20, 18, -6, 0, 6); c.fill(); c.restore();
    } else if (p.type === 'star') {
      c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath();
      for (let i = 0; i < 8; i++) { const an = i / 8 * TAU, r = i % 2 ? p.size * 0.28 : p.size; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      c.closePath(); c.fill(); c.restore();
    } else if (p.type === 'conf') {
      c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(1, Math.abs(Math.sin(p.life * 20 + p.rot))); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore();
    } else if (p.type === 'wind') {
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); c.stroke();
    }
  });
  c.globalAlpha = 1;
}

function drawGlass(c) {
  glass.forEach((q) => {
    const a = clamp(1 - Math.max(0, q.life - (q.max - 0.9)) / 0.9, 0, 1);
    const r = q.r * (0.6 + 0.4 * Math.min(1, q.life * 6));
    c.globalAlpha = a;
    const gr = c.createRadialGradient(q.x - r * 0.3, q.y - r * 0.3, r * 0.1, q.x, q.y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(0.7, 'rgba(170,220,255,.45)'); gr.addColorStop(1, 'rgba(110,190,250,.55)');
    c.fillStyle = gr; c.beginPath(); c.ellipse(q.x, q.y, r, r * 1.12, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.stroke();
    if (q.trail) { c.fillStyle = 'rgba(170,220,255,.3)'; c.fillRect(q.x - r * 0.18, q.y - q.trail, r * 0.36, q.trail); }
  });
  c.globalAlpha = 1;
}

function drawFloaters(c) {
  floaters.forEach((f) => {
    const k = f.life < 0.2 ? ease(f.life / 0.2) * 1.25 : 1.25 - 0.25 * Math.min(1, (f.life - 0.2) * 3);
    c.save(); c.translate(f.x, f.y - f.life * 40); c.scale(k, k); c.globalAlpha = clamp(2 - f.life * 2, 0, 1); c.rotate(-0.08);
    c.font = '900 ' + f.size + 'px "Baloo 2","Comic Sans MS",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 9; c.strokeStyle = '#fff'; c.lineJoin = 'round'; c.strokeText(f.text, 0, 0);
    c.fillStyle = f.col; c.fillText(f.text, 0, 0); c.restore();
  });
}

/* ------------------------------------------------------------------ */
/* Lógica do jogo                                                       */
/* ------------------------------------------------------------------ */
function toLocal(x, y) { return { x: (x - cx) / S, y: (y - cy - P.py * S) / S }; }
function overPet(x, y, m) {
  const l = toLocal(x, y); m = m || 0;
  const inE = (ex, ey, rx, ry) => ((l.x - ex) / (rx + m)) ** 2 + ((l.y - ey) / (ry + m)) ** 2 <= 1;
  return inE(0, -105, 130, 105) || inE(0, 100, 136, 122) || inE(-122, 108, 28, 56) || inE(122, 108, 28, 56) || inE(-72, 196, 46, 30) || inE(72, 196, 46, 30);
}

function startRound(sp) {
  Snd.init();
  Snd.stopAll(); showerActive = dryerActive = false;
  P = newPet(sp);
  particles = []; glass = []; floaters = []; drops = []; puddle = 0;
  beforeImg = snapshot(P, 'sad'); afterImg = '';
  scene = 'play'; tool = 'sponge';
  $('menu').classList.add('hidden'); $('win').classList.add('hidden'); $('ba').classList.add('hidden');
  $('hud').classList.remove('hidden'); $('toolbar').classList.remove('hidden');
  $('progressIcon').textContent = SPECIES[sp].icon;
  refreshToolbar();
}

function goMenu() {
  Snd.stopAll(); showerActive = dryerActive = false; ptr.down = false;
  scene = 'menu'; P = null;
  $('menu').classList.remove('hidden'); $('win').classList.add('hidden'); $('ba').classList.add('hidden');
  $('hud').classList.add('hidden'); $('toolbar').classList.add('hidden');
  updateCount();
}

function nextPet() {
  const i = SPECIES_ORDER.indexOf(P ? P.sp : 'dino');
  startRound(SPECIES_ORDER[(i + 1) % SPECIES_ORDER.length]);
}

function remaining(pet) {
  const mud = pet.blobs.reduce((s, b) => s + (b.mud > 0.03 ? 1 : 0), 0);
  const foam = pet.blobs.reduce((s, b) => s + (b.foam > 0.03 ? 1 : 0), 0);
  return { mud, foam, scr: pet.scratches.filter((s) => !s.on).length, leaf: pet.leaves.filter((l) => !l.gone).length };
}

function progress(pet) {
  const nb = pet.blobs.length;
  const r = pet.blobs.reduce((s, b) => s + Math.max(clamp(b.mud, 0, 1), 0.5 * clamp(b.foam, 0, 1)), 0) / nb;
  const sc = pet.scratches.filter((s) => !s.on).length / pet.scratches.length;
  const lf = pet.leaves.filter((l) => !l.gone).length / pet.leaves.length;
  const base = 1 - (r * 0.6 + sc * 0.2 + lf * 0.2);
  const rem = remaining(pet);
  const rinsed = rem.mud === 0 && rem.foam === 0;
  const dry = rinsed ? 1 - clamp(pet.wet, 0, 1) : 0;
  return clamp(base * 0.85 + dry * 0.15, 0, 1);
}

function hintTool(pet) {
  const r = remaining(pet);
  if (r.mud > 0) return 'sponge';
  if (r.foam > 0) return 'shower';
  if (r.scr > 0) return 'bandage';
  if (pet.wet >= 0.1) return 'dryer';
  return null;
}

/* toolbar */
function buildToolbar() {
  const tb = $('toolbar');
  TOOLS.forEach((t) => {
    const b = document.createElement('button'); b.className = 'tool'; b.dataset.id = t.id; b.setAttribute('aria-label', t.label);
    const disc = document.createElement('div'); disc.className = 'disc';
    const cn = document.createElement('canvas'); cn.width = 96; cn.height = 96;
    const c = cn.getContext('2d'); c.translate(48, 50); c.scale(1.05, 1.05); drawToolIcon(c, t.id, 0, -1);
    disc.appendChild(cn); b.appendChild(disc);
    const l = document.createElement('span'); l.textContent = t.label; b.appendChild(l);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); Snd.init(); selectTool(t.id); });
    tb.appendChild(b);
  });
}
function selectTool(id) {
  if (tool !== id) { stopLoops(); }
  tool = id; Snd.tick(); refreshToolbar();
}
function refreshToolbar() {
  document.querySelectorAll('.tool').forEach((b) => {
    b.classList.toggle('sel', b.dataset.id === tool);
    b.classList.toggle('hint', !!P && scene === 'play' && P.ready && b.dataset.id === P.hintTool && b.dataset.id !== tool);
  });
}
function stopLoops() { if (showerActive) { Snd.showerOff(); showerActive = false; onShowerStop(); } if (dryerActive) { Snd.dryerOff(); dryerActive = false; } }

function onShowerStop() {
  if (P && P.wet > 0.35 && P.showerTime > 1.0 && !P.sneezeDone && P.sneeze <= 0) { P.sneezePending = 0.5; }
}

/* ---- ponteiro ---- */
function setPtr(e) { ptr.lx = ptr.x; ptr.ly = ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; }
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault(); Snd.init(); setPtr(e); ptr.lx = ptr.x; ptr.ly = ptr.y; ptr.down = true;
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  if (scene === 'play' && P && P.ready) onTap();
});
cv.addEventListener('pointermove', (e) => { setPtr(e); });
function release() { ptr.down = false; stopLoops(); }
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);
cv.addEventListener('contextmenu', (e) => e.preventDefault());

function onTap() {
  const l = toLocal(ptr.x, ptr.y);
  // folhas: qualquer ferramenta puxa
  for (const lf of P.leaves) {
    if (!lf.gone && dist(l.x, l.y, lf.x, lf.y - 20) < 52) { pullLeaf(lf); return; }
  }
  if (tool === 'bandage') {
    for (const s of P.scratches) {
      if (!s.on && dist(l.x, l.y, s.x, s.y) < 56) {
        s.on = true; s.pop = 1; P.proud = 1.2; Snd.bandage();
        sparkleAt(ptr.x, ptr.y, 8); say('Pronto!', ptr.x, ptr.y - 50, '#2dbd5f', 34);
        return;
      }
    }
    Snd.tick();
    return;
  }
  // arranhão sem curativo: dói!
  for (const s of P.scratches) {
    if (!s.on && dist(l.x, l.y, s.x, s.y) < 40 && tool !== 'hand') { P.ouch = 0.7; Snd.ouch(); say('Aiii!', ptr.x, ptr.y - 40, '#e53935', 36); return; }
  }
  if (tool === 'hand') {
    // bochecha/nariz/barriga
    if (overPet(ptr.x, ptr.y)) {
      if (dist(l.x, l.y, 0, -92) < 36 && P.sneezeCool <= 0 && P.wet > 0.3) { startSneeze(); return; }
      if (dist(l.x, l.y, 0, -92) < 36) { Snd.boop(); say('Boop!', ptr.x, ptr.y - 50, '#ff6b9a', 34); P.giggle = 0.6; heartAt(ptr.x, ptr.y - 20); return; }
      P.giggle = 0.7; P.sq = 0.5; Snd.giggle(); heartAt(ptr.x, ptr.y - 20);
    }
  }
  if (tool === 'shower') { Snd.showerOn(); showerActive = true; P.showerTime = 0; P.sneezeDone = false; }
  if (tool === 'dryer') { Snd.dryerOn(); dryerActive = true; }
}

function pullLeaf(lf) {
  lf.gone = true; lf.vx = rand(-160, 160); lf.vy = -rand(200, 320); lf.vr = rand(-8, 8);
  Snd.swoosh(); P.giggle = 0.5; P.sq = 0.3;
  const px = cx + (lf.x) * S, py = cy + (lf.y) * S;
  say('Uhuu!', px, py - 30, '#2dbd5f', 34);
  // folha voando como partícula
  spawn({ x: px, y: py, vx: lf.vx, vy: lf.vy, g: 500, max: 1.4, size: 22, col: lf.col, type: 'star', vr: lf.vr });
  sparkleAt(px, py, 6, ['#ffffff', '#c8f7c5']);
}

function startSneeze() {
  P.sneeze = 1.0; P.sneezeCool = 4; P.sneezeDone = true; P.sneezeFired = false; Snd.sneezeWind();
}

function doSneezeBurst() {
  Snd.sneeze();
  say('ATCHIM!', cx, cy - 190 * S, '#2f8fe0', 58);
  const nx = cx, ny = cy - 90 * S;
  for (let i = 0; i < 26; i++) { const a = rand(0, TAU), s = rand(80, 340); spawn({ x: nx, y: ny, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7 + 90, g: 600, max: rand(0.4, 0.8), size: rand(3, 7), col: 'rgba(150,215,255,.95)', type: 'dot' }); }
  const n = 9 + (Math.random() * 5 | 0);
  for (let i = 0; i < n; i++) glass.push({ x: rand(30, W - 30), y: rand(H * 0.12, H * 0.8), r: rand(14, 52), life: -Math.random() * 0.12, max: rand(3.0, 4.2), vy: rand(4, 16), trail: Math.random() < 0.4 ? rand(10, 50) : 0 });
  P.lean = 0.2; P.sq = 0.6;
  P.wet = Math.max(0, P.wet - 0.1);
}

function checkWin() {
  const r = remaining(P);
  if (!P.win && r.mud === 0 && r.foam === 0 && r.scr === 0 && r.leaf === 0 && P.wet < 0.1 && P.ready) {
    P.win = true; P.winT = 0; P.jumpT = 0;
    Snd.stopAll(); showerActive = dryerActive = false;
    Snd.win(); confetti(110); sparkleAt(cx, cy - 60 * S, 40);
    say('Brilhando!', cx, cy - 210 * S, '#ff6b9a', 54);
    afterImg = snapshot(P, 'happy');
    cleanedCount++; store('cc_count', String(cleanedCount));
    scene = 'win';
    $('toolbar').classList.add('hidden');
    setTimeout(() => { if (scene === 'win') $('win').classList.remove('hidden'); }, 1800);
  }
}

function update(dt) {
  time += dt;
  updateParticles(dt);
  if (!P) return;
  P.t += dt;
  sndCool -= dt;
  const pp = P;
  // timers
  ['sponging', 'showering', 'drying', 'petting', 'ouch', 'proud', 'giggle'].forEach((k) => { if (pp[k] > 0) pp[k] = Math.max(0, pp[k] - dt); });
  pp.sneezeCool = Math.max(0, pp.sneezeCool - dt);
  pp.blinkT -= dt; if (pp.blinkT <= 0) { pp.blink = 0.14; pp.blinkT = rand(1.5, 4); } if (pp.blink > 0) pp.blink -= dt;
  pp.sq *= Math.pow(0.001, dt); // volta ao normal
  pp.lean *= Math.pow(0.003, dt);
  pp.shake = pp.showering > 0 ? Math.sin(pp.t * 70) * 3 : 0;

  // queda inicial
  if (!pp.ready || pp.win) {
    if (pp.win) {
      pp.winT += dt;
      if (pp.py >= 0) { pp.jumpT -= dt; if (pp.jumpT <= 0) { pp.vy = -820; pp.jumpT = 1.15; Snd.sparkle(); } }
    }
    pp.vy += 2600 * dt; pp.py += pp.vy * dt;
    if (pp.py >= 0) {
      if (pp.vy > 260) { pp.sq = clamp(pp.vy / 1400, 0, 0.8); if (!pp.ready) { Snd.splat(); splashAt(cx, floorY, 14, '#8d6a3c'); } }
      pp.py = 0; pp.vy = pp.vy > 330 ? -pp.vy * 0.38 : 0;
      if (!pp.ready && pp.vy === 0) { pp.settle += dt; }
    }
    if (!pp.ready && pp.settle > 0.01) { pp.ready = true; refreshToolbar(); }
  }
  if (pp.win && pp.winT > 0.3 && Math.random() < dt * 14) sparkleAt(cx + rand(-150, 150) * S, cy + rand(-200, 150) * S, 1);

  // espirro
  if (pp.sneezePending > 0) { pp.sneezePending -= dt; if (pp.sneezePending <= 0) startSneeze(); }
  if (pp.sneeze > 0) {
    const before = pp.sneeze; pp.sneeze = Math.max(0, pp.sneeze - dt);
    if (before > 0.5) pp.lean = -0.1 * (1 - (before - 0.5) / 0.5) - 0.02;
    if (before > 0.5 && pp.sneeze <= 0.5 && !pp.sneezeFired) { pp.sneezeFired = true; doSneezeBurst(); }
  }

  if (pp.ready && !pp.win && scene === 'play') {
    toolEffects(dt);
    // evaporação natural lenta
    pp.wet = Math.max(0, pp.wet - dt * 0.004);
    if (pp.wet > 0.5 && Math.random() < dt * pp.wet * 3) spawn({ x: cx + rand(-110, 110) * S, y: cy + 215 * S, vy: 50, g: 800, max: 0.45, size: 4, col: 'rgba(120,200,255,.9)', type: 'dot' });
    pp.hintTool = hintTool(pp);
    refreshHint();
    checkWin();
  }
  pp.fluff = Math.max(0, pp.fluff - dt * (pp.drying > 0 ? 0 : 0.7));
  // folhas arrancadas: ficam "gone" e saem de cena
  // arranhão pulando
  pp.scratches.forEach((s) => { if (s.pop > 0) s.pop = Math.max(0, s.pop - dt * 1.5); });
  // gotas do chuveiro
  updateDrops(dt);
  // poça
  puddle = Math.max(0, puddle - dt * 0.012);
  ptr.speed = lerp(ptr.speed, dist(ptr.x, ptr.y, ptr.lx, ptr.ly) / Math.max(dt, 0.001), 0.4);
  ptr.lx = ptr.x; ptr.ly = ptr.y;
  $('progressFill').style.width = (progress(pp) * 100).toFixed(1) + '%';
}

let lastHint = '';
function refreshHint() {
  const h = P.hintTool + '|' + tool;
  if (h !== lastHint) { lastHint = h; refreshToolbar(); }
}

function toolEffects(dt) {
  const pp = P;
  if (!ptr.down) return;
  const over = overPet(ptr.x, ptr.y);
  const sp = ptr.speed;
  if (tool === 'sponge') {
    if (over) {
      const l = toLocal(ptr.x, ptr.y);
      let touched = false;
      pp.blobs.forEach((b) => {
        if (b.mud > 0 && dist(l.x, l.y, b.x, b.y) < b.r + 26) {
          const d = (0.4 * dt + sp * 0.00055 * dt * 60 * 0.12);
          b.mud = Math.max(0, b.mud - Math.min(d, 0.06));
          b.foam = Math.min(1, b.foam + Math.min(d, 0.06) * 1.3);
          touched = true;
        }
      });
      if (sp > 120) {
        pp.sponging = 0.25; pp.sq = Math.max(pp.sq, 0.12);
        if (Math.random() < dt * 22) bubbleAt(ptr.x + rand(-26, 26), ptr.y + rand(-26, 26));
        if (sndCool <= 0) { Snd.scrub(); sndCool = 0.16; }
        if (touched && Math.random() < dt * 8) spawn({ x: ptr.x + rand(-20, 20), y: ptr.y + rand(-10, 20), vx: rand(-60, 60), vy: rand(-40, 60), g: 600, max: 0.5, size: rand(3, 6), col: pp.mess.cols[0], type: 'dot' });
      }
    }
  } else if (tool === 'shower') {
    pp.showerTime += dt;
    // jorro
    const n = Math.round(dt * 140);
    for (let i = 0; i < n; i++) {
      drops.push({ x: ptr.x + rand(-8, 8) + (i % 2 ? 1 : -1) * rand(0, 12), y: ptr.y - 18 + rand(-4, 4), vx: rand(-40, 40), vy: rand(280, 420), age: 0 });
    }
  } else if (tool === 'dryer') {
    const dir = ptr.x < cx ? 1 : -1;
    const nx = ptr.x + dir * 34, ny = ptr.y;
    for (let i = 0; i < 3; i++) {
      const a = rand(-0.28, 0.28), s = rand(480, 720);
      spawn({ x: nx, y: ny + rand(-14, 14), vx: Math.cos(a) * s * dir, vy: Math.sin(a) * s, max: rand(0.25, 0.45), type: 'wind' });
    }
    const target = overPet(ptr.x + dir * 90, ptr.y, 30) || over;
    if (target) {
      pp.drying = 0.25;
      pp.wet = Math.max(0, pp.wet - dt * 0.28);
      pp.fluff = Math.min(1, pp.fluff + dt * 1.8);
      if (pp.wet < 0.01) pp.wet = 0;
      pp.leaves.forEach((lf) => {
        if (!lf.gone && dist((ptr.x - cx) / S, (ptr.y - cy) / S, lf.x, lf.y) < 130) {
          lf.hp -= dt * 0.9; if (lf.hp <= 0) pullLeaf(lf);
        }
      });
      // bolhinhas de espuma voam
      pp.blobs.forEach((b) => { if (b.foam > 0 && dist((ptr.x - cx) / S + dir * 70, (ptr.y - cy) / S, b.x, b.y) < 80) { b.foam = Math.max(0, b.foam - dt * 0.35); if (Math.random() < dt * 6) bubbleAt(cx + b.x * S, cy + b.y * S); } });
      if (Math.random() < dt * 10) spawn({ x: cx + rand(-130, 130) * S, y: cy + rand(-200, 150) * S, vx: -dir * rand(120, 260), vy: rand(-40, 20), max: 0.5, size: 3, col: 'rgba(255,255,255,.9)', type: 'dot' });
    }
  } else if (tool === 'hand') {
    if (over && sp > 80) {
      pp.petting = 0.3; pp.sq = Math.max(pp.sq, 0.1);
      if (Math.random() < dt * 8) heartAt(ptr.x + rand(-20, 20), ptr.y - 20);
      if (sndCool <= 0 && Math.random() < 0.25) { Snd.giggle(); sndCool = 0.9; }
    }
  }
}

function updateDrops(dt) {
  const pp = P;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt; d.vy += 900 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    let kill = false;
    if (d.age > 0.09 && pp.ready && overPet(d.x, d.y)) {
      kill = true;
      const l = toLocal(d.x, d.y);
      pp.wet = Math.min(1, pp.wet + 0.0022);
      pp.showering = 0.25; pp.rinsed = true;
      pp.blobs.forEach((b) => {
        if (dist(l.x, l.y, b.x, b.y) < b.r + 20) {
          if (b.foam > 0) { b.foam = Math.max(0, b.foam - 0.032); if (Math.random() < 0.05) Snd.foamPop(); }
          if (b.mud > 0) b.mud = Math.max(0, b.mud - 0.006);
        }
      });
      pp.scratches.forEach((s) => { if (!s.on && dist(l.x, l.y, s.x, s.y) < 30 && pp.ouch <= 0 && Math.random() < 0.01) { pp.ouch = 0.5; Snd.ouch(); } });
      if (Math.random() < 0.5) spawn({ x: d.x, y: d.y, vx: rand(-90, 90), vy: rand(-120, -20), g: 700, max: 0.3, size: rand(2, 4), col: 'rgba(130,205,255,.95)', type: 'dot' });
    } else if (d.y > floorY + rand(0, 26) * S && d.age > 0.1) {
      kill = true; puddle = Math.min(1, puddle + 0.0012);
      if (Math.random() < 0.3) spawn({ x: d.x, y: floorY, vx: rand(-60, 60), vy: rand(-110, -30), g: 600, max: 0.3, size: 3, col: 'rgba(140,210,255,.9)', type: 'dot' });
    }
    if (kill || d.y > H + 20) drops.splice(i, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Render                                                               */
/* ------------------------------------------------------------------ */
function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, W, H);
  drawBackground(g, W, H, cy, S);
  if (P && (scene === 'play' || scene === 'win')) {
    // poça
    if (puddle > 0.01) { g.fillStyle = 'rgba(110,190,245,.5)'; ell(g, cx, floorY + 18 * S, (120 + 120 * puddle) * S, (14 + 14 * puddle) * S); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, cx - 40 * S, floorY + 14 * S, 40 * S * puddle + 10, 4 * S); g.fill(); }
    // sombra
    const sh = clamp(1 + P.py / 600, 0.5, 1);
    g.fillStyle = 'rgba(60,40,20,.25)'; ell(g, cx, floorY + 8 * S, 150 * S * sh, 20 * S * sh); g.fill();
    drawPet(g, cx, cy, S, P, viewFor(P));
  } else if (P === null && scene === 'menu') { /* menu em HTML */ }
  // gotas de chuveiro
  if (drops.length) {
    g.fillStyle = 'rgba(120,200,255,.85)'; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1;
    drops.forEach((d) => { g.beginPath(); g.ellipse(d.x, d.y, 3, 7, Math.atan2(d.vx, d.vy) * -1, 0, TAU); g.fill(); });
  }
  drawParticles(g);
  // ferramenta no cursor
  if (P && scene === 'play' && ptr.down) {
    g.save(); g.translate(ptr.x, ptr.y);
    const sc = 1.15 + (tool === 'sponge' ? Math.sin(time * 18) * 0.04 : 0);
    if (tool === 'sponge') { g.translate(0, -14); g.rotate(Math.sin(time * 20) * 0.15 * clamp(ptr.speed / 300, 0, 1) - 0.2); }
    if (tool === 'shower') { g.translate(18, -38); }
    if (tool === 'dryer') { const dir = ptr.x < cx ? 1 : -1; g.scale(1.15, 1.15); g.translate(-dir * 48, -6); g.scale(1 / 1.15, 1 / 1.15); }
    if (tool === 'hand') { g.translate(0, -18); g.rotate(Math.sin(time * 10) * 0.1); }
    if (tool === 'bandage') { g.translate(0, -10); }
    g.scale(sc, sc);
    g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 8; g.shadowOffsetY = 4;
    drawToolIcon(g, tool, time, ptr.x < cx ? 1 : -1); // dir>0: sopra pra direita (bico espelhado)
    g.restore();
  }
  drawGlass(g);
  drawFloaters(g);
}

let last = performance.now(), paused = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused) { update(dt); render(); }
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* Menu e telas                                                         */
/* ------------------------------------------------------------------ */
function buildMenu() {
  const wrap = $('cards');
  SPECIES_ORDER.forEach((k) => {
    const b = document.createElement('button'); b.className = 'card';
    const cn = document.createElement('canvas'); cn.width = 192; cn.height = 192;
    const c = cn.getContext('2d');
    const dummy = newPet(k); dummy.blobs = []; dummy.leaves = []; dummy.scratches = [];
    const f = { eyes: 'round', mouth: 'smile', open: 1, brow: 0, blush: 0.4, tear: false, talk: 0 };
    c.fillStyle = '#d9f3ff'; c.fillRect(0, 0, 192, 192);
    drawPet(c, 96, 100, 0.38, dummy, { py: 0, sq: 0, lean: 0, shake: 0, face: f, ear: 0, arms: 0, flies: 0, stink: 0, happy: false, t: 1 });
    b.appendChild(cn);
    const s = document.createElement('span'); s.textContent = SPECIES[k].name; b.appendChild(s);
    const i = document.createElement('i'); i.textContent = '▶'; b.appendChild(i);
    b.addEventListener('click', () => startRound(k));
    wrap.appendChild(b);
  });
  updateCount();
}
function updateCount() { $('countLabel').textContent = cleanedCount > 0 ? '🛁 Bichinhos limpinhos: ' + cleanedCount : ''; }

/* antes / depois */
let baAnim = null, baDrag = false;
function showBA() {
  $('win').classList.add('hidden'); $('ba').classList.remove('hidden'); scene = 'ba';
  $('baBefore').src = beforeImg; $('baAfter').src = afterImg;
  setBA(100);
  const t0 = performance.now();
  cancelAnimationFrame(baAnim);
  const step = (n) => {
    const k = clamp((n - t0 - 600) / 2600, 0, 1);
    setBA(100 - 100 * ease(k));
    if (k < 1 && !baDrag) baAnim = requestAnimationFrame(step);
  };
  baAnim = requestAnimationFrame(step);
}
function setBA(p) {
  p = clamp(p, 0, 100);
  $('baAfter').style.clipPath = 'inset(0 0 0 ' + p + '%)';
  $('baHandle').style.left = p + '%';
}
function baFromEvent(e) {
  const r = $('baBox').getBoundingClientRect();
  setBA((e.clientX - r.left) / r.width * 100);
}
function initBA() {
  const box = $('baBox');
  box.addEventListener('pointerdown', (e) => { baDrag = true; cancelAnimationFrame(baAnim); try { box.setPointerCapture(e.pointerId); } catch (er) {} baFromEvent(e); });
  box.addEventListener('pointermove', (e) => { if (baDrag) baFromEvent(e); });
  const up = () => { baDrag = false; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
}

/* ------------------------------------------------------------------ */
/* Init                                                                 */
/* ------------------------------------------------------------------ */
function init() {
  resize();
  buildToolbar();
  buildMenu();
  initBA();
  $('btnHome').addEventListener('click', goMenu);
  $('btnSound').addEventListener('click', () => { Snd.init(); $('btnSound').textContent = Snd.toggle() ? '🔊' : '🔇'; });
  $('btnBA').addEventListener('click', showBA);
  $('btnNext').addEventListener('click', nextPet);
  $('btnBANext').addEventListener('click', nextPet);
  $('btnBAReplay').addEventListener('click', showBA);
  requestAnimationFrame(frame);
}

// chamados pelo app Android
window.__back = function () {
  if (scene === 'menu') return false;
  goMenu(); return true;
};
window.__pause = function () { Snd.stopAll(); showerActive = dryerActive = false; ptr.down = false; };
document.addEventListener('visibilitychange', () => { paused = document.hidden; last = performance.now(); if (document.hidden) window.__pause(); });

// ganchos para testes automatizados
window.__game = { startRound, get P() { return P; }, get scene() { return scene; }, selectTool, ptr, toLocal, get S() { return S; }, get cx() { return cx; }, get cy() { return cy; }, update, render, snapshot, showBA };

init();
