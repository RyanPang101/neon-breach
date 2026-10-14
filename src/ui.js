// All DOM/overlay wiring lives here — game.js never touches document.*.
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

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function hideAllOverlays() {
  ['titleScreen', 'loadoutScreen', 'safehouseScreen', 'shopScreen', 'levelUpScreen', 'pauseScreen', 'settingsScreen', 'gameOverScreen', 'winScreen']
    .forEach(hide);
}

function renderTitle() {
  const d = Save.data;
  let txt = `Data Cores: ${d.cores}  |  Best Wave: ${d.bestWave}  |  Runs Played: ${d.runsPlayed}`;
  if (!Save.persistent) txt += "   ⚠ Progress won't save in this browser context (try opening via a local server, not a double-clicked file).";
  document.getElementById('metaSummary').textContent = txt;
}

function renderLoadoutSelect() {
  const container = document.getElementById('loadoutCards');
  container.innerHTML = '';
  const selectedId = loadoutRegistry.list().find(l => Save.data.unlockedLoadouts.includes(l.id)).id;
  Game._loadoutPick = selectedId;
  loadoutRegistry.list().forEach(l => {
    const unlocked = Save.data.unlockedLoadouts.includes(l.id);
    const div = document.createElement('div');
    div.className = 'card' + (unlocked ? '' : ' locked');
    div.innerHTML = `<h3>${l.name}</h3><p>${l.desc}</p>` + (unlocked ? '' : `<span class="cost">Locked — Safehouse</span>`);
    if (unlocked) {
      div.onclick = () => {
        Game._loadoutPick = l.id;
        [...container.children].forEach(c => c.style.boxShadow = '');
        div.style.boxShadow = '0 0 18px var(--cyan)';
      };
      if (l.id === selectedId) div.style.boxShadow = '0 0 18px var(--cyan)';
    }
    container.appendChild(div);
  });
}

function renderSafehouse() {
  document.getElementById('coreCount').textContent = Save.data.cores;
  const container = document.getElementById('safehouseCards');
  container.innerHTML = '';
  safehouseItemRegistry.list().forEach(item => {
    let owned = false, level = 0;
    if (item.type === 'loadout') owned = Save.data.unlockedLoadouts.includes(item.ref);
    else level = Save.perkLevel(item.id);
    const div = document.createElement('div');
    const locked = item.type === 'perk' && item.stack ? (level >= item.max) : owned;
    div.className = 'card' + (locked && item.type !== 'perk' ? ' owned' : '') + (locked && item.type === 'perk' && !item.stack ? ' owned' : '');
    const stackTxt = item.stack ? ` (Lv ${level}/${item.max})` : '';
    div.innerHTML = `<h3>${item.name}${stackTxt}</h3><p>${item.desc}</p>` +
      (locked ? `<p style="color:#3f3;">${item.stack ? 'MAXED' : 'OWNED'}</p>` : `<span class="cost">◆ ${item.cost}</span>`);
    if (!locked) {
      div.onclick = () => {
        if (Save.data.cores < item.cost) return;
        Save.data.cores -= item.cost;
        if (item.type === 'loadout') Save.data.unlockedLoadouts.push(item.ref);
        else Save.data.perks[item.id] = (Save.data.perks[item.id] || 0) + 1;
        Save.save();
        AudioSys.coin();
        renderSafehouse();
      };
    } else { div.classList.add('locked'); }
    if (!locked && Save.data.cores < item.cost) div.classList.add('poor');
    container.appendChild(div);
  });
}

function renderShop() {
  document.getElementById('shopShards').textContent = Game.player.shards;
  const container = document.getElementById('shopCards');
  container.innerHTML = '';
  shopItemRegistry.list().forEach(item => {
    const owned = !item.repeatable && Game.player._boughtShop && Game.player._boughtShop.has(item.id);
    const div = document.createElement('div');
    div.className = 'card' + (owned ? ' owned' : '') + (!owned && Game.player.shards < item.cost ? ' poor' : '');
    div.innerHTML = `<h3>${item.name}</h3><p>${item.desc}</p><span class="cost">◆ ${item.cost}</span>`;
    if (owned) { div.innerHTML += '<p style="color:#3f3;">OWNED</p>'; div.onclick = null; div.classList.add('locked'); }
    else {
      div.onclick = () => {
        if (Game.player.shards < item.cost) return;
        Game.player.shards -= item.cost;
        item.apply(Game.player);
        if (!item.repeatable) { Game.player._boughtShop = Game.player._boughtShop || new Set(); Game.player._boughtShop.add(item.id); }
        AudioSys.coin();
        renderShop();
      };
    }
    container.appendChild(div);
  });
}

