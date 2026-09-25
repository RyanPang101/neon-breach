import { canvas, W, H } from './canvas.js';
import { AudioSys } from './audio.js';
import { EventBus } from './eventBus.js';

export const Input = { keys: {}, mouse: { x: W / 2, y: H / 2, down: false } };

window.addEventListener('keydown', e => {
  Input.keys[e.code] = true;
  if (e.code === 'Escape') EventBus.emit('input:escape');
});
window.addEventListener('keyup', e => { Input.keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  Input.mouse.x = (e.clientX - r.left) * (W / r.width);
  Input.mouse.y = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener('mousedown', () => { AudioSys.startAmbient(); Input.mouse.down = true; });
canvas.addEventListener('mouseup', () => { Input.mouse.down = false; });
