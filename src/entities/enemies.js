// Every "normal" enemy type lives here, each self-contained, plus the
// weighted spawn-table registration for it. To add a new enemy type:
// write a class extending EnemyBase, then call enemyTypeRegistry.register().
// Visual rule: matte body, red only on the part that hurts you, and the
// exposed state shown as anatomy (open plate, retracted barrel, venting core).
import { ctx } from '../core/canvas.js';
import { dist, angleTo, angleDiff, clamp, rand } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { Camera } from '../core/camera.js';
import { EventBus } from '../core/eventBus.js';
import { World } from '../core/world.js';
import { createRegistry } from '../core/registry.js';
import { PAL } from '../core/palette.js';
import { poly, ngon, bodyStyle } from '../core/draw.js';
import { spawnProjectile } from '../systems/projectiles.js';
import { burst } from '../systems/particles.js';
import { isStunned } from '../systems/status.js';
import { EnemyBase } from './enemyBase.js';

export const enemyTypeRegistry = createRegistry('enemyType');

function core(x, y, r, color = PAL.red) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// Skittering chevron swarm unit.
export class Drone extends EnemyBase {
  constructor(x, y, m) { super(x, y, 16 * m, 12, PAL.ash, 'Drone'); this.speed = rand(70, 95) * Math.min(1.6, m); this.contactDmg = 10; this.hitCd = 0; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt;
    if (this.hitCd > 0) this.hitCd -= dt;
    // Committing to a contact swing is its own opening.
    if (this.collidesWithPlayer(player) && this.hitCd <= 0) { player.takeDamage(this.contactDmg); this.hitCd = 0.6; this.expose(0.5); }
  }
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    poly([[r * 1.2, 0], [-r * 0.8, r * 0.95], [-r * 0.3, 0], [-r * 0.8, -r * 0.95]], s.fill, s.stroke, 2);
    core(r * 0.1, 0, 2.4);
    ctx.restore(); this.eliteRing();
  }
}

// Bolted-down gun. The barrel retracts while it is exposed.
export class Turret extends EnemyBase {
  constructor(x, y, m) { super(x, y, 24 * m, 15, PAL.ash, 'Turret'); this.fireCd = rand(0.5, 1.5); this.fireInterval = clamp(1.6 - m * 0.1, 0.6, 1.6); }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.fireInterval;
      spawnProjectile(this.x + Math.cos(this.angle) * (this.r + 4), this.y + Math.sin(this.angle) * (this.r + 4),
        this.angle, 220, 'enemy', 8, PAL.red, 0, 5);
      this.expose(0.4);
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(6 * dt);
  }
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y);
    poly(ngon(8, r, Math.PI / 8), s.fill, s.stroke, 2);
    ctx.rotate(this.angle);
    const len = this.exposed ? r * 0.7 : r + 9;
    ctx.fillStyle = this.hitFlash > 0 ? PAL.bone : PAL.ash; ctx.fillRect(0, -3, len, 6);
    if (this.fireCd < 0.3 && !this.exposed) core(len, 0, 2.6);
    core(0, 0, 3);
    ctx.restore(); this.eliteRing();
  }
}

// Fast dart that circles at range.
export class Hunter extends EnemyBase {
  constructor(x, y, m) { super(x, y, 20 * m, 11, PAL.ash, 'Hunter'); this.speed = rand(140, 170) * Math.min(1.7, m); this.strafeDir = Math.random() < 0.5 ? 1 : -1; this.strafeTimer = rand(0.5, 1.2); this.contactDmg = 8; this.hitCd = 0; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = rand(0.5, 1.2); this.expose(0.4); }
    const perp = this.angle + Math.PI / 2; const d = dist(this, player); const closeSpeed = d > 160 ? 1 : -0.3;
    this.x += Math.cos(this.angle) * this.speed * closeSpeed * dt + Math.cos(perp) * this.speed * 0.6 * this.strafeDir * dt;
    this.y += Math.sin(this.angle) * this.speed * closeSpeed * dt + Math.sin(perp) * this.speed * 0.6 * this.strafeDir * dt;
    if (this.hitCd > 0) this.hitCd -= dt;
    if (this.collidesWithPlayer(player) && this.hitCd <= 0) { player.takeDamage(this.contactDmg); this.hitCd = 0.5; }
  }
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    poly([[r * 1.7, 0], [r * 0.2, r * 0.45], [-r * 0.9, r * 1.0], [-r * 0.5, 0], [-r * 0.9, -r * 1.0], [r * 0.2, -r * 0.45]], s.fill, s.stroke, 2);
    core(r * 0.55, 0, 2);
    ctx.restore(); this.eliteRing();
  }
}

