// missions.js — Mara's five-mission story arc against Dario Kessler.
// Each mission is a list of steps; a step completes by reaching a
// place, entering a car, sabotaging a container, winning a race leg, or
// defeating guards. Rewards pay through the economy. The tracker draws
// the objective text, the 3D waypoint beacon and the minimap blip.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng } from "./rng.js";
import { createCar, carDef } from "./vehicles.js";

const RACE_POINTS = [
  [31, -150], [31, 150], [93, 150], [93, -150],
];

function missionDefs() {
  return [
    {
      name: CONFIG.missionNames[0],
      briefing: "Kessler's couriers took your last delivery. Take the Pipit and run the package to Marina Bay yourself.",
      steps: [
        { kind: "enterCar", text: "Get in a car at Voss Auto" },
        { kind: "reach", target: [0, -168], text: "Deliver the package to Marina Bay pier" },
      ],
    },
    {
      name: CONFIG.missionNames[1],
      briefing: "Kessler keeps a Vantara locked in his warehouse. Steal it — and lose the cops at the Spray Shack.",
      steps: [
        { kind: "reach", target: [140, 31], text: "Reach Kessler's warehouse in the Old Port" },
        { kind: "steal", car: "vantara", text: "Steal the Vantara" },
        { kind: "reach", target: [-62, 124], text: "Escape the police — reach the Spray Shack" },
      ],
    },
    {
      name: CONFIG.missionNames[2],
      briefing: "Kessler's smuggling runs through the Old Port containers. Sabotage three of them — quietly.",
      steps: [
        { kind: "reach", target: [120, 0], text: "Sneak into the Old Port container yard" },
        { kind: "sabotage", count: 3, text: "Sabotage the marked containers (0/3)" },
        { kind: "reach", target: [62, 124], text: "Get back to Voss Auto" },
      ],
    },
    {
      name: CONFIG.missionNames[3],
      briefing: "Neon Strip street race. Three rivals, four checkpoints. Win it and the shotgun is yours.",
      steps: [
        { kind: "reach", target: [31, -120], text: "Get to the Neon Strip start line" },
        { kind: "race", text: "Race! Hit every checkpoint" },
      ],
    },
    {
      name: CONFIG.missionNames[4],
      briefing: "This ends tonight. Storm Kessler's warehouse, take down his guards, and settle the debt.",
      steps: [
        { kind: "reach", target: [150, 31], text: "Storm Kessler's warehouse" },
        { kind: "defeat", count: 6, text: "Take down Kessler's guards (0/6)" },
        { kind: "reach", target: [150, 10], text: "Confront Kessler at his office" },
      ],
    },
  ];
}

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.defs = missionDefs();
    this.active = -1; // index into defs, -1 = free roam
    this.step = 0;
    this.completed = [false, false, false, false, false];
    this.sabotaged = 0;
    this.defeated = 0;
    this.racePoint = 0;
    this.rivals = [];
    this.rng = makeRng(CONFIG.seed + 505);
    this.waypoint = null; // [x, z] or null
    this.beacon = null;
    this.vantara = null; // the M2 prize car
    this.sabotageSpots = [];
  }

  current() {
    return this.active >= 0 ? this.defs[this.active] : null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return "Explore Solmar. Steal a car, take a mission, make money.";
    const s = m.steps[this.step];
    if (!s) return m.name;
    if (s.kind === "sabotage") return `Sabotage the marked containers (${this.sabotaged}/${s.count})`;
    if (s.kind === "defeat") return `Take down Kessler's guards (${this.defeated}/${s.count})`;
    if (s.kind === "race") return `Race! Checkpoint ${this.racePoint + 1}/4`;
    return s.text;
  }

  // Beacon: a tall glowing cylinder + ring at the active waypoint.
  setWaypoint(x, z) {
    this.waypoint = [x, z];
    if (!this.beacon) {
      const g = new THREE.Group();
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 60, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
      );
      beam.position.y = 30;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.8, 0.18, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd23e }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      g.add(beam, ring);
      this.scene.add(g);
      this.beacon = g;
    }
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  hideWaypoint() {
    this.waypoint = null;
    if (this.beacon) this.beacon.visible = false;
  }

  start(i, ctx = {}) {
    if (this.completed[i]) return false;
    this.active = i;
    this.step = 0;
    this.sabotaged = 0;
    this.defeated = 0;
    this.racePoint = 0;
    ctx.onToast?.(`${this.defs[i].name}: ${this.defs[i].briefing}`);
    ctx.audio?.missionStart();
    this.enterStep(0, ctx);
    return true;
  }

  enterStep(i, ctx = {}) {
    this.step = i;
    const s = this.currentStep();
    if (!s) { this.finish(ctx); return; }
    if (s.kind === "reach" || s.kind === "steal") this.setWaypoint(...(s.target ?? this.vantaraSpot(ctx)));
    if (s.kind === "sabotage") this.setupSabotage(ctx);
    if (s.kind === "race") this.setupRace(ctx);
    if (s.kind === "defeat") this.setupFinale(ctx);
    if (s.kind === "enterCar") this.setWaypoint(62, 132);
  }

  vantaraSpot() {
    return [140, 20];
  }

  setupSabotage(ctx) {
    this.sabotaged = 0;
    this.sabotageSpots = [[118, -8], [132, 22], [108, 48]].map(([x, z]) => ({ x, z, done: false }));
    for (const sp of this.sabotageSpots) ctx.effects?.mark(sp.x, sp.z);
    const next = this.sabotageSpots[0];
    this.setWaypoint(next.x, next.z);
    ctx.combat?.spawnGuard(126, -2);
    ctx.combat?.spawnGuard(114, 30);
    ctx.combat?.spawnGuard(140, 44);
  }

  setupRace(ctx) {
    this.racePoint = 0;
    this.setWaypoint(...RACE_POINTS[0]);
    // Three rival cars at the start line.
    const defs = [carDef("corto"), carDef("pipit"), carDef("mule")];
    this.rivals = defs.map((d, i) => {
      const c = createCar(d, 31 + (i - 1) * 5, -128, 0, { driver: "rival" });
      c.racePoint = 0;
      c.finished = false;
      this.scene.add(c.mesh);
      return c;
    });
    ctx.audio?.raceStart();
  }

  setupFinale(ctx) {
    this.defeated = 0;
    for (let i = 0; i < 6; i++) {
      ctx.combat?.spawnGuard(138 + (i % 3) * 9, 22 + Math.floor(i / 3) * 14);
    }
    this.setWaypoint(150, 31);
  }

  // Called by the game when the player presses E near a sabotage container.
  trySabotage(x, z, ctx) {
    const s = this.currentStep();
    if (!s || s.kind !== "sabotage") return false;
    const spot = this.sabotageSpots.find((sp) => !sp.done && Math.hypot(sp.x - x, sp.z - z) < 5);
    if (!spot) return false;
    spot.done = true;
    this.sabotaged++;
    ctx.effects?.explosion(spot.x, 1, spot.z);
    ctx.audio?.explosion();
    ctx.police?.addWanted(1);
    if (this.sabotaged >= s.count) {
      this.advance(ctx);
    } else {
      const next = this.sabotageSpots.find((sp) => !sp.done);
      if (next) this.setWaypoint(next.x, next.z);
    }
    return true;
  }

  onGuardKilled(ctx) {
    const s = this.currentStep();
    if (s && s.kind === "defeat") {
      this.defeated++;
      if (this.defeated >= s.count) this.advance(ctx);
    }
  }

  advance(ctx) {
    ctx.audio?.stepDone();
    this.step++;
    if (this.step >= this.current().steps.length) this.finish(ctx);
    else this.enterStep(this.step, ctx);
  }

  finish(ctx) {
    const i = this.active;
    this.completed[i] = true;
    const reward = CONFIG.missionRewards[i];
    ctx.economy?.addMoney(reward);
    ctx.onToast?.(`${this.defs[i].name} complete! +$${reward}`);
    ctx.audio?.missionComplete();
    if (i === 1) ctx.combat?.unlock("pistol");
    if (i === 3) ctx.combat?.unlock("shotgun");
    if (i === 4) ctx.onToast?.("Kessler is finished. Solmar is yours, Mara. — THE END (free roam continues)");
    this.active = -1;
    this.hideWaypoint();
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
    ctx.combat?.clearGuards();
    ctx.save?.();
  }

  update(dt, ctx) {
    // Pulse the beacon.
    if (this.beacon?.visible) {
      const s = 1 + Math.sin(ctx.time * 4) * 0.12;
      this.beacon.scale.set(s, 1, s);
    }
    const s = this.currentStep();
    if (!s) return;
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    if (s.kind === "enterCar" && ctx.inCar) this.advance(ctx);
    else if (s.kind === "reach" && Math.hypot(px - s.target[0], pz - s.target[1]) < 7) this.advance(ctx);
    else if (s.kind === "steal" && ctx.inCar && ctx.carId === "vantara") this.advance(ctx);
    else if (s.kind === "race") this.updateRace(dt, ctx);
  }

  updateRace(dt, ctx) {
    const target = RACE_POINTS[this.racePoint];
    if (Math.hypot(ctx.playerX - target[0], ctx.playerZ - target[1]) < 9) {
      this.racePoint++;
      if (this.racePoint >= RACE_POINTS.length) {
        this.advance(ctx);
        return;
      }
      this.setWaypoint(...RACE_POINTS[this.racePoint]);
      ctx.onToast?.(`Checkpoint ${this.racePoint + 1}/4!`);
    }
    // Rivals chase the same checkpoints.
    for (const r of this.rivals) {
      if (r.finished) continue;
      const t = RACE_POINTS[r.racePoint];
      const dx = t[0] - r.x;
      const dz = t[1] - r.z;
      const d = Math.hypot(dx, dz);
      if (d < 9) {
        r.racePoint++;
        if (r.racePoint >= RACE_POINTS.length) { r.finished = true; continue; }
      }
      const want = Math.atan2(dx, dz);
      let dh = want - r.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      r.heading += Math.max(-2 * dt, Math.min(2 * dt, dh));
      r.speed += (24 - r.speed) * Math.min(1, dt);
      r.x += Math.sin(r.heading) * r.speed * dt;
      r.z += Math.cos(r.heading) * r.speed * dt;
      r.mesh.position.set(r.x, 0, r.z);
      r.mesh.rotation.y = r.heading + Math.PI;
      const spin = (r.speed * dt) / 0.34;
      for (const w of r.wheels) w.rotation.x += spin;
    }
  }
}
