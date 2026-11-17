// SOLMAR — Streets of Solmar. Bootstrap: creates the game, then either runs
// one deterministic shot (?shot=chase|city|mission|start&seed=1) for the
// entry's screenshots, or starts the normal game loop behind the menu.
import { Game } from "./game.js";

const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");

const container = document.getElementById("game");
const game = new Game(container);
game.init(null);

if (shot) {
  // Deterministic screenshot mode: no loop, no audio, one rendered frame.
  try {
    game.buildShot(shot);
    window.__shotReady = true;
    document.title = `SOLMAR shot ${shot}`;
  } catch (err) {
    console.error("shot failed", err);
    window.__shotError = String(err);
  }
} else {
  game.start();
  window.__shotReady = false;
}
