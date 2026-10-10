// Level picker: a row of signs with numbers and stars. Locked levels show a padlock.
import { V, ease } from '../core.js';
import { INK, rr, fs, circle } from '../draw.js';
import { Button, layoutTopRight, drawStarIcon } from '../ui.js';
import { playMusic, toggleMute, sfx } from '../audio.js';
import { Particles } from '../particles.js';
import { save, LEVELS } from '../storage.js';
import { drawModelAt } from '../iso.js';
import { VEHICLES } from '../models.js';
import { levelSpec } from '../levels.js';
import { PlayScene } from './play.js';
import { TitleScene } from './title.js';

const COLORS = ['#e8443a', '#f5962a', '#f7d43c', '#5cc95a', '#3b8fe8', '#9b5de5', '#f06fb0', '#e8443a', '#f5962a', '#5cc95a'];

export class LevelScene {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.fx = new Particles();
    this.home = new Button('home', '#f5962a', 36);
    this.sound = new Button('sound', '#3b8fe8', 36);
    this.onResize();
  }
  onResize() {
    layoutTopRight([this.sound, this.home]);
    const cols = 6, gapX = Math.min(160, (V.w - V.safeL - V.safeR - 140) / cols), gapY = 128;
    this.spots = [];
    for (let i = 0; i < LEVELS; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      // Small pictures of the machines this level uses, when it is not just the truck.
      const v = levelSpec(i + 1).vehicles;
      this.spots.push({ x: V.w / 2 + (c - (cols - 1) / 2) * gapX, y: 135 + r * gapY, r: 44, v: v.length === 1 && v[0] === 'truck' ? [] : v });
    }
  }
  enter() { playMusic('menu'); }
  onDown(p) {
    if (this.sound.hit(p)) { toggleMute(); sfx('tap'); return; }
    if (this.home.hit(p)) { sfx('tap'); this.game.go(new TitleScene(this.game)); return; }
    for (let i = 0; i < LEVELS; i++) {
      const s = this.spots[i];
      if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + 26) {
        if (i + 1 > save.unlocked) { sfx('bump'); s.shake = 0.4; return; }
        sfx('pop');
        this.game.go(new PlayScene(this.game, i + 1));
        return;
      }
    }
    this.fx.burst(p.x, p.y, 6);
  }
  update(dt) {
    this.t += dt; this.fx.update(dt);
    for (const s of this.spots) if (s.shake) s.shake = Math.max(0, s.shake - dt);
  }
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, V.h);
    g.addColorStop(0, '#7fd0ff'); g.addColorStop(1, '#d6f4ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, V.w, V.h);
    ctx.beginPath(); ctx.moveTo(0, 660);
    for (let x = 0; x <= V.w; x += 20) ctx.lineTo(x, 660 + Math.sin(x * 0.01) * 6);
    ctx.lineTo(V.w, V.h); ctx.lineTo(0, V.h); ctx.closePath(); fs(ctx, '#8fd65f', 4);
    // the machines driving along the bottom
    const tx = ((t * 110) % (V.w + 700)) - 200;
    drawModelAt(ctx, (L, M) => VEHICLES.truck.model(L, M, { load: ['rock', 'beam', 'sand', 'brick', 'log', 'pipe'] }), tx, 690, 1.1, 0);
    drawModelAt(ctx, (L, M) => VEHICLES.forklift.model(L, M, { load: ['brick', 'brick', 'pipe', 'beam'] }), tx - 190, 690, 1.1, 0);
    drawModelAt(ctx, (L, M) => VEHICLES.digger.model(L, M, { load: ['sand', 'sand', 'gravel'] }), tx - 400, 690, 1.1, 0);
    const next = Math.min(save.unlocked, LEVELS);
    for (let i = 0; i < LEVELS; i++) {
      const s = this.spots[i], locked = i + 1 > save.unlocked;
      const hop = i + 1 === next ? Math.abs(Math.sin(t * 3)) * 10 : 0;
      ctx.save();
      ctx.translate(s.x + (s.shake ? Math.sin(t * 50) * 6 : 0), s.y - hop);
      circle(ctx, 0, 8, s.r); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
      circle(ctx, 0, 0, s.r); fs(ctx, locked ? '#b8b4c4' : COLORS[i % COLORS.length], 6);
      if (locked) {
        rr(ctx, -20, -6, 40, 32, 6); fs(ctx, '#ffffff', 4);
        ctx.beginPath(); ctx.arc(0, -8, 13, Math.PI, 0); ctx.lineWidth = 12; ctx.strokeStyle = INK; ctx.stroke();
        ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      } else {
        ctx.font = '900 44px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
        ctx.strokeText(String(i + 1), 0, 3); ctx.fillStyle = '#ffffff'; ctx.fillText(String(i + 1), 0, 3);
      }
      ctx.restore();
      if (!locked) {
        for (let k = 0; k < 3; k++) drawStarIcon(ctx, s.x + (k - 1) * 28, s.y + s.r + 18, 12, k < (save.stars[i + 1] || 0));
        // Machine badges in a column right of the button.
        s.v.forEach((type, k) => {
          const bx = s.x + s.r + 12, by = s.y - (s.v.length - 1) * 16 + k * 32;
          circle(ctx, bx, by, 16); fs(ctx, '#ffffff', 3);
          drawModelAt(ctx, (L, M) => VEHICLES[type].model(L, M, {}), bx - 2, by + 6, 0.28, 0.3, 1);
        });
      }
    }
    if (next && save.unlocked <= LEVELS) {
      const s = this.spots[next - 1];
      const k = ease.outQuad((Math.sin(t * 4) + 1) / 2);
      ctx.beginPath(); ctx.arc(s.x, s.y - Math.abs(Math.sin(t * 3)) * 10, s.r + 10 + k * 6, 0, Math.PI * 2);
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
    }
    this.fx.draw(ctx);
    this.home.draw(ctx, t);
    this.sound.draw(ctx, t);
  }
}
