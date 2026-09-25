import { ctx, W, H } from './canvas.js';
import { rand } from './utils.js';
import { Settings } from './settings.js';

export const Camera = {
  shake: 0, punch: 0, hitstop: 0,
  update(dt) {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 36);
    if (this.punch > 0) this.punch = Math.max(0, this.punch - dt * 3);
    if (this.hitstop > 0) this.hitstop = Math.max(0, this.hitstop - dt);
  },
  addShake(v) { this.shake = Math.min(28, Math.max(this.shake, v)); },
  addPunch(v) { this.punch = Math.min(0.25, this.punch + v); },
  addHitstop(t) { this.hitstop = Math.max(this.hitstop, t); },
  apply() {
    const zoom = 1 + this.punch;
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    if (this.shake > 0 && Settings.shakeEnabled) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }
  },
};
