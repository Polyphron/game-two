import type { PlayerState, Vec3 } from "../game/state";
import type { EnemyAlertState, EnemyRole, Sector } from "../terrain/sector";

export type EnemyDefinition = {
  role: EnemyRole;
  sensorRange: number;
  attackRange: number;
  moveSpeed: number;
  confidenceGain: number;
  confidenceLoss: number;
  threat: number;
  propagationRadius: number;
};

export type EnemyTerrain = {
  heightAt: (x: number, z: number) => number;
  coverAt: (x: number, z: number, y: number) => number;
  hasTerrainOcclusion: (a: Vec3, b: Vec3) => boolean;
};

export type EnemyUnitRuntime = {
  id: string;
  role: EnemyRole;
  position: Vec3;
};

export type EnemyClusterRuntime = {
  id: string;
  center: Vec3;
  radius: number;
  roles: EnemyRole[];
  alert: EnemyAlertState;
  confidence: number;
  lastKnownPosition?: Vec3;
  units: EnemyUnitRuntime[];
};

export type EnemyRuntime = {
  seed: number;
  clusters: EnemyClusterRuntime[];
};

export type UpdateEnemyRuntimeInput = {
  player: PlayerState;
  terrain: EnemyTerrain;
  deltaSeconds: number;
  playerSignature: number;
};

export type ClusterThreat = {
  level: number;
  activeClusters: number;
};

export const ENEMY_DEFINITIONS: Record<EnemyRole, EnemyDefinition> = {
  scout: {
    role: "scout",
    sensorRange: 190,
    attackRange: 62,
    moveSpeed: 38,
    confidenceGain: 0.62,
    confidenceLoss: 0.52,
    threat: 0.34,
    propagationRadius: 175
  },
  gunship: {
    role: "gunship",
    sensorRange: 150,
    attackRange: 96,
    moveSpeed: 26,
    confidenceGain: 0.68,
    confidenceLoss: 0.42,
    threat: 0.56,
    propagationRadius: 145
  }
};

const PING_CONFIDENCE = 0.34;
const CONFIRMED_THRESHOLD = 0.68;
const ATTACKING_THRESHOLD = 0.9;
const INVESTIGATING_THRESHOLD = 0.28;
const PROPAGATED_CONFIDENCE = 0.3;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function copyVec3(value: Vec3): Vec3 {
  return {
    x: value.x,
    y: value.y,
    z: value.z
  };
}

function distance2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function roleOffset(role: EnemyRole, index: number, radius: number): { x: number; z: number } {
  const angle = (index + (role === "gunship" ? 0.5 : 0)) * Math.PI * 0.74;
  const distance = Math.max(8, radius * (role === "gunship" ? 0.18 : 0.32));

  return {
    x: Math.cos(angle) * distance,
    z: Math.sin(angle) * distance
  };
}

function strongestDefinition(roles: EnemyRole[]): EnemyDefinition {
  return roles.reduce((strongest, role) => {
    const next = ENEMY_DEFINITIONS[role];
    return next.sensorRange > strongest.sensorRange ? next : strongest;
  }, ENEMY_DEFINITIONS[roles[0] ?? "scout"]);
}

function highestThreatDefinition(roles: EnemyRole[]): EnemyDefinition {
  return roles.reduce((strongest, role) => {
    const next = ENEMY_DEFINITIONS[role];
    return next.threat > strongest.threat ? next : strongest;
  }, ENEMY_DEFINITIONS[roles[0] ?? "scout"]);
}

function setMinimumAlert(cluster: EnemyClusterRuntime, alert: EnemyAlertState, confidence: number): void {
  if (cluster.alert === "confirmed" || cluster.alert === "attacking") {
    return;
  }

  cluster.alert = alert;
  cluster.confidence = Math.max(cluster.confidence, confidence);
}

function alertRank(alert: EnemyAlertState): number {
  switch (alert) {
    case "attacking":
    case "engaged":
      return 6;
    case "confirmed":
      return 5;
    case "investigating":
      return 4;
    case "searching":
      return 3;
    case "suspicious":
      return 2;
    case "cooling":
      return 1;
    case "idle":
      return 0;
  }
}

function alertForConfidence(cluster: EnemyClusterRuntime, distanceToPlayer: number): EnemyAlertState {
  const attackRange = highestThreatDefinition(cluster.roles).attackRange;

  if (cluster.confidence >= ATTACKING_THRESHOLD && distanceToPlayer <= attackRange) {
    return "attacking";
  }

  if (cluster.confidence >= CONFIRMED_THRESHOLD) {
    return "confirmed";
  }

  if (cluster.confidence >= INVESTIGATING_THRESHOLD) {
    return "investigating";
  }

  if (cluster.confidence > 0) {
    return "suspicious";
  }

  return "idle";
}

