import type { Vec3 } from "../game/state";

export const WEAPON_RULES = {
  laser: {
    range: 72,
    hitRadius: 6,
    damage: 22,
    heatCost: 38,
    heatMax: 100,
    heatDissipationPerSecond: 14,
    signatureCost: 0.12,
    signatureDissipationPerSecond: 0.05,
  },
  missile: {
    lockThreshold: 0.7,
    reloadSeconds: 12,
    speed: 80,
    damage: 80,
    hitRadius: 7,
    lifetimeSeconds: 6,
    maxRange: 360,
    signatureCost: 0.2,
  },
} as const;

export interface WeaponActor {
  id: string;
  position: Vec3;
  yaw: number;
  heat: number;
  signature: number;
}

export interface CombatTarget {
  id: string;
  position: Vec3;
  health: number;
  active?: boolean;
}

export interface ProjectileState {
  id: string;
  shooterId: string;
  targetId?: string;
  position: Vec3;
  direction: Vec3;
  speed: number;
  damage: number;
  hitRadius: number;
  ageSeconds: number;
  lifetimeSeconds: number;
  distanceTravelled: number;
  maxRange: number;
}

export interface WeaponState {
  missileReloadRemaining: number;
  projectiles: ProjectileState[];
  nextProjectileSequence: number;
}

export type FireFailureReason = "heat" | "lock" | "reloading" | "invalid-target";

export type CombatEvent =
  | {
      type: "laser-fired";
      shooterId: string;
      targetId?: string;
    }
  | {
      type: "laser-hit";
      shooterId: string;
      targetId: string;
      damage: number;
      remainingHealth: number;
    }
  | {
      type: "missile-fired";
      shooterId: string;
      projectileId: string;
      targetId: string;
    }
  | {
      type: "projectile-hit";
      projectileId: string;
      targetId: string;
      damage: number;
      remainingHealth: number;
    }
  | {
      type: "target-killed";
      projectileId?: string;
      shooterId?: string;
      targetId: string;
    }
  | {
      type: "projectile-expired";
      projectileId: string;
      reason: "lifetime" | "range";
    };

export type FireResult =
  | {
      ok: true;
      events: CombatEvent[];
    }
  | {
      ok: false;
      reason: FireFailureReason;
      events: CombatEvent[];
    };

export function createWeaponState(): WeaponState {
  return {
    missileReloadRemaining: 0,
    projectiles: [],
    nextProjectileSequence: 1,
  };
}

export function updateWeapons(state: WeaponState, deltaSeconds: number, actors: WeaponActor[] = []): void {
  const delta = Math.max(0, deltaSeconds);
  state.missileReloadRemaining = Math.max(0, state.missileReloadRemaining - delta);

  for (const actor of actors) {
    actor.heat = Math.max(0, actor.heat - WEAPON_RULES.laser.heatDissipationPerSecond * delta);
    actor.signature = Math.max(0, actor.signature - WEAPON_RULES.laser.signatureDissipationPerSecond * delta);
  }
}

export function tryFireLaser(state: WeaponState, shooter: WeaponActor, targets: CombatTarget[]): FireResult {
  void state;

  if (shooter.heat + WEAPON_RULES.laser.heatCost > WEAPON_RULES.laser.heatMax) {
    return { ok: false, reason: "heat", events: [] };
  }

  shooter.heat += WEAPON_RULES.laser.heatCost;
  shooter.signature = clamp01(shooter.signature + WEAPON_RULES.laser.signatureCost);

  const target = findLaserTarget(shooter, targets);
  const events: CombatEvent[] = [
    {
      type: "laser-fired",
      shooterId: shooter.id,
      targetId: target?.id,
    },
  ];

  if (target) {
    applyDamage(target, WEAPON_RULES.laser.damage);
    events.push({
      type: "laser-hit",
      shooterId: shooter.id,
      targetId: target.id,
      damage: WEAPON_RULES.laser.damage,
      remainingHealth: target.health,
    });
    if (target.health <= 0) {
      events.push({
        type: "target-killed",
        shooterId: shooter.id,
        targetId: target.id,
      });
    }
  }

  return { ok: true, events };
}

