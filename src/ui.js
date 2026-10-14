// All DOM/overlay wiring lives here; game.js never touches document.*.
// It reacts to EventBus signals from Game ('ui:showShop', etc.) and calls
// back into Game's public methods (init, closeShop, applyUpgrade, ...).
import { Game } from './game.js';
import { Save } from './core/save.js';
import { AudioSys } from './core/audio.js';
import { Settings } from './core/settings.js';
import { EventBus } from './core/eventBus.js';
import { loadoutRegistry } from './content/loadouts.js';
import { shopItemRegistry } from './content/shopItems.js';
import { safehouseItemRegistry } from './content/safehouseItems.js';

const wrap = document.getElementById('ui-wrap');
const $ = (id) => document.getElementById(id);
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
function hideAllOverlays() {
  ['titleScreen', 'loadoutScreen', 'safehouseScreen', 'shopScreen', 'levelUpScreen', 'pauseScreen', 'settingsScreen', 'gameOverScreen', 'winScreen']
    .forEach(hide);
  wrap.classList.remove('paused');
}
function goTitle() { hideAllOverlays(); renderTitle(); show('titleScreen'); Game.state = 'title'; }

function renderTitle() {
  const d = Save.data;
  $('statCores').textContent = d.cores; $('statBest').textContent = d.bestWave; $('statRuns').textContent = d.runsPlayed;
  $('metaSummary').textContent = Save.persistent ? '' : "Progress won't save in this browser context. Open it from a web address, not a downloaded file.";
}

function renderLoadoutSelect() {
  const container = $('loadoutCards');
  container.innerHTML = '';
  const all = loadoutRegistry.list();
  const dpsOf = (l) => l.weapon.dmg * l.weapon.pellets * l.weapon.fireRate;
  const maxDps = Math.max(...all.map(dpsOf)), maxHp = Math.max(...all.map(l => l.startHp)), maxRange = Math.max(...all.map(l => l.weapon.projSpeed));
  const stat = (label, val, frac) => `<div class="stat">${label}<b>${val}</b></div><div class="bar"><i style="width:${Math.round(frac * 100)}%"></i></div>`;
  const selectedId = all.find(l => Save.data.unlockedLoadouts.includes(l.id)).id;
  Game._loadoutPick = selectedId;
  all.forEach(l => {
    const unlocked = Save.data.unlockedLoadouts.includes(l.id);
    const div = document.createElement('div');
    div.className = 'card' + (unlocked ? '' : ' locked') + (unlocked && l.id === selectedId ? ' sel' : '');
    div.innerHTML = `<h3>${l.name}</h3><p>${l.desc}</p>` +
      stat('Output', Math.round(dpsOf(l)), dpsOf(l) / maxDps) + stat('Hull', l.startHp, l.startHp / maxHp) + stat('Velocity', l.weapon.projSpeed, l.weapon.projSpeed / maxRange) +
      `<div class="favors">${unlocked ? l.favors : 'Locked. Unlock it in the Safehouse.'}</div>`;
    if (unlocked) {
      div.onclick = () => {
        Game._loadoutPick = l.id;
        [...container.children].forEach(c => c.classList.remove('sel'));
        div.classList.add('sel');
      };
    }
    container.appendChild(div);
  });
}

// Ledger lines: unaffordable ones are struck back to ash ('poor'), never hidden.
function line({ name, desc, price, owned, poor, locked, onclick }) {
  const div = document.createElement('div');
  div.className = 'line' + (owned ? ' owned' : '') + (poor ? ' poor' : '') + (locked ? ' locked' : '');
  div.innerHTML = `<div class="nm">${name}</div><div class="ds">${desc}</div><div class="px">${price}</div>`;
  if (onclick) div.onclick = onclick;
  return div;
}

function renderSafehouse() {
  $('coreCount').textContent = Save.data.cores;
  const container = $('safehouseCards');
  container.innerHTML = '';
  safehouseItemRegistry.list().forEach(item => {
    let owned = false, level = 0;
    if (item.type === 'loadout') owned = Save.data.unlockedLoadouts.includes(item.ref);
    else level = Save.perkLevel(item.id);
    const locked = item.type === 'perk' && item.stack ? (level >= item.max) : (item.type === 'perk' ? level >= 1 : owned);
    const stackTxt = item.stack ? ` ${level}/${item.max}` : '';
    const poor = !locked && Save.data.cores < item.cost;
    container.appendChild(line({
      name: item.name + stackTxt, desc: item.desc,
      price: locked ? (item.stack ? 'MAXED' : 'OWNED') : `◆ ${item.cost}`,
      owned: locked, locked, poor,
      onclick: locked || poor ? null : () => {
        Save.data.cores -= item.cost;
        if (item.type === 'loadout') Save.data.unlockedLoadouts.push(item.ref);
        else Save.data.perks[item.id] = (Save.data.perks[item.id] || 0) + 1;
        Save.save();
        renderSafehouse();
      },
    }));
  });
}

function renderShop() {
  $('shopShards').textContent = Game.player.shards;
  const container = $('shopCards');
  container.innerHTML = '';
  shopItemRegistry.list().forEach(item => {
    const owned = !item.repeatable && Game.player._boughtShop && Game.player._boughtShop.has(item.id);
    const poor = !owned && Game.player.shards < item.cost;
    container.appendChild(line({
      name: item.name, desc: item.desc, price: owned ? 'OWNED' : `◆ ${item.cost}`, owned, poor, locked: owned,
      onclick: owned || poor ? null : () => {
        Game.player.shards -= item.cost;
        item.apply(Game.player);
        if (!item.repeatable) { Game.player._boughtShop = Game.player._boughtShop || new Set(); Game.player._boughtShop.add(item.id); }
        AudioSys.coin();
        renderShop();
      },
    }));
  });
}

