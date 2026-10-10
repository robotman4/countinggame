// Blocky models: materials, piles, the truck, the house being built and decorations.
// Every builder is fn(list, M, ...): it adds boxes (see box() in iso.js) in the space of M.
import { box, m, mT, mRY, mRZ, mRX, mS } from './iso.js';
import { shade } from './core.js';

// ---------------- materials ----------------
// One "unit" of each material fits in a 0.46 x 0.46 square, so six fit in the truck bed.
export const MATERIALS = {
  rock: {
    color: '#9aa3ad',
    item(L, M) {
      box(L, M, 0, 0, 0, 0.42, 0.24, 0.38, '#9aa3ad');
      box(L, M, -0.03, 0.24, 0.02, 0.28, 0.12, 0.24, '#b6bec7');
    },
  },
  gravel: {
    color: '#7d838c',
    item(L, M) {
      const c = ['#6f757e', '#8d939b', '#7d838c', '#a3a8ae'];
      [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]].forEach(([x, z], i) => box(L, M, x, 0, z, 0.19, 0.15, 0.19, c[i]));
      box(L, M, 0, 0.15, 0, 0.2, 0.13, 0.2, '#959ba3');
    },
  },
  sand: {
    color: '#f2cf63',
    item(L, M) {
      box(L, M, 0, 0, 0, 0.44, 0.14, 0.44, '#f0c95a');
      box(L, M, 0, 0.14, 0, 0.3, 0.11, 0.3, '#f5d677');
      box(L, M, 0, 0.25, 0, 0.14, 0.07, 0.14, '#f9e39a');
    },
  },
  soil: {
    color: '#8a5a3b',
    item(L, M) {
      box(L, M, 0, 0, 0, 0.44, 0.14, 0.44, '#7e5234');
      box(L, M, 0, 0.14, 0, 0.3, 0.11, 0.3, '#93603f');
      box(L, M, 0.02, 0.25, 0, 0.04, 0.12, 0.04, '#4cae3c');
      box(L, M, -0.04, 0.33, 0, 0.08, 0.05, 0.05, '#5cc95a');
      box(L, M, 0.08, 0.31, 0, 0.08, 0.05, 0.05, '#5cc95a');
    },
  },
  coal: {
    color: '#3a3a46',
    item(L, M) {
      box(L, M, -0.08, 0, -0.06, 0.26, 0.2, 0.26, '#3a3a46');
      box(L, M, 0.12, 0, 0.1, 0.2, 0.16, 0.2, '#2f2f3a');
      box(L, M, 0.02, 0.17, 0.02, 0.18, 0.13, 0.18, '#4a4a5a');
    },
  },
  log: {
    color: '#a0663a',
    item(L, M) {
      box(L, M, 0, 0.02, 0, 0.42, 0.28, 0.3, '#a0663a', { top: '#b47645' });
      box(L, M, 0, 0.05, 0, 0.46, 0.22, 0.24, '#e6c08a');
      box(L, M, 0, 0.12, 0, 0.47, 0.08, 0.08, '#c99a5e');
    },
  },
  beam: {
    color: '#f08a24',
    item(L, M) {
      box(L, M, 0, 0, 0, 0.46, 0.06, 0.32, '#f08a24');
      box(L, M, 0, 0.06, 0, 0.46, 0.18, 0.1, '#d9761a');
      box(L, M, 0, 0.24, 0, 0.46, 0.06, 0.32, '#f59a3a');
    },
  },
  brick: {
    color: '#d9533b',
    item(L, M) {
      box(L, M, 0, 0, -0.11, 0.42, 0.13, 0.2, '#d9533b');
      box(L, M, 0, 0, 0.11, 0.42, 0.13, 0.2, '#c8472f');
      box(L, M, -0.11, 0.13, 0, 0.2, 0.13, 0.42, '#e0644a');
      box(L, M, 0.11, 0.13, 0, 0.2, 0.13, 0.42, '#d9533b');
    },
  },
  pipe: {
    color: '#3b8fe8',
    item(L, M) {
      box(L, M, 0, 0.02, 0, 0.42, 0.26, 0.26, '#3b8fe8');
      box(L, M, 0, 0.0, 0, 0.46, 0.3, 0.3, '#2f7ad0', { b: -0.01 });
      box(L, M, 0, 0.09, 0, 0.47, 0.12, 0.12, '#1d3f73');
    },
  },
};
export const MATERIAL_IDS = Object.keys(MATERIALS);
export const itemModel = (id) => (L, M) => MATERIALS[id].item(L, M);

