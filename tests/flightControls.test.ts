import { describe, expect, it } from "vitest";
import type { PlayerState } from "../src/game/state";
import { createMouseFlightState, updateMouseFlight } from "../src/flight/flightControls";

function player(): PlayerState {
  return {
    id: "player",
    kind: "player",
    position: { x: 0, y: 8, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    signature: 0.18,
    active: true,
    hull: 100,
    shield: 75,
    heat: 0,
    boost: 100,
    credits: 0,
    exposure: 0,
  };
}

const flatTerrain = {
  heightAt: () => 0,
  coverAt: () => 0.35,
};

describe("mouse flight controls", () => {
  it("turns toward mouse aim while moving fast over terrain", () => {
    const state = createMouseFlightState();
    const ship = player();

    updateMouseFlight(ship, state, flatTerrain, {
      aimX: 0.82,
      aimY: -0.2,
      throttle: 1,
      strafe: 0,
      boost: false,
      deltaSeconds: 0.5,
    });

    expect(ship.yaw).toBeGreaterThan(0.35);
    expect(ship.position.z).toBeLessThan(-20);
    expect(ship.position.y).toBeGreaterThan(4);
  });

  it("uses A/D strafe as lateral thrust instead of turn input", () => {
    const state = createMouseFlightState();
    const ship = player();

    updateMouseFlight(ship, state, flatTerrain, {
      aimX: 0,
      aimY: 0,
      throttle: 0.65,
      strafe: 1,
      boost: false,
      deltaSeconds: 0.5,
    });

    expect(Math.abs(ship.yaw)).toBeLessThan(0.02);
    expect(ship.position.x).toBeGreaterThan(6);
    expect(ship.position.z).toBeLessThan(-10);
  });

  it("boosts speed while raising signature and draining boost reserve", () => {
    const boosted = player();
    const normal = player();

    updateMouseFlight(normal, createMouseFlightState(), flatTerrain, {
      aimX: 0,
      aimY: 0,
      throttle: 1,
      strafe: 0,
      boost: false,
      deltaSeconds: 0.5,
    });
    updateMouseFlight(boosted, createMouseFlightState(), flatTerrain, {
      aimX: 0,
      aimY: 0,
      throttle: 1,
      strafe: 0,
      boost: true,
      deltaSeconds: 0.5,
    });

    expect(Math.hypot(boosted.velocity.x, boosted.velocity.z)).toBeGreaterThan(
      Math.hypot(normal.velocity.x, normal.velocity.z) * 1.45
    );
    expect(boosted.boost).toBeLessThan(normal.boost);
    expect(boosted.signature).toBeGreaterThan(normal.signature);
  });
});
