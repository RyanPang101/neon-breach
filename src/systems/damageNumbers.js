// Floating damage numbers — subscribes to the 'damage:dealt' fact emitted by
// EnemyBase.takeDamage() rather than being called directly, so it's a pure
// add-on: nothing else needs to know this system exists.
import { ctx } from '../core/canvas.js';
import { makePool } from '../core/pool.js';
import { rand, clamp } from '../core/utils.js';
import { EventBus } from '../core/eventBus.js';

const pool = makePool(
  () => ({ x: 0, y: 0, vy: 0, text: '', color: '#fff', size: 12, life: 0, maxLife: 0, dead: false }),
  (o, x, y, text, color, size, life) => {
    o.x = x + rand(-6, 6); o.y = y; o.vy = -42;
    o.text = text; o.color = color; o.size = size;
    o.life = life; o.maxLife = life; o.dead = false;
  }
);

function spawn(x, y, text, color, size, life = 0.8) { pool.get(x, y, text, color, size, life); }

export function updateDamageNumbers(dt) {
  for (const n of pool.active) {
    if (n.dead) continue;
    n.y += n.vy * dt; n.vy *= 0.94;
    n.life -= dt;
    if (n.life <= 0) n.dead = true;
  }
  pool.reclaim();
}
export function drawDamageNumbers() {
  ctx.save();
  ctx.textAlign = 'center';
  for (const n of pool.active) {
    const t = clamp(n.life / n.maxLife, 0, 1);
    ctx.globalAlpha = t;
    ctx.font = `bold ${n.size}px monospace`;
    ctx.fillStyle = n.color;
    ctx.shadowBlur = 6; ctx.shadowColor = n.color;
    ctx.fillText(n.text, n.x, n.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
export function clearDamageNumbers() { pool.active.length = 0; }

EventBus.on('damage:dealt', ({ x, y, amount, crit, exploit }) => {
  const text = Math.round(amount).toString();
  if (exploit) spawn(x, y - 10, 'EXPLOIT ' + text, '#ffb020', 15, 0.9);
  else if (crit) spawn(x, y - 10, text, '#ff0', 14, 0.75);
  else spawn(x, y - 10, text, '#9ef', 11, 0.6);
});
