# Game Two Recovery-First Rebuild Design

Date: 2026-05-14

## Direction

Game Two is a recovery-first clean rebuild of the lost demo base. The deployed Null Range demo and the `study-particle-landscape` terrain repo are reference material, not a source tree to copy verbatim. The goal is to recover the solid playable base that already existed, preserve the cockpit/radar/terrain identity, and rebuild it as maintainable Vite and Three.js modules.

Aesthetics are a core requirement, not garnish. The recovered look should protect the things the team is proud of: the particle terrain system, topographic terrain rendering, ground sonar reveal, star fields with a moon or celestial bodies, horizon fades, fog, scanlines, chromatic fringing, orange/black service-console UI, dense cockpit instrumentation, and the way visual information blooms and decays through the cockpit view.

The first milestone is not the full Starglider-style game. It is a playable radar-hunt vertical slice where terrain, radar, enemies, weapons, HUD, and audio all support one clear rhythm: isolate, ambush, kill, hide, relocate, hunt again.

## Architecture

Game Two should be rebuilt as a Vite and Three.js app with strict runtime boundaries:

- `render`: Three.js scene, postprocessing, terrain visual layers, ship and enemy visuals, projectiles, and effects.
- `terrain`: procedural height generation, CPU height sampling, sector validation, valley/ridge queries, and line-of-sight support.
- `flight`: player ship physics, terrain-skimming, boost, collision, and altitude safety.
- `radar`: passive contacts, active ping, ridge/line-of-sight exposure, contact confidence, and signature rules.
- `combat`: lasers, missile lock/reload, damage, salvage, credits, and kill events.
- `ai`: scout and gunship behaviors, local swarm alert states, search memory, and contact sharing.
- `hud`: cockpit overlays, radar scope, weapon status, boost/exposure status, and sector feedback.
- `audio`: engine, radar, weapons, alert, impact, boost, and ambient cockpit cues.
- `net-ready-state`: local authoritative game state shaped for later WebSocket sync, without implementing multiplayer in milestone one.

The visual terrain and gameplay terrain must share the same source. The topographic and particle layers can be shader-driven, but flight, cover, radar occlusion, AI visibility, projectile checks, and collision must query a CPU terrain sampler derived from the same procedural heightfield.

## Gameplay Loop

Each sector contains multiple enemy clusters, patrol pockets, or swarms separated by terrain. The player uses valleys to approach an isolated group while staying outside the detection envelope of nearby groups. A bad ping, careless ridge peek, or noisy escape can alert multiple swarms and compress the player from several directions.

The core loop is:

1. Read weak passive radar and choose an isolated target.
2. Use valleys to close distance while avoiding neighboring clusters.
3. Peek or ping only from favorable terrain.
4. Ambush with lasers or a slow-reload missile.
5. Hide immediately before other swarms converge.
6. Relocate through valleys while enemies search the last known area.
7. Repeat: hunt, kill, vanish, reassess.

The ground is not background. Valleys are stealth routes, ridges are information risks, and terrain is how the player controls alert propagation.

## Terrain And Radar

Terrain should preserve the recovered prototype approach: procedural heightfield rendered as stylized layers instead of a lit solid mesh.

The visual stack is:

- Topographic line layer for readable elevation, ridges, and valley shape.
- Particle/dot layer for density, motion, radar reveal, and atmospheric depth.
- Starfield/celestial layer with bright moon-like bodies, twinkle, chromatic highlights, horizon fade, and depth behind the terrain.
- Fog, CRT, scanline, vignette, bloom/fade, and postprocess effects for the cockpit-screen feeling.

The terrain module owns CPU-side sampling and analysis. It must answer:

- What is the terrain height at this position?
- Is the player below local ridge cover?
- Is there terrain-blocked line-of-sight between two points?
- Is this point part of a valley corridor, ridge, basin, or exposed high ground?
- Does this generated sector contain enough playable hiding routes and approach paths?

Terrain remains procedural, but generated sectors should be constrained and validated for gameplay. A sector should have valley corridors deep enough to hide in, ridgelines that create meaningful peek moments, radar shadow zones, enemy patrol routes with intermittent line-of-sight, and at least one safer approach plus one risky shortcut.

Radar is hybrid:

- Passive radar gives vague contact hints and motion traces, strongest near noisy or already-alert enemies.
- Active ping reveals more precise contacts and terrain echoes for a short time, but broadcasts the player position.
- Ground sonar is a primary terrain-reading mechanic. The normal forward view is intentionally narrow and close; pinging ground sonar should briefly reveal valleys, ridges, and route shape ahead so the player can plan the next hide/peek path.
- Peek exposure happens when the player climbs above local cover or crosses a ridge. It gives certainty but raises detection confidence.
- Radar confidence decays over time and is degraded or blocked by terrain.

Radar is gameplay, not decoration. The HUD scope must show uncertainty, last-known positions, ping waves, confirmed contacts, and swarm pressure clearly enough for tactical decisions.

Ground sonar visuals should feel like information arriving through a system: waves, pulses, bright contour/particle excitation, and clean fading rather than permanently lit terrain. The fade timing matters because it creates memory pressure: the player sees the valley route, commits it to short-term memory, then flies back into uncertainty.

## Enemies And Combat

Milestone one starts with two enemy roles because they prove the radar-hunt loop:

