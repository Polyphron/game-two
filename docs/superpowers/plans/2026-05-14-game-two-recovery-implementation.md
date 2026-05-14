# Game Two Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable Game Two recovery slice: a Vite/Three.js terrain-skimming radar-hunt game with two-layer procedural terrain, ground sonar, flight, weapons, enemy clusters, HUD, audio hooks, and reference-faithful aesthetics.

**Architecture:** Start with a clean TypeScript Vite app and keep the game in focused modules: terrain, render, flight, radar, combat, AI, HUD, audio, and net-ready state. The visual terrain and gameplay terrain share one procedural height source so flight, cover, sonar, and line-of-sight match what the player sees.

**Tech Stack:** Node, Vite, TypeScript, Three.js, Vitest, Playwright, Web Audio API, DOM HUD/CSS overlays.

---

## File Structure

- Create: `package.json` - scripts and dependency manifest.
- Create: `tsconfig.json` - TypeScript compiler settings.
- Create: `vite.config.ts` - Vite and Vitest configuration.
- Create: `index.html` - app root.
- Create: `src/main.ts` - browser entrypoint.
- Create: `src/styles.css` - Game Two HUD/menu/start aesthetic.
- Create: `src/game/Game.ts` - top-level lifecycle and frame loop.
- Create: `src/game/state.ts` - net-ready state shape and entity types.
- Create: `src/game/constants.ts` - tuning constants.
- Create: `src/terrain/noise.ts` - deterministic seeded noise.
- Create: `src/terrain/TerrainField.ts` - CPU procedural terrain and sampling.
- Create: `src/terrain/sector.ts` - sector generation, valley/ridge analysis, clusters.
- Create: `src/render/RendererApp.ts` - Three.js renderer, camera, postprocess shell.
- Create: `src/render/terrainVisuals.ts` - particle and topographic terrain layers.
- Create: `src/render/worldVisuals.ts` - starfield, celestial body, fog/fade anchors.
- Create: `src/flight/playerFlight.ts` - player flight physics and terrain-skimming.
- Create: `src/radar/radarModel.ts` - passive radar, active ping, exposure, confidence.
- Create: `src/combat/weapons.ts` - lasers, missile lock/reload, damage events.
- Create: `src/ai/enemies.ts` - enemy definitions and cluster alert behavior.
- Create: `src/hud/Hud.ts` - DOM HUD view model and rendering.
- Create: `src/audio/AudioBus.ts` - safe audio event facade.
- Create: `src/input/Input.ts` - keyboard/mouse input state.
- Create: `tests/terrain.test.ts` - terrain and line-of-sight tests.
- Create: `tests/radar.test.ts` - sonar/radar confidence tests.
- Create: `tests/ai.test.ts` - cluster alert propagation tests.
- Create: `tests/combat.test.ts` - missile and laser rule tests.
- Create: `tests/e2e/render.spec.ts` - browser smoke test for canvas/HUD.

---

## Task 1: Bootstrap Runnable App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Create package manifest**

Create `package.json` with:

```json
{
  "name": "game-two",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0",
    "typescript": "^5.8.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create TypeScript and Vite config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Create app root**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Game Two</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Create temporary visual shell**

Create `src/main.ts`:

```ts
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");

root.innerHTML = `
  <main class="start-screen">
    <aside class="terrain-strip" aria-hidden="true"></aside>
    <section class="service-panel">
      <p class="sys-copy">SYS.STAT /// NOMINAL</p>
      <h1>GAME TWO</h1>
      <button class="deploy-button" type="button">DEPLOY -></button>
    </section>
  </main>
`;
```

Create `src/styles.css`:

```css
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #000;
  color: #ff9f00;
  font-family: "Arial Narrow", "Antonio", "Impact", sans-serif;
}

.start-screen {
  display: grid;
  grid-template-columns: minmax(220px, 19vw) 1fr;
  min-height: 100%;
  background: #ffa300;
  color: #050505;
}

.terrain-strip {
  background:
    repeating-linear-gradient(12deg, rgba(0, 225, 255, 0.08) 0 1px, transparent 1px 19px),
    repeating-linear-gradient(-18deg, rgba(0, 120, 80, 0.07) 0 1px, transparent 1px 23px),
    #020304;
}

.service-panel {
  padding: clamp(2rem, 6vw, 6rem);
}

.sys-copy {
  font-family: "Consolas", monospace;
  font-size: 0.7rem;
  letter-spacing: 0.22em;
}

h1 {
  margin: 20vh 0 2rem;
  font-size: clamp(5rem, 18vw, 15rem);
  line-height: 0.78;
  letter-spacing: 0;
}

