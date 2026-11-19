// SOLMAR — bootstrap: build the game, expose window.__game (the play driver contract).
import { buildGame } from './game.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const canvas = document.getElementById('c');
const game = buildGame(canvas, seed);
window.__game = game;
