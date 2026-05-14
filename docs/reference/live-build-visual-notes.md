# Live Build Visual Reference Notes

Date: 2026-05-14

These notes summarize live-build screenshots provided by the user for Game Two recovery work. The screenshots should be treated as visual direction anchors alongside the locally downloaded deployed build in `references/nullrange-live-build`.

## Start And Services Screen

- Strong orange field with black technical panels.
- Oversized condensed title typography; typography is part of the identity, not generic UI.
- Left side contains a dark terrain/topographic strip with faint blue/green contour lines.
- Upper-left system copy uses tiny monospaced status text: `SYS.STAT`, uplink/security, coordinates.
- Top-right icon buttons are black, square, clipped/notched, and utilitarian.
- Ship cards use black panels with orange wireframe ship renderings.
- Loadout cards are blocky, minimal, and high-contrast.
- Callsign entry and deploy button are large, terminal-like, and tactile.
- The start flow can change for Game Two, but the high-contrast orange/black service-console identity should remain available as a design mode.

## In-Flight View

- Primary world is black space with a bright cyan-white moon/celestial body, starfield dust, chromatic fringing, scanlines, and soft horizon fades.
- Terrain is a stylized data surface, not a solid lit mesh: cyan/green topographic lines plus dense RGB particle/dot fields.
- Valleys are visible through terrain contour density and sonar/radar excitation; readability depends on line/particle fade behavior.
- The view is intentionally narrow and cockpit-like. Ground sonar/pulse should reveal route shape ahead rather than keeping the terrain permanently readable.
- HUD color is mostly orange/yellow with cyan used for shield/terrain/sonar accents.
- Top-center compass uses dense tick marks, headings, and small target/status indicators.
- Upper-left activity feed is boxed and terse.
- Upper-right leaderboard/session panel is boxed, dense, and diegetic.
- Left-side stats are small boxed counters: kills, held, heat, credits.
- Bottom-center cockpit strip includes ship icon, hull/shield bars, curved horizon/reticle line, and a central concentric sonar/radar instrument.
- Central reticle and large dotted radar arcs frame the world without hiding the terrain.

## Flight Menu Overlay

- Menu overlays do not replace the world; they sit over the live terrain/starfield view.
- Orange typography and controls remain consistent with the cockpit HUD.
- Controls are shown as small keycaps with labels: throttle, strafe, steer, boost, pulse, services.
- Settings use simple horizontal controls and blocky selected states.
- The moon/starfield/terrain backdrop remains visible, keeping the player in the cockpit context.

## Protected Aesthetic Principles

- Preserve the particle terrain, topographic terrain lines, ground sonar reveal, bright celestial/starfield backdrop, CRT scanlines, chromatic fringing, and fading information layers.
- Avoid generic glassmorphism, rounded sci-fi cards, photoreal terrain, or conventional flight-sim panels.
- Treat the interface as a readable machine: harsh contrast, tiny status language, dense but disciplined instrumentation, and information that pulses/fades in time.
