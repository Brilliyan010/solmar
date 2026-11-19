// economy.js — money, taxi fares, Sun Coins, shops and the garage.
// The player earns from missions, taxi rides and collectibles, and
// spends at the Spray Shack (repair + repaint) and Ironworks (weapons).
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng, pick } from "./rng.js";

const STREETS = CONFIG.streetOffsets;

export class Economy {
  constructor(scene) {
    this.scene = scene;
    this.money = 250;
    this.rng = makeRng(CONFIG.seed + 606);
    this.coins = []; // {x, z, mesh, taken}
    this.coinsTaken = 0;
    this.garage = []; // car ids parked at Voss Auto
    this.taxi = null; // {x, z, dest, mesh, state}
    this.taxiTimer = 0;
    this.stats = { stolen: 0, missions: 0, topWanted: 0, earned: 0 };
    this.buildCoins();
  }

  buildCoins() {
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.15, 18);
    for (const [x, z] of CONFIG.sunCoins) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: 0xffd23e }),
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, 1.2, z);
      this.scene.add(mesh);
      this.coins.push({ x, z, mesh, taken: false });
    }
  }

  addMoney(n) {
    this.money += n;
    this.stats.earned += n;
  }

  spend(n) {
    if (this.money < n) return false;
    this.money -= n;
    return true;
  }

  // Taxi: a passenger waits on a sidewalk; E picks them up, then drive
  // to the flagged destination for the fare.
  maybeSpawnTaxi(now, ctx) {
    if (this.taxi) return;
    if (now - this.taxiTimer < 25) return;
    const street = pick(this.rng, STREETS);
    const along = pick(this.rng, [-120, -60, 60, 120]);
    const x = street + 8.5;
    const z = along;
    const dest = pick(this.rng, STREETS);
    const destAlong = pick(this.rng, [-150, 150]);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8),
      new THREE.MeshLambertMaterial({ color: 0xffc21a }),
    );
    body.position.y = 1.05;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a }),
    );
    head.position.y = 1.75;
    mesh.add(body, head);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.taxi = { x, z, dest: [dest, destAlong], mesh, state: "waiting" };
    ctx.onToast?.("Taxi passenger waiting — press E near them.");
  }

  taxiPickup(ctx) {
    if (!this.taxi || this.taxi.state !== "waiting") return false;
    this.taxi.state = "riding";
    this.scene.remove(this.taxi.mesh);
    ctx.missions?.setWaypoint?.(this.taxi.dest[0], this.taxi.dest[1]);
    ctx.onToast?.("Taxi: take the passenger to the marker.");
    return true;
  }

  update(dt, ctx) {
    const now = ctx.time;
    this.maybeSpawnTaxi(now, ctx);
    // Sun Coins spin + collect.
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.2 + Math.sin(now * 2 + c.x) * 0.15;
      if (Math.hypot(ctx.playerX - c.x, ctx.playerZ - c.z) < 2.2) {
        c.taken = true;
        this.coinsTaken++;
        this.scene.remove(c.mesh);
        this.addMoney(CONFIG.sunCoinValue);
        ctx.audio?.coin();
        ctx.onToast?.(`Sun Coin! +$${CONFIG.sunCoinValue} (${this.coinsTaken}/10)`);
      }
    }
    // Taxi drop-off.
    if (this.taxi?.state === "riding" && ctx.inCar) {
      const [dx, dz] = this.taxi.dest;
      if (Math.hypot(ctx.playerX - dx, ctx.playerZ - dz) < 8) {
        this.addMoney(CONFIG.taxiFare);
        ctx.onToast?.(`Taxi fare paid! +$${CONFIG.taxiFare}`);
        ctx.audio?.coin();
        this.taxi = null;
        this.taxiTimer = now;
        ctx.missions?.hideWaypoint?.();
      }
    }
  }

  // What can the player do by pressing E here? Returns a prompt string
  // (and performs the action when `act` is true).
  interactPrompt(ctx, act) {
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    // Taxi passenger.
    if (this.taxi?.state === "waiting" && Math.hypot(px - this.taxi.x, pz - this.taxi.z) < 3) {
      if (act) this.taxiPickup(ctx);
      return "E — Pick up taxi passenger";
    }
    // Mission sabotage containers.
    if (ctx.missions?.currentStep()?.kind === "sabotage") {
      const spot = ctx.missions.sabotageSpots.find((s) => !s.done && Math.hypot(px - s.x, pz - s.z) < 5);
      if (spot) {
        if (act) ctx.missions.trySabotage(px, pz, ctx);
        return "E — Sabotage container";
      }
    }
    // Spray Shack: repair + repaint.
    if (Math.hypot(px + 62, pz - 124) < 8 && ctx.inCar) {
      if (act && this.spend(CONFIG.sprayCost)) {
        ctx.car.damaged = 0;
        ctx.car.bodyMat.color.setHex(Math.floor(this.rng() * 0xffffff));
        ctx.police?.clearWanted();
        ctx.onToast?.(`Spray Shack: repainted + repaired — $${CONFIG.sprayCost}`);
        ctx.audio?.coin();
      } else if (act) {
        ctx.onToast?.("Not enough cash for the Spray Shack ($150).");
      }
      return `E — Spray Shack: repaint + repair ($${CONFIG.sprayCost})`;
    }
    // Ironworks gun shop.
    if (Math.hypot(px + 124, pz + 62) < 8 && !ctx.inCar) {
      if (act) {
        if (!ctx.combat.unlockedPistol && this.spend(CONFIG.pistolCost)) {
          ctx.combat.unlock("pistol");
          ctx.combat.select("pistol");
          ctx.onToast?.(`Bought a Pistol — $${CONFIG.pistolCost}`);
        } else if (ctx.combat.unlockedPistol && !ctx.combat.unlockedShotgun && this.spend(CONFIG.shotgunCost)) {
          ctx.combat.unlock("shotgun");
          ctx.combat.select("shotgun");
          ctx.onToast?.(`Bought a Shotgun — $${CONFIG.shotgunCost}`);
        } else {
          ctx.onToast?.("Ironworks: you own everything. Ammo restocked.");
          ctx.combat.ammo.pistol = Math.max(ctx.combat.ammo.pistol, 48);
          ctx.combat.ammo.shotgun = Math.max(ctx.combat.ammo.shotgun, 18);
        }
      }
      const item = !ctx.combat.unlockedPistol ? `Pistol ($${CONFIG.pistolCost})` : !ctx.combat.unlockedShotgun ? `Shotgun ($${CONFIG.shotgunCost})` : "Ammo";
      return `E — Ironworks: buy ${item}`;
    }
    // Missions board at Voss Auto.
    if (Math.hypot(px - 48, pz - 106) < 5 && !ctx.inCar) {
      if (act) {
        const next = ctx.missions.completed.findIndex((c) => !c);
        if (next >= 0 && ctx.missions.active < 0) ctx.missions.start(next, ctx);
        else if (ctx.missions.active >= 0) ctx.onToast?.("Finish your current mission first.");
        else ctx.onToast?.("All missions complete! Free roam, Mara.");
      }
      return "E — Take next mission";
    }
    return null;
  }
}