// ---------------- piles ----------------
// Loose materials make a stepped heap, solid ones a neat stack.
export function pile(L, M, id) {
  const c = MATERIALS[id].color;
  if (id === 'log' || id === 'pipe' || id === 'beam') {
    const col = id === 'log' ? '#a0663a' : id === 'pipe' ? '#3b8fe8' : '#f08a24';
    const end = id === 'log' ? '#e6c08a' : id === 'pipe' ? '#1d3f73' : shade(col, -0.2);
    // two sleepers
    box(L, M, -0.6, 0, 0, 0.2, 0.12, 1.6, '#8a5a3b');
    box(L, M, 0.6, 0, 0, 0.2, 0.12, 1.6, '#8a5a3b');
    const rows = [[-0.5, -0.17, 0.17, 0.5], [-0.33, 0, 0.33], [-0.17, 0.17]];
    rows.forEach((row, r) => row.forEach((z) => {
      const y = 0.12 + r * 0.3;
      if (id === 'beam') {
        box(L, M, 0, y, z, 1.7, 0.05, 0.28, col);
        box(L, M, 0, y + 0.05, z, 1.7, 0.18, 0.08, shade(col, -0.1));
        box(L, M, 0, y + 0.23, z, 1.7, 0.05, 0.28, shade(col, 0.1));
      } else {
        box(L, M, 0, y, z, 1.6, 0.3, 0.3, col);
        box(L, M, 0, y + 0.04, z, 1.66, 0.22, 0.22, end, { b: -0.02 });
      }
    }));
    return;
  }
  if (id === 'brick') {
    for (const [x, z] of [[-0.45, -0.3], [0.45, -0.3], [0, 0.4]]) {
      box(L, M, x, 0, z, 0.8, 0.12, 0.7, '#b48552');
      box(L, M, x, 0.12, z, 0.72, 0.5, 0.62, '#d9533b', { top: '#e0644a' });
      box(L, M, x, 0.3, z, 0.74, 0.04, 0.64, '#e8c8a0');
    }
    return;
  }
  if (id === 'rock') {
    const rocks = [[-0.5, -0.3, 0.6], [0.4, -0.4, 0.55], [0.1, 0.35, 0.65], [-0.45, 0.45, 0.45], [0.55, 0.4, 0.4], [0, -0.05, 0.5]];
    rocks.forEach(([x, z, s], i) => box(L, M, x, i === 5 ? 0.45 : 0, z, s, s * 0.8, s * 0.9, i % 2 ? '#9aa3ad' : '#aab2bb'));
    return;
  }
  const tiers = [[1.9, 0.3], [1.45, 0.28], [1.0, 0.26], [0.55, 0.22]];
  let y = 0;
  tiers.forEach(([s, h], i) => {
    box(L, M, 0, y, 0, s, h, s * 0.95, shade(c, i * 0.05 - 0.04));
    y += h;
  });
  if (id === 'gravel') for (const [x, z] of [[0.7, 0.6], [-0.75, 0.55], [0.5, -0.75]]) box(L, M, x, 0, z, 0.18, 0.12, 0.18, '#6f757e');
  if (id === 'soil') box(L, M, 0.1, y, 0, 0.06, 0.2, 0.06, '#4cae3c');
  if (id === 'coal') box(L, M, -0.2, y - 0.1, 0.2, 0.2, 0.18, 0.2, '#4a4a5a');
}