- Scout: fast, fragile, wide detection. Scouts investigate pings, ridge exposure, and last-known positions. Their job is to find and track the player.
- Gunship: slower, tougher, narrower detection. Gunships become dangerous when a scout or ping gives them enough confidence to converge.

Enemy clusters use alert states: idle patrol, suspicious, investigating, confirmed contact, attacking, searching, and cooling down. Alert propagates locally through clusters, but terrain and distance limit propagation so a bad position can alert multiple swarms without waking the whole sector instantly.

The architecture must support more enemy roles through data-driven definitions. Near-future roles include:

- Interceptor: fast pursuer that flushes the player out of valleys.
- Missile Frigate: long-range lock pressure that forces terrain breaks.
- Jammer: corrupts passive radar and creates false contacts.
- Sentry or Turret: fixed or slow-moving area denial near objectives.
- Carrier or Nest: local swarm source that escalates if ignored.
- Decoy or Probe: cheap contact that wastes pings or baits exposure.

Player tools:

- Lasers: reliable direct damage, useful for finishing, but firing increases signature and exposure.
- Missiles: special-key weapon with slow reload, built for ambush hit-and-runs. Lock quality depends on recent radar confidence or line-of-sight exposure.
- Boost: escape and repositioning tool with heat/noise cost.
- Radar ping: information weapon with stealth cost.

The desired combat rhythm is isolate, ambush, kill, dive, hide, relocate.

## HUD, Audio, And Start Flow

The HUD should recover the cockpit density of the old demo while protecting first-minute readability.

HUD layers:

- Radar scope as the primary gameplay instrument, showing uncertain passive contacts, confirmed contacts, ping waves, last-known positions, and swarm alert pressure.
- Forward ground-sonar feedback, separate from enemy radar, showing terrain shape ahead through temporary contour and particle excitation.
- Threat/status strip for exposure, lock warning, hull/shield, boost heat, and missile reload.
- Minimal sector readout for remaining clusters, credits/salvage, and objective state.
- Weapon feedback for laser heat, missile lock quality, and reload.
- Diegetic cockpit framing with scanlines, reticle, central dotted radar arcs, compass ticks, side gauges, diagnostics, boxed activity/leaderboard panels, and terminal labels, subordinate to radar readability.

Audio is gameplay feedback:

- Passive radar hum changes with contact density.
- Active ping is loud and satisfying, but risky.
- Enemy detection, search, and lock warnings are distinct.
- Boost and engine pitch communicate speed, altitude, and stress.
- Missile lock and reload have clear timing cues.
- Ambient cockpit loop preserves the old demo mood.

The start flow should be similar in tone, not identical to the old demo. It should offer quick callsign/start/settings and immediate launch. The orange/black service-console language, oversized condensed title type, black wireframe ship/loadout cards, clipped square icon buttons, tiny system-status copy, and terminal-like deploy/callsign controls should remain available as a strong reference. Ship services and upgrades can exist after landing or between sectors, but should not block the first playable loop.

Menus should preserve cockpit context when possible. A flight menu can overlay the live starfield/terrain view instead of replacing it, using orange controls, keycap labels, and simple blocky selected states.

## Milestone One Done Line

The first milestone is complete when:

- The Vite/Three.js app boots locally.
- Procedural two-layer terrain renders with topographic lines and particles/dots.
- CPU terrain sampling matches the visual terrain closely enough for flight, cover, and line-of-sight.
- The player can skim terrain, boost, fire lasers, ping radar, lock missiles, and fire missiles.
- A sector contains multiple enemy clusters.
- Scout and gunship AI use detection confidence, last-known position, terrain cover, and local alert propagation.
- The player can isolate a cluster, ambush, hide, relocate, and repeat.
- HUD communicates radar uncertainty, exposure, weapon status, and swarm pressure.
- Audio cues exist for radar, weapons, boost, alert, and cockpit ambience.
- Multiplayer is not implemented, but game state is structured so WebSocket sync can be added later.

## Testing

Automated tests should focus on risky game rules:

- Terrain height sampling.
- Line-of-sight checks over terrain.
- Radar confidence decay.
- Alert propagation between nearby clusters.
- Missile lock rules.
- Sector validation for playable valleys and ridges.

Required deterministic simulations:

- Active ping alerts a nearby cluster but not the whole sector.
- Diving below a ridge breaks or degrades enemy contact.
- A bad peek from exposed terrain can alert more than one cluster.

Browser verification should confirm that the canvas renders nonblank and HUD elements do not overlap on desktop and mobile landscape viewports.

Manual playtest checklist:

- Can the player read passive radar and choose an isolated target?
- Does ground sonar reveal valleys far enough ahead to plan, while still fading quickly enough to preserve tension?
- Can the player approach through valleys without being instantly detected?
- Does peeking provide useful information and real risk?
- Does active ping feel powerful but dangerous?
- Do the particle terrain, topographic lines, starfield/celestial backdrop, orange/yellow HUD language, fog, scanlines, chromatic fringing, and fades carry the intended aesthetic identity?
- Can the player kill, hide, relocate, and hunt again?
- Does alert propagation feel local and positional rather than omniscient?

## Explicit Non-Goals For Milestone One

- Full multiplayer implementation.
- Full campaign progression.
- Large upgrade economy.
- Many enemy types beyond scout and gunship.
- Pixel-perfect recreation of the old start screen.
- Solid terrain materials or lighting-heavy terrain rendering.
