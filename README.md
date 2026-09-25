# Neon Breach: Rootkit

Cyberpunk survival roguelite. Canvas 2D, vanilla JS, zero dependencies, zero build step.

## Run it locally

ES modules require a real HTTP origin (browsers block `import` over `file://`).
Any static file server works:

```
python -m http.server 8420
# or
npx serve .
```

Then open the printed localhost URL.

## Deploying

This is a static site — `index.html` + `style.css` + `src/**/*.js`. Upload the
`neon-breach/` folder as-is to any static host (GitHub Pages, Netlify, Vercel,
Cloudflare Pages, itch.io as an HTML5 game). No build step required.

## Architecture

```
src/
  core/       engine plumbing: canvas, input, audio, camera, save, the
              event bus, the registry helper, the shared "world" blackboard
  systems/    stateless-ish gameplay systems: particles, projectiles,
              status effects, pickups
  entities/   Player, EnemyBase + the 7 enemy classes, BossBase + the 3 bosses
  content/    pure data tables: loadouts, upgrades, shop items, safehouse perks
  game.js     the state machine (init/update/draw/wave logic) — no DOM code
  ui.js       all DOM/overlay wiring — no game-loop code
  main.js     bootstrap: wires input, starts the loop
```

### Why it's split this way

The original build was a single 1,533-line file with every system, every
piece of content, and all DOM wiring interleaved in one closure. That made
"add one enemy" or "add one upgrade" a scroll-and-splice operation across
unrelated code. Three things fix that:

1. **Content lives in registries, not switch statements.** `enemyTypeRegistry`,
   `upgradeRegistry`, `shopItemRegistry`, `safehouseItemRegistry`,
   `loadoutRegistry`, `bossRegistry` — each is a `{register, get, list}` map
   (`src/core/registry.js`). Adding content is one `registry.register(id, {...})`
   call in the relevant `content/` or `entities/` file. `game.js` never
   hardcodes a list of enemies or upgrades; it asks the registry.
2. **Entities talk through an event bus, not through the `Game` singleton.**
   `EventBus` (`src/core/eventBus.js`) decouples "a thing happened"
   (`enemy:killed`, `player:levelup`, `player:death`, `pickup:shard`,
   `ui:showShop`, ...) from "what reacts to it." `game.js` subscribes to the
   facts it cares about; `ui.js` subscribes to the ones it cares about.
   Neither entities nor systems import the `Game` object at all — a new
   system (achievements, analytics, a quest log) can listen to the same
   events without editing entity code.
3. **`game.js` and `ui.js` are hard-separated.** The state machine has zero
   `document.*` calls; all DOM/overlay work is in `ui.js`, driven by the same
   event bus. This is what makes the play logic testable/scriptable
   independent of the page (see manual QA notes below) and is also what a
   future engine swap (say, moving rendering to WebGL or React-based UI
   overlays) would need already true.

### Adding new content (the common cases)

- **New enemy type:** add a class extending `EnemyBase` in
  `src/entities/enemies.js` (or its own file), then
  `enemyTypeRegistry.register('id', { cls, weight, minWave })`.
- **New boss:** write a `makeXxx(wave)` factory in `src/entities/bosses.js`
  that builds a `BossBase` with an `attacks` array, then
  `bossRegistry.register('waveNumber', { wave, factory })`.
- **New level-up upgrade:** one line in `src/content/upgrades.js`:
  `upgradeRegistry.register('id', { name, desc, tag, apply(player) {...} })`.
- **New shop item / Safehouse perk:** same pattern in
  `src/content/shopItems.js` / `src/content/safehouseItems.js`.
- **New loadout:** same pattern in `src/content/loadouts.js`; gate it behind
  a Safehouse unlock by adding a `type:'loadout'` entry in
  `safehouseItems.js` referencing its id.
- **New cross-cutting system** (achievements, analytics, daily challenges):
  subscribe to `EventBus` events in a new file imported from `main.js`.
  It needs no changes to `game.js`, entities, or content files.

### Known pre-existing quirks (carried over from the original file, not introduced by this refactor)

- A `Turret` can spawn just off-canvas (edge spawn logic) and, since turrets
  never move, stay permanently off-screen and unreachable for that run.
- The muzzle offset (`player.r + 6` ahead of the player, along the aim angle)
  means a target standing essentially on top of the player can end up on the
  far side of the bullet's spawn point and get missed by fast weapons at
  true point-blank range.
- `button:disabled` is styled in `style.css` but never toggled from JS —
  unaffordable shop/Safehouse items are still clickable (they just no-op).
- Settings (volume/shake/flash) are in-memory only and reset on reload; only
  Safehouse progress persists.

These (plus everything else worth fixing) are catalogued with concrete fixes
in the improvements report delivered alongside this refactor.