// ---------------- the dump truck ----------------
// Forward is +x. tilt raises the bed (0 = flat). load = material ids in the bed.
export const BED_SLOTS = [[-0.78, -0.22], [-0.78, 0.22], [-0.32, -0.22], [-0.32, 0.22], [0.14, -0.22], [0.14, 0.22], [0.6, -0.22], [0.6, 0.22]];
export function bedMatrix(M, tilt, long = false) {
  const back = long ? -1.25 : -1.05;
  return m(M, mT(back, 0.5, 0), mRZ(tilt), mT(-back, -0.5, 0));
}
export function truck(L, M, o = {}) {
  const color = o.color || '#f7c531', bedc = o.bed || '#f5962a';
  const long = (o.cap || 6) > 6;
  const back = long ? -1.25 : -1.05, front = long ? 0.85 : 0.42;
  const len = front - back;
  // wheels
  for (const x of long ? [-0.85, -0.35, 0.95] : [-0.6, 0.75]) for (const z of [-0.47, 0.47]) {
    box(L, M, x, 0, z, 0.42, 0.4, 0.2, '#2c2c36');
    box(L, M, x, 0.13, z + Math.sign(z) * 0.1, 0.16, 0.14, 0.02, '#d0d0d8');
  }
  // chassis
  box(L, M, (back + 1.25) / 2, 0.22, 0, 1.25 - back, 0.2, 0.74, '#4a4a58', { b: -0.4 });
  // cab
  const cx = front + 0.4;
  box(L, M, cx, 0.42, 0, 0.62, 0.62, 0.92, color);
  box(L, M, cx + 0.32, 0.72, 0, 0.02, 0.26, 0.72, '#9fe0ff');
  box(L, M, cx + 0.05, 0.72, 0.47, 0.36, 0.24, 0.02, '#9fe0ff');
  box(L, M, cx + 0.05, 0.72, -0.47, 0.36, 0.24, 0.02, '#9fe0ff');
  box(L, M, cx, 1.04, 0, 0.18, 0.08, 0.18, o.light ? '#ff4a3d' : '#ff9a3d');
  box(L, M, cx + 0.33, 0.24, 0, 0.08, 0.16, 0.98, '#8a8a98');
  box(L, M, cx + 0.33, 0.48, 0.3, 0.04, 0.1, 0.16, '#fff3a0');
  box(L, M, cx + 0.33, 0.48, -0.3, 0.04, 0.1, 0.16, '#fff3a0');
  box(L, M, cx - 0.36, 0.5, -0.4, 0.08, 0.7, 0.08, '#6a6a78');
  // bed (tilts around its back edge)
  const B = bedMatrix(M, o.tilt || 0, long);
  const bc = (back + front) / 2;
  box(L, B, bc, 0.42, 0, len, 0.08, 0.96, bedc, { b: -0.3 });
  box(L, B, front - 0.03, 0.5, 0, 0.06, 0.44, 0.96, shade(bedc, -0.05));
  box(L, B, back + 0.03, 0.5, 0, 0.06, 0.28, 0.96, shade(bedc, -0.05));
  box(L, B, bc, 0.5, 0.45, len, 0.3, 0.06, bedc);
  box(L, B, bc, 0.5, -0.45, len, 0.3, 0.06, bedc);
  const slots = BED_SLOTS.slice(0, long ? 8 : 6).map(([x, z]) => m(B, mT(x + (long ? -0.2 : 0), 0.5, z), mS(0.92)));
  drawLoad(L, slots, o.load);
  return slots;
}

// Put the load items in their slots. Every vehicle model returns its slot matrices.
function drawLoad(L, slots, load) {
  (load || []).forEach((id, i) => { if (slots[i]) MATERIALS[id].item(L, slots[i]); });
}

