import { Game } from './game.js';
import { initUI } from './ui.js';
import { EventBus } from './core/eventBus.js';
import './core/input.js';

EventBus.on('input:escape', () => Game.togglePause());

// Scale the fixed 960x640 game to whatever window it's in; the page can't scroll, so
// without this a small or zoomed window cuts off menus and part of the arena.
// Mouse aiming already maps through getBoundingClientRect, so it follows the scale.
const wrap = document.getElementById('ui-wrap');
function fit() {
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const s = Math.min(vw / 960, vh / 640);
  wrap.style.position = 'absolute'; wrap.style.margin = '0'; wrap.style.transformOrigin = '0 0';
  wrap.style.transform = `scale(${s})`;
  wrap.style.left = `${(vw - 960 * s) / 2}px`;
  wrap.style.top = `${(vh - 640 * s) / 2}px`;
}
window.addEventListener('resize', fit);
fit();

initUI();
requestAnimationFrame(t => Game.loop(t));
