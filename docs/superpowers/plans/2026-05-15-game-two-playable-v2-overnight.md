# Game Two Playable V2 Overnight Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current aesthetic/terrain slice into a playable radar-hunt v2 where the player can scan, reveal contacts, alert enemy clusters, ambush with lasers/missiles, hide behind terrain, and clear a sector.

**Architecture:** Keep the current `Game` class as the local-authoritative orchestrator and add focused rule modules for radar contacts, enemy runtime, weapons, and feedback. Multiplayer remains skipped, but all runtime state should stay serializable and deterministic enough to slot into a future sync layer.

**Tech Stack:** Vite, TypeScript, Three.js, Vitest, Playwright.

---

## File Structure

- Create: `src/radar/radarModel.ts` - contact confidence, ping exposure, terrain occlusion, last-known positions.
- Create: `src/combat/weapons.ts` - laser/missile state, reloads, projectile lifecycle, hit events.
- Create: `src/ai/enemies.ts` - enemy instances, cluster alert states, local propagation, searching/cooling behavior.
- Create: `src/audio/AudioBus.ts` - browser-safe cue facade.
- Modify: `src/terrain/sector.ts` - richer cluster alert state and support enemy runtime seeds.
- Modify: `src/game/state.ts` - net-ready entity kinds for enemies/projectiles.
- Modify: `src/game/Game.ts` - integrate radar, sector, enemies, combat, scoring, and cues.
- Modify: `src/render/terrainVisuals.ts` or create render helpers only if enemy/projectile markers need Three.js visuals.
- Modify: `src/styles.css` / `src/main.ts` - HUD status readouts only where needed.
- Test: `tests/radarModel.test.ts`, `tests/combat.test.ts`, `tests/enemies.test.ts`, targeted integration tests.

---

## Task 1: Radar Contact Confidence

- [ ] Add tests proving active ping reveals nearby contacts but not all clusters.
- [ ] Add tests proving terrain occlusion and cover degrade contact confidence.
- [ ] Implement `RadarContact` state with `confidence`, `lastKnownPosition`, `age`, `source`, and `clusterId`.
- [ ] Implement contact decay so stale contacts become uncertain ghosts.
- [ ] Keep API independent of Three.js and DOM.

## Task 2: Combat And Weapons

- [ ] Add tests for laser heat, missile lock confidence, slow reload, projectile travel, and damage events.
- [ ] Implement `WeaponState`, laser fire, missile fire, projectile updates, hit detection, and weapon signature costs.
- [ ] Keep rules deterministic and serializable.

## Task 3: Enemy Runtime And Alert Propagation

- [ ] Expand cluster alert states to `idle`, `suspicious`, `investigating`, `confirmed`, `attacking`, `searching`, `cooling`.
- [ ] Add tests for local ping alert, no global omniscience, diving behind ridge to degrade contact, and last-known search.
- [ ] Implement scout/gunship definitions and per-enemy runtime positions.
- [ ] Implement cluster transitions based on radar confidence, player exposure, terrain occlusion, and damage.

## Task 4: Game Integration

- [ ] Instantiate sector, radar contacts, enemy runtime, and weapons in `Game`.
- [ ] Map controls: `Space` sonar ping, primary laser, special missile key.
- [ ] Feed scan-memory ping into radar/enemy alert rules.
- [ ] Apply damage, kills, credits/salvage, and cleared-sector objective.
- [ ] Add lightweight enemy/projectile markers so combat is playable before bespoke ship art.

## Task 5: HUD, Audio, And Verification

- [ ] Add status readouts for contacts, threat, missiles, heat, kills, credits, and objective progress.
- [ ] Add safe Web Audio cues for ping, laser, missile, hit, alert, and kill.
- [ ] Run `npm test`, `npm run build`, and a Playwright visual sanity check.
- [ ] Commit and push the completed v2 slice.

---

## Done Line

- The player can fly through the heightmap terrain with low FOW.
- Sonar reveals terrain and radar contacts temporarily.
- Enemy clusters react locally to pings, exposure, and attacks.
- The player can isolate a cluster, kill enemies, hide, and continue hunting.
- HUD communicates contact confidence, threat, weapon status, and sector progress.
- Tests and build pass.
