import type { RadarContact } from "./radarModel";

export type TargetLockStatus = "idle" | "seeking" | "locking" | "locked" | "lost";

export type TargetLockState = {
  quality: number;
  status: TargetLockStatus;
  targetClusterId?: string;
};

export type TargetLockInput = {
  contacts: readonly RadarContact[];
  deltaSeconds: number;
  requesting: boolean;
};

const MIN_LOCK_CONFIDENCE = 0.24;
const LOCK_GAIN_PER_SECOND = 1.05;
const LOCK_LOSS_PER_SECOND = 1.45;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function chooseContact(contacts: readonly RadarContact[]): RadarContact | undefined {
  let best: RadarContact | undefined;

  for (const contact of contacts) {
    if (contact.confidence < MIN_LOCK_CONFIDENCE) {
      continue;
    }

    if (!best || contact.confidence > best.confidence) {
      best = contact;
    }
  }

  return best;
}

export function createTargetLockState(): TargetLockState {
  return {
    quality: 0,
    status: "idle",
  };
}

export function updateTargetLock(state: TargetLockState, input: TargetLockInput): TargetLockState {
  const delta = Math.max(0, input.deltaSeconds);
  const contact = chooseContact(input.contacts);

  if (!input.requesting || !contact) {
    state.quality = clamp01(state.quality - LOCK_LOSS_PER_SECOND * delta);
    state.status = state.quality > 0 ? "lost" : input.requesting ? "seeking" : "idle";
    if (state.quality <= 0) {
      state.targetClusterId = undefined;
    }
    return state;
  }

  if (state.targetClusterId && state.targetClusterId !== contact.clusterId) {
    state.quality = Math.min(state.quality, 0.28);
  }

  state.targetClusterId = contact.clusterId;
  state.quality = clamp01(state.quality + LOCK_GAIN_PER_SECOND * (0.35 + contact.confidence) * delta);
  state.status = state.quality >= 1 ? "locked" : "locking";

  return state;
}
