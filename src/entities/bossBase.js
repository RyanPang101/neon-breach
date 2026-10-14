// Shared telegraph → attack state machine every boss kit is built on top of.
// A boss is just a BossBase with a list of {name, weight, telegraph, execute}
// attacks — see entities/bosses.js for how the three current bosses hook
// custom behavior on top of this via update() wrapping. The exposed/exploit
// bonus itself now lives in EnemyBase, shared with every enemy type.
import { ctx } from '../core/canvas.js';
import { angleTo, clamp, rand } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { PAL } from '../core/palette.js';
import { poly, ngon, bodyStyle } from '../core/draw.js';
import { EnemyBase } from './enemyBase.js';

export class BossBase extends EnemyBase {
  constructor(x, y, hp, radius, color, name, attacks) {
    super(x, y, hp, radius, color, name);
    this.attacks = attacks;
    this.state = 'idle'; this.stateTimer = rand(0.8, 1.4); this.currentAttack = null;
    this.spin = 0;
    this.sides = 8; // set per boss in bosses.js so each has its own silhouette
  }
  // Two counter-rotating armor rings around a core. The core opens up when exposed.
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.save(); ctx.rotate(this.spin * 0.25);
    poly(ngon(this.sides, r, Math.PI / this.sides), s.fill, s.stroke, 4);
    ctx.restore();
    ctx.save(); ctx.rotate(-this.spin * 0.4);
    poly(ngon(this.sides, r * 0.62), PAL.void, this.exposed ? PAL.amber : PAL.bone, 2);
    ctx.restore();
    const hot = this.state === 'telegraph';
    ctx.fillStyle = this.exposed ? PAL.amber : (hot ? PAL.red : PAL.redDim);
    const cr = r * (this.exposed ? 0.3 : 0.2) + Math.sin(this.spin * 6) * 1.5;
    ctx.beginPath(); ctx.arc(0, 0, cr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  pickAttack() {
    const total = this.attacks.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    for (const a of this.attacks) { r -= a.weight; if (r <= 0) return a; }
    return this.attacks[0];
  }
  update(dt, player) {
    super.update(dt, player);
    this.spin += dt;
    this.angle = angleTo(this, player);

    if (this.state === 'idle') {
      this.x += Math.cos(this.spin * 0.5) * 18 * dt;
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.currentAttack = this.pickAttack();
        this.state = 'telegraph'; this.stateTimer = this.currentAttack.telegraph;
        AudioSys.bossTelegraph();
      }
    } else if (this.state === 'telegraph') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'attack'; this.stateTimer = 0.08;
        this.currentAttack.execute(this, player);
      }
    } else if (this.state === 'attack') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) { this.state = 'idle'; this.stateTimer = rand(0.9, 1.6); }
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(14 * dt);
  }
  drawTelegraphRing() {
    if (this.state !== 'telegraph') return;
    const t = 1 - clamp(this.stateTimer / (this.currentAttack ? this.currentAttack.telegraph : 1), 0, 1);
    ctx.save(); ctx.strokeStyle = PAL.red; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 20);
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 14, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
}
