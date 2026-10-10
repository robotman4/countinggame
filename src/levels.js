// Difficulty per level, all in one place so it is easy to tune after the kids have played.
import { rng } from './core.js';
import { MATERIAL_IDS } from './models.js';

// Hand-tuned order sizes: counts per material for each level.
const COUNTS = [
  null,
  [2],          // 1: one material, tiny number
  [3],          // 2
  [2, 1],       // 3: two materials
  [3, 2],       // 4
  [4, 2],       // 5
  [2, 2, 1],    // 6: three materials, still one trip
  [3, 3, 2],    // 7: more than fits, two trips
  [4, 3, 2],    // 8
  [3, 2, 2, 2], // 9: four materials
  [5, 3, 2, 2], // 10
];

export function levelSpec(level) {
  const L = Math.max(1, Math.min(COUNTS.length - 1, level));
  const r = rng(L * 7919 + 13);
  const counts = COUNTS[L];
  // Pick the materials for this level (same every visit).
  const pool = MATERIAL_IDS.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const order = counts.map((n, i) => ({ m: pool[i], n }));
  // Extra piles that are not in the order, so choosing the right one matters.
  const extra = L <= 1 ? 1 : L <= 4 ? 2 : L <= 7 ? 2 : 2;
  const piles = pool.slice(0, counts.length + extra);
  for (let i = piles.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [piles[i], piles[j]] = [piles[j], piles[i]]; }
  return {
    level: L,
    order,
    piles,
    cap: L >= 8 ? 8 : 6,
    // guard: the truck refuses items that are not needed (early levels only).
    guard: L <= 4,
    // ticks: the order sign marks items as loaded, not only as delivered.
    ticks: L <= 6,
    roof: ['#e8443a', '#3b8fe8', '#9b5de5', '#5cc95a', '#f5962a'][L % 5],
  };
}