function canSeePlayer(cluster: EnemyClusterRuntime, player: PlayerState, terrain: EnemyTerrain): boolean {
  const cover = clamp01(terrain.coverAt(player.position.x, player.position.z, player.position.y));

  return cover < 0.72 && !terrain.hasTerrainOcclusion(cluster.center, player.position);
}

function propagateLocalAlerts(runtime: EnemyRuntime, source: EnemyClusterRuntime): void {
  const definition = strongestDefinition(source.roles);

  for (const target of runtime.clusters) {
    if (target.id === source.id || alertRank(target.alert) >= alertRank("investigating")) {
      continue;
    }

    if (distance2D(source.center, target.center) <= definition.propagationRadius) {
      target.alert = "investigating";
      target.confidence = Math.max(target.confidence, PROPAGATED_CONFIDENCE);
      target.lastKnownPosition = source.lastKnownPosition ? copyVec3(source.lastKnownPosition) : target.lastKnownPosition;
    }
  }
}

export function createEnemyRuntime(sector: Sector, terrain: EnemyTerrain): EnemyRuntime {
  return {
    seed: sector.seed,
    clusters: sector.clusters.map((cluster) => {
      const groundY = terrain.heightAt(cluster.center.x, cluster.center.z);
      const altitude = Math.max(6, cluster.center.y - groundY);
      const center = {
        x: cluster.center.x,
        y: groundY + altitude,
        z: cluster.center.z
      };

      return {
        id: cluster.id,
        center,
        radius: cluster.radius,
        roles: [...cluster.roles],
        alert: cluster.alert === "engaged" ? "confirmed" : cluster.alert,
        confidence: cluster.alert === "idle" ? 0 : 0.35,
        units: cluster.roles.map((role, index) => {
          const offset = roleOffset(role, index, cluster.radius);
          const x = cluster.center.x + offset.x;
          const z = cluster.center.z + offset.z;

          return {
            id: `${cluster.id}-${role}-${index}`,
            role,
            position: {
              x,
              y: terrain.heightAt(x, z) + (role === "gunship" ? 14 : 8),
              z
            }
          };
        })
      };
    })
  };
}

export function applyPingAlert(runtime: EnemyRuntime, origin: Vec3, radius: number): EnemyRuntime {
  for (const cluster of runtime.clusters) {
    if (distance2D(cluster.center, origin) <= radius) {
      setMinimumAlert(cluster, "investigating", PING_CONFIDENCE);
      cluster.lastKnownPosition = copyVec3(origin);
    }
  }

  return runtime;
}

export function updateEnemyRuntime(runtime: EnemyRuntime, input: UpdateEnemyRuntimeInput): EnemyRuntime {
  const deltaSeconds = Math.max(0, input.deltaSeconds);
  const detectedClusters: EnemyClusterRuntime[] = [];

  for (const cluster of runtime.clusters) {
    const definition = strongestDefinition(cluster.roles);
    const distance = distance2D(cluster.center, input.player.position);
    const inSensorRange = distance <= definition.sensorRange;
    const hadConfirmedContact = alertRank(cluster.alert) >= alertRank("confirmed");

    if (inSensorRange && canSeePlayer(cluster, input.player, input.terrain)) {
      const rangeSignal = 1 - distance / definition.sensorRange;
      const gain = definition.confidenceGain * (0.45 + rangeSignal * 0.35 + clamp01(input.playerSignature) * 0.45);
      cluster.confidence = clamp01(cluster.confidence + gain * deltaSeconds);
      cluster.lastKnownPosition = copyVec3(input.player.position);
      cluster.alert = alertForConfidence(cluster, distance);

      if (alertRank(cluster.alert) >= alertRank("confirmed")) {
        detectedClusters.push(cluster);
      }

      continue;
    }

    if (hadConfirmedContact) {
      cluster.alert = "searching";
      cluster.confidence = Math.max(0.1, cluster.confidence - definition.confidenceLoss * deltaSeconds);
      continue;
    }

    cluster.confidence = Math.max(0, cluster.confidence - definition.confidenceLoss * 0.65 * deltaSeconds);

    if (cluster.confidence <= 0) {
      cluster.alert = cluster.alert === "cooling" ? "idle" : "cooling";
    } else if (cluster.alert !== "investigating") {
      cluster.alert = alertForConfidence(cluster, distance);
    }
  }

  for (const cluster of detectedClusters) {
    propagateLocalAlerts(runtime, cluster);
  }

  return runtime;
}

export function getClusterThreat(runtime: EnemyRuntime): ClusterThreat {
  let level = 0;
  let activeClusters = 0;

  for (const cluster of runtime.clusters) {
    const rank = alertRank(cluster.alert);

    if (rank < alertRank("investigating")) {
      continue;
    }

    activeClusters += 1;
    level += highestThreatDefinition(cluster.roles).threat * (0.4 + cluster.confidence * 0.8);
  }

  return {
    level: clamp01(level),
    activeClusters
  };
}
