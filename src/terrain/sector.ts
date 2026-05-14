import type { Vec3 } from "../game/state";
import type { TerrainField } from "./TerrainField";
import { hash2 } from "./noise";

export type EnemyRole = "scout" | "gunship";
export type EnemyAlertState = "idle" | "searching" | "engaged";

export interface EnemyCluster {
  id: string;
  center: Vec3;
  radius: number;
  roles: EnemyRole[];
  alert: EnemyAlertState;
}

export interface Sector {
  seed: number;
  clusters: EnemyCluster[];
}

const TARGET_CLUSTER_COUNT = 5;
const CLUSTER_GAP = 24;

function seededRange(seed: number, index: number, channel: number, min: number, max: number): number {
  return min + hash2(index, channel, seed) * (max - min);
}

function clusterRoles(index: number): EnemyRole[] {
  return index % 2 === 0 ? ["scout", "gunship"] : ["scout"];
}

function distance2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isSeparated(candidate: EnemyCluster, clusters: EnemyCluster[]): boolean {
  return clusters.every((cluster) => {
    return distance2D(cluster.center, candidate.center) > candidate.radius + cluster.radius + CLUSTER_GAP;
  });
}

export function createSector(terrain: TerrainField, seed: number): Sector {
  const clusters: EnemyCluster[] = [];
  const halfSize = terrain.size / 2;
  const margin = Math.max(56, terrain.scale);
  const min = -halfSize + margin;
  const max = halfSize - margin;
  const patrolRadius = Math.max(0, (max - min) * 0.36);
  const angleOffset = hash2(seed, TARGET_CLUSTER_COUNT, seed) * Math.PI * 2;
  const maxAttempts = TARGET_CLUSTER_COUNT * 32;

  for (let attempt = 0; attempt < maxAttempts && clusters.length < TARGET_CLUSTER_COUNT; attempt += 1) {
    const slot = clusters.length;
    const slotAngle = angleOffset + (slot / TARGET_CLUSTER_COUNT) * Math.PI * 2;
    const jitterAngle = (hash2(attempt, 11, seed) - 0.5) * 0.26;
    const jitterRadius = 1 + (hash2(attempt, 29, seed) - 0.5) * 0.14;
    const radius = seededRange(seed, attempt, 47, 32, 48);
    const x = Math.max(min, Math.min(max, Math.cos(slotAngle + jitterAngle) * patrolRadius * jitterRadius));
    const z = Math.max(min, Math.min(max, Math.sin(slotAngle + jitterAngle) * patrolRadius * jitterRadius));
    const candidate: EnemyCluster = {
      id: `cluster-${slot}`,
      center: {
        x,
        y: terrain.heightAt(x, z) + 7,
        z
      },
      radius,
      roles: clusterRoles(slot),
      alert: "idle"
    };

    if (isSeparated(candidate, clusters)) {
      clusters.push(candidate);
    }
  }

  if (terrain.size >= 512 && clusters.length < TARGET_CLUSTER_COUNT) {
    throw new Error(
      `Unable to generate complete sector for seed ${seed}: created ${clusters.length}/${TARGET_CLUSTER_COUNT} clusters`
    );
  }

  return {
    seed,
    clusters
  };
}
