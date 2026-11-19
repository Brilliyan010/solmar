// SOLMAR — save and load in localStorage: cash, missions, upgrades,
// relics, bosses, coins and where Mara was standing.
const KEY = 'solmar-save-v1';

export function runSave(ctx) {
  // Snapshot the progression state into one JSON object and store it.
  function save() {
    try {
      const data = {
        money: ctx.economy?.money ?? 200,
        missionsDone: [...(ctx.missions?.done || [])],
        upgrades: [...(ctx.upgrades?.owned || [])],
        relics: [...(ctx.upgrades?.relicsFound || [])],
        cred: ctx.upgrades?.cred ?? 0,
        garage: ctx.economy?.garage || ['pipit'],
        bosses: Object.keys(ctx.bosses?.defeated || {}),
        coins: ctx.economy?.coins ?? 0,
        x: ctx.player.x,
        z: ctx.player.z,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      // Storage can be unavailable (private mode, sandbox): a failed
      // save is a shrug, not a crash.
      return false;
    }
  }

  // Restore a snapshot into the live systems. Returns the data, or null
  // when there is nothing saved (or it cannot be read).
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (ctx.economy) ctx.economy.money = d.money ?? 200;
      if (ctx.missions) d.missionsDone?.forEach((i) => ctx.missions.done.add(i));
      if (ctx.upgrades) {
        d.upgrades?.forEach((id) => ctx.upgrades.owned.add(id));
        d.relics?.forEach((i) => ctx.upgrades.relicsFound.add(i));
        ctx.upgrades.cred = d.cred ?? 0;
      }
      if (ctx.economy) {
        ctx.economy.garage = d.garage || ['pipit'];
        ctx.economy.coins = d.coins ?? 0;
      }
      if (ctx.bosses) d.bosses?.forEach((id) => { ctx.bosses.defeated[id] = true; });
      if (typeof d.x === 'number' && ctx.player) {
        ctx.player.x = d.x;
        ctx.player.z = d.z;
        ctx.player.mesh.position.set(d.x, 0, d.z);
      }
      return d;
    } catch {
      return null;
    }
  }

  function wipe() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // No storage available — nothing to wipe.
    }
  }

  return { save, load, wipe };
}
