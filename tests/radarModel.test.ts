import { describe, expect, it } from "vitest";
import type { PlayerState, Vec3 } from "../src/game/state";
import type { EnemyCluster } from "../src/terrain/sector";
import { createRadarState, getStrongestContact, updateRadarContacts } from "../src/radar/radarModel";

type TestTerrain = {
  heightAt: (x: number, z: number) => number;
  coverAt: (x: number, z: number, y: number) => number;
  hasTerrainOcclusion: (a: Vec3, b: Vec3) => boolean;
};

function createPlayer(position: Vec3 = { x: 0, y: 6, z: 0 }): PlayerState {
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
    exposure: 0,
  };
}

function createCluster(id: string, center: Vec3): EnemyCluster {
  return {
    id,
    center,
    radius: 32,
    roles: ["scout"],
    alert: "idle",
  };
}

function createTerrain(overrides: Partial<TestTerrain> = {}): TestTerrain {
  return {
    heightAt: () => 0,
    coverAt: () => 0,
    hasTerrainOcclusion: () => false,
    ...overrides,
  };
}

describe("radar contact model", () => {
  it("active ping creates a high confidence nearby contact without revealing far clusters", () => {
    const radar = createRadarState();
    const player = createPlayer();
    const nearby = createCluster("nearby", { x: 80, y: 8, z: 0 });
    const far = createCluster("far", { x: 700, y: 8, z: 0 });

    updateRadarContacts(radar, {
      player,
      clusters: [nearby, far],
      terrain: createTerrain(),
      deltaSeconds: 0.1,
      ping: true,
      playerSignature: 0.2,
    });

    expect(radar.contacts.get("nearby")?.confidence).toBeGreaterThan(0.75);
    expect(radar.contacts.has("far")).toBe(false);
    expect(getStrongestContact(radar)?.clusterId).toBe("nearby");
  });

  it("occluded and covered contacts resolve with lower confidence than exposed line-of-sight contacts", () => {
    const player = createPlayer();
    const exposed = createCluster("exposed", { x: 90, y: 8, z: 0 });
    const hidden = createCluster("hidden", { x: -90, y: 8, z: 0 });
    const radar = createRadarState();

    updateRadarContacts(radar, {
      player,
      clusters: [exposed, hidden],
      terrain: createTerrain({
        coverAt: (x) => (x < 0 ? 0.8 : 0),
        hasTerrainOcclusion: (_a, b) => b.x < 0,
      }),
      deltaSeconds: 0.1,
      ping: true,
      playerSignature: 0.2,
    });

    const exposedConfidence = radar.contacts.get("exposed")?.confidence ?? 0;
    const hiddenConfidence = radar.contacts.get("hidden")?.confidence ?? 0;

    expect(exposedConfidence).toBeGreaterThan(0.75);
    expect(hiddenConfidence).toBeGreaterThan(0.2);
    expect(hiddenConfidence).toBeLessThan(exposedConfidence);
  });

  it("stale contacts decay into ghosts while preserving last known position", () => {
    const radar = createRadarState();
    const player = createPlayer();
    const cluster = createCluster("contact", { x: 80, y: 8, z: 20 });

    updateRadarContacts(radar, {
      player,
      clusters: [cluster],
      terrain: createTerrain(),
      deltaSeconds: 0.1,
      ping: true,
      playerSignature: 0.2,
    });

    const initial = radar.contacts.get("contact");
    expect(initial?.confidence).toBeGreaterThan(0.75);
    const initialConfidence = initial?.confidence ?? 0;

    updateRadarContacts(radar, {
      player,
      clusters: [],
      terrain: createTerrain(),
      deltaSeconds: 5,
      ping: false,
      playerSignature: 0.05,
    });

    const stale = radar.contacts.get("contact");
    expect(stale?.source).toBe("ghost");
    expect(stale?.confidence).toBeGreaterThan(0);
    expect(stale?.confidence).toBeLessThan(initialConfidence);
    expect(stale?.ageSeconds).toBeGreaterThan(4);
    expect(stale?.lastKnownPosition).toEqual(cluster.center);
  });
});
