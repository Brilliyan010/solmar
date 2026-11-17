// Missions: Mara Voss's five-chapter story. Each mission is a list of steps;
// the manager watches the world and advances steps as the player completes
// them. Steps: goto, enterCar, stealCar, sabotage, eliminate, race, escape,
// deliver. Rewards follow the brief.
import { CFG } from "./config.js";
import { PLACES } from "./city.js";
import { buildCarMesh } from "./vehicles.js";
import { Rng } from "./rng.js";

const RACE_POINTS = [
  { x: 31, z: -31 }, { x: 155, z: -31 }, { x: 155, z: 93 },
  { x: 31, z: 155 }, { x: -93, z: 93 }, { x: -93, z: -93 },
];

export const MISSIONS = [
  {
    name: "First Delivery",
    briefing: "Mara's first job back in Solmar: a parcel for Marina Bay. Get wheels, deliver it, come home.",
    steps: [
      { kind: "enterCar", text: "Get in a car — any car will do" },
      { kind: "deliver", x: PLACES.marina.x - 30, z: PLACES.marina.z, r: 12, text: "Deliver the parcel to Marina Bay" },
      { kind: "goto", x: PLACES.vossAuto.x, z: PLACES.vossAuto.z, r: 9, text: "Return to Voss Auto" },
    ],
  },
  {
    name: "Hot Wheels",
    briefing: "Kessler's crew keeps a Vantara locked in his warehouse. Take it — and be ready to run.",
    steps: [
      { kind: "goto", x: PLACES.warehouse.x, z: PLACES.warehouse.z, r: 12, text: "Go to Kessler's warehouse in Old Port" },
      { kind: "stealCar", model: "vantara", x: -88, z: 124, text: "Steal the Vantara (press E)" },
      { kind: "escape", text: "Escape the police — lose them or reach Spray Shack" },
      { kind: "goto", x: PLACES.vossAuto.x, z: PLACES.vossAuto.z, r: 9, text: "Bring the Vantara home to Voss Auto" },
    ],
  },
  {
    name: "Harbor Lights",
    briefing: "Sabotage Kessler's smuggling containers under cover of the port lights. His guards are watching.",
    steps: [
      { kind: "goto", x: PLACES.port.x, z: PLACES.port.z, r: 14, text: "Sneak into Old Port" },
      { kind: "sabotage", spots: [{ x: -178, z: 128 }, { x: -156, z: 150 }, { x: -190, z: 168 }], text: "Sabotage the containers" },
      { kind: "eliminate", count: 4, text: "Deal with Kessler's guards" },
    ],
  },
  {
    name: "Neon Run",
    briefing: "The Strip's street race pays big. Six checkpoints, three rivals, one winner. Don't lose.",
    steps: [
      { kind: "goto", x: PLACES.neonStrip.x, z: PLACES.neonStrip.z, r: 12, text: "Meet the racers on Neon Strip" },
      { kind: "race", checkpoints: RACE_POINTS, text: "Win the street race" },
    ],
  },
  {
    name: "Payback at the Port",
    briefing: "It ends tonight. Kessler, his crew, his HQ — all of it. Bring a gun. Bring two.",
    steps: [
      { kind: "goto", x: PLACES.kesslerHQ.x, z: PLACES.kesslerHQ.z, r: 14, text: "Storm Kessler's HQ at the Port" },
      { kind: "eliminate", count: 7, boss: true, text: "Take down Kessler and his crew" },
      { kind: "goto", x: PLACES.vossAuto.x, z: PLACES.vossAuto.z, r: 9, text: "Drive home — Solmar is yours" },
    ],
  },
];

