import { ctx } from '../core/canvas.js';
import { makePool } from '../core/pool.js';
import { clamp, rand } from '../core/utils.js';

const particlePool = makePool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, color: '#fff', life: 0, maxLife: 0, r: 0, dead: false }),
  (o, x, y, color, speed, life) => {
    o.x = x; o.y = y;
    const a = rand(0, Math.PI * 2);
    o.vx = Math.cos(a) * rand(speed * 0.3, speed);
    o.vy = Math.sin(a) * rand(speed * 0.3, speed);
    o.color = color; o.life = life; o.maxLife = life; o.r = rand(2, 4); o.dead = false;
  }
);

export function burst(x, y, color, count = 10, speed = 140, life = 0.5) {
  for (let i = 0; i < count; i++) particlePool.get(x, y, color, speed, life);
}
export function updateParticles(dt) {
  for (const p of particlePool.active) {
    if (p.dead) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    if (p.life <= 0) p.dead = true;
  }
  particlePool.reclaim();
}
export function drawParticles() {
  for (const p of particlePool.active) {
    const t = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = t; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
export function clearParticles() { particlePool.active.length = 0; }
