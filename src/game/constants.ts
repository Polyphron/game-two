export const WORLD = {
  terrainSize: 768,
  terrainScale: 42,
  terrainAmplitude: 36,
  safeClearance: 1.8,
  skimClearance: 4.2
} as const;

export const PLAYER = {
  hullMax: 100,
  shieldMax: 75,
  heatMax: 100,
  boostMax: 100,
  moveSpeed: 18,
  strafeSpeed: 14,
  climbSpeed: 10,
  boostSpeedMultiplier: 1.85,
  turnRate: 2.6,
  heatDissipation: 14,
  boostRecharge: 18,
  exposureRecovery: 0.16
} as const;

export const RADAR = {
  passiveRange: 96,
  activeRange: 220,
  pingDuration: 1.6,
  pingSignature: 0.82,
  confidenceDecay: 0.28
} as const;
