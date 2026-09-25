// Run-scoped level-up upgrade pool. Add a new upgrade by registering an
// {name, desc, tag, apply(player)} entry — it enters the random pick pool
// automatically, no other file needs to change.
import { createRegistry } from '../core/registry.js';

export const upgradeRegistry = createRegistry('upgrade');

upgradeRegistry.register('firerate', { name: 'Overclock', desc: '+22% fire rate', tag: 'stat', apply: p => p.fireRateMult *= 1.22 });
upgradeRegistry.register('dmg', { name: 'Damage Boost', desc: '+25% damage', tag: 'stat', apply: p => p.dmgMult *= 1.25 });
upgradeRegistry.register('hp', { name: 'Vitality Patch', desc: '+25 max HP, full heal', tag: 'stat', apply: p => { p.maxHp += 25; p.hp = p.maxHp; } });
upgradeRegistry.register('speed', { name: 'Servo Upgrade', desc: '+14% move speed', tag: 'stat', apply: p => p.speedMult *= 1.14 });
upgradeRegistry.register('pierce', { name: 'Piercing Rounds', desc: 'Projectiles pierce +1 enemy', tag: 'build', apply: p => p.pierce += 1 });
upgradeRegistry.register('dash', { name: 'Dash Capacitor', desc: '-22% dash cooldown', tag: 'build', apply: p => p.dashCdMult *= 0.78 });
upgradeRegistry.register('twin', { name: 'Twin Barrel', desc: 'Fire an additional parallel shot', tag: 'build', apply: p => p.extraPellets += 1 });
upgradeRegistry.register('emp', { name: 'EMP Rounds', desc: 'Hits have a chance to briefly stun', tag: 'element', apply: p => p.empChance = Math.min(0.6, p.empChance + 0.18) });
upgradeRegistry.register('virus', { name: 'Viral Payload', desc: 'Hits apply damage-over-time', tag: 'element', apply: p => p.virusChance = Math.min(0.6, p.virusChance + 0.18) });
upgradeRegistry.register('lifesteal', { name: 'Data Leech', desc: '2% of damage dealt heals you', tag: 'build', apply: p => p.lifesteal += 0.02 });
upgradeRegistry.register('crit', { name: 'Exploit Chip', desc: '+12% crit chance (2x dmg)', tag: 'build', apply: p => p.critChance = Math.min(0.75, p.critChance + 0.12) });
upgradeRegistry.register('magnet', { name: 'Pickup Magnet', desc: 'Bigger pickup radius', tag: 'stat', apply: p => p.magnetMult *= 1.5 });

// Exploit-system synergies — these are what make builds combo off the
// Exposed/Overload mechanic instead of just stacking flat stats.
upgradeRegistry.register('zeroday', { name: 'Zero-Day Exploit', desc: '+25% damage against exposed enemies', tag: 'exploit', apply: p => p.exploitDmgMult *= 1.25 });
upgradeRegistry.register('extaccess', { name: 'Extended Access', desc: '+30% exposed-window duration', tag: 'exploit', apply: p => p.exposeDurationMult *= 1.3 });
upgradeRegistry.register('capacitor', { name: 'Overload Capacitor', desc: '-20% Overload cooldown', tag: 'exploit', apply: p => p.overloadCdMult *= 0.8 });
upgradeRegistry.register('cascade', { name: 'Cascade Protocol', desc: 'Exploit kills have a chance to expose a nearby enemy', tag: 'exploit', apply: p => p.cascadeChance = Math.min(0.75, p.cascadeChance + 0.25) });
upgradeRegistry.register('chainexploit', { name: 'Chain Exploit', desc: 'Exploit kills refund 1.5s of Overload cooldown', tag: 'exploit', apply: p => p.overloadRefund += 1.5 });
