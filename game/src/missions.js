// SOLMAR — 5 misi berantai: briefing, waypoint, objective, reward, boss, replay.
import { CFG } from './config.js';

const DEFS = [
  {
    name: 'First Delivery', desc: 'Drive the package to Marina Bay. Learn to drive.',
    steps: [
      { text: 'Get in the Pipit at Voss Auto', at: { x: 14, z: 110 } },
      { text: 'Deliver the package to Marina Bay', at: { x: 94, z: 180 } },
    ],
    reward: 500,
  },
  {
    name: 'Hot Wheels', desc: 'Steal the Vantara from Kessler\'s warehouse. Lose the cops.',
    steps: [
      { text: 'Steal the Vantara at the Old Port', at: { x: -170, z: -60 } },
      { text: 'Escape the police — reach the Spray Shack', at: { x: 40, z: -40 } },
    ],
    reward: 1500, gun: 'pistol',
  },
  {
    name: 'Harbor Lights', desc: 'Sneak into the Old Port. Sabotage 3 containers. Beat Rico Vane.',
    steps: [
      { text: 'Reach the Old Port containers', at: { x: -170, z: 40 } },
      { text: 'Sabotage the marked containers (0/3)', at: { x: -170, z: 40 }, sabotage: 3 },
      { text: 'Defeat Rico Vane, Harbor Enforcer', at: { x: -170, z: 40 }, boss: 'rico' },
    ],
    reward: 2500,
  },
  {
    name: 'Neon Run', desc: 'Street race on the Neon Strip vs 3 rivals. Then duel the Neon King.',
    steps: [
      { text: 'Reach the Neon Strip start line', at: { x: 93, z: -60 } },
      { text: 'Win the race — 4 checkpoints', at: { x: 93, z: -60 }, race: 0 },
      { text: 'Duel the Neon King', at: { x: 93, z: 0 }, boss: 'neonking' },
    ],
    reward: 4000, gun: 'shotgun',
  },
  {
    name: 'Payback at the Port', desc: 'Storm Kessler\'s stronghold. Defeat Dario Kessler.',
    steps: [
      { text: 'Fight through the port guards', at: { x: -172, z: 0 }, guards: 4 },
      { text: 'Defeat Dario Kessler (3 phases)', at: { x: -172, z: 0 }, boss: 'kessler' },
    ],
    reward: 10000, gun: 'smg',
  },
];