export function tryFireMissile(
  state: WeaponState,
  shooter: WeaponActor,
  lockConfidence: number,
  target: CombatTarget,
): FireResult {
  if (!isTargetActive(target)) {
    return { ok: false, reason: "invalid-target", events: [] };
  }
  if (lockConfidence < WEAPON_RULES.missile.lockThreshold) {
    return { ok: false, reason: "lock", events: [] };
  }
  if (state.missileReloadRemaining > 0) {
    return { ok: false, reason: "reloading", events: [] };
  }

  const projectileId = `missile-${state.nextProjectileSequence}`;
  state.nextProjectileSequence += 1;
  state.missileReloadRemaining = WEAPON_RULES.missile.reloadSeconds;
  shooter.signature = clamp01(shooter.signature + WEAPON_RULES.missile.signatureCost);

  state.projectiles.push({
    id: projectileId,
    shooterId: shooter.id,
    targetId: target.id,
    position: cloneVec3(shooter.position),
    direction: directionToTarget(shooter.position, target.position),
    speed: WEAPON_RULES.missile.speed,
    damage: WEAPON_RULES.missile.damage,
    hitRadius: WEAPON_RULES.missile.hitRadius,
    ageSeconds: 0,
    lifetimeSeconds: WEAPON_RULES.missile.lifetimeSeconds,
    distanceTravelled: 0,
    maxRange: WEAPON_RULES.missile.maxRange,
  });

  return {
    ok: true,
    events: [
      {
        type: "missile-fired",
        shooterId: shooter.id,
        projectileId,
        targetId: target.id,
      },
    ],
  };
}

export function updateProjectiles(
  state: WeaponState,
  targets: CombatTarget[],
  deltaSeconds: number,
): CombatEvent[] {
  const delta = Math.max(0, deltaSeconds);
  const events: CombatEvent[] = [];
  const activeProjectiles: ProjectileState[] = [];

  for (const projectile of state.projectiles) {
    const stepDistance = projectile.speed * delta;
    projectile.position = {
      x: projectile.position.x + projectile.direction.x * stepDistance,
      y: projectile.position.y + projectile.direction.y * stepDistance,
      z: projectile.position.z + projectile.direction.z * stepDistance,
    };
    projectile.ageSeconds += delta;
    projectile.distanceTravelled += stepDistance;

    const hitTarget = findProjectileTarget(projectile, targets);
    if (hitTarget) {
      applyDamage(hitTarget, projectile.damage);
      events.push({
        type: "projectile-hit",
        projectileId: projectile.id,
        targetId: hitTarget.id,
        damage: projectile.damage,
        remainingHealth: hitTarget.health,
      });
      if (hitTarget.health <= 0) {
        events.push({
          type: "target-killed",
          projectileId: projectile.id,
          targetId: hitTarget.id,
        });
      }
      continue;
    }

    if (projectile.ageSeconds >= projectile.lifetimeSeconds) {
      events.push({
        type: "projectile-expired",
        projectileId: projectile.id,
        reason: "lifetime",
      });
      continue;
    }
    if (projectile.distanceTravelled >= projectile.maxRange) {
      events.push({
        type: "projectile-expired",
        projectileId: projectile.id,
        reason: "range",
      });
      continue;
    }

    activeProjectiles.push(projectile);
  }

  state.projectiles = activeProjectiles;
  return events;
}

function findLaserTarget(shooter: WeaponActor, targets: CombatTarget[]): CombatTarget | undefined {
  const forward = forwardFromYaw(shooter.yaw);
  let bestTarget: CombatTarget | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (!isTargetActive(target)) continue;

    const relative = {
      x: target.position.x - shooter.position.x,
      z: target.position.z - shooter.position.z,
    };
    const forwardDistance = relative.x * forward.x + relative.z * forward.z;
    if (forwardDistance < 0 || forwardDistance > WEAPON_RULES.laser.range) continue;

    const lateralX = relative.x - forward.x * forwardDistance;
    const lateralZ = relative.z - forward.z * forwardDistance;
    const lateralDistance = Math.hypot(lateralX, lateralZ);
    if (lateralDistance > WEAPON_RULES.laser.hitRadius) continue;

    if (forwardDistance < bestDistance) {
      bestDistance = forwardDistance;
      bestTarget = target;
    }
  }

  return bestTarget;
}

function findProjectileTarget(projectile: ProjectileState, targets: CombatTarget[]): CombatTarget | undefined {
  let bestTarget: CombatTarget | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (!isTargetActive(target)) continue;

    const distance = distance2D(projectile.position, target.position);
    if (distance > projectile.hitRadius) continue;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTarget = target;
    }
  }

  return bestTarget;
}

function applyDamage(target: CombatTarget, damage: number): void {
  target.health = Math.max(0, target.health - damage);
  if (target.health <= 0 && "active" in target) {
    target.active = false;
  }
}

function isTargetActive(target: CombatTarget): boolean {
  return target.health > 0 && target.active !== false;
}

function forwardFromYaw(yaw: number): Vec3 {
  return {
    x: Math.sin(yaw),
    y: 0,
    z: -Math.cos(yaw),
  };
}

function directionToTarget(origin: Vec3, target: Vec3): Vec3 {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= 0.001) {
    return forwardFromYaw(0);
  }

  return {
    x: dx / distance,
    y: 0,
    z: dz / distance,
  };
}

function distance2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function cloneVec3(value: Vec3): Vec3 {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
