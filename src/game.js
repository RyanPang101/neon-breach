// The state machine — orchestrates a run, but knows nothing about DOM
// overlays (see ui.js) and holds no hardcoded content tables (see content/).
// It listens on EventBus for facts emitted by entities/systems rather than
// those modules calling back into Game directly.
import { ctx, W, H } from './core/canvas.js';
import { CONFIG } from './config.js';
import { Save } from './core/save.js';
import { AudioSys } from './core/audio.js';
import { Camera } from './core/camera.js';
import { EventBus } from './core/eventBus.js';
import { World } from './core/world.js';
import { clamp, rand, angleTo, angleDiff, dist } from './core/utils.js';

import { updateParticles, drawParticles, clearParticles, burst } from './systems/particles.js';
import { updateProjectiles, drawProjectiles, clearProjectiles, getActiveProjectiles } from './systems/projectiles.js';
import { applyStatus } from './systems/status.js';
import { Pickup } from './systems/pickups.js';
import { updateDamageNumbers, drawDamageNumbers, clearDamageNumbers } from './systems/damageNumbers.js';

import { Player } from './entities/player.js';
import { Turret, Shielded, enemyTypeRegistry } from './entities/enemies.js';
import { BossBase } from './entities/bossBase.js';
import { getBossFactoryForWave, isBossWave } from './entities/bosses.js';

import { loadoutRegistry } from './content/loadouts.js';
import { upgradeRegistry } from './content/upgrades.js';

function pickUpgrades(n) {
  const pool = [...upgradeRegistry.list()];
  const chosen = [];
  for (let i = 0; i < n && pool.length; i++) { const idx = Math.floor(Math.random() * pool.length); chosen.push(pool.splice(idx, 1)[0]); }
  return chosen;
}