// ---------------- the forklift ----------------
// Carries solid things (bricks, beams, pipes, logs) on a pallet. tilt lifts the forks.
export function forklift(L, M, o = {}) {
  const color = o.color || '#f5962a';
  for (const [x, z, s] of [[0.42, -0.36, 0.4], [0.42, 0.36, 0.4], [-0.45, -0.34, 0.32], [-0.45, 0.34, 0.32]]) {
    box(L, M, x, 0, z, s, s, 0.18, '#2c2c36');
    box(L, M, x, s * 0.3, z + Math.sign(z) * 0.09, s * 0.4, s * 0.4, 0.02, '#d0d0d8');
  }
  box(L, M, -0.05, 0.16, 0, 1.0, 0.42, 0.62, color, { b: -0.2 });
  box(L, M, -0.6, 0.16, 0, 0.22, 0.6, 0.66, '#4a4a58');
  box(L, M, -0.2, 0.58, 0, 0.3, 0.1, 0.4, '#3a3a46');
  box(L, M, -0.36, 0.68, 0, 0.06, 0.32, 0.4, '#3a3a46');
  box(L, M, 0.2, 0.58, 0, 0.1, 0.24, 0.1, '#3a3a46');
  for (const [x, z] of [[-0.45, -0.3], [-0.45, 0.3], [0.3, -0.3], [0.3, 0.3]]) box(L, M, x, 0.58, z, 0.06, 0.72, 0.06, '#4a4a58');
  box(L, M, -0.08, 1.3, 0, 0.86, 0.06, 0.7, '#4a4a58');
  box(L, M, -0.08, 1.36, 0, 0.16, 0.08, 0.16, o.light ? '#ff4a3d' : '#ff9a3d');
  // mast
  box(L, M, 0.58, 0.08, -0.26, 0.08, 1.5, 0.08, '#6a6a78');
  box(L, M, 0.58, 0.08, 0.26, 0.08, 1.5, 0.08, '#6a6a78');
  box(L, M, 0.58, 1.5, 0, 0.08, 0.08, 0.6, '#6a6a78');
  // forks and pallet go up and down
  const C = m(M, mT(0, (o.tilt || 0) * 1.7, 0));
  box(L, C, 0.65, 0.08, 0, 0.05, 0.5, 0.6, '#3a3a46');
  box(L, C, 1.0, 0.06, -0.18, 0.7, 0.05, 0.09, '#3a3a46');
  box(L, C, 1.0, 0.06, 0.18, 0.7, 0.05, 0.09, '#3a3a46');
  box(L, C, 1.0, 0.11, 0, 0.74, 0.1, 0.78, '#c99a5e', { b: -0.2 });
  const slots = [[0.82, -0.19], [0.82, 0.19], [1.18, -0.19], [1.18, 0.19]].map(([x, z]) => m(C, mT(x, 0.21, z), mS(0.76)));
  drawLoad(L, slots, o.load);
  return slots;
}

