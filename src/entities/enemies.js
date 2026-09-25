// Every "normal" enemy type lives here, each self-contained, plus the
// weighted spawn-table registration for it. To add a new enemy type:
// write a class extending EnemyBase, then call enemyTypeRegistry.register()
// at the bottom of this file (or in its own file imported from main.js) —
// nothing in game.js needs to change.
import { ctx } from '../core/canvas.js';
import { dist, angleTo, angleDiff, clamp, rand } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { Camera } from '../core/camera.js';
import { EventBus } from '../core/eventBus.js';
import { World } from '../core/world.js';
import { createRegistry } from '../core/registry.js';
import { spawnProjectile } from '../systems/projectiles.js';
import { burst } from '../systems/particles.js';
import { isStunned } from '../systems/status.js';
import { EnemyBase } from './enemyBase.js';

export const enemyTypeRegistry = createRegistry('enemyType');

export class Drone extends EnemyBase {
  constructor(x, y, m) { super(x, y, 16 * m, 12, '#f33', 'Drone'); this.speed = rand(70, 95) * Math.min(1.6, m); this.contactDmg = 10; this.hitCd = 0; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt;
    if (this.hitCd > 0) this.hitCd -= dt;
    // Committing to a contact swing is its own opening — the exploit here
    // rewards punishing a Drone right as it hits you, not just kiting it.
    if (this.collidesWithPlayer(player) && this.hitCd <= 0) { player.takeDamage(this.contactDmg); this.hitCd = 0.6; this.expose(0.5); }
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 10; ctx.shadowColor = '#f33';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.hitFlash > 0 ? '#fff' : '#f33');
    ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2);
    ctx.restore(); this.eliteRing();
  }
}

export class Turret extends EnemyBase {
  constructor(x, y, m) { super(x, y, 24 * m, 15, '#f90', 'Turret'); this.fireCd = rand(0.5, 1.5); this.fireInterval = clamp(1.6 - m * 0.1, 0.6, 1.6); }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = this.fireInterval;
      spawnProjectile(this.x + Math.cos(this.angle) * (this.r + 4), this.y + Math.sin(this.angle) * (this.r + 4),
        this.angle, 220, 'enemy', 8, '#f90', 0, 5);
      this.expose(0.4); // recoil/cycling lag right after firing
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(6 * dt);
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 10; ctx.shadowColor = '#f90';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.hitFlash > 0 ? '#fff' : '#f90');
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; const px = Math.cos(a) * this.r, py = Math.sin(a) * this.r; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.restore(); this.eliteRing();
  }
}

export class Hunter extends EnemyBase {
  constructor(x, y, m) { super(x, y, 20 * m, 11, '#a0f', 'Hunter'); this.speed = rand(140, 170) * Math.min(1.7, m); this.strafeDir = Math.random() < 0.5 ? 1 : -1; this.strafeTimer = rand(0.5, 1.2); this.contactDmg = 8; this.hitCd = 0; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.strafeTimer -= dt;
    // Committing to a new strafe direction is the read — punish the flip.
    if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = rand(0.5, 1.2); this.expose(0.4); }
    const perp = this.angle + Math.PI / 2; const d = dist(this, player); const closeSpeed = d > 160 ? 1 : -0.3;
    this.x += Math.cos(this.angle) * this.speed * closeSpeed * dt + Math.cos(perp) * this.speed * 0.6 * this.strafeDir * dt;
    this.y += Math.sin(this.angle) * this.speed * closeSpeed * dt + Math.sin(perp) * this.speed * 0.6 * this.strafeDir * dt;
    if (this.hitCd > 0) this.hitCd -= dt;
    if (this.collidesWithPlayer(player) && this.hitCd <= 0) { player.takeDamage(this.contactDmg); this.hitCd = 0.5; }
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 10; ctx.shadowColor = '#a0f';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.hitFlash > 0 ? '#fff' : '#a0f');
    ctx.beginPath(); ctx.moveTo(this.r, 0); ctx.lineTo(0, this.r); ctx.lineTo(-this.r, 0); ctx.lineTo(0, -this.r);
    ctx.closePath(); ctx.fill(); ctx.restore(); this.eliteRing();
  }
}

// Shielded: must be flanked — shield facing rotates slowly, full dmg only from behind it
export class Shielded extends EnemyBase {
  constructor(x, y, m) { super(x, y, 34 * m, 14, '#3cf', 'Shielded'); this.shieldAngle = rand(0, Math.PI * 2); this.spin = rand(-0.6, 0.6); this.speed = 45 * m; }
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
    // A flanking hit is the exploit itself: it opens a window so a follow-up
    // shot from anywhere still gets the exposed bonus, not just a lone flank hit.
    if (flanked && !this.exposed) this.expose(1.2);
    super.takeDamage(flanked ? amount : amount * 0.15, crit);
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 10; ctx.shadowColor = '#3cf';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.hitFlash > 0 ? '#fff' : '#3cf');
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9ef'; ctx.lineWidth = 4; ctx.shadowBlur = 12; ctx.shadowColor = '#9ef';
    ctx.beginPath(); ctx.arc(0, 0, this.r + 6, this.shieldAngle - 0.9, this.shieldAngle + 0.9); ctx.stroke();
    ctx.restore(); this.eliteRing();
  }
}

