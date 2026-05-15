import { describe, expect, it } from "vitest";
import type { Vec3 } from "../src/game/state";
import {
  WEAPON_RULES,
  createWeaponState,
  tryFireLaser,
  tryFireMissile,
  updateProjectiles,
  updateWeapons,
} from "../src/combat/weapons";

type TestShooter = {
  id: string;
  position: Vec3;
  yaw: number;
  heat: number;
  signature: number;
};

type TestTarget = {
  id: string;
  position: Vec3;
  health: number;
  active: boolean;
};

function createShooter(overrides: Partial<TestShooter> = {}): TestShooter {
  return {
    id: "player",
    position: { x: 0, y: 8, z: 0 },
    yaw: 0,
    heat: 0,
    signature: 0.18,
    ...overrides,
  };
}

function createTarget(id: string, position: Vec3, health = 100): TestTarget {
  return {
    id,
    position,
    health,
    active: true,
  };
}

describe("combat weapon rules", () => {
  it("requires missile lock confidence and slow reload before firing again", () => {
    const weapons = createWeaponState();
    const shooter = createShooter();
    const target = createTarget("raider-1", { x: 0, y: 8, z: -80 });

    const withoutLock = tryFireMissile(weapons, shooter, WEAPON_RULES.missile.lockThreshold - 0.01, target);
    expect(withoutLock).toMatchObject({ ok: false, reason: "lock" });
    expect(weapons.projectiles).toHaveLength(0);

    const fired = tryFireMissile(weapons, shooter, WEAPON_RULES.missile.lockThreshold, target);
    expect(fired.ok).toBe(true);
    expect(fired.events).toContainEqual({
      type: "missile-fired",
      shooterId: "player",
      projectileId: "missile-1",
      targetId: "raider-1",
    });
    expect(weapons.projectiles).toHaveLength(1);
    expect(weapons.missileReloadRemaining).toBe(WEAPON_RULES.missile.reloadSeconds);

    const whileReloading = tryFireMissile(weapons, shooter, 1, target);
    expect(whileReloading).toMatchObject({ ok: false, reason: "reloading" });

    updateWeapons(weapons, WEAPON_RULES.missile.reloadSeconds - 0.25);
    expect(tryFireMissile(weapons, shooter, 1, target).ok).toBe(false);

    updateWeapons(weapons, 0.25);
    const firedAfterReload = tryFireMissile(weapons, shooter, 1, target);
    expect(firedAfterReload.ok).toBe(true);
    expect(weapons.projectiles.map((projectile) => projectile.id)).toEqual(["missile-1", "missile-2"]);
  });

  it("heat gates repeated laser fire and weapon updates cool the shooter", () => {
    const weapons = createWeaponState();
    const shooter = createShooter();
    const target = createTarget("drone-1", { x: 0, y: 8, z: -40 }, 200);

    expect(tryFireLaser(weapons, shooter, [target]).ok).toBe(true);
    expect(tryFireLaser(weapons, shooter, [target]).ok).toBe(true);

    const blocked = tryFireLaser(weapons, shooter, [target]);
    expect(blocked).toMatchObject({ ok: false, reason: "heat" });
    expect(shooter.heat).toBe(WEAPON_RULES.laser.heatCost * 2);
    expect(shooter.signature).toBeCloseTo(0.18 + WEAPON_RULES.laser.signatureCost * 2);

    updateWeapons(weapons, 3, [shooter]);

    expect(shooter.heat).toBe(WEAPON_RULES.laser.heatCost * 2 - WEAPON_RULES.laser.heatDissipationPerSecond * 3);
    expect(tryFireLaser(weapons, shooter, [target]).ok).toBe(true);
  });

  it("updates projectiles through deterministic travel, hit, damage, kill, and expiry events", () => {
    const weapons = createWeaponState();
    const shooter = createShooter();
    const target = createTarget("ambush-target", { x: 0, y: 8, z: -40 }, WEAPON_RULES.missile.damage);

    const fired = tryFireMissile(weapons, shooter, 1, target);
    expect(fired.ok).toBe(true);

    const events = updateProjectiles(weapons, [target], 0.5);

    expect(target.health).toBe(0);
    expect(target.active).toBe(false);
    expect(events).toEqual([
      {
        type: "projectile-hit",
        projectileId: "missile-1",
        targetId: "ambush-target",
        damage: WEAPON_RULES.missile.damage,
        remainingHealth: 0,
      },
      {
        type: "target-killed",
        projectileId: "missile-1",
        targetId: "ambush-target",
      },
    ]);
    expect(weapons.projectiles).toHaveLength(0);
  });

  it("aims locked missiles at the selected target instead of only ship-forward", () => {
    const weapons = createWeaponState();
    const shooter = createShooter({ yaw: 0 });
    const target = createTarget("flank-target", { x: 40, y: 8, z: 0 }, WEAPON_RULES.missile.damage);

    const fired = tryFireMissile(weapons, shooter, 1, target);
    expect(fired.ok).toBe(true);

    const events = updateProjectiles(weapons, [target], 0.5);

    expect(target.active).toBe(false);
    expect(events.some((event) => event.type === "target-killed" && event.targetId === "flank-target")).toBe(true);
  });

  it("homes locked missiles toward a target that changes course", () => {
    const weapons = createWeaponState();
    const shooter = createShooter({ yaw: 0 });
    const target = createTarget("dodging-target", { x: 0, y: 8, z: -140 }, WEAPON_RULES.missile.damage);

    const fired = tryFireMissile(weapons, shooter, 1, target);
    expect(fired.ok).toBe(true);

    updateProjectiles(weapons, [target], 0.35);
    target.position.x = 52;
    updateProjectiles(weapons, [target], 0.35);

    expect(weapons.projectiles[0]?.direction.x).toBeGreaterThan(0.15);
  });
});
