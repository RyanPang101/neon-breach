// Safehouse meta-unlocks, spent with persistent Data Cores across runs.
import { createRegistry } from '../core/registry.js';

export const safehouseItemRegistry = createRegistry('safehouseItem');

safehouseItemRegistry.register('unlock_sniper', { name: 'Unlock: Deep Scanner', desc: 'Unlocks the sniper loadout', cost: 40, type: 'loadout', ref: 'sniper' });
safehouseItemRegistry.register('unlock_shotgun', { name: 'Unlock: Breach Cannon', desc: 'Unlocks the shotgun loadout', cost: 40, type: 'loadout', ref: 'shotgun' });
safehouseItemRegistry.register('perm_hp', { name: 'Cybernetic Core', desc: '+10 starting max HP, all runs', cost: 30, type: 'perk', stack: true, max: 5 });
safehouseItemRegistry.register('perm_dmg', { name: 'Overclocked Firmware', desc: '+6% starting damage, all runs', cost: 35, type: 'perk', stack: true, max: 5 });
safehouseItemRegistry.register('perm_twin', { name: 'Pre-installed Twin Barrel', desc: 'Start every run with Twin Barrel active', cost: 80, type: 'perk', stack: false });
safehouseItemRegistry.register('perm_shards', { name: 'Shard Compressor', desc: '+15% Data Shard gain, all runs', cost: 50, type: 'perk', stack: true, max: 3 });