// ---------------- the excavator you drive ----------------
// Carries loose things (sand, gravel, soil, coal, rocks) in its bucket. tilt lifts the arm and tips the bucket.
export function digger(L, M, o = {}) {
  const u = Math.min(1, (o.tilt || 0) / 0.6);
  box(L, M, 0, 0, -0.45, 1.4, 0.3, 0.32, '#3a3a46');
  box(L, M, 0, 0, 0.45, 1.4, 0.3, 0.32, '#3a3a46');
  box(L, M, 0, 0.3, 0, 0.6, 0.1, 0.6, '#55556a');
  const U = m(M, mT(0, 0.4, 0));
  box(L, U, -0.15, 0, 0, 1.1, 0.4, 0.95, o.color || '#f7c531');
  box(L, U, 0.1, 0.4, -0.22, 0.45, 0.52, 0.45, o.color || '#f7c531');
  box(L, U, 0.335, 0.55, -0.22, 0.02, 0.28, 0.36, '#9fe0ff');
  box(L, U, 0.1, 0.55, -0.445, 0.3, 0.28, 0.02, '#9fe0ff');
  box(L, U, 0.1, 0.92, -0.22, 0.14, 0.07, 0.14, o.light ? '#ff4a3d' : '#ff9a3d');
  box(L, U, -0.58, 0.4, 0.2, 0.28, 0.22, 0.5, '#4a4a58');
  const A1 = m(U, mT(0.3, 0.35, 0.22), mRZ(0.5 + u * 0.4));
  box(L, A1, 0.55, -0.1, 0, 1.1, 0.2, 0.2, '#f5b81a');
  const A2 = m(A1, mT(1.05, 0, 0), mRZ(-1.55 + u * 0.35));
  box(L, A2, 0.38, -0.08, 0, 0.76, 0.16, 0.16, '#f5b81a');
  const A3 = m(A2, mT(0.76, 0, 0), mRZ(1.4 - u * 2.1));
  box(L, A3, 0.28, -0.06, 0, 0.56, 0.06, 0.6, '#6a6a78', { b: -0.2 });
  box(L, A3, 0.02, -0.06, 0, 0.05, 0.36, 0.6, '#6a6a78');
  box(L, A3, 0.28, -0.06, 0.29, 0.56, 0.22, 0.04, '#6a6a78');
  box(L, A3, 0.28, -0.06, -0.29, 0.56, 0.22, 0.04, '#6a6a78');
  const slots = [[0.28, 0, -0.14], [0.28, 0, 0.14], [0.28, 0.18, 0]].map(([x, y, z]) => m(A3, mT(x, y, z), mS(0.6)));
  drawLoad(L, slots, o.load);
  return slots;
}

// ---------------- vehicle table ----------------
export const LOOSE = new Set(['rock', 'gravel', 'sand', 'soil', 'coal']);
export const VEHICLES = {
  truck: { model: truck, r: 0.85, speed: 4.6, carries: () => true, exhaust: (cap) => [(cap > 6 ? 0.85 : 0.42) + 0.04, 1.25, -0.4] },
  forklift: { model: forklift, r: 0.75, speed: 5.2, cap: 4, carries: (id) => !LOOSE.has(id), exhaust: () => [-0.62, 0.85, 0.28] },
  digger: { model: digger, r: 0.95, speed: 3.8, cap: 3, carries: (id) => LOOSE.has(id), exhaust: () => [-0.55, 1.1, -0.3] },
};
const applyM = (M, x, y, z) => ({ x: M[0] * x + M[1] * y + M[2] * z + M[3], y: M[4] * x + M[5] * y + M[6] * z + M[7], z: M[8] * x + M[9] * y + M[10] * z + M[11] });
export const vehicleM = (v) => m(mT(v.x, (v.bounce || 0) + (v.hop ? v.hop.y : 0), v.z), mRY(v.h));
// Where slot i of a vehicle is in world space (for items flying in and out).
export function slotWorld(v, i) {
  const slots = VEHICLES[v.type].model([], vehicleM(v), { tilt: v.tilt, cap: v.cap });
  return applyM(slots[Math.min(i, slots.length - 1)], 0, 0.12, 0);
}
export function localToWorld(v, p) { return applyM(vehicleM(v), p[0], p[1], p[2]); }

