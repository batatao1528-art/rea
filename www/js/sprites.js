'use strict';
/*
 * Vale Florido — toda a arte em pixel art é gerada aqui, por código.
 * Medidas seguem o guia: tiles e ícones 16x16, personagem 16x24
 * (desenhado num quadro de 32x40 para caber as ferramentas).
 */
const Sprites = (() => {
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c, x };
  };
  const rect = (x, X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  const px = (x, X, Y, col) => { x.fillStyle = col; x.fillRect(X, Y, 1, 1); };

  function rand(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function line(x, x0, y0, x1, y1, col, w = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= steps; i++) {
      rect(x, Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps), w, w, col);
    }
  }

  // Elipse preenchida; col pode ser função (dx, dy) => cor | null
  function ell(x, cx, cy, rx, ry, col) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let X = Math.floor(cx - rx); X <= Math.ceil(cx + rx); X++) {
        const dx = (X + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        const c = typeof col === 'function' ? col(dx, dy) : col;
        if (c) px(x, X, y, c);
      }
    }
  }

  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  // Contorno escuro de 1px em volta de tudo que é opaco (visual clássico de pixel art)
  function outline(c, col = '#2a1c14') {
    const x = c.getContext('2d');
    const w = c.width, h = c.height;
    const d = x.getImageData(0, 0, w, h);
    const a = d.data, out = new Uint8ClampedArray(a);
    const [r, g, b] = hex(col);
    for (let y = 0; y < h; y++) {
      for (let X = 0; X < w; X++) {
        const i = (y * w + X) * 4;
        if (a[i + 3]) continue;
        const near = (X > 0 && a[i - 1]) || (X < w - 1 && a[i + 7]) ||
          (y > 0 && a[i - w * 4 + 3]) || (y < h - 1 && a[i + w * 4 + 3]);
        if (near) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; }
      }
    }
    d.data.set(out);
    x.putImageData(d, 0, 0);
    return c;
  }

  const cache = {};
  const memo = (k, f) => cache[k] || (cache[k] = f());

  // ===================== TERRENO (environment_tiles) =====================
  const SP = [
    { g: '#6dbf3e', d: '#56a432', l: '#8ed65c', fl: ['#fff6e0', '#ffd84a', '#ff8fb3', '#a8c8ff'],
      leaf: '#3f9a3a', leafD: '#2c7430', leafL: '#69c457', weed: '#4f9a2c' },
    { g: '#5cb037', d: '#478f2b', l: '#7dc94f', fl: ['#ffe14a', '#ff6b4a', '#fff6e0'],
      leaf: '#2f8a34', leafD: '#20652a', leafL: '#4fae47', weed: '#3f8a26' },
    { g: '#b9a046', d: '#9a8236', l: '#d6bb62', fl: ['#e0602a', '#c43f2a', '#f0c040'],
      leaf: '#d9772a', leafD: '#a8501e', leafL: '#f0a040', weed: '#8a7a30' },
    { g: '#e9eff5', d: '#c9d5e1', l: '#ffffff', fl: ['#c8d8e8'],
      leaf: null, leafD: null, leafL: null, weed: '#9a8a6a' },
  ];

  function grass(season, v) {
    const { c, x } = mk(16, 16);
    const p = SP[season];
    const r = rand(season * 31 + v * 7 + 1);
    rect(x, 0, 0, 16, 16, p.g);
    const n = v === 3 ? 6 : 14;
    for (let i = 0; i < n; i++) px(x, r() * 16 | 0, r() * 16 | 0, p.d);
    for (let i = 0; i < n / 2; i++) px(x, r() * 16 | 0, r() * 16 | 0, p.l);
    if (v === 1) {
      for (let i = 0; i < 3; i++) {
        const X = 1 + r() * 13 | 0, Y = 3 + r() * 11 | 0;
        px(x, X, Y, p.d); px(x, X + 2, Y, p.d); px(x, X + 1, Y - 1, p.d); px(x, X + 1, Y - 2, p.l);
      }
    }
    if (v === 2) {
      for (let i = 0; i < 2; i++) {
        const X = 2 + r() * 11 | 0, Y = 2 + r() * 11 | 0, f = p.fl[r() * p.fl.length | 0];
        px(x, X, Y - 1, f); px(x, X - 1, Y, f); px(x, X + 1, Y, f); px(x, X, Y + 1, f);
        px(x, X, Y, season === 3 ? '#ffffff' : '#ffd84a');
      }
    }
    return c;
  }

  // Auto-tile por máscara de 4 bits (1=N, 2=L, 4=S, 8=O => vizinho do mesmo tipo)
  function auto(mask, fill, edge, hi) {
    const { c, x } = mk(16, 16);
    const x0 = mask & 8 ? 0 : 1, x1 = mask & 2 ? 16 : 15;
    const y0 = mask & 1 ? 0 : 1, y1 = mask & 4 ? 16 : 15;
    x.save(); x.beginPath(); x.rect(x0, y0, x1 - x0, y1 - y0); x.clip(); fill(x); x.restore();
    if (!(mask & 1)) rect(x, x0, y0, x1 - x0, 1, hi || edge);
    if (!(mask & 4)) rect(x, x0, y1 - 1, x1 - x0, 1, edge);
    if (!(mask & 8)) rect(x, x0, y0, 1, y1 - y0, edge);
    if (!(mask & 2)) rect(x, x1 - 1, y0, 1, y1 - y0, edge);
    if (!(mask & 1) && !(mask & 8)) x.clearRect(x0, y0, 1, 1);
    if (!(mask & 1) && !(mask & 2)) x.clearRect(x1 - 1, y0, 1, 1);
    if (!(mask & 4) && !(mask & 8)) x.clearRect(x0, y1 - 1, 1, 1);
    if (!(mask & 4) && !(mask & 2)) x.clearRect(x1 - 1, y1 - 1, 1, 1);
    return c;
  }

  function soilFill(wet) {
    const base = wet ? '#5c3b1f' : '#8f5d2e', fur = wet ? '#462c16' : '#714622', sp = wet ? '#6e4828' : '#a8703c';
    return x => {
      const r = rand(wet ? 77 : 55);
      rect(x, 0, 0, 16, 16, base);
      for (let y = 3; y < 16; y += 4) rect(x, 0, y, 16, 1, fur);
      for (let i = 0; i < 12; i++) px(x, r() * 16 | 0, r() * 16 | 0, sp);
      if (wet) for (let i = 0; i < 4; i++) px(x, r() * 16 | 0, r() * 16 | 0, '#3a2512');
    };
  }
  const soil = (mask, wet) => auto(mask, soilFill(wet), wet ? '#3a2410' : '#5e3a1a', wet ? '#4a3018' : '#6e4622');

  const pathFill = x => {
    const r = rand(9);
    rect(x, 0, 0, 16, 16, '#c79c66');
    for (let i = 0; i < 14; i++) px(x, r() * 16 | 0, r() * 16 | 0, '#a98050');
    for (let i = 0; i < 8; i++) px(x, r() * 16 | 0, r() * 16 | 0, '#dcb682');
  };
  const path = mask => auto(mask, pathFill, '#9a7244');

  function plank() {
    const { c, x } = mk(16, 16);
    rect(x, 0, 0, 16, 16, '#a8743e');
    for (let y = 0; y < 16; y += 4) {
      rect(x, 0, y + 3, 16, 1, '#6e4822');
      rect(x, 0, y, 16, 1, '#c08a50');
      const off = (y / 4) % 2 ? 5 : 11;
      rect(x, off, y, 1, 3, '#7a5228');
      px(x, (off + 3) % 16, y + 1, '#5a3a1a');
    }
    return c;
  }

  function stone(v) {
    const { c, x } = mk(16, 16);
    const r = rand(300 + v);
    rect(x, 0, 0, 16, 16, '#8e8a84');
    for (let i = 0; i < 14; i++) px(x, r() * 16 | 0, r() * 16 | 0, '#a3a09a');
    for (let i = 0; i < 10; i++) px(x, r() * 16 | 0, r() * 16 | 0, '#76726c');
    if (v === 1) { line(x, 3, 4, 6, 7, '#6e6a64'); line(x, 6, 7, 9, 7, '#6e6a64'); }
    return c;
  }

  // Água animada (4 quadros) com espuma nas bordas
  function water(f, mask) {
    const { c, x } = mk(16, 16);
    const r = rand(42);
    rect(x, 0, 0, 16, 16, '#3d8ed6');
    for (let i = 0; i < 10; i++) px(x, r() * 16 | 0, r() * 16 | 0, '#3480c6');
    for (let k = 0; k < 3; k++) {
      const wy = k * 5 + 2, wx = (k * 7 + f * 2) % 16;
      rect(x, wx, wy, 3, 1, '#72b8ee');
      rect(x, (wx + 9) % 16, wy + 2, 2, 1, '#5aa6e6');
    }
    const foam = '#e8f6ff', foam2 = '#a8d8f8';
    if (!(mask & 1)) {
      rect(x, 0, 0, 16, 2, '#2e6ca8');
      for (let i = (f % 2); i < 16; i += 2) px(x, i, 2, foam2);
      rect(x, 0, 0, 16, 1, '#245a8e');
    }
    if (!(mask & 4)) { rect(x, 0, 15, 16, 1, foam); for (let i = (f % 2); i < 16; i += 2) px(x, i, 14, foam2); }
    if (!(mask & 8)) { rect(x, 0, 0, 1, 16, foam); for (let i = (f % 2); i < 16; i += 2) px(x, 1, i, foam2); }
    if (!(mask & 2)) { rect(x, 15, 0, 1, 16, foam); for (let i = (f % 2); i < 16; i += 2) px(x, 14, i, foam2); }
    return c;
  }

  // ===================== OBJETOS DO MAPA =====================
  function tree(season) {
    const { c, x } = mk(24, 32);
    const p = SP[season];
    rect(x, 10, 19, 4, 12, '#7a4c28'); rect(x, 10, 19, 1, 12, '#94603a'); rect(x, 13, 19, 1, 12, '#5a361c');
    px(x, 9, 31, '#7a4c28'); px(x, 14, 31, '#7a4c28');
    if (season === 3) {
      line(x, 11, 20, 5, 10, '#6a4022'); line(x, 12, 20, 19, 9, '#6a4022'); line(x, 12, 19, 12, 4, '#6a4022');
      line(x, 7, 13, 4, 12, '#6a4022'); line(x, 17, 12, 20, 13, '#6a4022'); line(x, 12, 9, 9, 6, '#6a4022');
      [[5, 9], [4, 11], [19, 8], [20, 12], [12, 3], [9, 5], [11, 4], [6, 10], [18, 9]].forEach(([a, b]) => px(x, a, b, '#ffffff'));
      return outline(c, '#3a2a1e');
    }
    const r = rand(season + 99);
    ell(x, 12, 11, 10.5, 10, (dx, dy) => dx + dy > 0.55 ? p.leafD : (dx + dy < -0.6 ? p.leafL : p.leaf));
    for (let i = 0; i < 26; i++) {
      const X = 3 + r() * 18 | 0, Y = 2 + r() * 17 | 0;
      const d = x.getImageData(X, Y, 1, 1).data;
      if (d[3]) px(x, X, Y, r() < 0.5 ? p.leafL : p.leafD);
    }
    if (season === 0) for (let i = 0; i < 7; i++) px(x, 5 + r() * 14 | 0, 4 + r() * 13 | 0, '#ffb3cf');
    if (season === 1) for (let i = 0; i < 4; i++) { const X = 5 + r() * 13 | 0, Y = 6 + r() * 10 | 0; rect(x, X, Y, 2, 2, '#e2402e'); }
    return outline(c, '#1f3420');
  }

  function pine(season) {
    const { c, x } = mk(24, 32);
    rect(x, 11, 25, 3, 7, '#6a4022'); rect(x, 11, 25, 1, 7, '#86562e');
    const G = season === 2 ? ['#3a6b3a', '#2a522c', '#4c8448'] : ['#2f6b3a', '#214f2b', '#3f8448'];
    for (let l = 0; l < 3; l++) {
      const top = 1 + l * 7, h = 12;
      for (let r = 0; r < h; r++) {
        const half = Math.round(1 + r * (6 + l * 1.5) / h);
        rect(x, 12 - half, top + r, half * 2, 1, G[0]);
        px(x, 12 - half, top + r, G[2]);
        rect(x, 12, top + r, half, 1, G[1]);
      }
      if (season === 3) {
        for (let r = 0; r < 4; r++) {
          const half = Math.round(1 + r * (6 + l * 1.5) / h);
          rect(x, 12 - half, top + r, half * 2, 1, '#f4f8fc');
        }
      }
    }
    return outline(c, '#162a18');
  }

  function stump() {
    const { c, x } = mk(16, 16);
    rect(x, 3, 7, 10, 7, '#7a4c28'); rect(x, 3, 7, 2, 7, '#94603a'); rect(x, 11, 7, 2, 7, '#5a361c');
    ell(x, 8, 7, 5, 2.5, '#c89a62'); ell(x, 8, 7, 3, 1.4, '#a8783e'); px(x, 8, 7, '#c89a62');
    px(x, 2, 13, '#7a4c28'); px(x, 13, 13, '#7a4c28');
    return outline(c);
  }

  function rock(kind) {
    const { c, x } = mk(16, 16);
    ell(x, 8, 9.5, 6.5, 5, (dx, dy) => dx + dy < -0.5 ? '#bab6b0' : (dx + dy > 0.6 ? '#76726c' : '#9a968f'));
    px(x, 5, 6, '#d8d4ce'); px(x, 6, 6, '#d8d4ce'); line(x, 9, 9, 11, 11, '#76726c');
    const spec = kind === 'copper' ? ['#e08a3c', '#b8612a'] : kind === 'iron' ? ['#f2ece0', '#c8b8a0'] : null;
    if (spec) [[5, 9], [9, 7], [11, 10], [7, 12], [10, 13]].forEach(([a, b], i) => {
      rect(x, a, b, 2, 1, spec[0]); px(x, a, b + 1, spec[1]);
    });
    return outline(c, '#3a3632');
  }

  function weed(season) {
    const { c, x } = mk(16, 16);
    const col = SP[season].weed, colL = season === 3 ? '#b8a888' : SP[season].leafL || '#69c457';
    line(x, 8, 14, 5, 6, col); line(x, 8, 14, 8, 4, col); line(x, 8, 14, 11, 6, col);
    line(x, 7, 14, 3, 9, colL); line(x, 9, 14, 13, 9, colL); line(x, 8, 14, 6, 8, colL);
    rect(x, 6, 13, 5, 2, col);
    return outline(c, '#1f3420');
  }

  function branch() {
    const { c, x } = mk(16, 16);
    line(x, 2, 12, 13, 8, '#7a4c28', 2); line(x, 2, 12, 13, 8, '#94603a');
    line(x, 8, 10, 10, 6, '#7a4c28'); px(x, 11, 5, '#5cae3a');
    return outline(c);
  }

  function fence(mask) {
    const { c, x } = mk(16, 16);
    const W = '#b07a42', D = '#7a4c24', L = '#d29a5a';
    if (mask & 1) rect(x, 7, 0, 2, 4, D);
    if (mask & 4) rect(x, 7, 12, 2, 4, D);
    if (mask & 2) { rect(x, 9, 5, 7, 2, W); rect(x, 9, 10, 7, 2, W); }
    if (mask & 8) { rect(x, 0, 5, 7, 2, W); rect(x, 0, 10, 7, 2, W); }
    rect(x, 6, 2, 4, 12, W); rect(x, 6, 2, 1, 12, L); rect(x, 9, 2, 1, 12, D); rect(x, 6, 2, 4, 1, L);
    return outline(c);
  }

  // ===================== ESTRUTURAS =====================
  function house() {
    const { c, x } = mk(80, 84);
    rect(x, 4, 44, 72, 40, '#d6a064');
    for (let y = 47; y < 80; y += 4) rect(x, 4, y, 72, 1, '#b98448');
    rect(x, 4, 79, 72, 5, '#8c8072');
    for (let i = 4; i < 76; i += 6) rect(x, i, 79, 1, 5, '#6e6458');
    for (const wx of [12, 56]) {
      rect(x, wx - 1, 51, 14, 12, '#f4ead8');
      rect(x, wx, 52, 12, 10, '#8fd0f0'); rect(x, wx, 52, 12, 3, '#bfe6fa');
      rect(x, wx + 5, 52, 2, 10, '#f4ead8'); rect(x, wx, 56, 12, 1, '#f4ead8');
      rect(x, wx - 1, 63, 14, 3, '#8a5a2c');
      for (let i = 0; i < 6; i++) px(x, wx + i * 2 + 1, 62, i % 2 ? '#ff6b6b' : '#ffd84a');
    }
    rect(x, 33, 59, 14, 1, '#5a3418');
    rect(x, 34, 60, 12, 24, '#7a4a22'); rect(x, 35, 61, 10, 23, '#8f5a2c');
    rect(x, 39, 61, 2, 23, '#7a4a22'); rect(x, 35, 70, 10, 1, '#7a4a22');
    px(x, 43, 72, '#f2c230'); px(x, 43, 73, '#c8961e');
    rect(x, 33, 82, 14, 2, '#a89a8a');
    const roofL = y => Math.round(10 * (1 - Math.min(1, (y - 4) / 10)));
    for (let y = 4; y < 46; y++) { const l = roofL(y); rect(x, l, y, 80 - 2 * l, 1, '#c0463a'); }
    for (let y = 8; y < 44; y += 4) {
      const l = roofL(y);
      rect(x, l, y, 80 - 2 * l, 1, '#9c342c');
      for (let i = l + ((y / 4) % 2) * 4; i < 80 - l; i += 8) rect(x, i, y - 3, 1, 3, '#a83a30');
    }
    rect(x, 10, 4, 60, 1, '#e0685a');
    rect(x, 0, 44, 80, 2, '#7a2620');
    rect(x, 58, 0, 8, 12, '#9a5a44'); rect(x, 57, 0, 10, 2, '#6e3a2a');
    rect(x, 58, 5, 8, 1, '#7a4434'); rect(x, 61, 2, 1, 3, '#7a4434'); rect(x, 62, 6, 1, 6, '#7a4434');
    return outline(c);
  }

  function bin() {
    const { c, x } = mk(32, 26);
    rect(x, 1, 9, 30, 16, '#a8743e');
    for (let y = 13; y < 25; y += 4) rect(x, 1, y, 30, 1, '#86562e');
    rect(x, 1, 9, 30, 1, '#c08a50');
    rect(x, 0, 3, 32, 7, '#8a5a2c'); rect(x, 0, 3, 32, 2, '#a8743e'); rect(x, 0, 9, 32, 1, '#6a4220');
    for (const bx of [2, 28]) { rect(x, bx, 3, 2, 22, '#8994a0'); px(x, bx, 3, '#c3ccd6'); }
    rect(x, 13, 14, 6, 6, '#f2c230'); rect(x, 15, 15, 2, 4, '#c8961e');
    return outline(c);
  }

  function stall() {
    const { c, x } = mk(48, 56);
    rect(x, 3, 14, 3, 42, '#8a5a2c'); rect(x, 42, 14, 3, 42, '#8a5a2c');
    rect(x, 5, 20, 38, 18, '#7a4a22');
    for (let y = 24; y < 38; y += 4) rect(x, 5, y, 38, 1, '#6a3e1c');
    // vendedora (Dona Rosa)
    ell(x, 24, 26, 4, 4.5, '#f5c8a0');
    rect(x, 20, 21, 8, 3, '#b8b0a8'); ell(x, 24, 20, 2.5, 2, '#b8b0a8');
    px(x, 22, 26, '#2a1a12'); px(x, 26, 26, '#2a1a12'); px(x, 21, 28, '#f09080'); px(x, 27, 28, '#f09080');
    rect(x, 19, 30, 10, 6, '#5aa05a'); rect(x, 21, 30, 6, 6, '#f2eadc');
    // toldo listrado
    for (let i = 0; i < 8; i++) {
      const col = i % 2 ? '#f4ead8' : '#d8443a';
      rect(x, i * 6, 6, 6, 13, col);
      ell(x, i * 6 + 3, 19, 3, 2.5, col);
    }
    rect(x, 0, 5, 48, 2, '#9c2e26');
    // balcão
    rect(x, 1, 36, 46, 20, '#b07a42');
    for (let y = 40; y < 56; y += 4) rect(x, 1, y, 46, 1, '#8a5a2c');
    rect(x, 0, 34, 48, 3, '#d29a5a'); rect(x, 0, 36, 48, 1, '#8a5a2c');
    const crates = [['#f08a24', '#c8661a'], ['#e2402e', '#a82a1e'], ['#5cc64a', '#3a9a30']];
    crates.forEach(([a, b], i) => {
      const cx = 6 + i * 13;
      rect(x, cx, 31, 10, 4, '#8a5a2c');
      for (let k = 0; k < 4; k++) { px(x, cx + 1 + k * 2, 30, a); px(x, cx + 2 + k * 2, 30, b); px(x, cx + 1 + k * 2, 29, a); }
    });
    rect(x, 18, 44, 12, 7, '#f4ead8'); rect(x, 22, 45, 4, 5, '#f2c230');
    return outline(c);
  }

  // ===================== PLANTAÇÕES (crops_sheet) =====================
  function crop(type, stage) {
    const { c, x } = mk(16, 24);
    const dead = stage === 5;
    const L = dead ? '#9a8458' : '#4caf3a', D = dead ? '#76603c' : '#2f8a2c', H = dead ? '#b8a070' : '#7ad35c';
    const B = 20;
    if (stage === 1) {
      ell(x, 8, B + 0.5, 4, 1.8, '#6e4420');
      px(x, 7, B, '#e8d8a0'); px(x, 9, B - 1, '#e8d8a0'); px(x, 6, B - 1, '#4a2c12');
      return c;
    }
    if (stage === 2) {
      rect(x, 8, B - 4, 1, 5, D);
      px(x, 7, B - 4, L); px(x, 6, B - 5, L); px(x, 9, B - 4, L); px(x, 10, B - 5, L); px(x, 8, B - 5, H);
      ell(x, 8, B + 0.5, 3, 1, '#6e4420');
      return outline(c, '#1f3a1a');
    }
    const big = stage === 4;
    if (type === 'carrot') {
      const h = big ? 12 : 9;
      line(x, 8, B, 3, B - h + 2, L); line(x, 8, B, 8, B - h, D); line(x, 8, B, 13, B - h + 2, L);
      line(x, 8, B, 5, B - h + 1, H); line(x, 8, B, 11, B - h + 1, H); line(x, 7, B, 6, B - h + 4, D); line(x, 9, B, 10, B - h + 4, D);
      if (big && !dead) { rect(x, 6, B - 1, 5, 3, '#f08a24'); px(x, 7, B - 1, '#ffb060'); px(x, 9, B + 1, '#c8661a'); }
    } else if (type === 'corn') {
      const h = big ? 19 : 12;
      rect(x, 7, B - h, 2, h + 1, L); rect(x, 8, B - h, 1, h + 1, D);
      for (let i = 0; i < (big ? 4 : 3); i++) {
        const y = B - 3 - i * 4, s = i % 2 ? 1 : -1;
        line(x, s > 0 ? 9 : 6, y, s > 0 ? 13 : 2, y - 3, i % 2 ? H : L);
      }
      if (big && !dead) {
        rect(x, 9, B - 13, 3, 6, '#f4d03f'); px(x, 10, B - 12, '#fff08a'); px(x, 10, B - 10, '#d8a828');
        px(x, 9, B - 7, L); px(x, 11, B - 7, L);
        px(x, 7, B - 20, '#d8b060'); px(x, 8, B - 21, '#d8b060'); px(x, 9, B - 20, '#d8b060');
      }
    } else if (type === 'tomato') {
      rect(x, 12, B - 15, 1, 16, '#a8783c');
      ell(x, 8, B - 6, 5, big ? 7 : 5.5, (dx, dy) => dx + dy > 0.5 ? D : (dx + dy < -0.6 ? H : L));
      if (!dead) {
        const spots = [[5, B - 8], [9, B - 10], [7, B - 4], [10, B - 5]];
        spots.forEach(([a, b], i) => {
          if (!big && i > 1) return;
          rect(x, a, b, 2, 2, big ? '#e2402e' : '#9ad060');
          if (big) px(x, a, b, '#ff8a70');
        });
      }
    } else if (type === 'strawberry') {
      ell(x, 8, B - 2, big ? 6.5 : 5.5, big ? 4 : 3.5, (dx, dy) => dy > 0.3 ? D : (dx < -0.3 ? H : L));
      px(x, 5, B - 4, D); px(x, 10, B - 3, D);
      if (!dead) {
        if (big) {
          [[3, B - 2], [8, B - 1], [11, B - 3]].forEach(([a, b]) => {
            rect(x, a, b, 2, 2, '#e8303e'); px(x, a, b + 2, '#e8303e'); px(x, a + 1, b, '#ffd84a');
          });
        } else {
          [[5, B - 4], [10, B - 4]].forEach(([a, b]) => { px(x, a, b, '#ffffff'); px(x, a + 1, b, '#ffd84a'); });
        }
      }
    } else if (type === 'sunflower') {
      const h = big ? 15 : 11;
      rect(x, 7, B - h, 2, h + 1, L); rect(x, 8, B - h, 1, h + 1, D);
      line(x, 6, B - 4, 3, B - 7, L); line(x, 9, B - 6, 12, B - 9, H);
      if (dead) ell(x, 8, B - h, 3, 3, '#8a6a3a');
      else if (big) { ell(x, 8, B - h - 1, 4.5, 4.5, '#ffd23a'); ell(x, 8, B - h - 1, 2.2, 2.2, '#6a3a1a'); px(x, 6, B - h - 4, '#fff08a'); }
      else ell(x, 8, B - h, 2, 2, '#9ad060');
    } else if (type === 'melon' || type === 'pumpkin') {
      line(x, 1, B, 14, B - 2, D);
      ell(x, 4, B - 3, 3, 2.5, L); ell(x, 12, B - 5, 3, 2.5, H); ell(x, 8, B - 6, 2.5, 2, L);
      if (!dead && !big) ell(x, 9, B - 1, 2, 1.5, type === 'melon' ? '#5aa83a' : '#e8a040');
      if (!dead && big) {
        if (type === 'melon') {
          ell(x, 8, B - 2, 6.5, 4.5, dx => (Math.floor((dx + 1) * 5) % 2 ? '#2f7a2a' : '#5cb040'));
          px(x, 5, B - 4, '#a8e070');
        } else {
          ell(x, 8, B - 3, 6.5, 4.5, dx => (Math.abs(dx) < 0.12 || Math.abs(Math.abs(dx) - 0.55) < 0.1 ? '#c8601a' : '#f08a24'));
          rect(x, 7, B - 9, 2, 2, '#5a3a1a'); px(x, 5, B - 5, '#ffb060');
        }
      }
    }
    return outline(c, dead ? '#4a3a24' : '#1f3a1a');
  }

  // ===================== ÍCONES (items_icons) =====================
  const WOOD = ['#b07a42', '#8a5a2c', '#6a4220'];
  function handle(x, len = 0) {
    line(x, 3, 12, 10 - len, 5 + len, WOOD[0]);
    line(x, 4, 12, 11 - len, 5 + len, WOOD[1]);
    line(x, 4, 13, 11 - len, 6 + len, WOOD[2]);
  }
  const METAL = lvl => lvl === 2 ? ['#eef3f8', '#c3ccd6', '#8994a0'] : ['#b8b4ac', '#8f8b84', '#66625c'];

  function rawIcon(id) {
    const { c, x } = mk(16, 16);
    const m = id.match(/^(hoe|can|axe|pick)(\d)(f?)$/);
    if (m) {
      const lvl = +m[2];
      if (m[1] === 'hoe') {
        handle(x);
        const col = lvl === 2 ? METAL(2) : ['#c89a62', '#a0703c', '#7a4c24'];
        rect(x, 10, 2, 4, 3, col[1]); rect(x, 12, 4, 3, 7, col[1]); rect(x, 12, 4, 1, 7, col[0]); rect(x, 14, 4, 1, 7, col[2]);
      } else if (m[1] === 'axe') {
        handle(x);
        const col = METAL(lvl);
        rect(x, 9, 1, 4, 6, col[1]); rect(x, 12, 0, 3, 8, col[1]); rect(x, 14, 0, 1, 8, col[0]); rect(x, 9, 1, 1, 6, col[2]);
      } else if (m[1] === 'pick') {
        handle(x);
        const col = METAL(lvl);
        line(x, 6, 2, 9, 1, col[1], 2); line(x, 9, 1, 13, 4, col[1], 2); line(x, 13, 4, 14, 8, col[1], 2);
        px(x, 6, 3, col[2]); px(x, 15, 9, col[2]); line(x, 9, 1, 12, 3, col[0]);
      } else {
        const col = lvl === 2 ? ['#f2d070', '#d8a838', '#a87a20'] : ['#a8c4d8', '#7d9bb3', '#5a7890'];
        rect(x, 5, 7, 8, 7, col[1]); rect(x, 5, 7, 2, 6, col[0]); rect(x, 5, 13, 8, 1, col[2]); rect(x, 11, 7, 2, 7, col[2]);
        rect(x, 7, 4, 4, 1, col[2]); rect(x, 11, 5, 1, 3, col[2]); px(x, 6, 5, col[2]); px(x, 6, 6, col[2]);
        line(x, 5, 9, 1, 5, col[1], 1); line(x, 5, 10, 2, 7, col[2]); rect(x, 0, 4, 2, 2, col[0]);
        if (m[3]) { rect(x, 6, 7, 5, 1, '#4aa8f0'); px(x, 0, 7, '#4aa8f0'); px(x, 1, 9, '#4aa8f0'); px(x, 0, 10, '#8ad0ff'); }
      }
      return c;
    }
    switch (id) {
      case 'rod':
        line(x, 2, 14, 13, 1, WOOD[1]); line(x, 3, 14, 14, 1, WOOD[0]);
        rect(x, 4, 10, 3, 3, '#8994a0'); px(x, 5, 11, '#c3ccd6');
        line(x, 14, 1, 14, 10, '#e8e8e8'); px(x, 13, 11, '#c3ccd6'); px(x, 14, 12, '#c3ccd6');
        break;
      case 'seed_carrot': case 'seed_corn': case 'seed_tomato': case 'seed_strawberry':
      case 'seed_sunflower': case 'seed_melon': case 'seed_pumpkin': {
        rect(x, 4, 5, 8, 10, '#d9bf87'); rect(x, 3, 7, 10, 8, '#d9bf87'); rect(x, 3, 14, 10, 1, '#b89a60');
        rect(x, 5, 4, 6, 1, '#c8aa70'); rect(x, 6, 2, 4, 2, '#b89a60'); px(x, 7, 1, '#8a6a3a'); px(x, 8, 1, '#8a6a3a');
        const lab = { seed_carrot: '#f08a24', seed_corn: '#f4d03f', seed_tomato: '#e2402e', seed_strawberry: '#e8303e',
          seed_sunflower: '#ffd23a', seed_melon: '#5cb040', seed_pumpkin: '#f08a24' }[id];
        ell(x, 8, 10, 3, 3, '#f4ead8'); ell(x, 8, 10, 2, 2, lab);
        px(x, 8, 7, '#4caf3a');
        break;
      }
      case 'carrot':
        line(x, 4, 12, 10, 6, '#f08a24', 3); line(x, 3, 14, 5, 12, '#f08a24', 2); px(x, 2, 15, '#f08a24');
        px(x, 6, 10, '#c8661a'); px(x, 9, 8, '#c8661a'); px(x, 5, 11, '#ffb060');
        line(x, 11, 5, 13, 1, '#4caf3a'); line(x, 12, 6, 15, 4, '#3d9a30'); line(x, 11, 6, 14, 3, '#7ad35c');
        break;
      case 'corn':
        line(x, 4, 14, 6, 6, '#5aa83a', 2); line(x, 12, 14, 10, 6, '#5aa83a', 2);
        ell(x, 8, 8, 3, 6.5, '#f4d03f');
        for (let y = 3; y < 14; y += 2) for (let X = 6; X < 11; X += 2) px(x, X + (y % 4 ? 1 : 0), y, '#d8a828');
        px(x, 7, 4, '#fff08a');
        line(x, 5, 15, 7, 10, '#4caf3a'); line(x, 11, 15, 9, 10, '#4caf3a');
        break;
      case 'tomato':
        ell(x, 8, 9, 6, 5.5, (dx, dy) => dx + dy > 0.6 ? '#b82a1e' : '#e2402e');
        px(x, 5, 7, '#ff8a70'); px(x, 5, 8, '#ff8a70'); px(x, 6, 6, '#ff8a70');
        rect(x, 7, 3, 3, 2, '#4caf3a'); px(x, 6, 4, '#3d9a30'); px(x, 10, 4, '#3d9a30'); px(x, 8, 2, '#3d9a30');
        break;
      case 'strawberry':
        ell(x, 8, 8, 5.5, 4.5, '#e8303e');
        for (let r = 0; r < 5; r++) rect(x, 4 + r, 11 + r, 9 - r * 2, 1, '#e8303e');
        [[6, 8], [9, 7], [8, 10], [11, 9], [5, 10], [8, 13]].forEach(([a, b]) => px(x, a, b, '#ffd84a'));
        rect(x, 5, 3, 7, 2, '#4caf3a'); px(x, 8, 1, '#3d9a30'); px(x, 8, 2, '#3d9a30');
        break;
      case 'fish_sardine': case 'fish_carp': case 'fish_tilapia': case 'fish_catfish': {
        const col = { fish_sardine: ['#a8c8dc', '#7a9cb4'], fish_carp: ['#d8b060', '#a8803a'],
          fish_tilapia: ['#a8aec8', '#7a809a'], fish_catfish: ['#7a6a58', '#54483a'] }[id];
        ell(x, 8.5, 8, 5.5, 3.5, (dx, dy) => dy > 0.3 ? col[1] : col[0]);
        rect(x, 1, 5, 2, 7, col[1]); rect(x, 3, 7, 1, 3, col[1]);
        rect(x, 7, 4, 3, 1, col[1]); px(x, 12, 7, '#1a1a1a'); px(x, 11, 9, col[1]);
        if (id === 'fish_tilapia') { rect(x, 6, 6, 1, 4, col[1]); rect(x, 9, 6, 1, 4, col[1]); }
        if (id === 'fish_catfish') { line(x, 14, 9, 15, 12, '#3a3028'); line(x, 13, 10, 13, 13, '#3a3028'); }
        if (id === 'fish_sardine') px(x, 8, 7, '#e8f4ff');
        break;
      }
      case 'wood':
        rect(x, 1, 6, 12, 7, '#8a5a2c'); rect(x, 1, 6, 12, 2, '#b07a42'); rect(x, 1, 12, 12, 1, '#6a4220');
        ell(x, 13, 9.5, 2.5, 3.5, '#d2a46a'); px(x, 13, 9, '#a8783e'); px(x, 13, 10, '#a8783e');
        px(x, 5, 9, '#6a4220'); px(x, 9, 10, '#6a4220');
        break;
      case 'stone':
        ell(x, 8, 9, 6, 4.5, (dx, dy) => dx + dy < -0.5 ? '#bab6b0' : (dx + dy > 0.6 ? '#76726c' : '#9a968f'));
        px(x, 5, 7, '#d8d4ce');
        break;
      case 'copper': case 'iron': {
        ell(x, 8, 9, 6, 4.5, (dx, dy) => dx + dy > 0.6 ? '#66625c' : '#8a867f');
        const s = id === 'copper' ? ['#e08a3c', '#ffb070'] : ['#e8e2d6', '#ffffff'];
        [[5, 8], [9, 7], [10, 10], [6, 11]].forEach(([a, b]) => { rect(x, a, b, 2, 2, s[0]); px(x, a, b, s[1]); });
        break;
      }
      case 'bread':
        ell(x, 8, 9.5, 6.5, 4.5, (dx, dy) => dy < -0.2 ? '#f0bd6e' : '#d89a4a');
        line(x, 5, 9, 6, 7, '#b8782e'); line(x, 8, 9, 9, 7, '#b8782e'); line(x, 11, 9, 12, 7, '#b8782e');
        break;
      case 'soup':
        ell(x, 8, 9, 6.5, 2, '#f08a24'); px(x, 6, 9, '#4caf3a'); px(x, 10, 8, '#e2402e');
        for (let r = 0; r < 4; r++) rect(x, 2 + r, 10 + r, 13 - r * 2, 1, r ? '#d8d0c4' : '#f4ead8');
        line(x, 6, 6, 7, 3, '#e0e8f0'); line(x, 10, 6, 9, 2, '#e0e8f0');
        break;
      case 'coin':
        ell(x, 8, 8, 5.5, 5.5, '#f2c230'); ell(x, 8, 8, 4, 4, '#e0aa20');
        rect(x, 7, 5, 2, 7, '#fff08a'); rect(x, 6, 6, 4, 1, '#fff08a'); rect(x, 6, 10, 4, 1, '#fff08a');
        break;
      case 'crate':
        rect(x, 2, 5, 12, 9, '#a8743e'); rect(x, 1, 3, 14, 3, '#8a5a2c'); rect(x, 2, 9, 12, 1, '#86562e');
        break;
      case 'sunflower':
        line(x, 8, 15, 8, 9, '#3d9a30'); px(x, 9, 12, '#4caf3a'); px(x, 10, 11, '#4caf3a');
        ell(x, 8, 6, 5.5, 5.5, '#ffd23a'); ell(x, 8, 6, 2.5, 2.5, '#6a3a1a'); px(x, 5, 3, '#fff08a');
        break;
      case 'melon':
        ell(x, 8, 9, 6.5, 5.5, dx => (Math.floor((dx + 1) * 5) % 2 ? '#2f7a2a' : '#5cb040')); px(x, 5, 6, '#a8e070');
        break;
      case 'pumpkin':
        ell(x, 8, 9.5, 7, 5.5, dx => (Math.abs(dx) < 0.12 || Math.abs(Math.abs(dx) - 0.55) < 0.1 ? '#c8601a' : '#f08a24'));
        rect(x, 7, 2, 2, 3, '#5a3a1a'); px(x, 9, 2, '#4caf3a'); px(x, 5, 7, '#ffb060');
        break;
      case 'egg':
        ell(x, 8, 9, 4.5, 5.5, (dx, dy) => (dx + dy > 0.6 ? '#e0d6c4' : '#fbf6ec')); px(x, 6, 6, '#ffffff');
        break;
      case 'milk':
        rect(x, 5, 5, 6, 10, '#f4f4f4'); rect(x, 6, 3, 4, 2, '#f4f4f4'); rect(x, 6, 2, 4, 1, '#4aa8f0');
        rect(x, 5, 8, 6, 4, '#4aa8f0'); px(x, 7, 9, '#ffffff'); px(x, 8, 10, '#ffffff'); rect(x, 10, 5, 1, 10, '#d0d0d0');
        break;
      case 'hay':
        for (let i = 0; i < 6; i++) line(x, 3 + i * 2, 14, 5 + i, 2, i % 2 ? '#e8c860' : '#d4a83a');
        rect(x, 3, 8, 11, 2, '#a8783c');
        break;
      case 'bait':
        line(x, 3, 11, 6, 8, '#e88a8a', 2); line(x, 6, 8, 10, 11, '#e88a8a', 2); line(x, 10, 11, 13, 7, '#e88a8a', 2); px(x, 13, 6, '#c86a6a');
        break;
      case 'sprinkler': case 'sprinkler2': x.drawImage(sprinklerObj(id === 'sprinkler2' ? 2 : 1), 0, 0); break;
      case 'fence_item':
        rect(x, 3, 3, 3, 11, '#b07a42'); rect(x, 10, 3, 3, 11, '#b07a42'); rect(x, 2, 6, 12, 2, '#d29a5a'); rect(x, 2, 10, 12, 2, '#d29a5a');
        break;
      case 'stonepath':
        [[2, 2, 5, 4], [8, 1, 6, 5], [1, 8, 6, 5], [8, 8, 6, 6]].forEach(([a, b, w, h]) => { rect(x, a, b, w, h, '#a8a49e'); rect(x, a, b, w, 1, '#c8c4be'); });
        break;
      case 'flowerbed': x.drawImage(flowerbedObj(), 0, 0); break;
      case 'lamp':
        rect(x, 7, 9, 2, 6, '#3a3a3a'); rect(x, 4, 2, 8, 8, '#3a3a3a'); rect(x, 5, 3, 6, 6, '#ffe88a'); rect(x, 6, 4, 2, 2, '#ffffff'); rect(x, 5, 1, 6, 1, '#3a3a3a');
        break;
      case 'trophy': x.drawImage(trophyObj(), 0, 0); break;
      case 'salad':
        for (let r = 0; r < 4; r++) rect(x, 2 + r, 10 + r, 13 - r * 2, 1, r ? '#d8d0c4' : '#f4ead8');
        ell(x, 8, 8.5, 5.5, 3, '#5cc64a'); px(x, 6, 7, '#e2402e'); px(x, 10, 8, '#f08a24'); px(x, 8, 6, '#7ad35c'); px(x, 11, 7, '#e2402e');
        break;
      case 'omelet':
        ell(x, 8, 10, 7, 3.5, '#f4ead8'); ell(x, 8, 9, 5, 2.5, '#f8d040'); px(x, 6, 8, '#fff08a'); px(x, 9, 9, '#4caf3a');
        break;
      case 'grilled_fish':
        ell(x, 8, 10.5, 7, 3.5, '#f4ead8'); ell(x, 8.5, 9, 4.5, 2.2, '#b8783a'); rect(x, 2, 7, 2, 4, '#a0602a');
        line(x, 6, 8, 7, 10, '#7a4a20'); line(x, 9, 8, 10, 10, '#7a4a20'); px(x, 11, 8, '#2a1a12');
        break;
      case 'pamonha':
        ell(x, 8, 9, 4, 6, '#c8d878'); line(x, 8, 3, 8, 15, '#a8b858'); rect(x, 7, 1, 2, 2, '#e8e0b0'); px(x, 6, 8, '#e8f0a8');
        break;
      case 'pumpkin_soup':
        ell(x, 8, 9, 6.5, 2, '#f08a24'); px(x, 7, 9, '#ffb060');
        for (let r = 0; r < 4; r++) rect(x, 2 + r, 10 + r, 13 - r * 2, 1, r ? '#a8783c' : '#c89a62');
        line(x, 6, 6, 7, 3, '#e0e8f0'); line(x, 10, 6, 9, 2, '#e0e8f0');
        break;
      case 'cake':
        rect(x, 3, 8, 10, 6, '#f8e0b0'); rect(x, 3, 6, 10, 2, '#ffb0c8'); rect(x, 3, 10, 10, 1, '#ffb0c8');
        rect(x, 7, 3, 2, 3, '#e8303e'); px(x, 7, 3, '#ff8a90'); rect(x, 2, 14, 12, 1, '#d8d0c4');
        break;
    }
    return c;
  }

  // ===================== DECORAÇÕES =====================
  function sprinklerObj(lvl) {
    const { c, x } = mk(16, 16);
    const m = lvl === 2 ? ['#eef3f8', '#c3ccd6', '#8994a0'] : ['#f0a868', '#d08040', '#9a5a28'];
    ell(x, 8, 11.5, 5.5, 3, m[1]); ell(x, 8, 11, 3.5, 1.8, m[2]);
    rect(x, 7, 4, 2, 8, m[1]); rect(x, 7, 4, 1, 8, m[0]);
    rect(x, 4, 4, 8, 2, m[1]); rect(x, 4, 4, 8, 1, m[0]);
    px(x, 3, 5, '#4aa8f0'); px(x, 12, 5, '#4aa8f0'); px(x, 8, 2, '#4aa8f0');
    if (lvl === 2) { px(x, 2, 3, '#8ad0ff'); px(x, 13, 3, '#8ad0ff'); }
    return outline(c);
  }
  function lampObj() {
    const { c, x } = mk(16, 32);
    rect(x, 7, 12, 2, 18, '#3a3a3a'); rect(x, 5, 29, 6, 3, '#2a2a2a');
    rect(x, 4, 4, 8, 9, '#3a3a3a'); rect(x, 5, 5, 6, 7, '#ffe88a'); rect(x, 6, 6, 2, 3, '#ffffff');
    rect(x, 3, 3, 10, 2, '#2a2a2a'); rect(x, 5, 1, 6, 2, '#2a2a2a'); px(x, 7, 0, '#2a2a2a'); px(x, 8, 0, '#2a2a2a');
    return outline(c, '#141414');
  }
  function flowerbedObj() {
    const { c, x } = mk(16, 16);
    rect(x, 1, 10, 14, 5, '#a8743e'); rect(x, 1, 10, 14, 1, '#c08a50'); rect(x, 2, 9, 12, 2, '#6e4420');
    [[3, '#ff6b8a'], [6, '#ffd84a'], [9, '#a8c8ff'], [12, '#ff8a40']].forEach(([fx, col], i) => {
      const fy = 4 + (i % 2) * 2;
      rect(x, fx, fy + 2, 1, 9 - fy - 2 + 1, '#3d9a30');
      px(x, fx, fy - 1, col); px(x, fx - 1, fy, col); px(x, fx + 1, fy, col); px(x, fx, fy + 1, col); px(x, fx, fy, '#fff6e0');
    });
    return outline(c);
  }
  function trophyObj() {
    const { c, x } = mk(16, 16);
    rect(x, 4, 13, 8, 2, '#8a5a2c'); rect(x, 6, 11, 4, 2, '#d8a828'); rect(x, 7, 9, 2, 2, '#d8a828');
    ell(x, 8, 5, 4.5, 4, dx => (dx < -0.3 ? '#fff08a' : '#f2c230')); rect(x, 3, 1, 10, 2, '#f2c230');
    px(x, 2, 3, '#d8a828'); px(x, 2, 4, '#d8a828'); px(x, 13, 3, '#d8a828'); px(x, 13, 4, '#d8a828');
    return outline(c);
  }
  const cobbleFill = x => {
    rect(x, 0, 0, 16, 16, '#7a766f');
    [[1, 1, 6, 5], [8, 1, 7, 4], [1, 7, 4, 5], [6, 6, 5, 5], [12, 6, 3, 5], [1, 13, 7, 3], [9, 12, 6, 4]].forEach(([a, b, w, h]) => {
      rect(x, a, b, w, h, '#a8a49e'); rect(x, a, b, w, 1, '#c8c4be'); rect(x, a, b + h - 1, w, 1, '#8e8a84');
    });
  };

  // ===================== CONSTRUÇÕES =====================
  function board() {
    const { c, x } = mk(16, 26);
    rect(x, 2, 12, 2, 14, '#7a4a22'); rect(x, 12, 12, 2, 14, '#7a4a22');
    rect(x, 0, 2, 16, 13, '#a8743e'); rect(x, 0, 2, 16, 1, '#c08a50'); rect(x, 0, 14, 16, 1, '#7a4a22');
    rect(x, 2, 4, 5, 6, '#f4ead8'); rect(x, 9, 5, 5, 5, '#fff6c0'); rect(x, 4, 10, 6, 3, '#f4ead8');
    px(x, 4, 4, '#e8303e'); px(x, 11, 5, '#4aa8f0'); px(x, 7, 10, '#5cc64a');
    for (const [a, b] of [[3, 6], [3, 8], [10, 7], [10, 8], [5, 11]]) rect(x, a, b, 3, 1, '#a89a8a');
    return outline(c);
  }
  function coop() {
    const { c, x } = mk(48, 46);
    rect(x, 3, 20, 42, 26, '#d8b07a');
    for (let y = 23; y < 46; y += 4) rect(x, 3, y, 42, 1, '#b88e58');
    rect(x, 3, 43, 42, 3, '#8c8072');
    rect(x, 19, 31, 10, 15, '#6a3e1c'); rect(x, 20, 32, 8, 14, '#8a5a2c'); rect(x, 23, 32, 2, 14, '#6a3e1c');
    ell(x, 37, 28, 3.5, 3.5, '#3a2a1a'); ell(x, 37, 28, 2.5, 2.5, '#e8c860');
    for (let y = 2; y < 22; y++) { const l = Math.max(0, Math.round(12 - (y - 2) * 0.9)); rect(x, l, y, 48 - 2 * l, 1, y % 4 === 1 ? '#7a3828' : '#a0503a'); }
    rect(x, 0, 20, 48, 2, '#6a2a1e'); rect(x, 12, 2, 24, 1, '#c8705a');
    ell(x, 10, 30, 3, 4, '#fbf6ec');
    return outline(c);
  }
  function barn() {
    const { c, x } = mk(64, 62);
    rect(x, 3, 24, 58, 38, '#b8423a');
    for (let X = 6; X < 61; X += 5) rect(x, X, 24, 1, 38, '#9c342c');
    rect(x, 3, 24, 58, 2, '#f4ead8'); rect(x, 3, 24, 2, 38, '#f4ead8'); rect(x, 59, 24, 2, 38, '#f4ead8');
    rect(x, 20, 36, 24, 26, '#f4ead8'); rect(x, 22, 38, 20, 24, '#8a2a24');
    line(x, 22, 38, 41, 61, '#f4ead8', 2); line(x, 41, 38, 22, 61, '#f4ead8', 2); rect(x, 31, 38, 2, 24, '#f4ead8');
    rect(x, 27, 27, 10, 7, '#f4ead8'); rect(x, 28, 28, 8, 5, '#3a2a1a'); rect(x, 29, 30, 6, 3, '#e8c860');
    for (let y = 0; y < 26; y++) { const l = Math.max(0, Math.round(20 - y * 0.95)); rect(x, l, y, 64 - 2 * l, 1, y % 4 === 3 ? '#4a2a1e' : '#6a3a2a'); }
    rect(x, 0, 24, 64, 2, '#3a1e14'); rect(x, 20, 0, 24, 1, '#8a5a44');
    return outline(c);
  }
  function festTent(season) {
    const { c, x } = mk(48, 52);
    const cols = [['#ff8ab0', '#fff6e0'], ['#4aa8f0', '#ffe14a'], ['#e0602a', '#ffd84a'], ['#6a5ad8', '#f4f8fc']][season];
    rect(x, 3, 14, 3, 38, '#8a5a2c'); rect(x, 42, 14, 3, 38, '#8a5a2c');
    for (let y = 2; y < 18; y++) { const l = Math.max(0, Math.round(16 - y)); for (let X = l; X < 48 - l; X++) px(x, X, y, Math.floor(X / 6) % 2 ? cols[1] : cols[0]); }
    for (let i = 0; i < 8; i++) ell(x, i * 6 + 3, 18, 3, 2.5, i % 2 ? cols[1] : cols[0]);
    rect(x, 23, 0, 2, 3, '#8a5a2c'); rect(x, 25, 0, 6, 3, cols[0]);
    rect(x, 1, 34, 46, 18, '#f4ead8'); rect(x, 1, 34, 46, 3, cols[0]); for (let X = 1; X < 47; X += 4) rect(x, X, 37, 2, 2, cols[0]);
    rect(x, 0, 32, 48, 3, '#c08a50');
    rect(x, 8, 26, 6, 6, '#f2c230'); rect(x, 10, 24, 2, 2, '#f2c230');
    ell(x, 24, 29, 4, 3, '#e8303e'); rect(x, 23, 31, 2, 4, '#e8303e');
    rect(x, 34, 27, 7, 5, season === 2 ? '#f08a24' : season === 1 ? '#8fb4cc' : season === 0 ? '#ffd23a' : '#f08a24');
    return outline(c);
  }

  // ===================== ANIMAIS =====================
  function flipped(src) {
    const m = mk(src.width, src.height);
    m.x.translate(src.width, 0); m.x.scale(-1, 1); m.x.drawImage(src, 0, 0);
    return m.c;
  }
  function chicken(f) {
    const { c, x } = mk(16, 16);
    rect(x, 7, 13, 1, 2, '#f08a24'); rect(x, 10, 13 - f, 1, 2 + f, '#f08a24');
    ell(x, 9, 10, 4.5, 3.5, (dx, dy) => (dy > 0.4 ? '#e8e0d4' : '#fbf8f2'));
    rect(x, 13, 7, 2, 3, '#fbf8f2'); px(x, 14, 6, '#e8e0d4');
    line(x, 7, 10, 10, 11, '#d8d0c4');
    ell(x, 5, 6 + f * 0.5, 2.4, 2.4, '#fbf8f2');
    rect(x, 4, 2 + f, 3, 2, '#e8303e'); px(x, 2, 7 + f, '#f08a24'); px(x, 4, 6 + f, '#1a1a1a'); px(x, 4, 8 + f, '#e8303e');
    return outline(c, '#4a3a2a');
  }
  function cow(f) {
    const { c, x } = mk(24, 20);
    const legs = f ? [[5, 1], [9, 0], [14, 1], [18, 0]] : [[5, 0], [9, 1], [14, 0], [18, 1]];
    legs.forEach(([lx, up]) => { rect(x, lx, 14, 2, 5 - up, '#f4f0e8'); rect(x, lx, 18 - up, 2, 1, '#3a2a1a'); });
    rect(x, 4, 6, 17, 9, '#f8f4ec'); rect(x, 4, 13, 17, 2, '#e0d8cc');
    ell(x, 9, 8, 2.5, 2, '#2a2420'); ell(x, 16, 10, 3, 2.2, '#2a2420'); px(x, 19, 7, '#2a2420');
    rect(x, 12, 14, 3, 2, '#f0a0b0');
    line(x, 21, 7, 22, 13, '#e0d8cc'); px(x, 22, 14, '#2a2420');
    rect(x, 0, 4, 6, 7, '#f8f4ec'); rect(x, 0, 8, 4, 3, '#f0a0b0'); px(x, 1, 9, '#c06070');
    px(x, 2, 6, '#1a1a1a'); px(x, 5, 3, '#c8c0b0'); px(x, 1, 3, '#c8c0b0'); rect(x, 5, 5, 2, 2, '#2a2420');
    return outline(c, '#3a3028');
  }

  // Moradores: reaproveita o desenho do personagem trocando a paleta
  function npcFrame(pal, dir, f) {
    const saved = { ...C };
    Object.assign(C, pal);
    const fr = playerFrame('idle', dir, f, null);
    Object.assign(C, saved);
    return fr;
  }

  // ===================== PERSONAGEM (player_sheet) =====================
  const C = {
    skin: '#f5c8a0', skinD: '#dc9c78', blush: '#f09080', hair: '#7a4422', hairD: '#5a2e16', eye: '#2a1a12',
    hat: '#ecc768', hatL: '#fbe39a', hatD: '#c49a3c', band: '#c8443a',
    shirt: '#f2eadc', over: '#3d72c4', overD: '#2b528f', shoe: '#5a3620',
  };
  const X0 = 8, B0 = 12;

  function drawFrontBack(x, back, o) {
    const X = X0, B = B0, Y = B + (o.bob || 0);
    const lL = o.liftL || 0, lR = o.liftR || 0;
    rect(x, X + 4, B + 17, 3, 5 - lL, C.overD); rect(x, X + 4, B + 22 - lL, 3, 2, C.shoe);
    rect(x, X + 9, B + 17, 3, 5 - lR, C.overD); rect(x, X + 9, B + 22 - lR, 3, 2, C.shoe);
    rect(x, X + 3, Y + 10, 10, 3, C.shirt);
    rect(x, X + 3, Y + 12, 10, 6, C.over); rect(x, X + 3, Y + 17, 10, 1, C.overD);
    rect(x, X + 4, Y + 10, 2, 3, C.over); rect(x, X + 10, Y + 10, 2, 3, C.over);
    if (!back) { rect(x, X + 6, Y + 13, 4, 2, C.overD); px(x, X + 4, Y + 12, '#ffd84a'); px(x, X + 11, Y + 12, '#ffd84a'); }
    if (!o.noArms) {
      const s = o.swing || 0;
      rect(x, X + 1, Y + 10, 2, 3, C.shirt); rect(x, X + 1, Y + 13 + s, 2, 2, C.skin);
      rect(x, X + 13, Y + 10, 2, 3, C.shirt); rect(x, X + 13, Y + 13 - s, 2, 2, C.skin);
    }
    if (!back) {
      rect(x, X + 4, Y + 4, 8, 7, C.skin);
      rect(x, X + 3, Y + 4, 10, 2, C.hair); rect(x, X + 3, Y + 4, 1, 5, C.hair); rect(x, X + 12, Y + 4, 1, 5, C.hair);
      rect(x, X + 5, Y + 7, 1, 2, C.eye); rect(x, X + 10, Y + 7, 1, 2, C.eye);
      px(x, X + 4, Y + 9, C.blush); px(x, X + 11, Y + 9, C.blush); rect(x, X + 7, Y + 9, 2, 1, C.skinD);
    } else {
      rect(x, X + 3, Y + 4, 10, 7, C.hair); rect(x, X + 4, Y + 10, 8, 1, C.hairD);
    }
    rect(x, X + 5, Y, 6, 4, C.hat); rect(x, X + 5, Y + 2, 6, 1, C.band); px(x, X + 6, Y, C.hatL);
    rect(x, X + 2, Y + 3, 12, 2, C.hat); rect(x, X + 2, Y + 4, 12, 1, C.hatD);
  }

  function drawSide(x, o) {
    const X = X0, B = B0, Y = B + (o.bob || 0), s = o.stride || 0;
    rect(x, X + 7 - s, B + 17, 3, 5, C.overD); rect(x, X + 6 - s, B + 22, 4, 2, C.shoe);
    rect(x, X + 6 + s, B + 17, 3, 5, C.over); rect(x, X + 5 + s, B + 22, 4, 2, C.shoe);
    rect(x, X + 5, Y + 10, 6, 3, C.shirt); rect(x, X + 5, Y + 12, 6, 6, C.over); rect(x, X + 6, Y + 10, 2, 3, C.over);
    rect(x, X + 5, Y + 17, 6, 1, C.overD);
    rect(x, X + 4, Y + 4, 7, 7, C.skin); px(x, X + 3, Y + 8, C.skin);
    rect(x, X + 8, Y + 4, 4, 6, C.hair); rect(x, X + 4, Y + 4, 7, 2, C.hair);
    rect(x, X + 5, Y + 7, 1, 2, C.eye); px(x, X + 6, Y + 9, C.blush);
    rect(x, X + 5, Y, 6, 4, C.hat); rect(x, X + 5, Y + 2, 6, 1, C.band); px(x, X + 6, Y, C.hatL);
    rect(x, X + 2, Y + 3, 11, 2, C.hat); rect(x, X + 2, Y + 4, 11, 1, C.hatD);
    if (!o.noArms) {
      const a = o.swing || 0;
      rect(x, X + 7 + a, Y + 10, 2, 4, C.shirt); rect(x, X + 7 + a, Y + 14, 2, 2, C.skin);
    }
  }

  // Poses das ferramentas: [mão x, mão y, ângulo da cabeça da ferramenta]
  const POSES = {
    tool: {
      0: [[16, 13, -90], [19, 22, 30], [16, 28, 90]],
      1: [[16, 22, -150], [16, 16, -90], [16, 13, -90]],
      2: [[20, 18, -50], [15, 13, -100], [10, 26, 165]],
    },
    can: {
      0: [[16, 30, 0], [16, 30, -30], [16, 31, -55]],
      1: [[16, 22, 0], [16, 22, -30], [16, 21, -55]],
      2: [[9, 27, 0], [8, 27, -30], [7, 28, -55]],
    },
  };

  function playerFrame(anim, dir, f, icon) {
    const side = dir >= 2, d = side ? 2 : dir;
    const { c, x } = mk(32, 40);
    const o = {};
    const isTool = ['hoe', 'water', 'axe', 'pick', 'rod'].includes(anim);
    if (anim === 'idle') o.bob = f;
    else if (anim === 'walk') {
      if (side) { o.stride = [1, 0, -1, 0][f]; o.swing = [-1, 0, 1, 0][f]; }
      else { o.liftL = [2, 0, 0, 0][f]; o.liftR = [0, 0, 2, 0][f]; o.swing = [1, 0, -1, 0][f]; }
      o.bob = [0, 1, 0, 1][f];
    } else if (anim === 'harvest') { o.bob = f === 0 ? 2 : 0; o.swing = f === 0 ? 2 : -3; }
    else if (isTool) { o.noArms = true; o.bob = f === 2 ? 1 : 0; }

    let toolLayer = null, behind = d === 1;
    if (isTool && icon) {
      const pose = POSES[anim === 'water' ? 'can' : 'tool'][d][f];
      if (pose[1] < B0 + 10) behind = true; // ferramenta erguida acima dos ombros fica atrás da cabeça
      toolLayer = () => {
        const [hx, hy, ang] = pose;
        x.save();
        x.translate(hx + 0.5, hy + 0.5);
        if (anim === 'water') { x.rotate(ang * Math.PI / 180); x.drawImage(icon, -8, -8); }
        else { x.rotate((ang + 45) * Math.PI / 180); x.drawImage(icon, -4, -12); }
        x.restore();
        const sh = d === 2 ? [[X0 + 8, B0 + 11 + o.bob]] : [[X0 + 3, B0 + 11 + o.bob], [X0 + 12, B0 + 11 + o.bob]];
        sh.forEach(([sx, sy]) => line(x, sx, sy, hx, hy, C.shirt, 2));
        rect(x, hx - 1, hy - 1, 2, 2, C.skin);
      };
    }
    if (toolLayer && behind) toolLayer();
    if (d === 2) drawSide(x, o); else drawFrontBack(x, d === 1, o);
    if (toolLayer && !behind) toolLayer();
    outline(c);
    if (dir === 3) {
      const m = mk(32, 40);
      m.x.translate(32, 0); m.x.scale(-1, 1); m.x.drawImage(c, 0, 0);
      return m.c;
    }
    return c;
  }

  // ===================== API =====================
  const api = {
    grass: (s, v) => memo(`g${s}_${v}`, () => grass(s, v)),
    soil: (mask, wet) => memo(`s${mask}_${wet ? 1 : 0}`, () => soil(mask, wet)),
    path: mask => memo(`p${mask}`, () => path(mask)),
    plank: () => memo('plank', plank),
    stone: v => memo(`st${v}`, () => stone(v)),
    water: (f, mask) => memo(`w${f}_${mask}`, () => water(f, mask)),
    tree: s => memo(`tree${s}`, () => tree(s)),
    pine: s => memo(`pine${s}`, () => pine(s)),
    stump: () => memo('stump', stump),
    rock: k => memo(`rock${k}`, () => rock(k)),
    weed: s => memo(`weed${s}`, () => weed(s)),
    branch: () => memo('branch', branch),
    fence: m => memo(`fence${m}`, () => fence(m)),
    house: () => memo('house', house),
    bin: () => memo('bin', bin),
    stall: () => memo('stall', stall),
    crop: (t, st) => memo(`crop${t}_${st}`, () => crop(t, st)),
    cobble: m => memo(`cb${m}`, () => auto(m, cobbleFill, '#5e5a54')),
    sprinklerObj: l => memo(`spr${l}`, () => sprinklerObj(l)),
    lampObj: () => memo('lamp', lampObj),
    flowerbedObj: () => memo('flowerbed', flowerbedObj),
    trophyObj: () => memo('trophy', trophyObj),
    board: () => memo('board', board),
    coop: () => memo('coop', coop),
    barn: () => memo('barn', barn),
    festTent: s => memo(`fest${s}`, () => festTent(s)),
    chicken: (right, f) => memo(`chk${right ? 1 : 0}${f}`, () => (right ? flipped(chicken(f)) : chicken(f))),
    cow: (right, f) => memo(`cow${right ? 1 : 0}${f}`, () => (right ? flipped(cow(f)) : cow(f))),
    npc: (id, dir, f) => memo(`npc${id}${dir}${f}`, () => npcFrame(NPCS[id].pal, dir, f)),
    rawIcon: id => memo(`ri${id}`, () => rawIcon(id)),
    icon: id => memo(`ic${id}`, () => {
      const m = mk(16, 16); m.x.drawImage(api.rawIcon(id), 0, 0); return outline(m.c);
    }),
    iconURL: id => memo(`url${id}`, () => api.icon(id).toDataURL()),
    player: (anim, dir, f, iconId) => memo(`pl${anim}_${dir}_${f}_${iconId || ''}`,
      () => playerFrame(anim, dir, f, iconId ? api.rawIcon(iconId) : null)),
  };
  return api;
})();
