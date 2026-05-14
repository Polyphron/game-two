import { PLAYER, WORLD } from "./constants";
import { TerrainField } from "../terrain/TerrainField";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type EntityKind = "player" | "drone" | "sensor" | "salvage";

export interface EntityState {
  id: string;
  kind: EntityKind;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  signature: number;
  active: boolean;
}

export interface PlayerState extends EntityState {
  kind: "player";
  hull: number;
  shield: number;
  heat: number;
  boost: number;
  credits: number;
  exposure: number;
}

export interface GameState {
  seed: number;
  time: number;
  terrain: TerrainField;
  player: PlayerState;
  entities: Map<string, EntityState>;
}

export function createInitialState(seed = 20260514, terrain?: TerrainField): GameState {
  const activeTerrain = terrain ?? new TerrainField({
    seed,
    size: WORLD.terrainSize,
    scale: WORLD.terrainScale,
    amplitude: WORLD.terrainAmplitude
  });
  const spawnX = 0;
  const spawnZ = -WORLD.terrainSize * 0.32;
  const position = {
    x: spawnX,
    y: activeTerrain.heightAt(spawnX, spawnZ) + WORLD.skimClearance,
    z: spawnZ
  };
  const player: PlayerState = {
    id: "player",
    kind: "player",
    position,
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    signature: 0.18,
    active: true,
    hull: PLAYER.hullMax,
    shield: PLAYER.shieldMax,
    heat: 0,
    boost: PLAYER.boostMax,
    credits: 0,
    exposure: 0
  };

  return {
    seed,
    time: 0,
    terrain: activeTerrain,
    player,
    entities: new Map<string, EntityState>([[player.id, player]])
  };
}