// ---------------- the house being built ----------------
// progress 0..1 fills blocks layer by layer; roof appears at 1.
// colors: list of block colours (the materials delivered so far).
// Building styles: a wide house, or a tall narrow tower.
export const BUILDINGS = { house: { n: 4, layers: 4 }, tower: { n: 3, layers: 7 } };
export const buildingHeight = (style) => 0.16 + BUILDINGS[style || 'house'].layers * 0.42;
export function house(L, M, progress, colors, roofK = 0, roofColor = '#e8443a', style = 'house') {
  box(L, M, 0, 0, 0, 2.6, 0.16, 2.6, '#b8b2a8', { b: -5 });
  const ring = [];
  const { n, layers } = BUILDINGS[style], s = 0.5, h = ((n - 1) / 2) * s;
  for (let i = 0; i < n; i++) ring.push([-h + i * s, -h]);
  for (let i = 1; i < n; i++) ring.push([h, -h + i * s]);
  for (let i = n - 2; i >= 0; i--) ring.push([-h + i * s, h]);
  for (let i = n - 2; i >= 1; i--) ring.push([-h, -h + i * s]);
  const total = ring.length * layers;
  const shown = Math.round(progress * total);
  const doorX = -h + Math.floor(n / 2) * s;
  for (let k = 0; k < shown; k++) {
    const layer = Math.floor(k / ring.length), [x, z] = ring[k % ring.length];
    // door gap in front, windows every other row higher up
    const isDoor = z === h && Math.abs(x - doorX) < 0.01 && layer < 2;
    const isWin = layer >= 2 && layer % 2 === 0 && ((z === h && Math.abs(x - doorX + s) < 0.01) || (x === h && Math.abs(z) < 0.3));
    const c = isDoor ? '#8a5a3b' : isWin ? '#9fe0ff' : colors.length ? colors[k % colors.length] : '#e8d8b8';
    box(L, M, x, 0.16 + layer * 0.42, z, s, 0.42, s, c, isDoor || isWin ? undefined : { top: shade(c, 0.12) });
  }
  if (roofK > 0) {
    const top = 0.16 + layers * 0.42, k = (n * s + 0.3) / 2.3;
    const R = m(M, mT(0, top + (1 - roofK) * 2, 0), mS(k));
    box(L, R, 0, 0, 0, 2.3, 0.22, 2.3, roofColor);
    box(L, R, 0, 0.22, 0, 1.7, 0.22, 1.7, shade(roofColor, 0.08));
    box(L, R, 0, 0.44, 0, 1.1, 0.22, 1.1, shade(roofColor, 0.15));
    box(L, R, 0, 0.66, 0, 0.5, 0.2, 0.5, shade(roofColor, 0.22));
    if (style === 'tower') box(L, R, 0, 0.86, 0, 0.08, 0.7, 0.08, '#6a6a78'), box(L, R, 0.2, 1.3, 0, 0.36, 0.24, 0.03, '#e8443a');
    else box(L, R, 0.55, 0.3, -0.5, 0.24, 0.6, 0.24, '#9a96a6');
  }
}

// ---------------- decorations ----------------
export function tree(L, M, k = 0) {
  box(L, M, 0, 0, 0, 0.26, 0.5, 0.26, '#8a5a3b');
  if (k % 2) {
    box(L, M, 0, 0.5, 0, 0.9, 0.5, 0.9, '#4cae3c');
    box(L, M, 0, 1.0, 0, 0.6, 0.4, 0.6, '#5cc95a');
  } else {
    box(L, M, 0, 0.5, 0, 0.8, 0.9, 0.8, '#43a047', { top: '#5cc95a' });
  }
}
export function cone(L, M) {
  box(L, M, 0, 0, 0, 0.32, 0.06, 0.32, '#e8443a');
  box(L, M, 0, 0.06, 0, 0.2, 0.14, 0.2, '#ff7a2a');
  box(L, M, 0, 0.2, 0, 0.16, 0.08, 0.16, '#ffffff');
  box(L, M, 0, 0.28, 0, 0.11, 0.12, 0.11, '#ff7a2a');
}
export function barrel(L, M) {
  box(L, M, 0, 0, 0, 0.36, 0.5, 0.36, '#3b8fe8');
  box(L, M, 0, 0.18, 0, 0.38, 0.06, 0.38, '#ffffff');
}
export function fence(L, M, len) {
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 0.6) box(L, M, x, 0, 0, 0.1, 0.5, 0.1, '#ffffff');
  box(L, M, 0, 0.3, 0, len, 0.12, 0.06, '#e8443a');
}

