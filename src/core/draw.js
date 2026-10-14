import { ctx } from './canvas.js';
import { PAL } from './palette.js';
import { isStunned } from '../systems/status.js';

export function poly(pts, fill, stroke, lw = 2) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.stroke(); }
}

export function ngon(n, r, rot = 0) {
  const p = [];
  for (let i = 0; i < n; i++) { const a = rot + i * Math.PI * 2 / n; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return p;
}

// One matte body style for every enemy; state is the only thing that changes color.
export function bodyStyle(e) {
  if (e.hitFlash > 0) return { fill: PAL.bone, stroke: PAL.bone };
  if (isStunned(e)) return { fill: PAL.ash, stroke: PAL.bone };
  if (e.exposed) return { fill: PAL.amberDim, stroke: PAL.amber };
  return { fill: PAL.concrete, stroke: PAL.ash };
}
