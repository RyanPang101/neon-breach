// Starting weapon/kit choices. Add a new one by calling register() with a
// unique id — it will automatically show up on the loadout-select screen
// and can be gated behind a Safehouse unlock via content/safehouseItems.js.
import { createRegistry } from '../core/registry.js';

export const loadoutRegistry = createRegistry('loadout');

loadoutRegistry.register('assault', {
  name: 'Assault Rig', unlockCost: 0,
  desc: 'Balanced rapid-fire. Forgiving, reliable, easy to build around.',
  weapon: { fireRate: 6.5, dmg: 9, pellets: 1, spread: 0.03, pierce: 0, projSpeed: 560, color: '#0ff' },
  startHp: 100,
});
loadoutRegistry.register('sniper', {
  name: 'Deep Scanner', unlockCost: 40,
  desc: 'Slow, hard-hitting, pierces through lines of enemies. High skill ceiling.',
  weapon: { fireRate: 1.6, dmg: 42, pellets: 1, spread: 0.0, pierce: 3, projSpeed: 900, color: '#f0f' },
  startHp: 85,
});
loadoutRegistry.register('shotgun', {
  name: 'Breach Cannon', unlockCost: 40,
  desc: 'Five-pellet spread, devastating up close, weak at range.',
  weapon: { fireRate: 2.2, dmg: 11, pellets: 5, spread: 0.32, pierce: 0, projSpeed: 480, color: '#ff0' },
  startHp: 110,
});