// Excavator. arm = 0..1 animates the dig.
export function excavator(L, M, t) {
  box(L, M, 0, 0, -0.42, 1.5, 0.3, 0.3, '#3a3a46');
  box(L, M, 0, 0, 0.42, 1.5, 0.3, 0.3, '#3a3a46');
  box(L, M, 0, 0.3, 0, 0.6, 0.1, 0.6, '#55556a');
  const swing = Math.sin(t * 0.7) * 0.5;
  const U = m(M, mT(0, 0.4, 0), mRY(swing));
  box(L, U, -0.15, 0, 0, 1.2, 0.4, 0.95, '#f7c531');
  box(L, U, 0.2, 0.4, -0.2, 0.5, 0.55, 0.5, '#f7c531');
  box(L, U, 0.46, 0.55, -0.2, 0.02, 0.3, 0.4, '#9fe0ff');
  box(L, U, -0.6, 0.4, 0.2, 0.3, 0.2, 0.5, '#4a4a58');
  const dig = (Math.sin(t * 1.4) + 1) / 2;
  const A1 = m(U, mT(0.35, 0.35, 0.22), mRZ(0.7 - dig * 0.5));
  box(L, A1, 0.6, -0.1, 0, 1.2, 0.2, 0.2, '#f5b81a');
  const A2 = m(A1, mT(1.15, 0, 0), mRZ(-1.6 + dig * 0.6));
  box(L, A2, 0.45, -0.08, 0, 0.9, 0.16, 0.16, '#f5b81a');
  const A3 = m(A2, mT(0.9, 0, 0), mRZ(-0.6 + dig * 0.9));
  box(L, A3, 0.15, -0.2, 0, 0.3, 0.3, 0.4, '#6a6a78');
}

// Tower crane with a turning jib and a hook.
export function crane(L, M, t) {
  box(L, M, 0, 0, 0, 0.8, 0.2, 0.8, '#6a6a78');
  for (let i = 0; i < 6; i++) box(L, M, 0, 0.2 + i * 0.6, 0, 0.32, 0.6, 0.32, i % 2 ? '#f7c531' : '#f5b81a');
  const J = m(M, mT(0, 3.8, 0), mRY(t * 0.25));
  box(L, J, 0, 0, 0, 0.4, 0.4, 0.4, '#f7c531');
  box(L, J, 0.15, 0.4, 0.05, 0.3, 0.3, 0.3, '#9fe0ff');
  box(L, J, 1.1, 0.12, 0, 2.6, 0.18, 0.2, '#f5b81a');
  box(L, J, -0.8, 0.12, 0, 1.0, 0.18, 0.2, '#f5b81a');
  box(L, J, -1.15, -0.15, 0, 0.4, 0.4, 0.4, '#8a8a98');
  const hy = -1.0 - Math.sin(t * 0.6) * 0.4;
  box(L, J, 2.1, hy, 0, 0.03, -hy, 0.03, '#2a1f3d');
  box(L, J, 2.1, hy - 0.16, 0, 0.16, 0.16, 0.16, '#e8443a');
}

// Little worker with a hard hat.
export function worker(L, M, wave = 0) {
  box(L, M, -0.07, 0, 0, 0.1, 0.3, 0.12, '#3b5fa8');
  box(L, M, 0.07, 0, 0, 0.1, 0.3, 0.12, '#3b5fa8');
  box(L, M, 0, 0.3, 0, 0.3, 0.32, 0.18, '#ff8a1a');
  box(L, M, 0, 0.42, 0.095, 0.3, 0.05, 0.01, '#fff3a0');
  box(L, M, 0, 0.62, 0, 0.22, 0.22, 0.22, '#ffd2a8');
  box(L, M, 0, 0.84, 0, 0.28, 0.08, 0.28, '#f7c531');
  box(L, M, 0, 0.92, 0, 0.18, 0.06, 0.18, '#f7c531');
  box(L, M, -0.2, 0.34, 0, 0.08, 0.26, 0.08, '#ff8a1a');
  const A = m(M, mT(0.2, 0.6, 0), mRX(0), mRZ(1.0 + Math.sin(wave) * 0.6 * (wave ? 1 : 0)));
  box(L, A, 0, -0.04, 0, 0.26, 0.08, 0.08, '#ff8a1a');
}
