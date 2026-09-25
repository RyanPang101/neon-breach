// In-run Black Market items, bought with per-run Data Shards.
import { createRegistry } from '../core/registry.js';

export const shopItemRegistry = createRegistry('shopItem');

shopItemRegistry.register('heal', {
  name: 'Field Repair', desc: 'Heal 40% of max HP', cost: 15, repeatable: true,
  apply: p => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); },
});
shopItemRegistry.register('twinshop', {
  name: 'Twin Barrel', desc: 'Fire an additional parallel shot', cost: 35, repeatable: false,
  apply: p => { p.extraPellets += 1; },
});
shopItemRegistry.register('dmgshop', {
  name: 'Damage Coil', desc: '+20% damage, permanent this run', cost: 30, repeatable: true,
  apply: p => { p.dmgMult *= 1.2; },
});
shopItemRegistry.register('armor', {
  name: 'Nanoweave Armor', desc: '+30 max HP', cost: 25, repeatable: true,
  apply: p => { p.maxHp += 30; p.hp += 30; },
});
shopItemRegistry.register('rerollup', {
  name: 'Upgrade Reroll', desc: 'Guaranteed pick of 4 (instead of 3) next level-up', cost: 20, repeatable: true,
  apply: p => { p.bonusUpgradeChoice = (p.bonusUpgradeChoice || 0) + 1; },
});