// Suicide bomber: chases, explodes on contact or death, telegraphs briefly first
export class Bomber extends EnemyBase {
  constructor(x, y, m) { super(x, y, 14 * m, 11, '#f66', 'Bomber'); this.speed = rand(110, 140) * Math.min(1.6, m); this.armed = false; this.fuse = 0; this.exploded = false; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt;
    // The fuse window IS the exploit: the same moment that makes it lethal
    // is the moment it's worth committing a shot to kill it before it goes off.
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
    burst(this.x, this.y, '#f66', 20, 220, 0.5);
    if (player && dist(this, player) < 90) player.takeDamage(24);
    EventBus.emit('enemy:killed', { enemy: this, skipDrops: true, exploit: this.exposed });
  }
  // Gunfire kill: still explode (with damage/fx) instead of silently no-opping.
  // Overridden (not just EnemyBase.takeDamage) so death always routes through
  // explode() — but it still needs the same exposed-bonus/damage-number
  // behavior every other enemy gets, since the whole point of this enemy is
  // "hit it while armed for the exploit bonus."
  takeDamage(amount, crit) {
    const wasExposed = this.exposed;
    const dealt = amount * (wasExposed ? this.exposeMult : 1);
    this.hp -= dealt; this.hitFlash = 0.1;
    burst(this.x, this.y, crit ? '#fff' : this.color, crit ? 8 : 4, crit ? 120 : 80, 0.25);
    if (crit) Camera.addPunch(0.02);
    if (wasExposed) AudioSys.exploitHit();
    EventBus.emit('damage:dealt', { x: this.x, y: this.y, amount: dealt, crit, exploit: wasExposed });
    if (this.hp <= 0 && !this.exploded) this.explode(World.player);
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y);
    const pulse = this.armed ? (1 + Math.sin(this.fuse * 40) * 0.15) : 1;
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = this.armed ? 22 : 10; ctx.shadowColor = this.armed ? '#fff' : '#f66';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.armed && Math.floor(this.fuse * 20) % 2 === 0 ? '#fff' : '#f66');
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = Math.PI * 2 / 3 * i - Math.PI / 2; const px = Math.cos(a) * this.r, py = Math.sin(a) * this.r; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.restore(); this.eliteRing();
  }
}

// Sniper: telegraphs a laser line, then fires a fast shot along it
export class SniperEnemy extends EnemyBase {
  constructor(x, y, m) { super(x, y, 20 * m, 13, '#0f6', 'Sniper'); this.state = 'idle'; this.timer = rand(1, 2); this.lockAngle = 0; }
  update(dt, player) {
    super.update(dt, player);
    if (isStunned(this)) return;
    this.angle = angleTo(this, player);
    this.timer -= dt;
    if (this.state === 'idle' && this.timer <= 0) { this.state = 'telegraph'; this.timer = 0.7; this.lockAngle = this.angle; this.expose(0.7); AudioSys.bossTelegraph(); }
    else if (this.state === 'telegraph' && this.timer <= 0) {
      this.state = 'idle'; this.timer = rand(1.4, 2.2);
      spawnProjectile(this.x + Math.cos(this.lockAngle) * (this.r + 4), this.y + Math.sin(this.lockAngle) * (this.r + 4),
        this.lockAngle, 640, 'enemy', 16, '#0f6', 0, 5);
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(5 * dt);
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.state === 'telegraph') {
      ctx.save(); ctx.rotate(this.lockAngle);
      ctx.strokeStyle = Math.floor(this.timer * 20) % 2 === 0 ? 'rgba(255,80,80,0.7)' : 'rgba(255,80,80,0.25)';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 10; ctx.shadowColor = '#0f6';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.hitFlash > 0 ? '#fff' : '#0f6');
    ctx.beginPath(); ctx.moveTo(0, -this.r); ctx.lineTo(this.r, this.r); ctx.lineTo(-this.r, this.r); ctx.closePath(); ctx.fill();
    ctx.restore(); this.eliteRing();
  }
}

// Summoner: keeps range, periodically spawns Drones (via EventBus, so it never
// needs a direct reference to the Game singleton), flees when close
export class Summoner extends EnemyBase {
  constructor(x, y, m) { super(x, y, 26 * m, 13, '#fc0', 'Summoner'); this.speed = 70; this.summonCd = rand(2, 3.5); }
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
      burst(this.x, this.y, '#fc0', 8, 100, 0.3);
      this.expose(1.0); // channeling the summon is the opening
    }
    if (this.collidesWithPlayer(player)) player.takeDamage(5 * dt);
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowBlur = this.hitFlash > 0 ? 25 : 10; ctx.shadowColor = '#fc0';
    ctx.fillStyle = isStunned(this) ? '#88f' : (this.hitFlash > 0 ? '#fff' : '#fc0');
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = Math.PI * 2 / 5 * i - Math.PI / 2; const rad = i % 2 === 0 ? this.r : this.r * 0.5; const px = Math.cos(a) * rad, py = Math.sin(a) * rad; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.restore(); this.eliteRing();
  }
}

enemyTypeRegistry.register('drone', { cls: Drone, weight: 30, minWave: 1 });
enemyTypeRegistry.register('turret', { cls: Turret, weight: 14, minWave: 1 });
enemyTypeRegistry.register('hunter', { cls: Hunter, weight: 20, minWave: 2 });
enemyTypeRegistry.register('shielded', { cls: Shielded, weight: 12, minWave: 3 });
enemyTypeRegistry.register('bomber', { cls: Bomber, weight: 14, minWave: 3 });
enemyTypeRegistry.register('sniper', { cls: SniperEnemy, weight: 12, minWave: 4 });
enemyTypeRegistry.register('summoner', { cls: Summoner, weight: 8, minWave: 5 });
