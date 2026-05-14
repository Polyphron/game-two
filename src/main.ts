import "./styles.css";
import { Game } from "./game/Game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element.");
}

app.innerHTML = `
  <div class="game-shell">
    <div id="viewport" class="viewport"></div>
  </div>
`;

const viewport = document.querySelector<HTMLDivElement>("#viewport");

if (!viewport) {
  throw new Error("Missing #viewport mount.");
}

const game = new Game(viewport);
game.start();

window.addEventListener("beforeunload", () => {
  game.dispose();
});