function renderLevelUp({ level, choices }) {
  document.getElementById('levelNum').textContent = level;
  const container = document.getElementById('upgradeChoices');
  container.innerHTML = '';
  choices.forEach(u => {
    const div = document.createElement('div'); div.className = 'card';
    div.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>`;
    div.onclick = () => { Game.applyUpgrade(u); hide('levelUpScreen'); };
    container.appendChild(div);
  });
}

function showGameOver() {
  document.getElementById('finalStats').textContent =
    `Wave reached: ${Game.wave}  |  Level: ${Game.player.level}  |  Data Cores earned: +${Game.lastCoresEarned}`;
  hideAllOverlays();
  show('gameOverScreen');
}
function showWin() {
  document.getElementById('winStats').textContent =
    `Root access achieved at wave ${Game.wave}!  Level: ${Game.player.level}  |  Data Cores earned: +${Game.lastCoresEarned}`;
  hideAllOverlays();
  show('winScreen');
}

function restart() {
  hideAllOverlays();
  Game.init(Game.selectedLoadout.id);
  Game.state = 'playing';
}

export function initUI() {
  document.getElementById('playBtn').onclick = () => { hideAllOverlays(); renderLoadoutSelect(); show('loadoutScreen'); };
  document.getElementById('safehouseBtn').onclick = () => { hideAllOverlays(); renderSafehouse(); show('safehouseScreen'); };
  document.getElementById('safehouseBackBtn').onclick = () => { hideAllOverlays(); renderTitle(); show('titleScreen'); };
  document.getElementById('resetSaveBtn').onclick = () => { if (confirm('Reset all progress? This cannot be undone.')) { Save.reset(); renderSafehouse(); } };
  document.getElementById('loadoutBackBtn').onclick = () => { hideAllOverlays(); renderTitle(); show('titleScreen'); };
  document.getElementById('loadoutConfirmBtn').onclick = () => {
    hideAllOverlays();
    Game.init(Game._loadoutPick);
    Game.state = 'playing';
  };

  document.getElementById('shopContinueBtn').onclick = () => Game.closeShop();

  document.getElementById('resumeBtn').onclick = () => Game.togglePause();
  document.getElementById('settingsBtn').onclick = () => { hide('pauseScreen'); show('settingsScreen'); };
  document.getElementById('settingsBackBtn').onclick = () => { hide('settingsScreen'); show('pauseScreen'); };
  document.getElementById('quitBtn').onclick = () => {
    hideAllOverlays();
    Game.finishRun();
    Game.state = 'title';
    renderTitle(); show('titleScreen');
  };
  const vol = document.getElementById('volSlider'), shake = document.getElementById('shakeToggle'), flash = document.getElementById('flashToggle');
  const st0 = Save.data.settings;
  vol.value = st0.volume; shake.checked = st0.shake; flash.checked = st0.flash;
  AudioSys.setVolume(st0.volume / 100); Settings.shakeEnabled = st0.shake; Settings.flashEnabled = st0.flash;
  vol.oninput = (e) => { AudioSys.setVolume(e.target.value / 100); Save.data.settings.volume = +e.target.value; Save.save(); };
  shake.onchange = (e) => { Settings.shakeEnabled = Save.data.settings.shake = e.target.checked; Save.save(); };
  flash.onchange = (e) => { Settings.flashEnabled = Save.data.settings.flash = e.target.checked; Save.save(); };

  document.getElementById('restartBtn').onclick = restart;
  document.getElementById('restartBtn2').onclick = restart;
  document.getElementById('toTitleBtn').onclick = () => { hideAllOverlays(); renderTitle(); show('titleScreen'); Game.state = 'title'; };
  document.getElementById('toTitleBtn2').onclick = () => { hideAllOverlays(); renderTitle(); show('titleScreen'); Game.state = 'title'; };

  EventBus.on('ui:showLevelUp', (payload) => { hideAllOverlays(); renderLevelUp(payload); show('levelUpScreen'); });
  EventBus.on('ui:showShop', () => { hideAllOverlays(); renderShop(); show('shopScreen'); });
  EventBus.on('ui:hideShop', () => hide('shopScreen'));
  EventBus.on('ui:showPause', () => { hideAllOverlays(); show('pauseScreen'); });
  EventBus.on('ui:hidePause', () => hideAllOverlays());
  EventBus.on('ui:showGameOver', showGameOver);
  EventBus.on('ui:showWin', showWin);

  renderTitle();
}