function renderLevelUp({ level, choices }) {
  $('levelNum').textContent = level;
  const container = $('upgradeChoices');
  container.innerHTML = '';
  choices.forEach(u => {
    const div = document.createElement('div'); div.className = 'card';
    div.innerHTML = `<span class="tag ${u.tag}">${u.tag}</span><h3>${u.name}</h3><p>${u.desc}</p>`;
    div.onclick = () => { Game.applyUpgrade(u); hide('levelUpScreen'); };
    container.appendChild(div);
  });
}

const rl = (label, value, note = '') => `<div class="rl"><span>${label}</span><b>${value}</b><i>${note}</i></div>`;

function postMortem() {
  const s = Game.stats, p = Game.player, prev = Game.prevBestWave || 0;
  const rate = s.kills ? Math.round(100 * s.exploitKills / s.kills) : 0;
  const delta = Game.wave > prev ? 'NEW BEST' : `BEST ${prev}`;
  const tip = rate < 25
    ? 'Few of your kills landed on an exposed target. Watch for the amber lock on an enemy and fire while it holds.'
    : 'Exploit kills are working. Press E when a crowd is close: Overload opens every window near your cursor at once.';
  return rl('Wave reached', Game.wave, delta) + rl('Exploit kills', rate + '%', `${s.exploitKills} / ${s.kills}`) +
    rl('Level', p.level) + rl('Cores banked', '+' + Game.lastCoresEarned) +
    `<div class="tip">${tip}</div><div class="hint">PRESS R TO RETRY</div>`;
}
function showGameOver() { $('finalStats').innerHTML = postMortem(); hideAllOverlays(); show('gameOverScreen'); }
function showWin() { $('winStats').innerHTML = postMortem(); hideAllOverlays(); show('winScreen'); }

function restart() {
  hideAllOverlays();
  Game.init(Game.selectedLoadout.id);
  Game.state = 'playing';
}

export function initUI() {
  $('playBtn').onclick = () => { hideAllOverlays(); renderLoadoutSelect(); show('loadoutScreen'); };
  $('safehouseBtn').onclick = () => { hideAllOverlays(); renderSafehouse(); show('safehouseScreen'); };
  $('safehouseBackBtn').onclick = goTitle;
  $('resetSaveBtn').onclick = () => { if (confirm('Reset all progress? This cannot be undone.')) { Save.reset(); renderSafehouse(); } };
  $('loadoutBackBtn').onclick = goTitle;
  $('loadoutConfirmBtn').onclick = () => { hideAllOverlays(); Game.init(Game._loadoutPick); Game.state = 'playing'; };
  $('shopContinueBtn').onclick = () => Game.closeShop();
  $('resumeBtn').onclick = () => Game.togglePause();
  $('settingsBtn').onclick = () => { hide('pauseScreen'); show('settingsScreen'); };
  $('settingsBackBtn').onclick = () => { hide('settingsScreen'); show('pauseScreen'); };
  $('quitBtn').onclick = () => { Game.finishRun(); goTitle(); };
  $('restartBtn').onclick = restart; $('restartBtn2').onclick = restart;
  $('toTitleBtn').onclick = goTitle; $('toTitleBtn2').onclick = goTitle;

  const vol = $('volSlider'), shake = $('shakeToggle'), flash = $('flashToggle');
  const st0 = Save.data.settings;
  vol.value = st0.volume; shake.checked = st0.shake; flash.checked = st0.flash;
  AudioSys.setVolume(st0.volume / 100); Settings.shakeEnabled = st0.shake; Settings.flashEnabled = st0.flash;
  vol.oninput = (e) => { AudioSys.setVolume(e.target.value / 100); Save.data.settings.volume = +e.target.value; Save.save(); };
  shake.onchange = (e) => { Settings.shakeEnabled = Save.data.settings.shake = e.target.checked; Save.save(); };
  flash.onchange = (e) => { Settings.flashEnabled = Save.data.settings.flash = e.target.checked; Save.save(); };

  // One-key retry from either end screen.
  window.addEventListener('keydown', (e) => {
    const ended = !$('gameOverScreen').classList.contains('hidden') || !$('winScreen').classList.contains('hidden');
    if (ended && (e.code === 'KeyR' || e.code === 'Enter')) restart();
  });

  // One sound family for every interaction. Denied lines get their own sound.
  const target = (e) => e.target.closest('button,.card,.line');
  wrap.addEventListener('mouseover', (e) => { const t = target(e); if (t && !t.contains(e.relatedTarget)) AudioSys.uiHover(); });
  wrap.addEventListener('click', (e) => {
    const t = target(e); if (!t) return;
    t.classList.contains('poor') || t.classList.contains('locked') ? AudioSys.uiDeny() : AudioSys.uiClick();
  });

  EventBus.on('ui:showLevelUp', (payload) => { hideAllOverlays(); renderLevelUp(payload); show('levelUpScreen'); });
  EventBus.on('ui:showShop', () => { hideAllOverlays(); renderShop(); show('shopScreen'); });
  EventBus.on('ui:hideShop', () => hide('shopScreen'));
  // Pause freezes and desaturates the frame instead of covering it with a card.
  EventBus.on('ui:showPause', () => { hideAllOverlays(); show('pauseScreen'); wrap.classList.add('paused'); });
  EventBus.on('ui:hidePause', () => hideAllOverlays());
  EventBus.on('ui:showGameOver', showGameOver);
  EventBus.on('ui:showWin', showWin);

  renderTitle();
}
