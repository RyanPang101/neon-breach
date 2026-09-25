import { ctx } from '../core/canvas.js';
import { dist, angleTo, rand } from '../core/utils.js';
import { AudioSys } from '../core/audio.js';
import { EventBus } from '../core/eventBus.js';
import { burst } from './particles.js';

export class Pickup {
  constructor(x, y, type, value) {
    this.x = x; this.y = y; this.type = type; this.value = value;
    this.r = type === 'xp' ? 6 : 5; this.dead = false; this.bob = rand(0, Math.PI * 2);
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
      burst(this.x, this.y, this.type === 'xp' ? '#0ff' : '#ff0', 6, 80, 0.3);
    }
  }
  draw() {
    const y = this.y + Math.sin(this.bob) * 3;
    ctx.save(); ctx.shadowBlur = 10;
    if (this.type === 'xp') {
      ctx.shadowColor = '#0ff'; ctx.fillStyle = '#0ff';
      ctx.beginPath(); ctx.arc(this.x, y, this.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.shadowColor = '#ff0'; ctx.fillStyle = '#ff0';
      ctx.save(); ctx.translate(this.x, y); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2);
      ctx.restore();
    }
    ctx.restore();
  }
}
