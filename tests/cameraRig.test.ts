import { describe, expect, it } from "vitest";
import { computeCockpitCamera } from "../src/flight/cameraRig";
import type { PlayerState } from "../src/game/state";

function playerAt(x: number, y: number, z: number, yaw: number): PlayerState {
  return {
    id: "player",
    kind: "player",
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: -20 },
    yaw,
    signature: 0.2,
    active: true,
    hull: 100,
    shield: 100,
    heat: 0,
    boost: 1,
    credits: 0,
    exposure: 0,
  };
}

describe("cockpit camera rig", () => {
  it("places the camera low behind the player and looks ahead", () => {
    const rig = computeCockpitCamera(playerAt(4, 9, -12, 0));

    expect(rig.position.y).toBeCloseTo(16.5, 5);
    expect(rig.position.z).toBeGreaterThan(-12);
    expect(rig.target.z).toBeLessThan(-12);
    expect(rig.target.y).toBeGreaterThan(9);
  });

  it("rotates the follow and look vectors with heading", () => {
    const rig = computeCockpitCamera(playerAt(0, 5, 0, Math.PI / 2));

    expect(rig.position.x).toBeLessThan(0);
    expect(rig.target.x).toBeGreaterThan(0);
  });
});
