// Save: one localStorage slot. Autosaves after each mission, manual save
// from the pause menu. Continue on the start screen loads it.
const KEY = "solmar-save-v1";

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== "object" || !data) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function hasSave() {
  return loadGame() !== null;
}
