// Boss factories + the wave→boss registry. To add a new boss: write a
// makeXxx(wave) factory that builds a BossBase with an attack list (and
// optionally wraps .update for bespoke behavior, as all three below do),
// then register it against the wave it should appear on.
import { W, H } from '../core/canvas.js';
import { angleTo, clamp, rand } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { EventBus } from '../core/eventBus.js';
import { createRegistry } from '../core/registry.js';
import { spawnProjectile } from '../systems/projectiles.js';
import { BossBase } from './bossBase.js';
import { Shielded } from './enemies.js';

export const bossRegistry = createRegistry('boss');

function makeMainframeGuardian(wave) {
  const hpScale = 1 + (wave / 5 - 1) * 0.6;
  const attacks = [
    { name: 'spread', weight: 3, telegraph: 0.7, execute: (b) => {
      const n = 10; for (let i = 0; i < n; i++) { const a = (Math.PI * 2 / n) * i + b.spin; spawnProjectile(b.x, b.y, a, 180, 'enemy', 10, '#f33', 0, 6); }
    } },
    { name: 'charge', weight: 2, telegraph: 0.6, execute: (b, player) => {
      const a = angleTo(b, player); b.chargeVx = Math.cos(a) * 700; b.chargeVy = Math.sin(a) * 700; b.charging = 0.35;
    } },
  ];
  const boss = new BossBase(W / 2, H / 2 - 150, 420 * hpScale, 40, '#f33', 'Mainframe Guardian', attacks);
  const baseUpdate = boss.update.bind(boss);
  boss.update = function (dt, player) {
    if (this.charging > 0) {
      this.charging -= dt;
      this.x += this.chargeVx * dt; this.y += this.chargeVy * dt;
      this.x = clamp(this.x, this.r, W - this.r); this.y = clamp(this.y, this.r, H - this.r);
      if (this.hitFlash > 0) this.hitFlash -= dt;
      // the charge is the boss's signature telegraphed attack — it must be able to hit you
      if (this.collidesWithPlayer(player)) player.takeDamage(28 * dt * 6);
      if (this.charging <= 0) this.expose(1.0); // recovery lag right after the charge ends
    } else baseUpdate(dt, player);
  };
  return boss;
}

function makeFirewallSentinel(wave) {
  const hpScale = 1 + (wave / 5 - 1) * 0.6;
  const attacks = [
    { name: 'sweep', weight: 3, telegraph: 0.8, execute: (b) => {
      b.sweepAngle = b.angle - 1.2; b.sweeping = 1.0;
    } },
    { name: 'summon', weight: 2, telegraph: 0.5, execute: (b) => {
      for (let i = 0; i < 2; i++) { const a = rand(0, Math.PI * 2); EventBus.emit('enemy:spawn', { enemy: new Shielded(b.x + Math.cos(a) * 70, b.y + Math.sin(a) * 70, 1 + b._wave * 0.04) }); }
      b.expose(1.2); // vulnerable right after summoning
    } },
  ];
  const boss = new BossBase(W / 2, H / 2 - 150, 520 * hpScale, 42, '#0af', 'Firewall Sentinel', attacks);
  boss._wave = wave;
  const baseUpdate = boss.update.bind(boss);
  boss.update = function (dt, player) {
    baseUpdate(dt, player);
    if (this.sweeping > 0) {
      this.sweeping -= dt * 0.6;
      this.sweepAngle += dt * 2.4;
      const nx = this.x + Math.cos(this.sweepAngle) * (this.r + 4), ny = this.y + Math.sin(this.sweepAngle) * (this.r + 4);
      if (Math.random() < 0.5) spawnProjectile(nx, ny, this.sweepAngle, 260, 'enemy', 10, '#0af', 0, 5);
    }
  };
  return boss;
}

function makeRootDaemon(wave) {
  const hpScale = 1 + (wave / 5 - 1) * 0.6;
  const attacks = [
    { name: 'spread2', weight: 3, telegraph: 0.6, execute: (b) => {
      const n = 14; for (let i = 0; i < n; i++) { const a = (Math.PI * 2 / n) * i - b.spin * 0.5; spawnProjectile(b.x, b.y, a, 200, 'enemy', 12, '#f0f', 0, 6); }
    } },
    { name: 'homing', weight: 2, telegraph: 0.7, execute: (b, player) => {
      for (let i = 0; i < 3; i++) { const a = angleTo(b, player) + rand(-0.4, 0.4); const pr = spawnProjectile(b.x, b.y, a, 240, 'enemy', 14, '#fff', 0, 6); pr.homing = true; }
    } },
    { name: 'enrage', weight: 1, telegraph: 0.9, execute: (b) => {
      b.enraged = true; b.enrageTimer = 4; AudioSys.explode();
    } },
  ];
  const boss = new BossBase(W / 2, H / 2 - 150, 700 * hpScale, 46, '#f0f', 'Root Daemon', attacks);
  const baseUpdate = boss.update.bind(boss);
  boss.update = function (dt, player) {
    if (this.enrageTimer > 0) {
      this.enrageTimer -= dt; this.speedBoost = 1.6;
      if (this.enrageTimer <= 0) { this.enraged = false; this.speedBoost = 1; this.expose(1.0); }
    }
    baseUpdate(dt, player);
  };
  return boss;
}

bossRegistry.register('5', { wave: 5, factory: makeMainframeGuardian });
bossRegistry.register('10', { wave: 10, factory: makeFirewallSentinel });
bossRegistry.register('15', { wave: 15, factory: makeRootDaemon });

export function getBossFactoryForWave(wave) {
  const entry = bossRegistry.list().find(b => b.wave === wave);
  return entry ? entry.factory : null;
}
export function isBossWave(wave) {
  return bossRegistry.list().some(b => b.wave === wave);
}
