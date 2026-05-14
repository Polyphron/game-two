import type { PlayerState, Vec3 } from "../game/state";

export type CameraRig = {
  position: Vec3;
  target: Vec3;
};

const BACK_DISTANCE = 18;
const HEIGHT = 7.5;
const LOOK_DISTANCE = 48;
const LOOK_LIFT = 2.2;

export function computeCockpitCamera(player: PlayerState): CameraRig {
  const heading = player.yaw ?? (player as PlayerState & { heading?: number }).heading ?? 0;
  const forwardX = Math.sin(heading);
  const forwardZ = -Math.cos(heading);

  return {
    position: {
      x: player.position.x - forwardX * BACK_DISTANCE,
      y: player.position.y + HEIGHT,
      z: player.position.z - forwardZ * BACK_DISTANCE,
    },
    target: {
      x: player.position.x + forwardX * LOOK_DISTANCE,
      y: player.position.y + LOOK_LIFT,
      z: player.position.z + forwardZ * LOOK_DISTANCE,
    },
  };
}
