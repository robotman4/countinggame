// Difficulty per level, all in one place so it is easy to tune after the kids have played.
import { rng } from './core.js';
import { MATERIAL_IDS, LOOSE } from './models.js';

// c = how many of each material, v = vehicles to drive (T truck, F forklift, D excavator),
// b = building (h house, t tower). New vehicles get one easy level of their own first.
const LEVELS = [
  null,
  { c: [2], v: 'T' },              // 1
  { c: [3], v: 'T' },              // 2
  { c: [2, 1], v: 'T' },           // 3
  { c: [3], v: 'F' },              // 4: meet the forklift
  { c: [3], v: 'D' },              // 5: meet the excavator
  { c: [3, 2], v: 'T' },           // 6
  { c: [2, 2], v: 'F' },           // 7
  { c: [2, 2], v: 'D' },           // 8: bucket holds 3, so two trips
  { c: [2, 2], v: 'DF' },          // 9: pick the right machine
  { c: [4, 2], v: 'T', b: 't' },   // 10
  { c: [2, 2, 1], v: 'T' },        // 11
  { c: [3, 3], v: 'F' },           // 12
  { c: [3, 2], v: 'DF' },          // 13
  { c: [3, 3, 2], v: 'T' },        // 14: more than fits in one trip
  { c: [2, 2, 2], v: 'TDF', b: 't' }, // 15: all three
  { c: [4, 3], v: 'DF' },          // 16
  { c: [4, 3, 2], v: 'T' },        // 17: bigger truck from here
  { c: [3, 2, 2], v: 'F' },        // 18
  { c: [3, 2, 2], v: 'D' },        // 19
  { c: [3, 2, 2, 2], v: 'TDF', b: 't' }, // 20
  { c: [3, 3, 2, 2], v: 'DF' },    // 21
  { c: [5, 3, 2, 2], v: 'T' },     // 22
  { c: [4, 3, 3, 2], v: 'TDF' },   // 23
  { c: [5, 4, 3, 2], v: 'TDF', b: 't' }, // 24
];
export const LEVEL_COUNT = LEVELS.length - 1;
const V_NAMES = { T: 'truck', F: 'forklift', D: 'digger' };

function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function levelSpec(level) {
  const L = Math.max(1, Math.min(LEVEL_COUNT, level));
  const r = rng(L * 7919 + 13);
  const def = LEVELS[L];
  const counts = def.c;
  const vehicles = def.v.split('').map((k) => V_NAMES[k]);
  const loose = shuffle(MATERIAL_IDS.filter((id) => LOOSE.has(id)), r);
  const solid = shuffle(MATERIAL_IDS.filter((id) => !LOOSE.has(id)), r);
  // Only materials the level's vehicles can carry. With both the excavator and the forklift,
  // alternate loose and solid so both machines are needed.
  let pick;
  if (def.v === 'F') pick = solid;
  else if (def.v === 'D') pick = loose;
  else if (def.v === 'DF') pick = counts.map((_, i) => (i % 2 ? solid : loose)[Math.floor(i / 2)]).concat(loose.slice(Math.ceil(counts.length / 2)), solid.slice(Math.floor(counts.length / 2)));
  else pick = shuffle(MATERIAL_IDS.slice(), r);
  const order = counts.map((n, i) => ({ m: pick[i], n }));
  // Extra piles that are not in the order, so choosing the right one matters. At most 6 piles.
  const extra = Math.min(L <= 1 ? 1 : 2, 6 - counts.length, pick.length - counts.length);
  const rest = shuffle(pick.slice(counts.length), r);
  const piles = shuffle(pick.slice(0, counts.length).concat(rest.slice(0, extra)), r);
  return {
    level: L,
    order,
    piles,
    vehicles,
    cap: L >= 17 ? 8 : 6, // truck size
    // guard: vehicles refuse items that are not needed (early levels only).
    guard: L <= 6,
    // ticks: the order sign marks items as loaded, not only as delivered.
    ticks: L <= 12,
    building: def.b === 't' ? 'tower' : 'house',
    roof: ['#e8443a', '#3b8fe8', '#9b5de5', '#5cc95a', '#f5962a'][L % 5],
  };
}
