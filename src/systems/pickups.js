import { ctx } from '../core/canvas.js';
import { dist, angleTo, rand } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { EventBus } from '../core/eventBus.js';
import { PAL } from '../core/palette.js';
import { burst } from './particles.js';

export class Pickup {
  constructor(x, y, type, value) {
    this.x = x; this.y = y; this.type = type; this.value = value;
    this.r = type === 'xp' ? 5 : 6; this.dead = false; this.bob = rand(0, Math.PI * 2);
  }
  update(dt, player) {
    this.bob += dt * 4;
    const d = dist(this, player);
    const magnet = 100 * player.magnetMult;
    if (d < magnet) {
      const a = angleTo(this, player);
      const pull = (magnet - d) * 4;
      this.x += Math.cos(a) * pull * dt; this.y += Math.sin(a) * pull * dt;
    }
    if (d < player.r + this.r) {
      this.dead = true;
      if (this.type === 'xp') {
        player.gainXp(this.value);
        AudioSys.pickup();
      } else {
        player.shards += this.value;
        EventBus.emit('pickup:shard', { value: this.value });
        AudioSys.coin();
      }
      burst(this.x, this.y, this.type === 'xp' ? PAL.ash : PAL.amber, 6, 80, 0.3);
    }
  }
  draw() {
    const y = this.y + Math.sin(this.bob) * 3;
    ctx.save(); ctx.translate(this.x, y);
    if (this.type === 'xp') {
      // data fragment: small matte square, no glow
      ctx.fillStyle = PAL.ash; ctx.fillRect(-this.r * 0.6, -this.r * 0.6, this.r * 1.2, this.r * 1.2);
    } else {
      // shards are opportunity, so they get the amber and a little light
      ctx.rotate(Math.PI / 4); ctx.shadowBlur = 8; ctx.shadowColor = PAL.amber;
      ctx.fillStyle = PAL.amber; ctx.fillRect(-this.r * 0.7, -this.r * 0.7, this.r * 1.4, this.r * 1.4);
    }
    ctx.restore();
  }
}
