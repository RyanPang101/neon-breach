import { AudioSys } from '../core/audio.js';

export function applyStatus(target, type) {
  target.status = target.status || {};
  if (type === 'stun') { target.status.stun = 1.1; AudioSys.stun(); }
  if (type === 'virus') { target.status.virus = { time: 3.5, tick: 0.5, dps: target.maxHp * 0.03 }; }
}
export function updateStatus(target, dt) {
  if (!target.status) return;
  if (target.status.stun > 0) target.status.stun -= dt;
  if (target.status.virus) {
    const v = target.status.virus;
    v.time -= dt; v.tick -= dt;
    if (v.tick <= 0) { v.tick += 0.5; target.takeDamage(v.dps, false, true); }
    if (v.time <= 0) delete target.status.virus;
  }
}
export function isStunned(target) { return target.status && target.status.stun > 0; }
