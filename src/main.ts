import "./styles.css";
import { WORLD } from "./game/constants";
import { Game } from "./game/Game";
import { loadHeightmapDataFromImage } from "./terrain/heightmap";
import { TerrainField } from "./terrain/TerrainField";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

app.innerHTML = `
  <div class="game-shell">
    <div id="viewport" class="viewport">
      <div class="cockpit-overlay" aria-hidden="true">
        <div class="activity-feed">
          <span>ACTIVITY FEED</span>
          <strong>14/05 20:38: SECTOR LINK LIVE. NOVA-WAVE.</strong>
        </div>
        <div class="compass-strip">
          <span>300</span>
          <span>330</span>
          <span>N</span>
          <span>030</span>
          <span>060</span>
        </div>
        <div class="score-panel">
          <span>ALL-TIME HIGHS</span>
          <strong>01 KESTREL</strong>
          <strong>02 WIDOWMAKER</strong>
          <strong>03 CINDER</strong>
          <span class="session-live">THIS SORTIE IS LIVE</span>
        </div>
        <div class="left-stats">
          <span>KILLS 0</span>
          <span>HELD 0</span>
          <span>HEAT 0</span>
        </div>
        <div class="reticle">
          <span></span>
        </div>
        <div class="bottom-hud">
          <div class="ship-mark"></div>
          <div class="hull-bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="sonar-core"></div>
          <div class="shield-bars" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const viewport = document.querySelector<HTMLDivElement>("#viewport");

if (!viewport) {
  throw new Error("Missing #viewport mount.");
}

async function createMapBackedGame(host: HTMLElement): Promise<Game> {
  const heightmap = await loadHeightmapDataFromImage("/assets/heightmap_512x512.png");
  const terrain = new TerrainField({
    seed: 20260514,
    size: WORLD.terrainSize,
    scale: WORLD.terrainScale,
    amplitude: WORLD.terrainAmplitude,
    heightmap,
    proceduralDetail: 0.075,
  });

  return new Game(host, { terrain });
}

let game: Game | null = null;

createMapBackedGame(viewport)
  .catch((error: unknown) => {
    console.warn("Falling back to procedural terrain because the heightmap could not be loaded.", error);
    return new Game(viewport);
  })
  .then((createdGame) => {
    game = createdGame;
    game.start();
  });

window.addEventListener("beforeunload", () => {
  game?.dispose();
});