export function createMissions(ctx) {
  const m = {
    defs: DEFS, active: -1, step: 0, done: new Set(),
    sabotaged: 0, waypoint: null, guardsLeft: 0,
  };
  function setObjective(text) {
    ctx.hud?.setObjective(text);
    const def = DEFS[m.active];
    const step = def?.steps[m.step];
    if (step?.at) {
      m.waypoint = { x: step.at.x, z: step.at.z };
      ctx.hud?.setWaypoint?.(m.waypoint);
    } else m.waypoint = null;
  }
  function refreshObjective() {
    if (m.active < 0) { ctx.hud?.setObjective('Free roam — press M for missions, E to interact'); return; }
    const def = DEFS[m.active], step = def.steps[m.step];
    let t = `${def.name} — ${step.text}`;
    if (step.sabotage) t = `${def.name} — Sabotage the marked containers (${m.sabotaged}/${step.sabotage})`;
    if (step.guards) t = `${def.name} — Defeat the port guards (${m.guardsLeft} left)`;
    setObjective(t);
  }
  function start(i, c = {}) {
    if (i < 0 || i >= DEFS.length) return false;
    if (i > 0 && !m.done.has(i - 1) && !c.debug) {
      ctx.hud?.toast(`Finish "${DEFS[i - 1].name}" first!`);
      return false;
    }
    m.active = i; m.step = 0; m.sabotaged = 0; m.guardsLeft = 0;
    const def = DEFS[i];
    ctx.hud?.toast(`MISSION — ${def.name}: ${def.desc}`);
    ctx.audio?.sting('mission');
    enterStep(0, c);
    return true;
  }
  function enterStep(n, c = {}) {
    if (m.active < 0) return false;
    const def = DEFS[m.active];
    if (n >= def.steps.length) { complete(); return true; }
    m.step = n;
    const step = def.steps[n];
    if (step.boss && ctx.bosses) ctx.bosses.spawn(step.boss, step.at.x + 6, step.at.z);
    if (step.guards && ctx.combat) {
      m.guardsLeft = step.guards;
      for (let i = 0; i < step.guards; i++) {
        ctx.combat.spawnGuard(step.at.x + (i - 1.5) * 6, step.at.z + (i % 2 ? 6 : -6));
      }
    }
    if (step.race !== undefined && ctx.activities) { ctx.activities.startRace(step.race); m.raceStarted = true; }
    if (step.sabotage) m.sabotaged = 0;
    refreshObjective();
    return true;
  }
  function advance() { enterStep(m.step + 1); }
  function complete() {
    const def = DEFS[m.active];
    const moneyMul = ctx.upgrades?.relicPerk('money') ? 1.2 : 1;
    const luckMul = ctx.upgrades?.has('m_luck') ? 1.15 : 1;
    const pay = Math.round(def.reward * moneyMul * luckMul);
    ctx.economy?.add(pay, `mission ${def.name}`);
    ctx.upgrades?.addCred(150);
    m.done.add(m.active);
    ctx.hud?.toast(`MISSION COMPLETE — ${def.name} +$${pay}`);
    ctx.audio?.sting('win');
    if (def.gun && ctx.combat) {
      ctx.combat.giveWeapon(def.gun);
      ctx.hud?.toast(`New weapon: ${def.gun.toUpperCase()}`);
    }
    if (m.active === 4) {
      ctx.hud?.toast('SOLMAR COMPLETE — You are the Legend of Solmar!');
      ctx.state = 'complete';
    }
    m.active = -1; m.step = 0;
    ctx.save?.save();
    refreshObjective();
  }
  function update(dt) {
    if (m.active < 0) return;
    const def = DEFS[m.active], step = def.steps[m.step];
    const p = ctx.player;
    if (!step) return;
    // Boss step selesai bila boss kalah.
    if (step.boss && ctx.bosses?.defeated[step.boss]) { advance(); return; }
    // Guard step selesai bila semua guard mati.
    if (step.guards) {
      const alive = ctx.combat.guards.filter((g) => !g.dead).length;
      m.guardsLeft = alive;
      if (alive === 0) { advance(); return; }
      refreshObjective();
      return;
    }
    // Race step selesai bila race step ini dimenangkan.
    if (step.race !== undefined) {
      const name = ctx.activities.RACE_SPOTS[step.race]?.name;
      if (name && ctx.activities.done.races.has(name)) { advance(); return; }
      if (!ctx.activities.race && m.raceStarted) { ctx.hud?.toast('RACE FAILED — try again (press E at the start line)'); m.raceStarted = false; refreshObjective(); }
      return;
    }
    // Sabotage: tekan E dekat kontainer.
    if (step.sabotage) {
      if (m.sabotaged >= step.sabotage) { advance(); return; }
      return;
    }
    // Step jalan: sampai waypoint.
    if (step.at && Math.hypot(step.at.x - p.x, step.at.z - p.z) < 7) advance();
  }
  function sabotage() {
    if (m.active < 0) return false;
    const step = DEFS[m.active].steps[m.step];
    if (!step?.sabotage) return false;
    m.sabotaged++;
    ctx.effects?.smoke(ctx.player.x + 4, ctx.player.z);
    ctx.audio?.sting('sabotage');
    refreshObjective();
    if (m.sabotaged >= step.sabotage) advance();
    return true;
  }
  m.start = start; m.enterStep = enterStep; m.update = update;
  m.complete = complete; m.refreshObjective = refreshObjective; m.sabotage = sabotage;
  return m;
}
