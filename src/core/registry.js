// Generic named-registry: the pattern behind every extensible content table
// in the game (enemies, upgrades, shop items, safehouse perks, bosses).
// Adding new content is "call register() from a content file", never
// "edit a switch statement in the game loop".
export function createRegistry(kind) {
  const items = new Map();
  return {
    register(id, def) {
      if (items.has(id)) console.warn(`[registry:${kind}] overwriting existing entry "${id}"`);
      const entry = { id, ...def };
      items.set(id, entry);
      return entry;
    },
    get(id) { return items.get(id); },
    has(id) { return items.has(id); },
    list() { return [...items.values()]; },
    ids() { return [...items.keys()]; },
  };
}
