// SOLMAR — bootstrap: buat game, expose window.__game (kontrak play driver).
import { createGame } from './game.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1);
const canvas = document.getElementById('c');
const game = createGame(canvas, seed);
window.__game = game;
