import { ctx, W, H } from '../core/canvas.js';
import { makePool } from '../core/pool.js';
import { PAL } from '../core/palette.js';
import { poly } from '../core/draw.js';

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
  // Team-coded so a bullet storm stays parseable: yours are thin amber streaks,
  // theirs are fat red diamonds. The weapon's own color field is not used for drawing.
  for (const pr of projPool.active) {
    if (pr.owner === 'player') {
      ctx.strokeStyle = pr.crit ? PAL.bone : PAL.amber;
      ctx.lineWidth = pr.crit ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03); ctx.lineTo(pr.x, pr.y); ctx.stroke();
    } else {
      const a = Math.atan2(pr.vy, pr.vx), r = pr.radius + 2;
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
      ctx.shadowBlur = 6; ctx.shadowColor = PAL.red;
      poly([[r * 1.3, 0], [0, r], [-r * 1.3, 0], [0, -r]], PAL.red);
      ctx.restore();
    }
  }
}
export function clearProjectiles() { projPool.active.length = 0; }
export function getActiveProjectiles() { return projPool.active; }
