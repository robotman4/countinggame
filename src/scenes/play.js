// The game: a sign shows what the building site needs ("4 beams + 2 rocks").
// Drive the truck to the right pile (tap it, or hold a finger where to go), drag or tap
// items into the truck, then drive back to the site where the truck tips them out.
import { V, R, ease, Tweens, clamp, lerp, dist, TAU } from '../core.js';
import { INK, rr, fs, circle, drawHand, drawArrow } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { recordLevel, LEVELS } from '../storage.js';
import { CAM, setCam, proj, unproj, depthOf, drawBoxes, drawModelAt, shadow, m, mT, mRY, mS } from '../iso.js';
import { MATERIALS, itemModel, pile, truck, bedSlotWorld, house, tree, cone, barrel, fence, excavator, crane, worker } from '../models.js';
import { levelSpec } from '../levels.js';
import { LevelScene } from './levels.js';

const MAXV = 4.6;      // truck top speed, world units per second
const TRUCK_R = 0.85;  // truck size for bumping into things
const DOCK = 1.9;      // how close to a pile counts as parked there
const HOUSE_R = 1.9;
// Where piles may stand, as fractions of the play area. Sets by number of piles.
const SLOTS = [[0.06, 0.06], [0.94, 0.06], [0.03, 0.6], [0.97, 0.6], [0.26, 1.0], [0.74, 1.0]];
const SLOT_SETS = { 2: [2, 3], 3: [0, 3, 4], 4: [0, 1, 4, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export class PlayScene {
  constructor(game, level) {
    this.game = game;
    this.level = level;
    this.spec = levelSpec(level);
    this.t = 0; this.timer = 0; this.idle = 0; this.mistakes = 0;
    this.tw = new Tweens();
    this.fx = new Particles();
    this.need = {}; this.delivered = {}; this.coming = {};
    for (const o of this.spec.order) { this.need[o.m] = o.n; this.delivered[o.m] = 0; this.coming[o.m] = 0; }
    this.total = this.spec.order.reduce((a, o) => a + o.n, 0);
    this.houseColors = [];
    this.progress = { v: 0 };
    this.roof = { k: 0 };
    this.truck = { x: 0, z: 0, h: 0, v: 0, tx: null, tz: null, tilt: 0, load: [], hidden: 0, cap: this.spec.cap, bounce: 0, hop: { y: 0 }, shake: 0 };
    this.flyers = []; this.pops = []; this.leftovers = [];
    this.signShake = {}; this.slotPop = {};
    this.state = 'intro'; this.introT = 0;
    this.sign = { k: 0 };
    this.home = new Button('home', '#f5962a', 36);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.endBtns = { home: new Button('home', '#f5962a', 44), retry: new Button('retry', '#3b8fe8', 44), next: new Button('next', '#5cc95a', 56) };
    this.endBtns.next.pulse = true;
    this.layout(true);
    this.tw.add(this.sign, { k: 1 }, 0.5, { ease: ease.outBack });
  }

  // ---------------- layout ----------------
  layout(first) {
    const left = V.safeL + 110, right = V.w - V.safeR - 110, top = 250, bot = V.h - V.safeB - 70;
    this.rect = { left, right, top, bot };
    setCam({ S: 60, ox: (left + right) / 2, oy: (top + bot) / 2 });
    const at = (u, v) => unproj(lerp(left, right, u), lerp(top, bot, v));
    const s = at(0.5, 0.45);
    this.site = { x: s.x, z: s.z };
    this.site.dock = { x: s.x + 0.4, z: s.z + 3.0 };
    const ids = this.spec.piles, set = SLOT_SETS[ids.length] || SLOT_SETS[6];
    const old = this.piles;
    this.piles = ids.map((id, i) => {
      const p = at(SLOTS[set[i]][0], SLOTS[set[i]][1]);
      const dx = this.site.x - p.x, dz = this.site.z - p.z, d = Math.hypot(dx, dz) || 1;
      return {
        m: id, x: p.x, z: p.z, r: 1.15,
        dock: { x: p.x + (dx / d) * 2.3, z: p.z + (dz / d) * 2.3 },
        items: old ? old[i].items : [0, 1, 2].map(() => ({ s: 1, ready: true, timer: 0 })),
        glow: old ? old[i].glow : 0,
      };
    });
    // Machines and props stand in the gaps between the roads (behind the house, beside the parking spot).
    const ss = proj(s.x, 0, s.z);
    const near = (dx, dy) => unproj(ss[0] + dx, ss[1] + dy);
    // The crane stands at the back corner of the house, inside its bump circle, so there is no gap to get stuck in.
    this.crane = { x: s.x - 1.35, z: s.z - 1.5 };
    // The excavator digs just outside the drivable area, so it never blocks the truck.
    this.digger = unproj(ss[0], top - 85);
    this.leftPos = near(-150, 95);
    this.workerPos = near(140, 100);
    this.obstacles = [
      ...this.piles.map((p) => ({ x: p.x, z: p.z, r: p.r })),
      { x: s.x, z: s.z, r: HOUSE_R },
    ];
    // A parking spot must never sit inside something, or the truck could never get there.
    for (const pl of this.piles) {
      for (let k = 0; k < 8; k++) {
        for (const o of this.obstacles) {
          if (o.x === pl.x && o.z === pl.z) continue;
          const dx = pl.dock.x - o.x, dz = pl.dock.z - o.z, d = Math.hypot(dx, dz) || 1e-3, min = o.r + TRUCK_R + 0.15;
          if (d < min) { pl.dock.x = o.x + (dx / d) * min; pl.dock.z = o.z + (dz / d) * min; }
        }
      }
    }
    if (first) { this.truck.x = this.site.dock.x; this.truck.z = this.site.dock.z; this.truck.h = 0; }
    this.clampTruck();
    layoutTopRight([this.sound, this.home]);
    const eb = this.endBtns;
    eb.next.x = V.w / 2 + 170; eb.retry.x = V.w / 2; eb.home.x = V.w / 2 - 170;
    eb.next.y = eb.retry.y = eb.home.y = V.h - V.safeB - 90;
    this.makeScenery();
    this.bg = null;
  }
  onResize() { this.layout(false); }
  enter() { playMusic('play'); }

  // Trees and cones around the edge of the play area, same every visit.
  makeScenery() {
    this.trees = [];
    const { left, right, top, bot } = this.rect;
    for (let y = 120; y < V.h + 60; y += 70) {
      for (let x = -20; x < V.w + 40; x += 80) {
        const px = x + ((y / 70) % 2) * 40 + (Math.sin(x * 12.9 + y * 7.1) * 18);
        const inside = px > left - 70 && px < right + 70 && y > top - 70 && y < bot + 50;
        if (inside) continue;
        if (y < 230 && px > V.w * 0.18 && px < V.w * 0.82) continue; // under the sign
        if (Math.sin(px * 3.3 + y * 1.7) > 0.25) continue;
        const w = unproj(px, y);
        if (this.piles.some((pl) => dist(w.x, w.z, pl.x, pl.z) < 2.4)) continue;
        this.trees.push({ x: w.x, z: w.z, k: (px * 7 + y) | 0 });
      }
    }
    const s = this.site;
    const ss = proj(s.x, 0, s.z);
    this.cones = [[-110, 150], [120, 160], [-200, -60], [210, -50]].map(([dx, dy]) => unproj(ss[0] + dx, ss[1] + dy));
    this.barrels = [[-170, -110], [175, -105]].map(([dx, dy]) => unproj(ss[0] + dx, ss[1] + dy));
  }

  // The ground is drawn once into an offscreen canvas.
  makeBg() {
    const c = document.createElement('canvas');
    c.width = Math.round(V.w * V.scale); c.height = Math.round(V.h * V.scale);
    const g = c.getContext('2d');
    g.setTransform(V.scale, 0, 0, V.scale, 0, 0);
    g.fillStyle = '#8fd65f'; g.fillRect(0, 0, V.w, V.h);
    // checker tiles
    const a = unproj(0, 0), b = unproj(V.w, 0), cc = unproj(0, V.h), d = unproj(V.w, V.h);
    const xs = [a.x, b.x, cc.x, d.x], zs = [a.z, b.z, cc.z, d.z];
    g.fillStyle = '#86cf57';
    for (let x = Math.floor(Math.min(...xs)) - 1; x < Math.max(...xs) + 1; x++) {
      for (let z = Math.floor(Math.min(...zs)) - 1; z < Math.max(...zs) + 1; z++) {
        if ((x + z) & 1) continue;
        const p = [proj(x, 0, z), proj(x + 1, 0, z), proj(x + 1, 0, z + 1), proj(x, 0, z + 1)];
        g.beginPath(); p.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
      }
    }
    // dirt roads from the site to each pile
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, col] of [[1.7, '#b8925a'], [1.4, '#d9b77a']]) {
      g.lineWidth = w * CAM.S; g.strokeStyle = col;
      for (const p of this.piles) {
        const s0 = proj(this.site.x, 0, this.site.z), s1 = proj(p.x, 0, p.z);
        g.beginPath(); g.moveTo(s0[0], s0[1]); g.lineTo(s1[0], s1[1]); g.stroke();
      }
    }
    // the building plot
    const s = this.site;
    const plot = [[s.x - 3.2, s.z - 2.6], [s.x + 3.2, s.z - 2.6], [s.x + 3.2, s.z + 3.4], [s.x - 3.2, s.z + 3.4]];
    for (const [k, col] of [[0.25, '#b8925a'], [0, '#d9b77a']]) {
      g.beginPath();
      plot.forEach(([x, z], i) => { const q = proj(x + (x > s.x ? k : -k), 0, z + (z > s.z ? k : -k)); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      g.closePath(); g.fillStyle = col; g.fill();
    }
    // around each pile
    for (const p of this.piles) {
      const q = proj(p.x, 0, p.z);
      g.beginPath(); g.ellipse(q[0], q[1], 1.9 * CAM.S, 1.9 * CAM.S * Math.sin(CAM.pitch), 0, 0, TAU); g.fillStyle = '#d9b77a'; g.fill();
    }
    this.bg = c;
  }

  // ---------------- helpers ----------------
  after(sec, fn) { this.tw.add({}, {}, sec, { onDone: fn }); }
  loaded(mat) { return this.truck.load.filter((x) => x === mat).length; }
  remaining(mat) { return (this.need[mat] || 0) - (this.delivered[mat] || 0) - this.loaded(mat) - (this.coming[mat] || 0); }
  stillNeeded() { return this.spec.order.some((o) => this.delivered[o.m] < o.n); }
  truckM() { const tr = this.truck; return m(mT(tr.x, tr.bounce + tr.hop.y, tr.z), mRY(tr.h)); }
  bedScreen() { const tr = this.truck; const c = tr.cap > 6 ? -0.2 : -0.3; return proj(tr.x + Math.cos(tr.h) * c, 0.9, tr.z + Math.sin(tr.h) * c); }
  slotScreen(i) { const w = bedSlotWorld(this.truck, i); return proj(w.x, w.y, w.z); }
  houseTop() { const s = this.site; return proj(s.x, 0.4 + this.progress.v * 1.7, s.z); }

  // Items floating over a pile, ready to grab. Bigger when the truck is parked there.
  itemScreen(p, i) {
    const big = this.dock === p;
    const base = proj(p.x, 1.6, p.z);
    const gap = big ? 66 : 40;
    const bob = Math.sin(this.t * 3 + i * 1.3) * (big ? 6 : 3);
    return { x: base[0] + (i - 1) * gap, y: base[1] - (big ? 40 : 18) + bob - (i === 1 ? 10 : 0), s: big ? 1.85 : 1.05 };
  }

  clampTruck() {
    const tr = this.truck, { left, right, top, bot } = this.rect;
    const [sx, sy] = proj(tr.x, 0, tr.z);
    const cx = clamp(sx, left - 60, right + 60), cy = clamp(sy, top - 40, bot + 40);
    if (cx !== sx || cy !== sy) { const w = unproj(cx, cy); tr.x = w.x; tr.z = w.z; }
  }
  setTarget(x, z) {
    const tr = this.truck;
    if (tr.tx === null && Math.abs(tr.v) < 0.5) sfx('vroom');
    tr.tx = x; tr.tz = z;
  }
  groundTarget(p) {
    const { left, right, top, bot } = this.rect;
    const w = unproj(clamp(p.x, left - 60, right + 60), clamp(p.y, top - 40, bot + 40));
    this.setTarget(w.x, w.z);
  }

  pop(txt, x, y, c) { this.pops.push({ txt: String(txt), x, y, c, t: 0 }); }

  // ---------------- input ----------------
  onDown(p) {
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p)) { sfx('tap'); this.game.go(new LevelScene(this.game)); return; }
    if (this.state === 'done') {
      if (this.doneT < 1.5) return;
      const eb = this.endBtns;
      if (eb.home.hit(p)) { sfx('tap'); this.game.go(new LevelScene(this.game)); }
      else if (eb.retry.hit(p)) { sfx('tap'); this.game.go(new PlayScene(this.game, this.level)); }
      else if (eb.next.visible && eb.next.hit(p)) { sfx('pop'); this.game.go(new PlayScene(this.game, this.level + 1)); }
      return;
    }
    if (this.state === 'intro') { if (this.introT > 0.6) this.startPlay(); return; }
    this.idle = 0;
    if (this.state !== 'play') return;
    const tr = this.truck;
    // Grab an item from the pile the truck is parked at.
    if (this.dock) {
      const d = this.dock;
      for (let i = 0; i < 3; i++) {
        const it = d.items[i];
        if (!it.ready) continue;
        const q = this.itemScreen(d, i);
        if (dist(p.x, p.y, q.x, q.y) < 52) {
          it.ready = false; it.dragging = true;
          this.drag = { pile: d, i, m: d.m, x: q.x, y: q.y, x0: p.x, y0: p.y, moved: false, s: q.s };
          sfx('pick');
          return;
        }
      }
    }
    // Tap the truck: give one item back to this pile if it carries any, otherwise honk.
    const bs = this.bedScreen();
    if (dist(p.x, p.y, bs[0], bs[1]) < 70) {
      if (this.dock && this.loaded(this.dock.m) > 0 && tr.hidden === 0) { this.giveBack(this.dock); return; }
      sfx('honk');
      this.tw.add(tr.hop, { y: 0.35 }, 0.12, { onDone: () => this.tw.add(tr.hop, { y: 0 }, 0.3, { ease: ease.outBounce }) });
      return;
    }
    // Tap a pile or its items: drive there.
    for (const pl of this.piles) {
      const q = proj(pl.x, 0.5, pl.z), q2 = this.itemScreen(pl, 1);
      if (dist(p.x, p.y, q[0], q[1]) < 80 || dist(p.x, p.y, q2.x, q2.y) < 70) {
        this.setTarget(pl.dock.x, pl.dock.z); this.tapFx(p); return;
      }
    }
    // Tap the house: drive back to the site.
    const hs = proj(this.site.x, 0.8, this.site.z);
    if (dist(p.x, p.y, hs[0], hs[1]) < 100) { this.setTarget(this.site.dock.x, this.site.dock.z); this.tapFx(p); return; }
    // Anywhere else: drive toward the finger, and keep following while it is held.
    this.holding = true;
    this.groundTarget(p);
    this.tapFx(p);
  }
  tapFx(p) { this.marker = { x: p.x, y: p.y, t: 0 }; }

  onMove(p) {
    if (this.drag) {
      const d = this.drag;
      d.x = p.x; d.y = p.y;
      if (dist(p.x, p.y, d.x0, d.y0) > 14) d.moved = true;
      return;
    }
    if (this.holding && this.state === 'play') { this.groundTarget(p); this.marker = { x: p.x, y: p.y, t: 0.15 }; }
  }

  onUp(p) {
    this.holding = false;
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const bs = this.bedScreen();
    // A tap counts as "put it in the truck" too.
    if (!d.moved || dist(p.x, p.y, bs[0], bs[1]) < 150) this.tryLoad(d);
    else this.sendBack(d);
  }

  // Item goes back to its spot over the pile.
  sendBack(d) {
    const it = d.pile.items[d.i];
    const f = { m: d.m, x: d.x, y: d.y, s: d.s };
    this.flyers.push(f);
    const q = this.itemScreen(d.pile, d.i);
    this.tw.add(f, { x: q.x, y: q.y }, 0.3, { arc: 40, onDone: () => { f.dead = true; it.ready = true; it.dragging = false; } });
  }

  tryLoad(d) {
    const tr = this.truck;
    if (tr.load.length >= tr.cap) {
      sfx('bump'); tr.shake = 0.4;
      this.sendBack(d);
      return;
    }
    if (this.spec.guard && this.remaining(d.m) <= 0) {
      sfx('bump');
      this.signShake[d.m] = 0.5; this.signShake.all = this.need[d.m] ? 0 : 0.5;
      this.sendBack(d);
      return;
    }
    const it = d.pile.items[d.i];
    it.dragging = false; it.timer = 0.8; it.s = 0;
    const idx = tr.load.length;
    tr.load.push(d.m);
    tr.hidden++;
    const f = { m: d.m, x: d.x, y: d.y, s: d.s };
    this.flyers.push(f);
    const q = this.slotScreen(idx);
    this.tw.add(f, { x: q[0], y: q[1], s: 0.92 }, 0.32, {
      arc: 70,
      onDone: () => {
        f.dead = true; tr.hidden = Math.max(0, tr.hidden - 1);
        const n = tr.load.slice(0, idx + 1).filter((x) => x === d.m).length;
        sfx('count', n);
        const bs = this.bedScreen();
        this.pop(n, bs[0], bs[1] - 70, MATERIALS[d.m].color);
        this.slotPop[d.m] = this.t;
        this.fx.burst(q[0], q[1], 4);
        tr.bounce = -0.06;
      },
    });
  }

  // Tap the truck at a pile: the last item of that material hops back out.
  giveBack(pl) {
    const tr = this.truck;
    const i = tr.load.lastIndexOf(pl.m);
    const q = this.slotScreen(i);
    tr.load.splice(i, 1);
    const f = { m: pl.m, x: q[0], y: q[1], s: 0.92 };
    this.flyers.push(f);
    const free = pl.items.findIndex((it) => !it.ready && !it.dragging);
    const target = this.itemScreen(pl, free >= 0 ? free : 1);
    sfx('jump');
    this.tw.add(f, { x: target.x, y: target.y, s: 1.85 }, 0.4, { arc: 80, onDone: () => { f.dead = true; if (free >= 0) { pl.items[free].ready = true; pl.items[free].s = 1; } } });
  }

  // ---------------- flow ----------------
  startPlay() {
    if (this.state !== 'intro') return;
    this.state = 'play';
    this.idle = 0;
    this.playT = this.t;
    sfx('whoosh');
  }

  startDump() {
    const tr = this.truck;
    this.state = 'dump';
    tr.tx = null; tr.v = 0;
    sfx('beep');
    this.after(0.3, () => sfx('beep'));
    this.tw.add(tr, { tilt: 0.6 }, 0.55, { onDone: () => { sfx('dump'); this.unloadNext(); } });
  }

  unloadNext() {
    const tr = this.truck;
    if (!tr.load.length) {
      this.tw.add(tr, { tilt: 0 }, 0.45, { delay: 0.2, onDone: () => { if (this.state === 'dump') this.state = 'play'; } });
      return;
    }
    const i = tr.load.length - 1, mat = tr.load.pop();
    const q = this.slotScreen(i);
    const f = { m: mat, x: q[0], y: q[1], s: 0.92 };
    this.flyers.push(f);
    if ((this.need[mat] || 0) - this.delivered[mat] - this.coming[mat] > 0) {
      this.coming[mat]++;
      const h = this.houseTop();
      this.tw.add(f, { x: h[0] + R.range(-20, 20), y: h[1], s: 1.2 }, 0.55, {
        arc: 130, ease: ease.inOutQuad,
        onDone: () => {
          f.dead = true;
          this.coming[mat]--; this.delivered[mat]++;
          const n = this.delivered[mat];
          this.houseColors.push(MATERIALS[mat].color);
          this.tw.add(this.progress, { v: this.deliveredTotal() / this.total }, 0.3);
          sfx('count', n);
          this.pop(n, h[0], h[1] - 60, MATERIALS[mat].color);
          this.slotPop[mat] = this.t;
          this.fx.burst(h[0], h[1], 6);
          if (this.deliveredTotal() >= this.total) this.finish();
        },
      });
    } else {
      // Not needed (wrong kind, or one too many): it lands on the leftover heap. No harm done.
      const lp = proj(this.leftPos.x, 0.2 + this.leftovers.length * 0.05, this.leftPos.z);
      this.tw.add(f, { x: lp[0], y: lp[1] }, 0.55, {
        arc: 90,
        onDone: () => { f.dead = true; this.leftovers.push(mat); this.mistakes++; sfx('bump'); this.fx.dust(lp[0], lp[1], 5); },
      });
    }
    this.after(0.3, () => this.unloadNext());
  }
  deliveredTotal() { return this.spec.order.reduce((a, o) => a + this.delivered[o.m], 0); }

  finish() {
    if (this.state === 'done') return;
    this.state = 'done';
    this.doneT = 0;
    // Stars: never 0. Lose one for extras, one for being slow (par grows with the order size).
    const trips = Math.ceil(this.total / this.spec.cap);
    const par = 20 + this.total * 3 + trips * 14;
    let s = 3;
    if (this.mistakes > 0) s--;
    if (this.timer > par) s--;
    if (this.timer > par * 2) s--;
    this.stars = Math.max(1, s);
    recordLevel(this.level, this.stars, Math.round(this.timer));
    this.endBtns.next.visible = this.level < LEVELS;
    this.tw.add(this.roof, { k: 1 }, 0.8, { delay: 0.4, ease: ease.outBounce });
    this.after(0.5, () => { sfx('thud'); });
    this.after(0.9, () => {
      sfx('fanfare');
      const h = this.houseTop();
      this.fx.confetti(h[0], h[1] - 40, 70);
      this.fx.firework(h[0] - 150, h[1] - 140);
      this.fx.firework(h[0] + 150, h[1] - 160);
    });
    for (let i = 0; i < this.stars; i++) this.after(1.9 + i * 0.4, () => sfx('star', i));
  }

  // ---------------- update ----------------
  update(dt) {
    this.t += dt;
    this.tw.update(dt);
    this.fx.update(dt);
    if (!this.bg) this.makeBg();
    if (this.state === 'intro') { this.introT += dt; if (this.introT > 3.4) this.startPlay(); }
    if (this.state === 'play') { this.timer += dt; this.idle += dt; }
    if (this.state === 'done') this.doneT += dt;
    if (this.state === 'dump') this.timer += dt;
    this.updateTruck(dt);
    for (const pl of this.piles) {
      for (const it of pl.items) {
        if (!it.ready && !it.dragging && it.timer > 0) {
          it.timer -= dt;
          if (it.timer <= 0) { it.ready = true; it.s = 0; this.tw.add(it, { s: 1 }, 0.35, { ease: ease.outBack }); }
        }
      }
      pl.glow += ((this.dock === pl ? 1 : 0) - pl.glow) * Math.min(1, dt * 8);
    }
    this.flyers = this.flyers.filter((f) => !f.dead);
    for (const pp of this.pops) pp.t += dt;
    this.pops = this.pops.filter((pp) => pp.t < 1.1);
    for (const k in this.signShake) this.signShake[k] = Math.max(0, this.signShake[k] - dt);
    if (this.marker) { this.marker.t += dt; if (this.marker.t > 0.5) this.marker = null; }
  }

  updateTruck(dt) {
    const tr = this.truck;
    if (this.state === 'play' && tr.tx !== null) {
      const dx = tr.tx - tr.x, dz = tr.tz - tr.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { tr.tx = null; }
      else {
        const diff = angDiff(this.steer(dx / d, dz / d, d), tr.h);
        tr.h += clamp(diff, -4.2 * dt, 4.2 * dt);
        const want = MAXV * Math.min(1, d / 1.2) * Math.max(d < 1.2 ? 0.05 : 0.3, Math.cos(diff));
        tr.v += (want - tr.v) * Math.min(1, dt * 5);
        // Pushing against something and getting nowhere: give up and wait for the next tap.
        this.stuckT = (this.stuckT || 0) + dt;
        if (this.stuckT > 0.8) {
          if (this.stuckFrom && dist(tr.x, tr.z, this.stuckFrom.x, this.stuckFrom.z) < 0.25) { tr.tx = null; sfx('bump'); }
          this.stuckFrom = { x: tr.x, z: tr.z }; this.stuckT = 0;
        }
      }
    } else { this.stuckT = 0; this.stuckFrom = null; }
    if (tr.tx === null || this.state !== 'play') tr.v *= Math.exp(-dt * 9);
    tr.x += Math.cos(tr.h) * tr.v * dt;
    tr.z += Math.sin(tr.h) * tr.v * dt;
    // Bump around piles, the house and the machines.
    for (const o of this.obstacles) {
      const dx = tr.x - o.x, dz = tr.z - o.z, d = Math.hypot(dx, dz), min = o.r + TRUCK_R;
      if (d < min && d > 1e-4) { tr.x = o.x + (dx / d) * min; tr.z = o.z + (dz / d) * min; }
    }
    this.clampTruck();
    // A little bounce while driving, and smoke from the pipe.
    const moving = Math.abs(tr.v) > 0.4;
    tr.bounce += ((moving ? Math.abs(Math.sin(this.t * 22)) * 0.04 : 0) - tr.bounce) * Math.min(1, dt * 12);
    tr.shake = Math.max(0, tr.shake - dt);
    this.smokeT = (this.smokeT || 0) - dt;
    if (this.smokeT <= 0) {
      this.smokeT = moving ? 0.08 : 0.45;
      const M = this.truckM(), lx = (tr.cap > 6 ? 0.85 : 0.42) + 0.04;
      const ex = [M[0] * lx + M[1] * 1.25 + M[2] * -0.4 + M[3], M[4] * lx + M[5] * 1.25 + M[6] * -0.4 + M[7], M[8] * lx + M[9] * 1.25 + M[10] * -0.4 + M[11]];
      const q = proj(ex[0], ex[1], ex[2]);
      this.fx.smoke(q[0], q[1], { r: moving ? 7 : 5, grow: 16, vx: R.range(-20, 20), vy: R.range(-50, -30), life: 0.7, drag: 1 });
    }
    // Which pile are we parked at?
    let best = null, bd = 1e9;
    for (const pl of this.piles) {
      const d = dist(tr.x, tr.z, pl.x, pl.z);
      if (d < pl.r + DOCK + 0.2 && d < bd) { best = pl; bd = d; }
    }
    if (best !== this.dock) {
      if (best && this.state === 'play') sfx('ready');
      if (this.drag && this.drag.pile !== best) { this.sendBack(this.drag); this.drag = null; }
      this.dock = best;
    }
    // At the site with something in the bed: tip it out.
    if (this.state === 'play' && tr.load.length && tr.hidden === 0 && dist(tr.x, tr.z, this.site.x, this.site.z) < HOUSE_R + TRUCK_R + 0.9) this.startDump();
  }

  // Direction to drive: straight at the target, or around the nearest thing in the way.
  steer(ux, uz, d) {
    const tr = this.truck;
    let best = null, bestAlong = 1e9;
    for (const o of this.obstacles) {
      const ox = o.x - tr.x, oz = o.z - tr.z;
      const along = ox * ux + oz * uz;
      if (along <= 0 || along > d) continue;
      const side = ox * -uz + oz * ux, clear = o.r + TRUCK_R + 0.15;
      if (Math.abs(side) < clear && along < bestAlong) { best = { o, side, clear }; bestAlong = along; }
    }
    if (!best) return Math.atan2(uz, ux);
    // Aim past the obstacle, on the side we are already on unless that side is blocked too.
    const { o, side, clear } = best, r = clear + 0.35;
    const pass = (sgn) => ({ x: o.x - uz * sgn * r, z: o.z + ux * sgn * r });
    const blocked = (q) => this.obstacles.some((b) => b !== o && dist(q.x, q.z, b.x, b.z) < b.r + TRUCK_R);
    let q = pass(side >= 0 ? -1 : 1);
    if (blocked(q)) { const q2 = pass(side >= 0 ? 1 : -1); if (!blocked(q2)) q = q2; }
    return Math.atan2(q.z - tr.z, q.x - tr.x);
  }

  // ---------------- draw ----------------
  draw(ctx) {
    const t = this.t;
    if (!this.bg) this.makeBg();
    ctx.drawImage(this.bg, 0, 0, V.w, V.h);
    const tr = this.truck;
    // Tap marker on the ground
    if (this.marker && this.state === 'play') {
      const k = this.marker.t / 0.5;
      ctx.beginPath(); ctx.ellipse(this.marker.x, this.marker.y, 20 + k * 30, (20 + k * 30) * 0.8, 0, 0, TAU);
      ctx.lineWidth = 5; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.stroke();
    }
    // Target flag where the truck is heading
    if (tr.tx !== null && this.state === 'play') {
      const q = proj(tr.tx, 0, tr.tz);
      ctx.beginPath(); ctx.ellipse(q[0], q[1], 16, 12, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    }
    // Glow under the pile the truck is parked at
    for (const pl of this.piles) {
      if (pl.glow < 0.02) continue;
      const q = proj(pl.x, 0, pl.z);
      ctx.beginPath(); ctx.ellipse(q[0], q[1], 1.9 * CAM.S, 1.9 * CAM.S * Math.sin(CAM.pitch), 0, 0, TAU);
      ctx.fillStyle = `rgba(255,240,120,${0.45 * pl.glow * (0.8 + Math.sin(t * 5) * 0.2)})`; ctx.fill();
    }
    // Shadows
    for (const pl of this.piles) shadow(ctx, pl.x, pl.z, 1.2, 0.16);
    shadow(ctx, tr.x, tr.z, 1.15, 0.22);
    for (const tt of this.trees) shadow(ctx, tt.x, tt.z, 0.5, 0.18);

    // 3D objects, back to front
    const groups = [];
    const add = (x, z, fn, bias = 0) => groups.push({ d: depthOf(x, 0, z) + bias, fn });
    const s = this.site;
    add(s.x, s.z, (L) => house(L, mT(s.x, 0, s.z), this.progress.v, this.houseColors, this.roof.k, this.spec.roof));
    add(this.crane.x, this.crane.z, (L) => crane(L, mT(this.crane.x, 0, this.crane.z), t));
    add(this.digger.x, this.digger.z, (L) => excavator(L, m(mT(this.digger.x, 0, this.digger.z), mRY(2.6)), t));
    add(this.workerPos.x, this.workerPos.z, (L) => worker(L, m(mT(this.workerPos.x, 0, this.workerPos.z), mRY(-2.2), mS(1.5)), this.state === 'dump' || this.state === 'done' ? t * 10 : 0));
    for (const c of this.cones) add(c.x, c.z, (L) => cone(L, mT(c.x, 0, c.z)));
    for (const b of this.barrels) add(b.x, b.z, (L) => barrel(L, mT(b.x, 0, b.z)));
    add(s.x, s.z - 2.5, (L) => fence(L, mT(s.x, 0, s.z - 2.5), 1.8));
    for (const pl of this.piles) add(pl.x, pl.z, (L) => pile(L, mT(pl.x, 0, pl.z), pl.m));
    for (const tt of this.trees) add(tt.x, tt.z, (L) => tree(L, mT(tt.x, 0, tt.z), tt.k));
    if (this.leftovers.length) {
      const lp = this.leftPos;
      add(lp.x, lp.z, (L) => this.leftovers.forEach((id, i) => {
        const a = i * 2.4, r = i ? 0.25 + (i % 3) * 0.12 : 0;
        MATERIALS[id].item(L, m(mT(lp.x + Math.cos(a) * r, Math.floor(i / 6) * 0.25, lp.z + Math.sin(a) * r), mRY(i)));
      }));
    }
    add(tr.x, tr.z, (L) => {
      const shown = tr.load.slice(0, tr.load.length - tr.hidden);
      const sh = tr.shake > 0 ? Math.sin(t * 60) * 0.05 : 0;
      truck(L, m(this.truckM(), mT(0, 0, sh)), { tilt: tr.tilt, load: shown, cap: tr.cap, light: Math.sin(t * 8) > 0 && Math.abs(tr.v) > 0.4 });
    }, 0.3);
    groups.sort((a, b) => a.d - b.d);
    for (const g of groups) { const L = []; g.fn(L); drawBoxes(ctx, L); }

    // Items floating over the piles
    for (const pl of this.piles) {
      const big = this.dock === pl;
      for (let i = 0; i < 3; i++) {
        const it = pl.items[i];
        if (!it.ready || it.s <= 0.01) continue;
        const q = this.itemScreen(pl, i);
        if (big) {
          ctx.beginPath(); ctx.arc(q.x, q.y + 4, 34, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,240,120,0.9)'; ctx.stroke();
        }
        drawModelAt(ctx, itemModel(pl.m), q.x, q.y + 12, q.s * it.s, Math.sin(t * 1.5 + i) * 0.4);
      }
    }
    // Flying and dragged items
    for (const f of this.flyers) drawModelAt(ctx, itemModel(f.m), f.x, f.y + 10, f.s);
    if (this.drag) drawModelAt(ctx, itemModel(this.drag.m), this.drag.x, this.drag.y + 10, this.drag.s * 1.15);

    this.fx.draw(ctx);
    // Count pops
    for (const pp of this.pops) {
      const k = ease.outBack(Math.min(1, pp.t * 4)), a = 1 - Math.max(0, pp.t - 0.7) / 0.4;
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      ctx.translate(pp.x, pp.y - pp.t * 40); ctx.scale(k, k);
      ctx.font = '900 64px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(pp.txt, 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillText(pp.txt, 0, 0);
      ctx.restore();
    }

    if (this.state !== 'done' || this.doneT < 1.5) this.drawSign(ctx);
    if (this.state === 'play' && this.idle > 5) this.drawHint(ctx);
    if (this.state === 'done') this.drawDone(ctx);
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }

  // The order: for each material a big number and one picture per piece.
  // Empty slot = faded picture, loaded in the truck = yellow ring, delivered = green.
  drawSign(ctx) {
    const order = this.spec.order;
    const intro = this.state === 'intro';
    // Move from the middle of the screen up to the top when play starts.
    const mv = intro ? 0 : Math.min(1, (this.t - (this.playT ?? 0)) * 3);
    const ICON = 52, NUM = 54, GAP = 40;
    const groupW = (o) => NUM + o.n * ICON;
    // Keep clear of the buttons on the right (and mirrored on the left so it stays centred).
    const maxW = V.w - 2 * (Math.max(V.safeL, V.safeR) + 60 + (this.sound.r + this.home.r) * 2 + 20);
    // Split into two rows if it does not fit, then shrink if it still does not.
    let rows = [order];
    const fullW = order.reduce((a, o) => a + groupW(o), 0) + GAP * (order.length - 1) + 50;
    if (fullW * 0.8 > maxW && order.length > 1) { const h = Math.ceil(order.length / 2); rows = [order.slice(0, h), order.slice(h)]; }
    const rowW = rows.map((r) => r.reduce((a, o) => a + groupW(o), 0) + GAP * (r.length - 1));
    const W = Math.max(...rowW) + 50, H = rows.length * 70 + 30;
    const fit = Math.min(1, maxW / W);
    const k = lerp(Math.min(1.45, (V.w - 80) / W), fit, intro ? 0 : ease.outQuad(mv)) * this.sign.k;
    const cx = V.w / 2, cy = lerp(V.h * 0.42, V.safeT + 14 + (H * k) / 2, intro ? 0 : ease.outQuad(mv));
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(k, k);
    if (this.signShake.all) ctx.translate(Math.sin(this.t * 50) * 8, 0);
    // board on two posts
    rr(ctx, -W / 2 + 30, H / 2 - 10, 16, 30, 4); fs(ctx, '#a0663a', 4);
    rr(ctx, W / 2 - 46, H / 2 - 10, 16, 30, 4); fs(ctx, '#a0663a', 4);
    rr(ctx, -W / 2, -H / 2, W, H, 22); fs(ctx, '#fff8e8', 5);
    rr(ctx, -W / 2 + 7, -H / 2 + 7, W - 14, H - 14, 16); ctx.lineWidth = 3; ctx.strokeStyle = '#f5b81a'; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]);
    let introI = 0;
    rows.forEach((row, ri) => {
      let x = -rowW[ri] / 2;
      const y = -H / 2 + 50 + ri * 70;
      row.forEach((o, gi) => {
        const sh = this.signShake[o.m] ? Math.sin(this.t * 50) * 6 : 0;
        const done = this.delivered[o.m], load = this.spec.ticks ? this.loaded(o.m) + this.coming[o.m] : 0;
        const allDone = done >= o.n;
        // the number
        ctx.font = '900 50px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
        ctx.strokeText(String(o.n), x + NUM / 2 + sh, y + 2);
        ctx.fillStyle = allDone ? '#5cc95a' : MATERIALS[o.m].color === '#3a3a46' ? '#6a6a80' : MATERIALS[o.m].color;
        ctx.fillText(String(o.n), x + NUM / 2 + sh, y + 2);
        x += NUM;
        const popAge = this.t - (this.slotPop[o.m] ?? -9);
        for (let i = 0; i < o.n; i++) {
          // During the intro the pictures appear one by one.
          const appear = intro ? clamp((this.introT - 0.4 - introI * 0.18) * 5, 0, 1) : 1;
          if (intro && appear > 0 && !this['ap' + introI]) { this['ap' + introI] = true; sfx('count', i + 1); }
          introI++;
          if (appear <= 0) continue;
          const ix = x + ICON / 2 + sh, st = i < done ? 2 : i < done + load ? 1 : 0;
          const bump = (st && i === (st === 2 ? done - 1 : done + load - 1) && popAge < 0.4) ? 1 + Math.sin(popAge / 0.4 * Math.PI) * 0.25 : 1;
          ctx.save(); ctx.translate(ix, y); ctx.scale(appear * bump, appear * bump);
          circle(ctx, 0, 0, 23);
          ctx.fillStyle = st === 2 ? '#8be27f' : st === 1 ? '#fff27a' : 'rgba(42,31,61,0.08)'; ctx.fill();
          if (st) { ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
          ctx.globalAlpha = st ? 1 : 0.4;
          drawModelAt(ctx, itemModel(o.m), 0, 9, 1.75, 0.2, 1.5);
          ctx.globalAlpha = 1;
          if (st === 2) { // tick
            ctx.beginPath(); ctx.moveTo(10, 14); ctx.lineTo(15, 20); ctx.lineTo(25, 6);
            ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
          }
          ctx.restore();
          x += ICON;
        }
        if (gi < row.length - 1) {
          ctx.font = '900 40px "Arial Rounded MT Bold", Arial, sans-serif';
          ctx.lineWidth = 7; ctx.strokeText('+', x + GAP / 2, y + 2);
          ctx.fillStyle = '#ffffff'; ctx.fillText('+', x + GAP / 2, y + 2);
          x += GAP;
        }
      });
    });
    ctx.restore();
    if (intro && this.introT > 1.2) drawHand(ctx, cx + 60, cy + (H * k) / 2 + 10, 1, Math.sin(this.t * 8) > 0 ? 1 : 0);
  }

  // Show the next step after a few seconds of doing nothing.
  drawHint(ctx) {
    const t = this.t, tr = this.truck;
    const need = (mat) => this.remaining(mat) > 0;
    const anyNeed = this.spec.order.some((o) => need(o.m));
    const press = Math.sin(t * 8) > 0 ? 1 : 0;
    if (this.dock && need(this.dock.m) && tr.load.length < tr.cap) {
      // drag from the pile to the truck
      const i = this.dock.items.findIndex((it) => it.ready);
      if (i < 0) return;
      const a = this.itemScreen(this.dock, i), b = this.bedScreen();
      const k = ease.inOutQuad((t * 0.7) % 1);
      drawHand(ctx, lerp(a.x, b[0], k) + 10, lerp(a.y, b[1], k) + 10, 1, 1);
      return;
    }
    if (tr.load.length && (!anyNeed || tr.load.length >= tr.cap || !this.dock || !need(this.dock.m))) {
      const h = proj(this.site.x, 1.0, this.site.z);
      drawHand(ctx, h[0] + 20, h[1] + 10, 1, press);
      const b = this.bedScreen();
      const ang = Math.atan2(h[1] - b[1], h[0] - b[0]);
      if (dist(h[0], h[1], b[0], b[1]) > 160) drawArrow(ctx, b[0] + Math.cos(ang) * 80, b[1] + Math.sin(ang) * 80, ang, 0.9);
      return;
    }
    const target = this.piles.find((pl) => need(pl.m));
    if (target) {
      const q = proj(target.x, 0.6, target.z);
      drawHand(ctx, q[0] + 10, q[1], 1, press);
      const b = this.bedScreen();
      const ang = Math.atan2(q[1] - b[1], q[0] - b[0]);
      if (dist(q[0], q[1], b[0], b[1]) > 180) drawArrow(ctx, b[0] + Math.cos(ang) * 80, b[1] + Math.sin(ang) * 80, ang, 0.9);
    }
  }

  drawDone(ctx) {
    const t = this.t, dt = this.doneT;
    if (dt < 1.5) return;
    const a = Math.min(1, (dt - 1.5) * 3);
    ctx.save();
    ctx.globalAlpha = a;
    // Light dim only, so the finished house stays in view between the stars and the buttons.
    ctx.fillStyle = 'rgba(20,14,40,0.25)'; ctx.fillRect(0, 0, V.w, V.h);
    rr(ctx, V.w / 2 - 260, 40 + V.safeT, 520, 150, 34); fs(ctx, '#fff8e8', 6);
    for (let i = 0; i < 3; i++) {
      const x = V.w / 2 + (i - 1) * 150, y = 115 + V.safeT;
      drawStarIcon(ctx, x, y, 58, false);
      const k = ease.outElastic(clamp((dt - 1.9 - i * 0.4) * 2, 0, 1));
      if (i < this.stars && k > 0) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); drawStarIcon(ctx, 0, 0, 58, true, t); ctx.restore(); }
    }
    for (const b of Object.values(this.endBtns)) b.draw(ctx, t);
    ctx.restore();
  }
}