export class MissionManager {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = new Rng(seed ^ 0x4d49);
    this.current = 0; // mission index
    this.done = [false, false, false, false, false];
    this.active = false;
    this.stepIndex = 0;
    this.stepState = null;
    this.waypoint = null;
    this.objective = "";
    this.race = null;
    this.onMissionComplete = null; // (index, reward) => void
    this.onStep = null; // (text) => void
  }

  get mission() {
    return MISSIONS[this.current];
  }

  start(index) {
    this.current = index;
    this.active = true;
    this.stepIndex = 0;
    this.stepState = null;
    this.race = null;
    this.enterStep(0);
  }

  stop() {
    this.active = false;
    this.waypoint = null;
    this.objective = "";
    this.cleanupRace();
  }

  cleanupRace() {
    if (this.race) {
      for (const r of this.race.rivals) this.scene.remove(r.mesh);
      this.race = null;
    }
  }

  enterStep(i) {
    const step = this.mission.steps[i];
    this.stepIndex = i;
    this.stepState = { done: 0, sabotaged: [], startedAt: 0 };
    this.objective = step.text;
    if (this.onStep) this.onStep(step.text);
    if (step.kind === "goto" || step.kind === "deliver") {
      this.waypoint = { x: step.x, z: step.z };
    } else if (step.kind === "stealCar") {
      this.waypoint = { x: step.x, z: step.z };
    } else if (step.kind === "sabotage") {
      this.waypoint = { x: step.spots[0].x, z: step.spots[0].z };
    } else if (step.kind === "eliminate") {
      this.waypoint = { x: this.mission.steps[0].x ?? PLACES.port.x, z: this.mission.steps[0].z ?? PLACES.port.z };
    } else if (step.kind === "race") {
      this.waypoint = { x: step.checkpoints[0].x, z: step.checkpoints[0].z };
    } else {
      this.waypoint = null;
    }
  }

  completeStep(ctx) {
    this.stepIndex++;
    if (this.stepIndex >= this.mission.steps.length) {
      this.completeMission(ctx);
      return;
    }
    this.enterStep(this.stepIndex);
  }

  completeMission(ctx) {
    const reward = CFG.missionRewards[this.current];
    this.done[this.current] = true;
    this.active = false;
    this.waypoint = null;
    this.objective = "";
    this.cleanupRace();
    ctx.economy.money += reward;
    if (this.onMissionComplete) this.onMissionComplete(this.current, reward);
  }

  failMission(ctx) {
    ctx.toast("Mission failed — try again");
    this.start(this.current);
  }

  // Spawn helpers the game calls when a step begins.
  spawnGuards(ctx, count, boss) {
    const base = this.current === 4 ? PLACES.kesslerHQ : PLACES.port;
    for (let i = 0; i < count; i++) {
      const x = base.x + this.rng.range(-22, 22);
      const z = base.z + this.rng.range(-22, 22);
      ctx.combat.spawnGuard(x, z, boss && i === 0);
    }
  }

  startRace(ctx) {
    const step = this.mission.steps[this.stepIndex];
    const rivals = [];
    const models = ["corto", "vantara", "pipit"];
    for (let i = 0; i < 3; i++) {
      const mesh = buildCarMesh(models[i], [0xff2f6d, 0x00c8ff, 0xf1c40f][i]);
      this.scene.add(mesh);
      const r = {
        mesh, x: 31 + (i - 1) * 5, z: -118 + i * 4, heading: -Math.PI / 2,
        speed: 0, cp: 0, finished: false,
      };
      mesh.position.set(r.x, 0, r.z);
      rivals.push(r);
    }
    this.race = { checkpoints: step.checkpoints, rivals, playerCp: 0, startedAt: ctx.now };
  }

  updateRace(dt, ctx) {
    const race = this.race;
    if (!race) return;
    const cps = race.checkpoints;
    // Player progress.
    const p = ctx.player;
    const cp = cps[race.playerCp];
    if (cp && Math.hypot(p.x - cp.x, p.z - cp.z) < 13) {
      race.playerCp++;
      this.waypoint = race.playerCp < cps.length ? { x: cps[race.playerCp].x, z: cps[race.playerCp].z } : null;
      this.objective = `Checkpoint ${Math.min(race.playerCp + 1, cps.length)}/${cps.length} — stay ahead`;
      ctx.audio?.pickup();
    }
    if (race.playerCp >= cps.length) {
      ctx.toast("Race won!");
      this.cleanupRace();
      this.completeStep(ctx);
      return;
    }
    // Rivals chase their next checkpoint with simple pursuit steering.
    for (const r of race.rivals) {
      if (r.finished) continue;
      const target = cps[r.cp];
      if (!target) continue;
      const dx = target.x - r.x;
      const dz = target.z - r.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 13) {
        r.cp++;
        if (r.cp >= cps.length) {
          r.finished = true;
          ctx.toast("A rival won the race…");
          this.failMission(ctx);
          return;
        }
        continue;
      }
      const th = Math.atan2(-dz, dx);
      let dh = th - r.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      r.heading += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
      r.speed += (26 - r.speed) * Math.min(1, dt * 1.2);
      r.x += Math.cos(r.heading) * r.speed * dt;
      r.z -= Math.sin(r.heading) * r.speed * dt;
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.y = r.heading;
    }
  }

  // Called every fixed step while a mission is active.
  update(dt, ctx) {
    if (!this.active) return;
    const step = this.mission.steps[this.stepIndex];
    const p = ctx.player;
    const dist = (x, z) => Math.hypot(p.x - x, p.z - z);
    switch (step.kind) {
      case "goto":
        if (dist(step.x, step.z) < step.r) this.completeStep(ctx);
        break;
      case "enterCar":
        if (!p.onFoot) this.completeStep(ctx);
        break;
      case "deliver":
        if (!p.onFoot && dist(step.x, step.z) < step.r) this.completeStep(ctx);
        break;
      case "stealCar":
        // The game sets ctx.stolenCar when the player steals the target.
        if (ctx.stolenCar === step.model) {
          ctx.stolenCar = null;
          ctx.police.addWanted(2);
          this.completeStep(ctx);
        }
        break;
      case "escape":
        if (ctx.police.stars === 0) this.completeStep(ctx);
        break;
      case "sabotage": {
        const s = this.stepState;
        if (!s.guardsSpawned) {
          s.guardsSpawned = true;
          this.spawnGuards(ctx, 3, false);
        }
        const next = step.spots.find((sp) => !s.sabotaged.includes(sp));
        if (next) {
          this.waypoint = { x: next.x, z: next.z };
          this.objective = `Sabotage the containers (${s.sabotaged.length}/3)`;
          if (dist(next.x, next.z) < 4.5 && ctx.interactPressed) {
            s.sabotaged.push(next);
            ctx.effects?.explosion(next.x, next.z, 0.6);
            ctx.audio?.crash();
            ctx.toast(`Container sabotaged (${s.sabotaged.length}/3)`);
          }
        } else {
          this.completeStep(ctx);
        }
        break;
      }
      case "eliminate": {
        const s = this.stepState;
        if (!s.guardsSpawned) {
          s.guardsSpawned = true;
          this.spawnGuards(ctx, step.count, step.boss);
          s.total = ctx.combat.aliveCount();
        }
        const left = ctx.combat.aliveCount();
        this.objective = `${step.text} (${s.total - left}/${s.total})`;
        if (left === 0) this.completeStep(ctx);
        break;
      }
      case "race":
        if (!this.race) this.startRace(ctx);
        this.updateRace(dt, ctx);
        break;
      default:
        break;
    }
  }
}
