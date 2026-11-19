// main.js — bootstrap: creates the Game, exposes the playtest hooks,
// and runs the frame loop. With ?shot=<scene> it renders one
// deterministic frame instead of starting the live loop.
import { Game } from "./game.js";

const canvas = document.getElementById("game-canvas");
const game = new Game(canvas);
window.__game = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");
if (shot) {
  game.renderShot(shot);
} else {
  const loop = (now) => {
    game.frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
