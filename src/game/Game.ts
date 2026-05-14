import * as THREE from "three";
import { createInitialState, type GameState } from "./state";
import { PLAYER, WORLD } from "./constants";
import { computeCockpitCamera } from "../flight/cameraRig";
import { createSonarPulse, triggerSonarPulse, updateSonarPulse, type SonarPulse } from "../radar/sonarPulse";
import { RendererApp } from "../render/RendererApp";
import { createTerrainVisuals, updateTerrainVisuals } from "../render/terrainVisuals";
import { createWorldVisuals } from "../render/worldVisuals";

export class Game {
  readonly state: GameState;

  private readonly host: HTMLElement;
  private readonly rendererApp: RendererApp;
  private readonly resizeHandler: () => void;
  private readonly keyDownHandler: (event: KeyboardEvent) => void;
  private readonly keyUpHandler: (event: KeyboardEvent) => void;
  private readonly terrainVisuals: THREE.Group;
  private readonly pressedKeys = new Set<string>();
  private readonly sonar: SonarPulse;
  private animationFrame = 0;
  private disposed = false;
  private started = false;
  private previousFrameTime = 0;

  constructor(host: HTMLElement, seed?: number) {
    this.host = host;
    this.state = createInitialState(seed);
    this.sonar = createSonarPulse();
    this.rendererApp = new RendererApp(host);
    this.resizeHandler = () => this.rendererApp.resize();
    this.keyDownHandler = (event) => this.handleKeyDown(event);
    this.keyUpHandler = (event) => this.handleKeyUp(event);
    this.terrainVisuals = createTerrainVisuals(this.state.terrain);

    this.rendererApp.scene.add(createWorldVisuals(this.state.seed));
    this.rendererApp.scene.add(this.terrainVisuals);
  }

  start(): void {
    if (this.started || this.disposed) {
      return;
    }

    this.started = true;
    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    this.resizeHandler();
    triggerSonarPulse(this.sonar);
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    window.cancelAnimationFrame(this.animationFrame);
    this.rendererApp.dispose();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.pressedKeys.add(event.code);

    if (event.code === "Space" && !event.repeat) {
      event.preventDefault();
      triggerSonarPulse(this.sonar);
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  private updatePlayer(deltaSeconds: number): void {
    const player = this.state.player;
    const left = this.pressedKeys.has("ArrowLeft") || this.pressedKeys.has("KeyA");
    const right = this.pressedKeys.has("ArrowRight") || this.pressedKeys.has("KeyD");
    const throttle = this.pressedKeys.has("KeyW") ? 1.32 : this.pressedKeys.has("KeyS") ? 0.46 : 0.88;
    const boosting = this.pressedKeys.has("ShiftLeft") || this.pressedKeys.has("ShiftRight");
    const turnInput = (right ? 1 : 0) - (left ? 1 : 0);
    const speed = PLAYER.moveSpeed * throttle * (boosting ? PLAYER.boostSpeedMultiplier : 1);
    const forwardX = Math.sin(player.yaw);
    const forwardZ = -Math.cos(player.yaw);
    const previousX = player.position.x;
    const previousZ = player.position.z;

    player.yaw += turnInput * PLAYER.turnRate * deltaSeconds;
    player.position.x += forwardX * speed * deltaSeconds;
    player.position.z += forwardZ * speed * deltaSeconds;
    this.wrapPlayerToTerrain();

    const groundHeight = this.state.terrain.heightAt(player.position.x, player.position.z);
    const targetY = groundHeight + WORLD.skimClearance;
    const skimBlend = Math.min(1, deltaSeconds * 5.8);
    player.position.y += (targetY - player.position.y) * skimBlend;
    player.velocity.x = (player.position.x - previousX) / Math.max(deltaSeconds, 0.0001);
    player.velocity.y = 0;
    player.velocity.z = (player.position.z - previousZ) / Math.max(deltaSeconds, 0.0001);
    player.boost = Math.max(0, Math.min(PLAYER.boostMax, player.boost + (boosting ? -24 : 18) * deltaSeconds));
    player.heat = Math.max(0, player.heat - PLAYER.heatDissipation * deltaSeconds);
    player.exposure = Math.max(0, Math.min(1, this.sonar.reveal * 0.55 + (boosting ? 0.2 : 0)));
  }

  private wrapPlayerToTerrain(): void {
    const player = this.state.player;
    const halfSize = this.state.terrain.size * 0.44;

    if (player.position.x < -halfSize) player.position.x = halfSize;
    if (player.position.x > halfSize) player.position.x = -halfSize;
    if (player.position.z < -halfSize) player.position.z = halfSize;
    if (player.position.z > halfSize) player.position.z = -halfSize;
  }

  private updateCamera(): void {
    const rig = computeCockpitCamera(this.state.player);
    this.rendererApp.camera.position.set(rig.position.x, rig.position.y, rig.position.z);
    this.rendererApp.camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
  }

  private updateInterface(): void {
    this.host.style.setProperty("--sonar-reveal", this.sonar.reveal.toFixed(3));
    this.host.style.setProperty("--ship-heat", (this.state.player.heat / PLAYER.heatMax).toFixed(3));
    this.host.style.setProperty("--shield", (this.state.player.shield / PLAYER.shieldMax).toFixed(3));
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) {
      return;
    }

    const deltaSeconds =
      this.previousFrameTime === 0 ? 0 : Math.min(0.05, (time - this.previousFrameTime) / 1000);
    this.previousFrameTime = time;
    this.state.time += deltaSeconds;
    this.updatePlayer(deltaSeconds);
    updateSonarPulse(this.sonar, deltaSeconds);
    this.updateCamera();
    updateTerrainVisuals(this.terrainVisuals, {
      playerPosition: this.state.player.position,
      sonarRadius: this.sonar.radius,
      sonarReveal: this.sonar.reveal,
      time: this.state.time
    });
    this.updateInterface();

    this.rendererApp.render();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  };
}