export const Game = {
  state: 'title', // title, loadoutselect, safehouse, playing, paused, levelup, shop, gameover, win
  player: null,
  enemyPool: [],
  pickups: [],
  wave: 0, spawnQueue: [], spawnTimer: 0, bossActive: false,
  runShardsEarned: 0, selectedLoadout: null,
  lastTime: 0, lastCoresEarned: 0,
  waveClearedHandled: false, bossJustDefeated: false,
  overloadFlash: 0,
  _loadoutPick: null,

  init(loadoutId) {
    const loadout = loadoutRegistry.get(loadoutId) || loadoutRegistry.list()[0];
    this.selectedLoadout = loadout;
    this.player = new Player(loadout, Save.data.perks);
    World.player = this.player;
    this.enemyPool = [];
    this.pickups = [];
    clearParticles();
    clearProjectiles();
    clearDamageNumbers();
    this.wave = 0; this.bossActive = false; this.runShardsEarned = 0;
    this.waveClearedHandled = false; this.bossJustDefeated = false;
    this.overloadFlash = 0;
    Camera.shake = 0; Camera.punch = 0;
    this.startNextWave();
  },

  startNextWave() {
    this.waveClearedHandled = false;
    this.bossJustDefeated = false;
    this.wave++;
    World.wave = this.wave;
    AudioSys.setTension(this.bossWaveNow() ? 1 : 0);
    const bossFactory = getBossFactoryForWave(this.wave);
    if (bossFactory) {
      this.bossActive = true;
      this.spawnEnemyObj(bossFactory(this.wave));
    } else {
      this.bossActive = false;
      const waveMult = 1 + this.wave * 0.11;
      const count = 4 + this.wave * 2;
      const eliteChance = clamp(0.04 + this.wave * 0.01, 0, 0.25);
      this.spawnQueue = [];
      for (let i = 0; i < count; i++) {
        const options = enemyTypeRegistry.list().filter(e => e.minWave <= this.wave);
        const total = options.reduce((s, o) => s + o.weight, 0);
        let r = Math.random() * total; let picked = options[0];
        for (const o of options) { r -= o.weight; if (r <= 0) { picked = o; break; } }
        this.spawnQueue.push({ cls: picked.cls, waveMult, elite: Math.random() < eliteChance });
      }
      this.spawnTimer = 0;
    }
  },
  bossWaveNow() { return isBossWave(this.wave); },

  spawnEnemyObj(e) { this.enemyPool.push(e); return e; },
  spawnQueued(entry) {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = rand(0, W); y = -30; } else if (edge === 1) { x = W + 30; y = rand(0, H); }
    else if (edge === 2) { x = rand(0, W); y = H + 30; } else { x = -30; y = rand(0, H); }
    const e = new entry.cls(x, y, entry.waveMult);
    if (entry.elite) e.makeElite();
    this.spawnEnemyObj(e);
  },

  onEnemyKilled({ enemy, skipDrops, exploit }) {
    burst(enemy.x, enemy.y, enemy.color, 14, 160, 0.5);
    Camera.addShake(enemy instanceof BossBase ? 16 : 3);
    if (enemy instanceof BossBase) Camera.addHitstop(0.12);
    if (exploit && this.player) {
      // Chain Exploit: refund Overload cooldown on an exploit kill.
      if (this.player.overloadRefund) this.player.overloadCooldownTimer = Math.max(0, this.player.overloadCooldownTimer - this.player.overloadRefund);
      // Cascade Protocol: a chance to force-expose the nearest other enemy.
      if (this.player.cascadeChance && Math.random() < this.player.cascadeChance) {
        let nearest = null, nearestDist = Infinity;
        for (const e of this.enemyPool) {
          if (e.dead || e === enemy) continue;
          const d = dist(enemy, e);
          if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        if (nearest && nearestDist < 220) nearest.expose(1.0);
      }
    }
    const shardMult = 1 + Save.perkLevel('perm_shards') * 0.15;
    if (!skipDrops) {
      const xpVal = enemy instanceof BossBase ? 120 : (enemy.elite ? 22 : (enemy instanceof Turret || enemy instanceof Shielded ? 12 : 8));
      this.pickups.push(new Pickup(enemy.x, enemy.y, 'xp', xpVal));
      if (Math.random() < 0.5 || enemy instanceof BossBase || enemy.elite) {
        const base = enemy instanceof BossBase ? 60 : (enemy.elite ? 10 : (rand(1, 4) | 0));
        this.pickups.push(new Pickup(enemy.x + rand(-10, 10), enemy.y + rand(-10, 10), 'shard', Math.round(base * shardMult)));
      }
    }
    if (enemy instanceof BossBase) {
      AudioSys.bossDefeat(); AudioSys.setTension(0);
      if (this.wave >= CONFIG.finalWave) { this.state = 'win'; this.onWin(); return; }
      // Flag it rather than using a setTimeout: a timer here used to race against
      // the per-frame wave-clear check below, which would already start spawning
      // the next wave before the shop had a chance to open. handleWaveClear()
      // reads this flag the moment the wave is actually detected as cleared.
      this.bossJustDefeated = true;
    }
  },

  onPlayerDeath() {
    setTimeout(() => { this.state = 'gameover'; this.finishRun(); EventBus.emit('ui:showGameOver'); }, 450);
  },
  onWin() {
    this.finishRun();
    EventBus.emit('ui:showWin');
  },
  finishRun() {
    const cores = Math.round(this.runShardsEarned * 0.4 + this.wave * 3);
    Save.data.cores += cores;
    Save.data.bestWave = Math.max(Save.data.bestWave, this.wave);
    Save.data.runsPlayed++;
    Save.save();
    this.lastCoresEarned = cores;
  },

  requestLevelUp() {
    if (this.state !== 'playing') return;
    this.state = 'levelup';
    AudioSys.levelUp();
    const n = 3 + (this.player.bonusUpgradeChoice > 0 ? 1 : 0);
    if (this.player.bonusUpgradeChoice > 0) this.player.bonusUpgradeChoice--;
    const choices = pickUpgrades(n);
    EventBus.emit('ui:showLevelUp', { level: this.player.level, choices });
  },
  applyUpgrade(upgrade) {
    upgrade.apply(this.player);
    this.state = 'playing';
  },

  openShop() {
    this.state = 'shop';
    EventBus.emit('ui:showShop');
  },
  closeShop() {
    this.state = 'playing';
    EventBus.emit('ui:hideShop');
    // Opening the shop always meant "we deliberately deferred the wave advance"
    // (see handleWaveClear) — so closing it must be the thing that resumes progress.
    this.startNextWave();
  },

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; EventBus.emit('ui:showPause'); }
    else if (this.state === 'paused') { this.state = 'playing'; EventBus.emit('ui:hidePause'); }
  },

  update(dt) {
    Camera.update(dt);
    if (this.overloadFlash > 0) this.overloadFlash -= dt;
    if (Camera.hitstop > 0) return; // brief freeze-frame on big hits
    if (this.state !== 'playing') return;
    World.enemies = this.enemyPool;
    this.player.update(dt);

    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { const e = this.spawnQueue.pop(); this.spawnQueued(e); this.spawnTimer = 0.45; }
    }

    for (const e of this.enemyPool) if (!e.dead) e.update(dt, this.player);
    this.enemyPool = this.enemyPool.filter(e => !e.dead);
    World.enemies = this.enemyPool;

    updateProjectiles(dt);
    // homing steer
    for (const pr of getActiveProjectiles()) {
      if (pr.dead || !pr.homing) continue;
      const a = angleTo(pr, this.player);
      const curA = Math.atan2(pr.vy, pr.vx);
      const d = angleDiff(curA, a);
      const newA = curA + clamp(d, -3 * dt, 3 * dt);
      const spd = Math.hypot(pr.vx, pr.vy);
      pr.vx = Math.cos(newA) * spd; pr.vy = Math.sin(newA) * spd;
    }
    // collisions
    for (const pr of getActiveProjectiles()) {
      if (pr.dead) continue;
      if (pr.owner === 'player') {
        for (const e of this.enemyPool) {
          if (e.dead || pr.hitSet.has(e)) continue;
          if (dist(pr, e) < pr.radius + e.r) {
            e._lastHitAngle = angleTo(e, pr);
            // Zero-Day Exploit upgrade: bonus damage against an already-exposed
            // target, stacked on top of the flat exposed multiplier EnemyBase applies.
            const dmg = e.exposed ? pr.dmg * (this.player.exploitDmgMult || 1) : pr.dmg;
            e.takeDamage(dmg, pr.crit);
            if (pr.effect === 'stun') applyStatus(e, 'stun');
            if (pr.effect === 'virus') applyStatus(e, 'virus');
            if (this.player.lifesteal > 0) this.player.heal(dmg * this.player.lifesteal);
            pr.hitSet.add(e);
            if (pr.pierce <= 0) { pr.dead = true; break; }
            pr.pierce -= 1;
          }
        }
      } else if (pr.owner === 'enemy') {
        if (dist(pr, this.player) < pr.radius + this.player.r) { this.player.takeDamage(pr.dmg); pr.dead = true; }
      }
    }

    // Overload "turn hostile" tick: an enemy caught in an Overload blast
    // periodically damages OTHER nearby enemies for a short window.
    for (const e of this.enemyPool) {
      if (e.dead || !(e._overloadHostile > 0)) continue;
      e._overloadHostile -= dt;
      e._overloadTick = (e._overloadTick || 0) - dt;
      if (e._overloadTick <= 0) {
        e._overloadTick = 0.25;
        for (const other of this.enemyPool) {
          if (other === e || other.dead) continue;
          if (dist(e, other) < 55) other.takeDamage(other.maxHp * 0.08, false);
        }
      }
    }

    for (const p of this.pickups) p.update(dt, this.player);
    this.pickups = this.pickups.filter(p => !p.dead);

    updateParticles(dt);
    updateDamageNumbers(dt);

    // Guarded with waveClearedHandled so this can only fire once per clear —
    // previously it re-fired every frame the shop was open (since the wave
    // number never changed), which reopened the shop the instant you closed
    // it via "Continue Breach", permanently soft-locking the run.
    if (!this.waveClearedHandled && this.spawnQueue.length === 0 && this.enemyPool.every(e => e.dead) && this.state === 'playing') {
      this.waveClearedHandled = true;
      this.bossActive = false;
      this.handleWaveClear();
    }
  },

  // Single source of truth for "what happens when a wave finishes clearing" —
  // called at most once per clear, whether it ended in a boss kill or not.
  handleWaveClear() {
    const openShopNow = this.bossJustDefeated || (this.wave % 3 === 0 && !getBossFactoryForWave(this.wave + 1));
    this.bossJustDefeated = false;
    if (openShopNow) this.openShop();
    else this.startNextWave();
  },

  draw() {
    ctx.save();
    Camera.apply();
    ctx.fillStyle = '#040408'; ctx.fillRect(-40, -40, W + 80, H + 80);
    // parallax grid + faint skyline
    const t = performance.now() / 1000;
    ctx.strokeStyle = 'rgba(0,255,255,0.05)'; ctx.lineWidth = 1;
    const offset = (t * 8) % 40;
    for (let x = -40 + offset; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(160,0,255,0.05)';
    for (let i = 0; i < 8; i++) { const bw = 60; const bx = (i * 140 - (t * 6) % 140); ctx.fillRect(bx, H - 100 - ((i * 37) % 80), bw, 200); }

    for (const p of this.pickups) p.draw();
    for (const e of this.enemyPool) { if (e instanceof BossBase) e.drawTelegraphRing(); e.draw(); e.drawExploitTelegraph(); }
    drawProjectiles();
    drawParticles();
    if (this.player && this.player.alive) { this.player.draw(); this.drawPlayerHud(); }
    drawDamageNumbers();

    // vignette
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad; ctx.fillRect(-40, -40, W + 80, H + 80);

    ctx.restore();
    this.drawUI();
    this.drawOverloadFlash();
  },

  // Kinetic "eye-line" HUD: HP and both ability cooldowns cluster right
  // below the player instead of screen corners, since looking away from
  // your character to check a cooldown is how you die in this game.
  drawPlayerHud() {
    const p = this.player;
    const cx = p.x, cy = p.y + 26;
    ctx.save();
    ctx.translate(cx, cy);
    const w = 42, h = 5;
    ctx.fillStyle = 'rgba(20,0,10,0.75)'; ctx.fillRect(-w / 2, 0, w, h);
    ctx.fillStyle = p.hp / p.maxHp < 0.3 ? '#f33' : '#0ff';
    ctx.fillRect(-w / 2, 0, w * clamp(p.hp / p.maxHp, 0, 1), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(-w / 2, 0, w, h);

    const pip = (dx, ready, color) => {
      ctx.beginPath(); ctx.arc(dx, h + 9, 5, 0, Math.PI * 2);
      ctx.fillStyle = ready ? color : 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.shadowBlur = ready ? 8 : 0; ctx.shadowColor = color; ctx.stroke();
    };
    pip(-9, p.dashCooldownTimer <= 0, '#0ff');
    pip(9, p.overloadCooldownTimer <= 0, '#ff2d4d');
    ctx.restore();
  },

  drawOverloadFlash() {
    if (this.overloadFlash <= 0) return;
    const t = clamp(this.overloadFlash / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha = t * 0.85;
    ctx.strokeStyle = '#ff2d4d'; ctx.lineWidth = 14; ctx.shadowBlur = 30; ctx.shadowColor = '#ff2d4d';
    ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = '#ff2d4d';
    ctx.fillRect(0, H * (1 - t) - 2, W, 4);
    ctx.restore();
  },

  drawUI() {
    if (this.state !== 'playing' && this.state !== 'levelup' && this.state !== 'shop') return;
    const p = this.player;
    ctx.fillStyle = '#0ff'; ctx.font = '14px monospace';
    ctx.fillText(`LEVEL ${p.level}`, 20, 26);
    ctx.fillStyle = '#003'; ctx.fillRect(20, 34, 220, 10);
    ctx.fillStyle = '#0ff'; ctx.fillRect(20, 34, 220 * clamp(p.xp / p.xpToNext, 0, 1), 10);
    ctx.strokeStyle = '#0ff'; ctx.strokeRect(20, 34, 220, 10);

    ctx.fillText(`WAVE ${this.wave}${this.bossWaveNow() ? ' (BOSS)' : ''}`, 20, 64);
    ctx.fillStyle = '#ff0'; ctx.fillText(`◆ SHARDS: ${p.shards}`, 20, 82);
    ctx.fillStyle = '#f6f'; ctx.fillText(`CRIT ${(p.critChance * 100) | 0}%`, 790, 30);

    const boss = this.enemyPool.find(e => e instanceof BossBase && !e.dead);
    if (boss) {
      ctx.fillStyle = '#300'; ctx.fillRect(W / 2 - 220, H - 42, 440, 18);
      ctx.fillStyle = boss.exposed ? '#fff' : '#f33';
      ctx.fillRect(W / 2 - 220, H - 42, 440 * clamp(boss.hp / boss.maxHp, 0, 1), 18);
      ctx.strokeStyle = '#f33'; ctx.strokeRect(W / 2 - 220, H - 42, 440, 18);
      ctx.fillStyle = '#fff'; ctx.font = '13px monospace'; ctx.textAlign = 'center';
      ctx.fillText(boss.name.toUpperCase() + (boss.exposed ? ' — EXPOSED!' : ''), W / 2, H - 48);
      ctx.textAlign = 'left';
    }
  },

  loop(time) {
    if (!this.lastTime) this.lastTime = time;
    let dt = (time - this.lastTime) / 1000; dt = Math.min(dt, 0.05); this.lastTime = time;
    this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  },
};

EventBus.on('enemy:killed', (payload) => Game.onEnemyKilled(payload));
EventBus.on('enemy:spawn', ({ enemy }) => Game.spawnEnemyObj(enemy));
EventBus.on('player:levelup', () => Game.requestLevelUp());
EventBus.on('player:death', () => Game.onPlayerDeath());
EventBus.on('pickup:shard', ({ value }) => { Game.runShardsEarned += value; });

// Overload: force-expose every enemy near the cursor and make them briefly
// hostile to each other. Lives here (not in Player) because it needs the
// enemy list, which entities intentionally never import directly.
EventBus.on('ability:overload', ({ originX, originY }) => {
  const radius = 160;
  const origin = { x: originX, y: originY };
  const targets = Game.enemyPool.filter(e => !e.dead && dist(origin, e) < radius);
  for (const t of targets) {
    t.expose(2.5, 2.2);
    t._overloadHostile = Math.max(t._overloadHostile || 0, 2.5);
  }
  Camera.addShake(8); Camera.addPunch(0.06);
  Game.overloadFlash = 0.6;
});
