// save.js — localStorage save / load for SOLMAR. One key, one JSON
// object: money, mission progress, Sun Coins, weapons, garage and the
// player's position. Autosaves after every mission; manual save from
// the pause menu.
const KEY = "solmar-save-v1";

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}
