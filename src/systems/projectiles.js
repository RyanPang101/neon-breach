import { ctx, W, H } from '../core/canvas.js';
import { makePool } from '../core/pool.js';

const projPool = makePool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, owner: '', dmg: 0, color: '#fff', pierce: 0, hitSet: null, radius: 5, dead: false, crit: false, effect: null, homing: false }),
  (o, x, y, angle, speed, owner, dmg, color, pierce, radius, crit, effect) => {
    o.x = x; o.y = y; o.vx = Math.cos(angle) * speed; o.vy = Math.sin(angle) * speed;
    o.owner = owner; o.dmg = dmg; o.color = color; o.pierce = pierce || 0;
    o.hitSet = o.hitSet ? (o.hitSet.clear(), o.hitSet) : new Set();
    o.radius = radius || 5; o.dead = false; o.crit = !!crit; o.effect = effect || null;
    // must reset: pooled objects can otherwise inherit a stale flag from a previous use
    o.homing = false;
  }
);

export function spawnProjectile(x, y, angle, speed, owner, dmg, color, pierce, radius, crit, effect) {
  return projPool.get(x, y, angle, speed, owner, dmg, color, pierce, radius, crit, effect);
}
export function updateProjectiles(dt) {
  for (const pr of projPool.active) {
    if (pr.dead) continue;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if (pr.x < -30 || pr.x > W + 30 || pr.y < -30 || pr.y > H + 30) pr.dead = true;
  }
  projPool.reclaim();
}
export function drawProjectiles() {
  for (const pr of projPool.active) {
    ctx.save();
    ctx.shadowBlur = pr.crit ? 20 : 12;
    ctx.shadowColor = pr.crit ? '#fff' : pr.color;
    ctx.fillStyle = pr.crit ? '#fff' : pr.color;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
export function clearProjectiles() { projPool.active.length = 0; }
export function getActiveProjectiles() { return projPool.active; }
