# Graph Report - neon-breach  (2026-10-14)

## Corpus Check
- 30 files · ~11,677 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 163 nodes · 487 edges · 14 communities (9 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f078b067`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- rand
- ui.js
- enemies.js
- game.js
- angleTo
- Turret
- particles.js
- EnemyBase
- player.js
- eventBus.js
- dist
- .update
- .update
- Pickup

## God Nodes (most connected - your core abstractions)
1. `rand()` - 28 edges
2. `EnemyBase` - 21 edges
3. `angleTo()` - 19 edges
4. `isStunned()` - 16 edges
5. `clamp()` - 15 edges
6. `burst()` - 13 edges
7. `BossBase` - 12 edges
8. `initUI()` - 12 edges
9. `AudioSys` - 11 edges
10. `ctx` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Adding new content (the common cases)` --references--> `BossBase`  [INFERRED]
  README.md → src/entities/bossBase.js
- `Known pre-existing quirks (carried over from the original file, not introduced by this refactor)` --references--> `Turret`  [INFERRED]
  README.md → src/entities/enemies.js
- `Adding new content (the common cases)` --references--> `EnemyBase`  [INFERRED]
  README.md → src/entities/enemyBase.js
- `particlePool` --calls--> `rand()`  [EXTRACTED]
  src/systems/particles.js → src/core/utils.js
- `drawDamageNumbers()` --calls--> `clamp()`  [EXTRACTED]
  src/systems/damageNumbers.js → src/core/utils.js

## Import Cycles
- None detected.

## Communities (14 total, 5 thin omitted)

### Community 0 - "rand"
Cohesion: 0.12
Nodes (14): clamp(), rand(), BossBase, bossRegistry, getBossFactoryForWave(), isBossWave(), makeFirewallSentinel(), makeMainframeGuardian() (+6 more)

### Community 1 - "ui.js"
Cohesion: 0.19
Nodes (17): loadoutRegistry, safehouseItemRegistry, shopItemRegistry, upgradeRegistry, createRegistry(), hide(), hideAllOverlays(), initUI() (+9 more)

### Community 2 - "enemies.js"
Cohesion: 0.23
Nodes (8): AudioSys, angleDiff(), choice(), World, enemyTypeRegistry, ELITE_TRAITS, applyStatus(), updateStatus()

### Community 3 - "game.js"
Cohesion: 0.26
Nodes (8): CONFIG, SAVE_KEY, Save, clearProjectiles(), drawProjectiles(), getActiveProjectiles(), projPool, updateProjectiles()

### Community 4 - "angleTo"
Cohesion: 0.29
Nodes (4): angleTo(), Drone, Hunter, isStunned()

### Community 5 - "Turret"
Cohesion: 0.18
Nodes (8): Adding new content (the common cases), Architecture, Deploying, Known pre-existing quirks (carried over from the original file, not introduced by this refactor), Neon Breach: Rootkit, Run it locally, Why it's split this way, Turret

### Community 6 - "particles.js"
Cohesion: 0.22
Nodes (7): makePool(), clearDamageNumbers(), drawDamageNumbers(), updateDamageNumbers(), clearParticles(), particlePool, updateParticles()

### Community 8 - "player.js"
Cohesion: 0.44
Nodes (6): Camera, canvas, ctx, H, W, Settings

### Community 9 - "eventBus.js"
Cohesion: 0.43
Nodes (3): EventBus, Input, Game

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `EnemyBase` connect `EnemyBase` to `rand`, `enemies.js`, `angleTo`, `Turret`, `dist`, `.update`, `.update`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Should `rand` be split into smaller, more focused modules?**
  _Cohesion score 0.12169312169312169 - nodes in this community are weakly interconnected._
- **Why does `rand()` connect `rand` to `enemies.js`, `game.js`, `angleTo`, `Turret`, `particles.js`, `player.js`, `dist`, `.update`, `.update`, `Pickup`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._