// Armored block with a rotating plate. Hit it from behind the plate.
export class Shielded extends EnemyBase {
  constructor(x, y, m) { super(x, y, 34 * m, 14, PAL.ash, 'Shielded'); this.shieldAngle = rand(0, Math.PI * 2); this.spin = rand(-0.6, 0.6); this.speed = 45 * m; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.shieldAngle += this.spin * dt;
    this.angle = angleTo(this, player);
    this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt;
    if (this.collidesWithPlayer(player)) player.takeDamage(7 * dt);
  }
  takeDamage(amount, crit) {
    const fromAngle = this._lastHitAngle != null ? this._lastHitAngle : this.angle;
    const diff = Math.abs(angleDiff(this.shieldAngle, fromAngle));
    const flanked = diff > (Math.PI * 0.62); // >~112deg counts as behind
    // A flanking hit is the exploit itself: it opens a window for follow-ups from anywhere.
    if (flanked && !this.exposed) this.expose(1.2);
    super.takeDamage(flanked ? amount : amount * 0.15, crit);
  }
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y);
    poly(ngon(8, r, Math.PI / 8), s.fill, s.stroke, 2);
    core(0, 0, 3);
    // Plate: heavy and bone while closed, thin and pushed out while exposed.
    ctx.strokeStyle = this.exposed ? PAL.amber : PAL.bone;
    ctx.lineWidth = this.exposed ? 2 : 6; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.arc(0, 0, r + (this.exposed ? 10 : 6), this.shieldAngle - 0.9, this.shieldAngle + 0.9); ctx.stroke();
    ctx.restore(); this.eliteRing();
  }
}

// Suicide bomber: the glowing fuse is both the threat and the exploit.
export class Bomber extends EnemyBase {
  constructor(x, y, m) { super(x, y, 14 * m, 11, PAL.ash, 'Bomber'); this.speed = rand(110, 140) * Math.min(1.6, m); this.armed = false; this.fuse = 0; this.exploded = false; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt;
    if (!this.armed && dist(this, player) < 70) { this.armed = true; this.fuse = 0.6; this.expose(0.6); }
    if (this.armed) {
      this.fuse -= dt;
      if (this.fuse <= 0) { this.explode(player); }
    }
  }
  explode(player) {
    if (this.exploded) return;
    this.exploded = true;
    this.dead = true;
    AudioSys.explode(); Camera.addShake(10); Camera.addPunch(0.04);
    burst(this.x, this.y, PAL.red, 20, 220, 0.5);
    if (player && dist(this, player) < 90) player.takeDamage(24);
    EventBus.emit('enemy:killed', { enemy: this, skipDrops: true, exploit: this.exposed });
  }
  // Overridden so death always routes through explode(), but it still applies the
  // exposed bonus and emits the damage number like every other enemy.
  takeDamage(amount, crit) {
    const wasExposed = this.exposed;
    const dealt = amount * (wasExposed ? this.exposeMult : 1);
    this.hp -= dealt; this.hitFlash = 0.1;
    burst(this.x, this.y, crit ? PAL.bone : this.color, crit ? 8 : 4, crit ? 120 : 80, 0.25);
    if (crit) Camera.addPunch(0.02);
    if (wasExposed) AudioSys.exploitHit();
    EventBus.emit('damage:dealt', { x: this.x, y: this.y, amount: dealt, crit, exploit: wasExposed });
    if (this.hp <= 0 && !this.exploded) this.explode(World.player);
  }
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    poly([[r * 1.1, -r * 0.7], [r * 1.1, r * 0.7], [-r * 1.0, r * 1.05], [-r * 1.0, -r * 1.05]], s.fill, s.stroke, 2);
    const flash = this.armed && Math.floor(this.fuse * 20) % 2 === 0;
    core(0, 0, this.armed ? 5 + Math.sin(this.fuse * 40) : 3.5, flash ? PAL.bone : PAL.red);
    ctx.restore(); this.eliteRing();
  }
}

