import { createInitialState, type GameState } from "./state";
import { RendererApp } from "../render/RendererApp";
import { createTerrainVisuals } from "../render/terrainVisuals";
import { createWorldVisuals } from "../render/worldVisuals";

export class Game {
  readonly state: GameState;

  private readonly rendererApp: RendererApp;
  private readonly resizeHandler: () => void;
  private animationFrame = 0;
  private disposed = false;
  private started = false;
  private previousFrameTime = 0;

  constructor(host: HTMLElement, seed?: number) {
    this.state = createInitialState(seed);
    this.rendererApp = new RendererApp(host);
    this.resizeHandler = () => this.rendererApp.resize();

    this.rendererApp.scene.add(createWorldVisuals(this.state.seed));
    this.rendererApp.scene.add(createTerrainVisuals(this.state.terrain));
  }

  start(): void {
    if (this.started || this.disposed) {
      return;
    }

    this.started = true;
    window.addEventListener("resize", this.resizeHandler);
    this.resizeHandler();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    window.removeEventListener("resize", this.resizeHandler);
    window.cancelAnimationFrame(this.animationFrame);
    this.rendererApp.dispose();
  }

  private readonly frame = (time: number): void => {
    if (this.disposed) {
      return;
    }

    const deltaSeconds =
      this.previousFrameTime === 0 ? 0 : Math.min(0.05, (time - this.previousFrameTime) / 1000);
    this.previousFrameTime = time;
    this.state.time += deltaSeconds;

    this.rendererApp.render();
    this.animationFrame = window.requestAnimationFrame(this.frame);
  };
}
