import type { PlayerState, Vec3 } from "../game/state";
import type { EnemyAlertState, EnemyCluster, EnemyRole } from "../terrain/sector";

export type RadarContactSource = "active-ping" | "passive" | "ghost";

export type RadarContact = {
  clusterId: string;
  confidence: number;
  ageSeconds: number;
  source: RadarContactSource;
  lastKnownPosition: Vec3;
  radius: number;
  roles: EnemyRole[];
  alert: EnemyAlertState;
};

export type RadarState = {
  contacts: Map<string, RadarContact>;
};

export type RadarTerrain = {
  heightAt: (x: number, z: number) => number;
  coverAt: (x: number, z: number, y: number) => number;
  hasTerrainOcclusion: (a: Vec3, b: Vec3) => boolean;
};

export type UpdateRadarContactsInput = {
  player: PlayerState;
  clusters: readonly EnemyCluster[];
  terrain: RadarTerrain;
  deltaSeconds: number;
  ping: boolean;
  playerSignature: number;
};

const ACTIVE_PING_RANGE = 280;
const PASSIVE_RANGE = 150;
const GHOST_DECAY_PER_SECOND = 0.11;
const GHOST_FLOOR = 0.06;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function copyVec3(value: Vec3): Vec3 {
  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

function distance2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function alertConfidenceMultiplier(alert: EnemyAlertState): number {
  if (alert === "engaged") {
    return 1;
  }

  if (alert === "searching") {
    return 0.94;
  }

  return 0.88;
}

function sampleCover(terrain: RadarTerrain, position: Vec3): number {
  return clamp01(terrain.coverAt(position.x, position.z, position.y));
}

function contactConfidence(input: UpdateRadarContactsInput, cluster: EnemyCluster): RadarContact | undefined {
  const distance = distance2D(input.player.position, cluster.center);
  const detectionRange = input.ping ? ACTIVE_PING_RANGE : PASSIVE_RANGE;

  if (distance > detectionRange) {
    return undefined;
  }

  const rangeFalloff = 1 - distance / detectionRange;
  const source: RadarContactSource = input.ping ? "active-ping" : "passive";
  const base = input.ping ? 0.78 + rangeFalloff * 0.18 : 0.18 + clamp01(input.playerSignature) * 0.42;
  const playerCover = sampleCover(input.terrain, input.player.position);
  const targetCover = sampleCover(input.terrain, cluster.center);
  const coverMultiplier = 1 - Math.max(playerCover, targetCover) * 0.45;
  const occlusionMultiplier = input.terrain.hasTerrainOcclusion(input.player.position, cluster.center) ? 0.55 : 1;
  const confidence = clamp01(base * coverMultiplier * occlusionMultiplier * alertConfidenceMultiplier(cluster.alert));

  if (confidence <= GHOST_FLOOR) {
    return undefined;
  }

  return {
    alert: cluster.alert,
    ageSeconds: 0,
    clusterId: cluster.id,
    confidence,
    lastKnownPosition: copyVec3(cluster.center),
    radius: cluster.radius,
    roles: [...cluster.roles],
    source,
  };
}

function decayExistingContacts(radar: RadarState, deltaSeconds: number): void {
  const decay = Math.max(0, deltaSeconds) * GHOST_DECAY_PER_SECOND;

  for (const contact of radar.contacts.values()) {
    contact.ageSeconds += Math.max(0, deltaSeconds);
    contact.confidence = Math.max(GHOST_FLOOR, contact.confidence - decay);
    contact.source = "ghost";
  }
}

export function createRadarState(): RadarState {
  return {
    contacts: new Map(),
  };
}

export function updateRadarContacts(radar: RadarState, input: UpdateRadarContactsInput): RadarState {
  decayExistingContacts(radar, input.deltaSeconds);

  for (const cluster of input.clusters) {
    const detected = contactConfidence(input, cluster);
    if (!detected) {
      continue;
    }

    const current = radar.contacts.get(cluster.id);
    if (!current || detected.confidence >= current.confidence) {
      radar.contacts.set(cluster.id, detected);
      continue;
    }

    current.ageSeconds = 0;
    current.alert = detected.alert;
    current.lastKnownPosition = detected.lastKnownPosition;
    current.radius = detected.radius;
    current.roles = detected.roles;
    current.source = detected.source;
  }

  return radar;
}

export function getStrongestContact(radar: RadarState): RadarContact | undefined {
  let strongest: RadarContact | undefined;

  for (const contact of radar.contacts.values()) {
    if (!strongest || contact.confidence > strongest.confidence) {
      strongest = contact;
    }
  }

  return strongest;
}