// Long-range lock-on: red laser while it aims, and that aim is the opening.
export class SniperEnemy extends EnemyBase {
  constructor(x, y, m) { super(x, y, 20 * m, 13, PAL.ash, 'Sniper'); this.state = 'idle'; this.timer = rand(1, 2); this.lockAngle = 0; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.timer -= dt;
    if (this.state === 'idle' && this.timer <= 0) { this.state = 'telegraph'; this.timer = 0.7; this.lockAngle = this.angle; this.expose(0.7); AudioSys.bossTelegraph(); }
    else if (this.state === 'telegraph' && this.timer <= 0) {
      this.state = 'idle'; this.timer = rand(1.4, 2.2);
      spawnProjectile(this.x + Math.cos(this.lockAngle) * (this.r + 4), this.y + Math.sin(this.lockAngle) * (this.r + 4),
        this.lockAngle, 640, 'enemy', 16, PAL.red, 0, 5);
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(5 * dt);
  }
  draw() {
    const r = this.r, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.state === 'telegraph') {
      ctx.save(); ctx.rotate(this.lockAngle);
      ctx.strokeStyle = Math.floor(this.timer * 20) % 2 === 0 ? PAL.red : PAL.redDim;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.rotate(this.angle);
    ctx.strokeStyle = PAL.ash; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 2.3, 0); ctx.stroke();
    poly([[r * 1.2, 0], [-r, r * 0.75], [-r * 0.45, 0], [-r, -r * 0.75]], s.fill, s.stroke, 2);
    core(r * 0.2, 0, 2.2);
    ctx.restore(); this.eliteRing();
  }
}

// Keeps range and spawns Drones (via EventBus, so it never imports Game).
export class Summoner extends EnemyBase {
  constructor(x, y, m) { super(x, y, 26 * m, 13, PAL.ash, 'Summoner'); this.speed = 70; this.summonCd = rand(2, 3.5); }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    const d = dist(this, player);
    const dir = d < 220 ? -1 : (d > 320 ? 1 : 0);
    this.x += Math.cos(this.angle) * this.speed * dir * dt; this.y += Math.sin(this.angle) * this.speed * dir * dt;
    this.summonCd -= dt;
    if (this.summonCd <= 0 && World.enemies.filter(e => !e.dead).length < 26) {
      this.summonCd = rand(3, 4.5);
      const a = rand(0, Math.PI * 2);
      EventBus.emit('enemy:spawn', { enemy: new Drone(this.x + Math.cos(a) * 40, this.y + Math.sin(a) * 40, 1 + World.wave * 0.05) });
      burst(this.x, this.y, PAL.ash, 8, 100, 0.3);
      this.expose(1.0);
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(5 * dt);
  }
  draw() {
    const r = this.r, w = r * 0.38, s = bodyStyle(this);
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(performance.now() / 1800);
    poly([[w, -r], [w, -w], [r, -w], [r, w], [w, w], [w, r], [-w, r], [-w, w], [-r, w], [-r, -w], [-w, -w], [-w, -r]], s.fill, s.stroke, 2);
    core(0, 0, this.exposed ? 5 : 3);
    ctx.restore(); this.eliteRing();
  }
}

enemyTypeRegistry.register('drone', { cls: Drone, weight: 30, minWave: 1 });
enemyTypeRegistry.register('turret', { cls: Turret, weight: 14, minWave: 1 });
enemyTypeRegistry.register('hunter', { cls: Hunter, weight: 20, minWave: 2 });
enemyTypeRegistry.register('shielded', { cls: Shielded, weight: 12, minWave: 3 });
enemyTypeRegistry.register('bomber', { cls: Bomber, weight: 14, minWave: 3 });
enemyTypeRegistry.register('sniper', { cls: SniperEnemy, weight: 12, minWave: 4 });
enemyTypeRegistry.register('summoner', { cls: Summoner, weight: 8, minWave: 5 });
