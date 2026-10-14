import { ctx } from '../core/canvas.js';
import { dist, choice } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { Camera } from '../core/camera.js';
import { EventBus } from '../core/eventBus.js';
import { World } from '../core/world.js';
import { PAL } from '../core/palette.js';
import { burst } from '../systems/particles.js';
import { updateStatus } from '../systems/status.js';

export const ELITE_TRAITS = ['fast', 'explosive', 'regen'];

export class EnemyBase {
  constructor(x, y, hp, radius, color, name) {
    this.x = x; this.y = y; this.hp = hp; this.maxHp = hp; this.r = radius; this.color = color; this.name = name;
    this.dead = false; this.angle = 0; this.hitFlash = 0; this.elite = false; this.trait = null;
    this.status = {};
    // Exploit system: any enemy can be pushed into a brief "exposed" window
    // (per-type trigger conditions live in each subclass/boss factory) during
    // which it takes bonus damage. Centralized here so the bonus applies
    // uniformly regardless of what triggered it.
    this.exposed = false; this.exposeTimer = 0; this.exposeMult = 1.6;
  }
  makeElite() {
    this.elite = true;
    this.trait = choice(ELITE_TRAITS);
    this.hp *= 2.2; this.maxHp = this.hp; this.r *= 1.25;
    if (this.trait === 'fast' && this.speed) this.speed *= 1.6;
  }
  expose(duration = 1.0, mult = 1.6) {
    const durMult = (World.player && World.player.exposeDurationMult) || 1;
    this.exposeTimer = Math.max(this.exposeTimer, duration * durMult);
    this.exposeMult = mult;
    if (!this.exposed) {
      this.exposed = true;
      AudioSys.exploitPing();
      burst(this.x, this.y, PAL.amber, 10, 100, 0.35);
      EventBus.emit('enemy:exposed', { enemy: this });
    }
  }
  takeDamage(amount, crit, fromStatus) {
    const wasExposed = this.exposed;
    const dealt = amount * (wasExposed ? this.exposeMult : 1);
    this.hp -= dealt;
    this.hitFlash = 0.1;
    burst(this.x, this.y, crit ? PAL.bone : this.color, crit ? 8 : 4, crit ? 120 : 80, 0.25);
    if (crit) Camera.addPunch(0.02);
    if (wasExposed) AudioSys.exploitHit();
    EventBus.emit('damage:dealt', { x: this.x, y: this.y, amount: dealt, crit, exploit: wasExposed });
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      if (this.elite && this.trait === 'explosive' && World.player) {
        AudioSys.explode(); burst(this.x, this.y, PAL.red, 16, 200, 0.5);
        if (dist(this, World.player) < 80) World.player.takeDamage(15);
      }
      EventBus.emit('enemy:killed', { enemy: this, exploit: wasExposed });
    }
  }
  update(dt, player) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.elite && this.trait === 'regen' && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03 * dt);
    if (this.exposeTimer > 0) { this.exposeTimer -= dt; if (this.exposeTimer <= 0) this.exposed = false; }
    updateStatus(this, dt);
  }
  draw() {}
  collidesWithPlayer(player) { return dist(this, player) < this.r + player.r; }
  eliteRing() {
    if (!this.elite) return;
    ctx.save(); ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  // Kinetic exploit telegraph: a pulsing bone-white wireframe bracket, drawn
  // uniformly for every enemy type (and bosses) from Game.draw() rather than
  // from each subclass's own draw(), so new enemy types get this for free.
  drawExploitTelegraph() {
    if (!this.exposed) return;
    const t = performance.now() / 1000;
    const pulse = 0.55 + Math.sin(t * 14) * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.12 + pulse * 0.1;
    ctx.fillStyle = PAL.amber;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = PAL.bone;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10; ctx.shadowColor = PAL.amber;
    const s = this.r + 9, b = 7;
    const corners = [[-s, -s, 1, 1], [s, -s, -1, 1], [-s, s, 1, -1], [s, s, -1, -1]];
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of corners) {
      ctx.moveTo(this.x + cx, this.y + cy + dy * b);
      ctx.lineTo(this.x + cx, this.y + cy);
      ctx.lineTo(this.x + cx + dx * b, this.y + cy);
    }
    ctx.stroke();
    ctx.restore();
  }
}
