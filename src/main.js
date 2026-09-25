import { Game } from './game.js';
import { initUI } from './ui.js';
import { EventBus } from './core/eventBus.js';
import './core/input.js';

EventBus.on('input:escape', () => Game.togglePause());

initUI();
requestAnimationFrame(t => Game.loop(t));