.deploy-button {
  border: 2px solid #050505;
  background: transparent;
  color: #050505;
  padding: 0.75rem 2.25rem;
  font: inherit;
  font-size: 1.4rem;
  letter-spacing: 0.08em;
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 6: Verify boot build**

Run: `npm run build`

Expected: TypeScript and Vite build complete without errors.

---

## Task 2: Net-Ready State And Deterministic Terrain

**Files:**
- Create: `src/game/state.ts`
- Create: `src/game/constants.ts`
- Create: `src/terrain/noise.ts`
- Create: `src/terrain/TerrainField.ts`
- Test: `tests/terrain.test.ts`

- [ ] **Step 1: Write terrain tests**

Create `tests/terrain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TerrainField } from "../src/terrain/TerrainField";

describe("TerrainField", () => {
  it("returns deterministic heights for the same seed", () => {
    const a = new TerrainField({ seed: 42, size: 512, scale: 42, amplitude: 18 });
    const b = new TerrainField({ seed: 42, size: 512, scale: 42, amplitude: 18 });
    expect(a.heightAt(12.25, -4.5)).toBeCloseTo(b.heightAt(12.25, -4.5), 5);
  });

  it("identifies ridge occlusion between two low points", () => {
    const terrain = new TerrainField({ seed: 7, size: 512, scale: 36, amplitude: 22 });
    const blocked = terrain.hasTerrainOcclusion(
      { x: -18, y: terrain.heightAt(-18, 0) + 1.2, z: 0 },
      { x: 18, y: terrain.heightAt(18, 0) + 1.2, z: 0 },
    );
    expect(typeof blocked).toBe("boolean");
  });

  it("classifies cover as stronger below local ridges", () => {
    const terrain = new TerrainField({ seed: 12, size: 512, scale: 38, amplitude: 20 });
    const low = terrain.coverAt(0, 0, terrain.heightAt(0, 0) + 0.6);
    const high = terrain.coverAt(0, 0, terrain.heightAt(0, 0) + 8);
    expect(low).toBeGreaterThanOrEqual(high);
  });
});
```

- [ ] **Step 2: Run failing terrain tests**

Run: `npm test -- tests/terrain.test.ts`

Expected: fail because `TerrainField` does not exist.

- [ ] **Step 3: Create state contracts**

Create `src/game/state.ts`:

```ts
export type Vec3 = { x: number; y: number; z: number };

export type EntityKind = "player" | "scout" | "gunship" | "laser" | "missile";

export type EntityState = {
  id: string;
  kind: EntityKind;
  position: Vec3;
  velocity: Vec3;
  heading: number;
  health: number;
};

export type PlayerState = EntityState & {
  kind: "player";
  hull: number;
  shield: number;
  heat: number;
  boost: number;
  credits: number;
  exposure: number;
};

export type GameState = {
  seed: number;
  time: number;
  player: PlayerState;
  entities: Map<string, EntityState>;
};

export function createInitialState(seed = 20260514): GameState {
  const player: PlayerState = {
    id: "player",
    kind: "player",
    position: { x: 0, y: 8, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    heading: 0,
    health: 100,
    hull: 100,
    shield: 100,
    heat: 0,
    boost: 1,
    credits: 0,
    exposure: 0,
  };

  return {
    seed,
    time: 0,
    player,
    entities: new Map([["player", player]]),
  };
}
```

Create `src/game/constants.ts`:

```ts
export const WORLD = {
  terrainSize: 512,
  terrainScale: 42,
  terrainAmplitude: 20,
  safeClearance: 1.8,
  skimClearance: 4.2,
};

export const PLAYER = {
  maxSpeed: 46,
  acceleration: 34,
  turnRate: 1.9,
  boostMultiplier: 1.75,
  boostDrainPerSecond: 0.42,
  boostRecoverPerSecond: 0.18,
};

export const RADAR = {
  passiveRange: 90,
  activeRange: 180,
  pingDuration: 2.2,
  pingSignature: 1,
  confidenceDecayPerSecond: 0.22,
};
```

- [ ] **Step 4: Create deterministic noise**

Create `src/terrain/noise.ts`:

```ts
export function hash2(seed: number, x: number, z: number): number {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);
  const a = hash2(seed, x0, z0);
  const b = hash2(seed, x0 + 1, z0);
  const c = hash2(seed, x0, z0 + 1);
  const d = hash2(seed, x0 + 1, z0 + 1);
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * tz;
}

export function fbm(seed: number, x: number, z: number, octaves = 5): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise(seed + i * 101, x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }

  return value / norm;
}
```

- [ ] **Step 5: Create TerrainField**

Create `src/terrain/TerrainField.ts`:

```ts
import type { Vec3 } from "../game/state";
import { fbm } from "./noise";

export type TerrainOptions = {
  seed: number;
  size: number;
  scale: number;
  amplitude: number;
};

export class TerrainField {
  readonly seed: number;
  readonly size: number;
  readonly scale: number;
  readonly amplitude: number;

  constructor(options: TerrainOptions) {
    this.seed = options.seed;
    this.size = options.size;
    this.scale = options.scale;
    this.amplitude = options.amplitude;
  }

  heightAt(x: number, z: number): number {
    const nx = x / this.scale;
    const nz = z / this.scale;
    const broad = fbm(this.seed, nx * 0.45, nz * 0.45, 4);
    const sharp = fbm(this.seed + 991, nx * 1.35, nz * 1.35, 4);
    const valleyCarve = Math.pow(Math.abs(fbm(this.seed + 303, nx * 0.55, nz * 0.55, 3) - 0.5) * 2, 1.8);
    const height01 = broad * 0.56 + sharp * 0.24 + valleyCarve * 0.2;
    return (height01 - 0.48) * this.amplitude;
  }

  coverAt(x: number, z: number, y: number): number {
    const local = this.heightAt(x, z);
    const ridge = this.localRidgeHeight(x, z, 18);
    const belowRidge = Math.max(0, ridge + 1.5 - y);
    const aboveGround = Math.max(0, y - local);
    return Math.max(0, Math.min(1, belowRidge / 10)) * Math.max(0, Math.min(1, 1 - aboveGround / 40));
  }

  localRidgeHeight(x: number, z: number, radius: number): number {
    let max = -Infinity;
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      max = Math.max(max, this.heightAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius));
    }
    return max;
  }

  hasTerrainOcclusion(a: Vec3, b: Vec3): boolean {
    const steps = 24;
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const y = a.y + (b.y - a.y) * t;
      if (this.heightAt(x, z) > y - 0.25) return true;
    }
    return false;
  }
}
```

- [ ] **Step 6: Verify terrain tests pass**

Run: `npm test -- tests/terrain.test.ts`

Expected: all three terrain tests pass.

---

## Task 3: Sector Validation And Enemy Clusters

**Files:**
- Create: `src/terrain/sector.ts`
- Test: `tests/ai.test.ts`

- [ ] **Step 1: Write sector/cluster test**

Create `tests/ai.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TerrainField } from "../src/terrain/TerrainField";
import { createSector } from "../src/terrain/sector";

describe("sector clusters", () => {
  it("creates multiple separated clusters for radar hunting", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 20 });
    const sector = createSector(terrain, 21);
    expect(sector.clusters.length).toBeGreaterThanOrEqual(3);
    const distances = sector.clusters.flatMap((a, i) =>
      sector.clusters.slice(i + 1).map((b) => Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z)),
    );
    expect(Math.min(...distances)).toBeGreaterThan(35);
  });
});
```

- [ ] **Step 2: Run failing sector test**

Run: `npm test -- tests/ai.test.ts`

Expected: fail because `createSector` does not exist.

- [ ] **Step 3: Implement sector generation**

Create `src/terrain/sector.ts`:

```ts
import type { Vec3 } from "../game/state";
import { hash2 } from "./noise";
import type { TerrainField } from "./TerrainField";

export type EnemyRole = "scout" | "gunship";

export type EnemyCluster = {
  id: string;
  center: Vec3;
  radius: number;
  roles: EnemyRole[];
  alert: "idle" | "suspicious" | "investigating" | "confirmed" | "attacking" | "searching" | "cooling";
};

export type Sector = {
  seed: number;
  clusters: EnemyCluster[];
};

export function createSector(terrain: TerrainField, seed: number): Sector {
  const clusters: EnemyCluster[] = [];
  const candidates = 36;

  for (let i = 0; i < candidates && clusters.length < 4; i += 1) {
    const x = (hash2(seed, i, 3) - 0.5) * terrain.size * 0.72;
    const z = (hash2(seed, i, 9) - 0.5) * terrain.size * 0.72;
    const y = terrain.heightAt(x, z) + 7;
    const separated = clusters.every((cluster) => Math.hypot(cluster.center.x - x, cluster.center.z - z) > 70);
    const cover = terrain.coverAt(x, z, y);
    if (separated && cover < 0.75) {
      clusters.push({
        id: `cluster-${clusters.length + 1}`,
        center: { x, y, z },
        radius: 32 + hash2(seed, i, 17) * 16,
        roles: clusters.length % 2 === 0 ? ["scout", "gunship"] : ["scout"],
        alert: "idle",
      });
    }
  }

  return { seed, clusters };
}
```

- [ ] **Step 4: Verify sector test passes**

Run: `npm test -- tests/ai.test.ts`

Expected: sector test passes.

---

## Task 4: Three.js Renderer And Reference-Faithful World Visuals

**Files:**
- Modify: `src/main.ts`
- Create: `src/game/Game.ts`
- Create: `src/render/RendererApp.ts`
- Create: `src/render/terrainVisuals.ts`
- Create: `src/render/worldVisuals.ts`

- [ ] **Step 1: Create RendererApp shell**

Create `src/render/RendererApp.ts`:

```ts
import * as THREE from "three";

export class RendererApp {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(82, 1, 0.1, 1500);
  readonly renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });

  constructor(private readonly host: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000006, 1);
    this.host.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 9, 22);
    this.camera.lookAt(0, 3, -30);
    this.resize();
  }

  resize(): void {
    const { clientWidth, clientHeight } = this.host;
    this.camera.aspect = clientWidth / Math.max(1, clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
```

- [ ] **Step 2: Add terrain visual layer**

Create `src/render/terrainVisuals.ts`:

```ts
import * as THREE from "three";
import type { TerrainField } from "../terrain/TerrainField";

export function createTerrainVisuals(terrain: TerrainField): THREE.Group {
  const group = new THREE.Group();
  group.name = "terrain-two-layer-visuals";

  const size = 260;
  const segments = 160;
  const pointPositions: number[] = [];
  const linePositions: number[] = [];

  for (let z = 0; z <= segments; z += 1) {
    for (let x = 0; x <= segments; x += 1) {
      const wx = (x / segments - 0.5) * size;
      const wz = (z / segments - 0.5) * size;
      const wy = terrain.heightAt(wx, wz);
      pointPositions.push(wx, wy, wz);
      if (x < segments) {
        const nx = ((x + 1) / segments - 0.5) * size;
        linePositions.push(wx, wy, wz, nx, terrain.heightAt(nx, wz), wz);
      }
    }
  }

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
  const points = new THREE.Points(
    pointGeometry,
    new THREE.PointsMaterial({ color: 0x00d2ff, size: 0.13, transparent: true, opacity: 0.68, depthWrite: false }),
  );
  points.name = "terrain-particle-dots";
  group.add(points);

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  const lines = new THREE.LineSegments(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0x006f61, transparent: true, opacity: 0.44 }),
  );
  lines.name = "terrain-topographic-lines";
  group.add(lines);

  return group;
}
```

- [ ] **Step 3: Add starfield and celestial**

Create `src/render/worldVisuals.ts`:

```ts
import * as THREE from "three";
import { hash2 } from "../terrain/noise";

export function createWorldVisuals(seed: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "starfield-celestial-backdrop";

  const starPositions: number[] = [];
  for (let i = 0; i < 1300; i += 1) {
    const x = (hash2(seed, i, 1) - 0.5) * 900;
    const y = hash2(seed, i, 2) * 300 + 25;
    const z = -hash2(seed, i, 3) * 900 - 80;
    starPositions.push(x, y, z);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  group.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xdffcff, size: 0.55, transparent: true, opacity: 0.75 })));

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(16, 48, 24),
    new THREE.MeshBasicMaterial({ color: 0xf7ffff }),
  );
  moon.position.set(54, 72, -145);
  moon.name = "bright-celestial-body";
  group.add(moon);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(21, 48, 24),
    new THREE.MeshBasicMaterial({ color: 0x63eaff, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  halo.position.copy(moon.position);
  halo.name = "cyan-celestial-halo";
  group.add(halo);

  return group;
}
```

- [ ] **Step 4: Create Game lifecycle**

Create `src/game/Game.ts`:

```ts
import { WORLD } from "./constants";
import { createInitialState } from "./state";
import { RendererApp } from "../render/RendererApp";
import { createTerrainVisuals } from "../render/terrainVisuals";
import { createWorldVisuals } from "../render/worldVisuals";
import { TerrainField } from "../terrain/TerrainField";

export class Game {
  private readonly state = createInitialState();
  private readonly terrain = new TerrainField({
    seed: this.state.seed,
    size: WORLD.terrainSize,
    scale: WORLD.terrainScale,
    amplitude: WORLD.terrainAmplitude,
  });
  private readonly renderer: RendererApp;
  private animationId = 0;

  constructor(host: HTMLElement) {
    this.renderer = new RendererApp(host);
    this.renderer.scene.add(createWorldVisuals(this.state.seed));
    this.renderer.scene.add(createTerrainVisuals(this.terrain));
    window.addEventListener("resize", this.resize);
  }

  start(): void {
    const tick = () => {
      this.renderer.render();
      this.animationId = window.requestAnimationFrame(tick);
    };
    tick();
  }

  dispose(): void {
    window.cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }

  private readonly resize = () => this.renderer.resize();
}
```

- [ ] **Step 5: Mount Game from main**

Replace `src/main.ts` with:

```ts
import "./styles.css";
import { Game } from "./game/Game";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Missing #app root");

root.innerHTML = `<div class="game-shell"><div id="viewport" class="viewport"></div></div>`;
const viewport = document.querySelector<HTMLDivElement>("#viewport");
if (!viewport) throw new Error("Missing #viewport");

const game = new Game(viewport);
game.start();

window.addEventListener("beforeunload", () => game.dispose());
```

Append to `src/styles.css`:

```css
.game-shell,
.viewport {
  width: 100%;
  height: 100%;
  background: #000006;
}

.viewport canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: auto;
}
```

- [ ] **Step 6: Verify rendering build**

Run: `npm run build`

Expected: build completes and Three.js types compile.

---

## Task 5: Player Flight And Input

**Files:**
- Create: `src/input/Input.ts`
- Create: `src/flight/playerFlight.ts`
- Modify: `src/game/Game.ts`

- [ ] **Step 1: Create input state**

Create `src/input/Input.ts`:

```ts
export type InputState = {
  throttle: number;
  strafe: number;
  turn: number;
  boost: boolean;
  ping: boolean;
  fireLaser: boolean;
  fireMissile: boolean;
};

export class Input {
  readonly state: InputState = {
    throttle: 0,
    strafe: 0,
    turn: 0,
    boost: false,
    ping: false,
    fireLaser: false,
    fireMissile: false,
  };

  private readonly keys = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  update(): void {
    this.state.throttle = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    this.state.strafe = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    this.state.turn = Number(this.keys.has("ArrowRight")) - Number(this.keys.has("ArrowLeft"));
    this.state.boost = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.state.ping = this.keys.has("Space");
    this.state.fireLaser = this.keys.has("Mouse0") || this.keys.has("KeyF");
    this.state.fireMissile = this.keys.has("KeyR");
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };
}
```

- [ ] **Step 2: Create flight update**

Create `src/flight/playerFlight.ts`:

```ts
import { PLAYER, WORLD } from "../game/constants";
import type { PlayerState } from "../game/state";
import type { InputState } from "../input/Input";
import type { TerrainField } from "../terrain/TerrainField";

export function updatePlayerFlight(player: PlayerState, input: InputState, terrain: TerrainField, dt: number): void {
  const boostActive = input.boost && player.boost > 0.04;
  const speedLimit = PLAYER.maxSpeed * (boostActive ? PLAYER.boostMultiplier : 1);

  player.heading += input.turn * PLAYER.turnRate * dt;
  const forwardX = Math.sin(player.heading);
  const forwardZ = -Math.cos(player.heading);
  const rightX = Math.cos(player.heading);
  const rightZ = Math.sin(player.heading);

  player.velocity.x += (forwardX * input.throttle + rightX * input.strafe * 0.55) * PLAYER.acceleration * dt;
  player.velocity.z += (forwardZ * input.throttle + rightZ * input.strafe * 0.55) * PLAYER.acceleration * dt;

  const speed = Math.hypot(player.velocity.x, player.velocity.z);
  if (speed > speedLimit) {
    player.velocity.x = (player.velocity.x / speed) * speedLimit;
    player.velocity.z = (player.velocity.z / speed) * speedLimit;
  }

  player.position.x += player.velocity.x * dt;
  player.position.z += player.velocity.z * dt;
  player.velocity.x *= 0.985;
  player.velocity.z *= 0.985;

  const ground = terrain.heightAt(player.position.x, player.position.z);
  const desiredY = ground + WORLD.skimClearance;
  player.position.y += (desiredY - player.position.y) * Math.min(1, dt * 3.2);
  if (player.position.y < ground + WORLD.safeClearance) {
    player.position.y = ground + WORLD.safeClearance;
    player.hull = Math.max(0, player.hull - 12 * dt);
  }

  if (boostActive) player.boost = Math.max(0, player.boost - PLAYER.boostDrainPerSecond * dt);
  else player.boost = Math.min(1, player.boost + PLAYER.boostRecoverPerSecond * dt);

  const cover = terrain.coverAt(player.position.x, player.position.z, player.position.y);
  player.exposure = Math.max(0, Math.min(1, 1 - cover + (boostActive ? 0.18 : 0)));
}
```

- [ ] **Step 3: Wire flight into frame loop**

Modify `src/game/Game.ts` so it owns `Input`, calls `updatePlayerFlight`, and positions the camera behind the player. The frame loop should compute `dt` from `performance.now()`.

Use these imports:

```ts
import { updatePlayerFlight } from "../flight/playerFlight";
import { Input } from "../input/Input";
```

Add fields:

```ts
private readonly input = new Input();
private lastTime = performance.now();
```

Inside the animation tick before render:

```ts
const now = performance.now();
const dt = Math.min(0.05, (now - this.lastTime) / 1000);
this.lastTime = now;
this.input.update();
updatePlayerFlight(this.state.player, this.input.state, this.terrain, dt);
this.renderer.camera.position.set(
  this.state.player.position.x - Math.sin(this.state.player.heading) * 14,
  this.state.player.position.y + 7,
  this.state.player.position.z + Math.cos(this.state.player.heading) * 14,
);
this.renderer.camera.lookAt(
  this.state.player.position.x + Math.sin(this.state.player.heading) * 30,
  this.state.player.position.y + 1,
  this.state.player.position.z - Math.cos(this.state.player.heading) * 30,
);
```

Add to `dispose()`:

```ts
this.input.dispose();
```

- [ ] **Step 4: Verify flight build**

Run: `npm run build`

Expected: build passes and local dev server shows moving terrain/camera with WASD and arrow keys.

---

## Task 6: Hybrid Radar And Ground Sonar

**Files:**
- Create: `src/radar/radarModel.ts`
- Test: `tests/radar.test.ts`

- [ ] **Step 1: Write radar tests**

Create `tests/radar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PlayerState } from "../src/game/state";
import { createRadarState, updateRadar } from "../src/radar/radarModel";
import { TerrainField } from "../src/terrain/TerrainField";

function playerAt(y: number): PlayerState {
  return {
    id: "player",
    kind: "player",
    position: { x: 0, y, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    heading: 0,
    health: 100,
    hull: 100,
    shield: 100,
    heat: 0,
    boost: 1,
    credits: 0,
    exposure: 0,
  };
}

describe("radar model", () => {
  it("active ping creates ground sonar reveal time", () => {
    const radar = createRadarState();
    const terrain = new TerrainField({ seed: 5, size: 512, scale: 42, amplitude: 20 });
    updateRadar(radar, playerAt(8), terrain, { ping: true }, 0.016);
    expect(radar.groundSonar).toBeGreaterThan(0);
    expect(radar.signature).toBeGreaterThan(0.5);
  });

  it("sonar reveal fades over time", () => {
    const radar = createRadarState();
    const terrain = new TerrainField({ seed: 5, size: 512, scale: 42, amplitude: 20 });
    updateRadar(radar, playerAt(8), terrain, { ping: true }, 0.016);
    updateRadar(radar, playerAt(8), terrain, { ping: false }, 3);
    expect(radar.groundSonar).toBe(0);
  });
});
```

- [ ] **Step 2: Run failing radar tests**

Run: `npm test -- tests/radar.test.ts`

Expected: fail because `radarModel` does not exist.

- [ ] **Step 3: Implement radar model**

Create `src/radar/radarModel.ts`:

```ts
import { RADAR } from "../game/constants";
import type { PlayerState } from "../game/state";
import type { TerrainField } from "../terrain/TerrainField";

export type RadarState = {
  groundSonar: number;
  signature: number;
  passiveSweep: number;
  lastPingAt: number;
};

export type RadarInput = {
  ping: boolean;
};

export function createRadarState(): RadarState {
  return {
    groundSonar: 0,
    signature: 0,
    passiveSweep: 0,
    lastPingAt: -Infinity,
  };
}

export function updateRadar(
  radar: RadarState,
  player: PlayerState,
  terrain: TerrainField,
  input: RadarInput,
  dt: number,
): void {
  radar.passiveSweep = (radar.passiveSweep + dt * 0.16) % 1;
  radar.groundSonar = Math.max(0, radar.groundSonar - dt / RADAR.pingDuration);
  radar.signature = Math.max(0, radar.signature - dt * RADAR.confidenceDecayPerSecond);

  if (input.ping) {
    radar.groundSonar = 1;
    radar.signature = Math.max(radar.signature, RADAR.pingSignature);
    radar.lastPingAt = 0;
  }

  const cover = terrain.coverAt(player.position.x, player.position.z, player.position.y);
  radar.signature = Math.max(radar.signature, Math.max(0, 1 - cover) * 0.65);
}
```

- [ ] **Step 4: Verify radar tests pass**

Run: `npm test -- tests/radar.test.ts`

Expected: radar tests pass.

---

## Task 7: Weapons And Combat Rules

**Files:**
- Create: `src/combat/weapons.ts`
- Test: `tests/combat.test.ts`

- [ ] **Step 1: Write combat tests**

Create `tests/combat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createWeaponState, fireMissile, updateWeapons } from "../src/combat/weapons";

describe("weapons", () => {
  it("missiles require lock confidence and reload", () => {
    const weapons = createWeaponState();
    expect(fireMissile(weapons, 0.2)).toBe(false);
    expect(fireMissile(weapons, 0.9)).toBe(true);
    expect(fireMissile(weapons, 0.9)).toBe(false);
  });

  it("missile reload recovers slowly", () => {
    const weapons = createWeaponState();
    fireMissile(weapons, 1);
    updateWeapons(weapons, 2);
    expect(weapons.missileReload).toBeGreaterThan(0);
    expect(weapons.missileReload).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run failing combat tests**

Run: `npm test -- tests/combat.test.ts`

Expected: fail because `weapons` does not exist.

- [ ] **Step 3: Implement weapons**

Create `src/combat/weapons.ts`:

```ts
export type WeaponState = {
  laserHeat: number;
  missileReload: number;
  missileReloadSeconds: number;
};

export function createWeaponState(): WeaponState {
  return {
    laserHeat: 0,
    missileReload: 1,
    missileReloadSeconds: 6,
  };
}

export function updateWeapons(weapons: WeaponState, dt: number): void {
  weapons.laserHeat = Math.max(0, weapons.laserHeat - dt * 0.55);
  weapons.missileReload = Math.min(1, weapons.missileReload + dt / weapons.missileReloadSeconds);
}

export function fireLaser(weapons: WeaponState): boolean {
  if (weapons.laserHeat >= 1) return false;
  weapons.laserHeat = Math.min(1, weapons.laserHeat + 0.08);
  return true;
}

export function fireMissile(weapons: WeaponState, lockConfidence: number): boolean {
  if (weapons.missileReload < 1 || lockConfidence < 0.65) return false;
  weapons.missileReload = 0;
  return true;
}
```

- [ ] **Step 4: Verify combat tests pass**

Run: `npm test -- tests/combat.test.ts`

Expected: combat tests pass.

---

## Task 8: Enemy AI Alert Propagation

**Files:**
- Create: `src/ai/enemies.ts`
- Modify: `tests/ai.test.ts`

- [ ] **Step 1: Extend AI tests**

Append to `tests/ai.test.ts`:

```ts
import { applyPingAlert } from "../src/ai/enemies";

describe("alert propagation", () => {
  it("ping alerts nearby clusters but not the whole sector", () => {
    const terrain = new TerrainField({ seed: 21, size: 512, scale: 42, amplitude: 20 });
    const sector = createSector(terrain, 21);
    const origin = sector.clusters[0].center;
    const alerted = applyPingAlert(sector.clusters, origin, 65);
    expect(alerted.length).toBeGreaterThanOrEqual(1);
    expect(alerted.length).toBeLessThan(sector.clusters.length);
  });
});
```

- [ ] **Step 2: Run failing AI propagation test**

Run: `npm test -- tests/ai.test.ts`

Expected: fail because `applyPingAlert` does not exist.

- [ ] **Step 3: Implement AI helpers**

Create `src/ai/enemies.ts`:

```ts
import type { Vec3 } from "../game/state";
import type { EnemyCluster } from "../terrain/sector";

export type EnemyDefinition = {
  role: "scout" | "gunship";
  maxHealth: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
};

export const ENEMIES: Record<EnemyDefinition["role"], EnemyDefinition> = {
  scout: { role: "scout", maxHealth: 3, speed: 28, detectionRange: 96, attackRange: 28 },
  gunship: { role: "gunship", maxHealth: 8, speed: 16, detectionRange: 70, attackRange: 44 },
};

export function distance2d(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function applyPingAlert(clusters: EnemyCluster[], origin: Vec3, radius: number): EnemyCluster[] {
  const alerted: EnemyCluster[] = [];
  for (const cluster of clusters) {
    if (distance2d(cluster.center, origin) <= radius + cluster.radius) {
      cluster.alert = "investigating";
      alerted.push(cluster);
    }
  }
  return alerted;
}
```

- [ ] **Step 4: Verify AI tests pass**

Run: `npm test -- tests/ai.test.ts`

Expected: all AI tests pass.

---

## Task 9: HUD And Service/Flight Aesthetic

**Files:**
- Create: `src/hud/Hud.ts`
- Modify: `src/game/Game.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Create HUD renderer**

Create `src/hud/Hud.ts`:

```ts
import type { PlayerState } from "../game/state";
import type { RadarState } from "../radar/radarModel";
import type { WeaponState } from "../combat/weapons";

export class Hud {
  readonly element = document.createElement("div");

  constructor(private readonly host: HTMLElement) {
    this.element.className = "hud";
    this.host.appendChild(this.element);
  }

  update(player: PlayerState, radar: RadarState, weapons: WeaponState): void {
    this.element.innerHTML = `
      <section class="hud-feed">ACTIVITY FEED<br>SECTOR LINK LIVE</section>
      <section class="hud-board">ALL-TIME HIGHS<br>01 KESTREL<br>02 WIDOWMAKER</section>
      <section class="hud-stats">KILLS&nbsp;&nbsp;0<br>HELD&nbsp;&nbsp;¤ 0<br>HEAT&nbsp;&nbsp;¤ ${Math.round(player.heat)}</section>
      <section class="hud-bottom">
        <div class="ship-disc">△</div>
        <div class="bar"><span style="width:${player.hull}%"></span></div>
        <div class="sonar" style="opacity:${0.32 + radar.groundSonar * 0.68}"></div>
        <div class="bar shield"><span style="width:${player.shield}%"></span></div>
      </section>
      <section class="hud-center">
        <div class="reticle">◎</div>
        <div class="readout">SPD ${Math.round(Math.hypot(player.velocity.x, player.velocity.z))}<br>MSL ${Math.round(weapons.missileReload * 100)}%</div>
      </section>
    `;
  }

  dispose(): void {
    this.element.remove();
  }
}
```

- [ ] **Step 2: Add HUD CSS**

Append to `src/styles.css`:

```css
.hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: #ffb000;
  font-family: "Consolas", "Space Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-shadow: 0 0 8px rgba(255, 145, 0, 0.65);
}

.hud-feed,
.hud-board,
.hud-stats {
  position: absolute;
  border: 1px solid #ffb000;
  background: rgba(0, 0, 0, 0.24);
  padding: 10px;
}

.hud-feed { top: 22px; left: 22px; }
.hud-board { top: 22px; right: 22px; min-width: 210px; }
.hud-stats { left: 22px; bottom: 44%; }

.hud-bottom {
  position: absolute;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
}

.ship-disc {
  width: 76px;
  height: 38px;
  border: 2px solid #ffe9a3;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.bar {
  width: 92px;
  height: 22px;
  border-left: 2px solid #ffb000;
  border-right: 2px solid #ffb000;
}

.bar span {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(90deg, #ffb000 0 6px, transparent 6px 9px);
}

.bar.shield span {
  background: repeating-linear-gradient(90deg, #5eeeff 0 6px, transparent 6px 9px);
}

.sonar {
  width: 92px;
  height: 50px;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, transparent 0 5px, rgba(255, 145, 0, 0.95) 6px 7px);
}

.hud-center {
  position: absolute;
  left: 50%;
  top: 44%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.reticle {
  font-size: 42px;
}
```

- [ ] **Step 3: Wire HUD into Game**

Modify `src/game/Game.ts` to instantiate `Hud`, `RadarState`, and `WeaponState`, then call `hud.update(...)` each frame.

Imports:

```ts
import { Hud } from "../hud/Hud";
import { createRadarState, updateRadar } from "../radar/radarModel";
import { createWeaponState, updateWeapons } from "../combat/weapons";
```

Fields:

```ts
private readonly radar = createRadarState();
private readonly weapons = createWeaponState();
private readonly hud: Hud;
```

Constructor after renderer:

```ts
this.hud = new Hud(host);
```

Frame loop after input/flight:

```ts
updateRadar(this.radar, this.state.player, this.terrain, { ping: this.input.state.ping }, dt);
updateWeapons(this.weapons, dt);
this.hud.update(this.state.player, this.radar, this.weapons);
```

Dispose:

```ts
this.hud.dispose();
```

- [ ] **Step 4: Verify HUD build**

Run: `npm run build`

Expected: build passes and HUD overlays the Three.js canvas.

---

## Task 10: Audio Event Facade

**Files:**
- Create: `src/audio/AudioBus.ts`
- Modify: `src/game/Game.ts`

- [ ] **Step 1: Create AudioBus**

Create `src/audio/AudioBus.ts`:

```ts
export type AudioCue = "ping" | "boost" | "laser" | "missile" | "alert";

export class AudioBus {
  private context: AudioContext | undefined;

  trigger(cue: AudioCue): void {
    if (!this.context) this.context = new AudioContext();
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    const frequency = cue === "ping" ? 90 : cue === "alert" ? 440 : cue === "missile" ? 180 : 260;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.connect(gain).connect(this.context.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }
}
```

- [ ] **Step 2: Wire ping cue**

Modify `src/game/Game.ts` to create `AudioBus` and call `audio.trigger("ping")` when `input.state.ping` is true and `radar.groundSonar` was zero before update.

Import:

```ts
import { AudioBus } from "../audio/AudioBus";
```

Field:

```ts
private readonly audio = new AudioBus();
```

Frame snippet before `updateRadar`:

```ts
const wasSonarIdle = this.radar.groundSonar <= 0;
updateRadar(this.radar, this.state.player, this.terrain, { ping: this.input.state.ping }, dt);
if (this.input.state.ping && wasSonarIdle) this.audio.trigger("ping");
```

- [ ] **Step 3: Verify audio build**

Run: `npm run build`

Expected: build passes; first ping may require user interaction because browsers gate audio.

---

## Task 11: Browser Smoke Verification

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/render.spec.ts`

- [ ] **Step 1: Create Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
  },
});
```

- [ ] **Step 2: Create nonblank/HUD test**

Create `tests/e2e/render.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders nonblank Game Two canvas with HUD", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".hud-feed")).toBeVisible();
  const screenshot = await page.screenshot();
  expect(screenshot.length).toBeGreaterThan(20_000);
});
```

- [ ] **Step 3: Run unit and browser tests**

Run: `npm test`

Expected: unit tests pass.

Run: `npm run e2e`

Expected: Playwright launches Vite and verifies visible canvas plus HUD.

---

## Task 12: First Playable Integration Check

**Files:**
- Modify: `docs/superpowers/specs/2026-05-14-game-two-recovery-design.md` only if acceptance criteria changed during implementation.

- [ ] **Step 1: Run full verification**

Run:

```powershell
npm run build
npm test
npm run e2e
```

Expected: all commands pass.

- [ ] **Step 2: Start local dev server**

Run: `npm run dev -- --port 5173`

Expected: Vite reports a local URL at `http://127.0.0.1:5173/`.

- [ ] **Step 3: Manual playtest checklist**

Verify in browser:

- The world has black space, starfield, bright celestial body, cyan/green terrain lines, and RGB particle terrain.
- WASD/arrow flight moves the camera over terrain.
- Space triggers visible ground-sonar intensity in the bottom instrument and audio cue after user interaction.
- Boost changes speed and exposure.
- HUD is readable and does not cover the valley read.
- The visual direction resembles the live reference instead of generic sci-fi UI.

- [ ] **Step 4: Commit milestone**

If the folder has been initialized as a git repo, run:

```powershell
git add .
git commit -m "feat: scaffold game two recovery slice"
```

Expected: one focused milestone commit.

---

## Self-Review

Spec coverage:

- Recovery-first build: covered by Tasks 1, 4, 9, and 12.
- Two-layer terrain and CPU sampler: covered by Tasks 2 and 4.
- Ground sonar and radar confidence: covered by Task 6 and HUD integration in Task 9.
- Terrain-skimming flight: covered by Task 5.
- Lasers, missiles, boost hooks: covered by Tasks 5 and 7.
- Multiple enemy clusters and local alert propagation: covered by Tasks 3 and 8.
- Cockpit/HUD aesthetic and visual reference fidelity: covered by Tasks 4, 9, and 12.
- Audio feedback: covered by Task 10.
- Multiplayer-shaped state without WebSockets: covered by Task 2.
- Tests and browser smoke verification: covered by Tasks 2, 3, 6, 7, 8, 11, and 12.

Known scope boundary:

- This plan produces the first playable recovery slice foundation. Additional tasks should add visible enemy meshes, projectile visuals, hit resolution, and richer AI movement after this foundation is verified.
