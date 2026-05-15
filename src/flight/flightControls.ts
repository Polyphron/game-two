import type { PlayerState, Vec3 } from "../game/state";
import { PLAYER, WORLD } from "../game/constants";

export type MouseFlightState = {
  speed: number;
  yawVelocity: number;
};

export type MouseFlightTerrain = {
  heightAt: (x: number, z: number) => number;
  coverAt: (x: number, z: number, y: number) => number;
};

export type MouseFlightInput = {
  aimX: number;
  aimY: number;
  boost: boolean;
  deltaSeconds: number;
  strafe: number;
  throttle: number;
};

const BASE_SPEED = 66;
const BOOST_MULTIPLIER = 1.86;
const STRAFE_SPEED = 34;
const MOUSE_TURN_RATE = 2.45;
const YAW_RESPONSE = 9.5;
const SKIM_RESPONSE = 7.6;
const BOOST_DRAIN = 34;
const BOOST_RECHARGE = 19;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function forwardFromYaw(yaw: number): Vec3 {
  return {
    x: Math.sin(yaw),
    y: 0,
    z: -Math.cos(yaw),
  };
}

function rightFromYaw(yaw: number): Vec3 {
  return {
    x: Math.cos(yaw),
    y: 0,
    z: Math.sin(yaw),
  };
}

export function createMouseFlightState(): MouseFlightState {
  return {
    speed: BASE_SPEED * 0.82,
    yawVelocity: 0,
  };
}

export function updateMouseFlight(
  player: PlayerState,
  state: MouseFlightState,
  terrain: MouseFlightTerrain,
  input: MouseFlightInput
): void {
  const delta = Math.max(0, input.deltaSeconds);
  const aimX = clamp(input.aimX, -1, 1);
  const aimY = clamp(input.aimY, -1, 1);
  const throttle = clamp(input.throttle, 0, 1);
  const strafe = clamp(input.strafe, -1, 1);
  const boosting = input.boost && player.boost > 0;
  const targetYawVelocity = aimX * MOUSE_TURN_RATE;
  const yawBlend = Math.min(1, delta * YAW_RESPONSE);
  const previousPosition = { ...player.position };

  state.yawVelocity += (targetYawVelocity - state.yawVelocity) * yawBlend;
  player.yaw += state.yawVelocity * delta;

  const targetSpeed = BASE_SPEED * (0.48 + throttle * 0.72) * (boosting ? BOOST_MULTIPLIER : 1);
  state.speed += (targetSpeed - state.speed) * Math.min(1, delta * 5.2);

  const forward = forwardFromYaw(player.yaw);
  const right = rightFromYaw(player.yaw);
  const strafeSpeed = strafe * STRAFE_SPEED * (boosting ? 1.18 : 1);

  player.position.x += (forward.x * state.speed + right.x * strafeSpeed) * delta;
  player.position.z += (forward.z * state.speed + right.z * strafeSpeed) * delta;

  const groundHeight = terrain.heightAt(player.position.x, player.position.z);
  const skimClearance = WORLD.skimClearance + aimY * 0.75;
  const targetY = groundHeight + clamp(skimClearance, WORLD.safeClearance + 0.5, WORLD.skimClearance + 5.5);
  player.position.y += (targetY - player.position.y) * Math.min(1, delta * SKIM_RESPONSE);

  player.velocity.x = (player.position.x - previousPosition.x) / Math.max(delta, 0.0001);
  player.velocity.y = (player.position.y - previousPosition.y) / Math.max(delta, 0.0001);
  player.velocity.z = (player.position.z - previousPosition.z) / Math.max(delta, 0.0001);
  player.boost = clamp(player.boost + (boosting ? -BOOST_DRAIN : BOOST_RECHARGE) * delta, 0, PLAYER.boostMax);

  const cover = terrain.coverAt(player.position.x, player.position.z, player.position.y);
  const speedSignal = clamp(Math.hypot(player.velocity.x, player.velocity.z) / (BASE_SPEED * BOOST_MULTIPLIER), 0, 1);
  player.exposure = clamp((1 - cover) * 0.32 + speedSignal * 0.24 + (boosting ? 0.28 : 0), 0, 1);
  player.signature = clamp(Math.max(player.signature * Math.max(0, 1 - delta * 0.18), player.exposure * 0.9), 0, 1);
}
