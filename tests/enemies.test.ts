import { describe, expect, it } from "vitest";
import type { PlayerState, Vec3 } from "../src/game/state";
import type { Sector } from "../src/terrain/sector";
import {
  applyPingAlert,
  createEnemyRuntime,
  getClusterThreat,
  updateEnemyRuntime
} from "../src/ai/enemies";

type TestTerrain = {
  heightAt: (x: number, z: number) => number;
  coverAt: (x: number, z: number, y: number) => number;
  hasTerrainOcclusion: (a: Vec3, b: Vec3) => boolean;
};

function createTerrain(overrides: Partial<TestTerrain> = {}): TestTerrain {
  return {
    heightAt: () => 0,
    coverAt: () => 0,
    hasTerrainOcclusion: () => false,
    ...overrides
  };
}

function createPlayer(position: Vec3 = { x: 0, y: 12, z: 0 }): PlayerState {
  return {
    id: "player",
    kind: "player",
    position,
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    signature: 0.18,
    active: true,
    hull: 100,
    shield: 100,
    heat: 0,
    boost: 100,
    credits: 0,
    exposure: 0
  };
}

function createSector(): Sector {
  return {
    seed: 12,
    clusters: [
      {
        id: "near",
        center: { x: 40, y: 8, z: 0 },
        radius: 32,
        roles: ["scout"],
        alert: "idle"
      },
      {
        id: "relay",
        center: { x: 115, y: 8, z: 0 },
        radius: 36,
        roles: ["scout", "gunship"],
        alert: "idle"
      },
      {
        id: "far",
        center: { x: 520, y: 8, z: 0 },
        radius: 42,
        roles: ["gunship"],
        alert: "idle"
      }
    ]
  };
}

describe("enemy cluster runtime", () => {
  it("applies local ping alerts to nearby clusters without waking every cluster", () => {
    const runtime = createEnemyRuntime(createSector(), createTerrain());

    applyPingAlert(runtime, { x: 0, y: 10, z: 0 }, 140);

    expect(runtime.clusters.find((cluster) => cluster.id === "near")?.alert).toBe("investigating");
    expect(runtime.clusters.find((cluster) => cluster.id === "relay")?.alert).toBe("investigating");
    expect(runtime.clusters.find((cluster) => cluster.id === "far")?.alert).toBe("idle");
  });

  it("raises a scout cluster toward confirmed contact for an exposed line-of-sight player", () => {
    const runtime = createEnemyRuntime(createSector(), createTerrain());
    const player = createPlayer({ x: 55, y: 12, z: 0 });

    updateEnemyRuntime(runtime, {
      player,
      terrain: createTerrain(),
      deltaSeconds: 1,
      playerSignature: 1
    });

    const scout = runtime.clusters.find((cluster) => cluster.id === "near");

    expect(scout?.alert).toBe("confirmed");
    expect(scout?.confidence).toBeGreaterThan(0.7);
    expect(scout?.lastKnownPosition).toEqual(player.position);
    expect(getClusterThreat(runtime).level).toBeGreaterThan(0.5);
  });

  it("moves confirmed contact to searching behind occlusion while preserving last known position", () => {
    const runtime = createEnemyRuntime(createSector(), createTerrain());
    const exposedPosition = { x: 55, y: 12, z: 0 };
    const hiddenPosition = { x: 55, y: 4, z: 0 };

    updateEnemyRuntime(runtime, {
      player: createPlayer(exposedPosition),
      terrain: createTerrain(),
      deltaSeconds: 1,
      playerSignature: 1
    });

    updateEnemyRuntime(runtime, {
      player: createPlayer(hiddenPosition),
      terrain: createTerrain({
        coverAt: () => 0.92,
        hasTerrainOcclusion: () => true
      }),
      deltaSeconds: 1,
      playerSignature: 0.15
    });

    const scout = runtime.clusters.find((cluster) => cluster.id === "near");

    expect(scout?.alert).toBe("searching");
    expect(scout?.lastKnownPosition).toEqual(exposedPosition);
    expect(scout?.confidence).toBeGreaterThan(0);
    expect(scout?.confidence).toBeLessThan(0.9);
  });
});
