import { ctx, W, H } from '../core/canvas.js';
import { clamp, angleTo, rand } from '../core/utils.js';
import { Input } from '../core/input.js';
import { AudioSys } from '../core/audio.js';
import { Camera } from '../core/camera.js';
import { Settings } from '../core/settings.js';
import { EventBus } from '../core/eventBus.js';
import { CONFIG } from '../config.js';
import { spawnProjectile } from '../systems/projectiles.js';
import { burst } from '../systems/particles.js';

export class Player {
  constructor(loadout, perks) {
    const w = loadout.weapon;
    this.loadoutId = loadout.id;
    this.x = W / 2; this.y = H / 2; this.vx = 0; this.vy = 0; this.r = 14; this.angle = 0;

    let baseHp = loadout.startHp + (perks.perm_hp || 0) * 10;
    this.maxHp = baseHp; this.hp = baseHp;

    this.level = 1; this.xp = 0; this.xpToNext = CONFIG.xpToLevelBase;
    this.shards = 0;

    this.baseWeapon = { ...w };
    this.fireCooldown = 0;
    this.fireRateMult = 1;
    this.dmgMult = 1 + (perks.perm_dmg || 0) * 0.06;
    this.pierce = 0;
    this.speedMult = 1;
    this.dashCdMult = 1;
    this.extraPellets = perks.perm_twin ? 1 : 0;
    this.empChance = 0; this.virusChance = 0;
    this.lifesteal = 0; this.critChance = 0.05;
    this.magnetMult = 1;
    this.bonusUpgradeChoice = 0;

    // Exploit-system synergies, set by upgrades (content/upgrades.js)
    this.exploitDmgMult = 1;
    this.exposeDurationMult = 1;
    this.cascadeChance = 0;
    this.overloadRefund = 0;

    // Overload: the active hack ability, on its own cooldown separate from the weapon
    this.overloadCooldownTimer = 0;
    this.overloadMax = 10;
    this.overloadCdMult = 1;

    this.dashTimer = 0; this.dashCooldownTimer = 0; this.invuln = 0;
    this.alive = true;
    this.hurtFlash = 0;
  }
  gainXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.floor(CONFIG.xpToLevelBase * Math.pow(CONFIG.xpToLevelGrowth, this.level - 1));
      EventBus.emit('player:levelup');
    }
  }
  update(dt) {
    if (!this.alive) return;
    let mx = 0, my = 0;
    if (Input.keys['KeyW'] || Input.keys['ArrowUp']) my -= 1;
    if (Input.keys['KeyS'] || Input.keys['ArrowDown']) my += 1;
    if (Input.keys['KeyA'] || Input.keys['ArrowLeft']) mx -= 1;
    if (Input.keys['KeyD'] || Input.keys['ArrowRight']) mx += 1;
    const len = Math.hypot(mx, my) || 1; mx /= len; my /= len;

    if (this.dashTimer > 0) this.dashTimer -= dt;
    else {
      this.vx += mx * CONFIG.playerAccel * dt; this.vy += my * CONFIG.playerAccel * dt;
      this.vx *= CONFIG.playerFriction; this.vy *= CONFIG.playerFriction;
      const maxSpd = CONFIG.playerSpeed * this.speedMult;
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > maxSpd) { this.vx = this.vx / spd * maxSpd; this.vy = this.vy / spd * maxSpd; }
    }

    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (Input.keys['Space'] && this.dashCooldownTimer <= 0 && this.dashTimer <= 0) {
      const a = (mx || my) ? Math.atan2(my, mx) : this.angle;
      this.vx = Math.cos(a) * CONFIG.dashSpeed; this.vy = Math.sin(a) * CONFIG.dashSpeed;
      this.dashTimer = CONFIG.dashDuration;
      this.dashCooldownTimer = CONFIG.dashCooldown * this.dashCdMult;
      this.invuln = CONFIG.dashDuration + 0.05;
      AudioSys.dash();
    }

    this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, this.r, W - this.r); this.y = clamp(this.y, this.r, H - this.r);
    this.angle = angleTo(this, Input.mouse);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (Input.mouse.down && this.fireCooldown <= 0) {
      const w = this.baseWeapon;
      this.fireCooldown = (1 / w.fireRate) / this.fireRateMult;
      this.fireWeapon(w);
    }

    if (this.overloadCooldownTimer > 0) this.overloadCooldownTimer -= dt;
    if (Input.keys['KeyE'] && this.overloadCooldownTimer <= 0) {
      this.overloadCooldownTimer = this.overloadMax * this.overloadCdMult;
      EventBus.emit('ability:overload', { originX: Input.mouse.x, originY: Input.mouse.y });
      AudioSys.overload();
    }
  }
  fireWeapon(w) {
    const totalPellets = w.pellets + this.extraPellets;
    const soundMap = { assault: AudioSys.shootAssault, sniper: AudioSys.shootSniper, shotgun: AudioSys.shootShotgun };
    (soundMap[this.loadoutId] || AudioSys.shootAssault)();
    for (let i = 0; i < totalPellets; i++) {
      let spreadOffset;
      if (totalPellets === 1) spreadOffset = 0;
      else spreadOffset = (i / (totalPellets - 1) - 0.5) * (w.spread + 0.15);
      const ang = this.angle + spreadOffset + (w.spread ? rand(-w.spread / 2, w.spread / 2) : 0);
      // Spawn at the player's center: a muzzle offset put shots past enemies standing on top of you.
      const nx = this.x, ny = this.y;
      let dmg = w.dmg * this.dmgMult;
      let crit = Math.random() < this.critChance;
      if (crit) { dmg *= 2; AudioSys.crit(); }
      let effect = null;
      if (Math.random() < this.empChance) effect = 'stun';
      else if (Math.random() < this.virusChance) effect = 'virus';
      spawnProjectile(nx, ny, ang, w.projSpeed, 'player', dmg, w.color, w.pierce + this.pierce, 5, crit, effect);
    }
  }
  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }
  takeDamage(amount) {
    if (this.invuln > 0 || !this.alive) return;
    this.hp -= amount;
    this.invuln = 0.5; this.hurtFlash = 0.3;
    AudioSys.hurt();
    Camera.addShake(6); Camera.addPunch(0.03);
    burst(this.x, this.y, '#f33', 10, 150, 0.4);
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false; AudioSys.death();
      Camera.addShake(20); Camera.addHitstop(0.15);
      EventBus.emit('player:death');
    }
  }
  draw() {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.shadowBlur = 16; ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
    ctx.beginPath();
    ctx.moveTo(18, 0); ctx.lineTo(-12, 10); ctx.lineTo(-6, 0); ctx.lineTo(-12, -10);
    ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
    if (this.hurtFlash > 0 && Settings.flashEnabled) {
      ctx.save(); ctx.globalAlpha = clamp(this.hurtFlash, 0, 0.5) * 0.6;
      ctx.fillStyle = '#f33'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
}
