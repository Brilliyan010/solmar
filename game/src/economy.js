// Economy: cash, Sun Coins to collect, a taxi side job, and three shops —
// Spray Shack (repair + lose the cops), Ironworks (guns + armour) and the
// Voss Auto garage (store stolen cars). Shops are zones; E interacts.
import * as THREE from "three";
import { CFG } from "./config.js";
import { PLACES } from "./city.js";
import { Rng } from "./rng.js";

const COIN_SPOTS = [
  { x: 62, z: -62 }, { x: 252, z: 20 }, { x: -155, z: 155 }, { x: 0, z: -186 },
  { x: -124, z: -124 }, { x: 186, z: 62 }, { x: -62, z: 186 }, { x: 124, z: -124 },
  { x: -186, z: 0 }, { x: 62, z: 124 },
];

export class Economy {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = new Rng(seed ^ 0x3c01);
    this.money = CFG.startMoney;
    this.coinsCollected = 0;
    this.garage = [];
    this.taxi = null; // { phase: 'pickup'|'dropoff', px, pz, dx, dz, fare }
    this.taxiCooldown = 0;
    this.prompt = "";
    this.promptAction = null;
    this.time = 0;
    // Sun Coins: spinning gold discs.
    this.coins = [];
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.16, 20);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd23c, emissive: 0xaa7700, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.3 });
    for (const spot of COIN_SPOTS) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, 1.2, spot.z);
      scene.add(mesh);
      this.coins.push({ mesh, x: spot.x, z: spot.z, taken: false });
    }
  }

  get coinCount() {
    return this.coins.filter((c) => !c.taken).length;
  }

  startTaxi(ctx) {
    const p = ctx.player;
    const px = p.x + this.rng.range(30, 90) * (this.rng.chance(0.5) ? 1 : -1);
    const pz = p.z + this.rng.range(30, 90) * (this.rng.chance(0.5) ? 1 : -1);
    const dest = this.rng.pick([PLACES.marina, PLACES.spire, PLACES.beach, PLACES.plaza, PLACES.hospital]);
    this.taxi = {
      phase: "pickup",
      px: Math.max(-210, Math.min(210, px)),
      pz: Math.max(-210, Math.min(210, pz)),
      dx: dest.x, dz: dest.z,
      fare: this.rng.int(CFG.taxiFareMin, CFG.taxiFareMax),
      destLabel: dest.label,
    };
    ctx.toast(`Taxi fare: pick up the passenger`);
    ctx.hud?.setObjective(`Taxi: pick up the passenger`);
  }

  update(dt, ctx) {
    this.time += dt;
    this.prompt = "";
    this.promptAction = null;
    const p = ctx.player;
    // Coins spin + collect.
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1.2 + Math.sin(this.time * 2 + c.x) * 0.15;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 3) {
        c.taken = true;
        c.mesh.visible = false;
        this.money += CFG.coinValue;
        this.coinsCollected++;
        ctx.audio?.pickup();
        ctx.toast(`Sun Coin +$${CFG.coinValue} (${this.coinsCollected}/${COIN_SPOTS.length})`);
      }
    }
    // Taxi job.
    if (this.taxi) {
      const t = this.taxi;
      const target = t.phase === "pickup" ? { x: t.px, z: t.pz } : { x: t.dx, z: t.dz };
      ctx.game.missionWaypointOverride = target;
      if (Math.hypot(p.x - target.x, p.z - target.z) < 6) {
        if (t.phase === "pickup") {
          t.phase = "dropoff";
          ctx.toast(`Passenger aboard — take them to ${t.destLabel}`);
        } else {
          this.money += t.fare;
          ctx.toast(`Taxi fare +$${t.fare}`);
          ctx.audio?.jingle();
          this.taxi = null;
          this.taxiCooldown = 20;
          ctx.game.missionWaypointOverride = null;
        }
      }
    } else {
      this.taxiCooldown -= dt;
    }
    // Shops (zones).
    const near = (place, r) => Math.hypot(p.x - place.x, p.z - place.z) < r;
    if (!p.onFoot && near(PLACES.sprayShack, 9)) {
      this.prompt = `E — Spray Shack: repair + lose the cops ($${CFG.sprayCost})`;
      this.promptAction = () => {
        if (this.money < CFG.sprayCost) {
          ctx.toast("Not enough cash for Spray Shack");
          return;
        }
        this.money -= CFG.sprayCost;
        if (p.inCar) p.inCar.damage = 0;
        ctx.police.clearWanted();
        ctx.audio?.jingle();
        ctx.toast("Fresh paint — the cops lost you");
      };
    } else if (p.onFoot && near(PLACES.ironworks, 8)) {
      if (!ctx.combat.owned.has("pistol")) {
        this.prompt = `E — Ironworks: buy a pistol ($${CFG.pistolCost})`;
        this.promptAction = () => {
          if (this.money < CFG.pistolCost) { ctx.toast("Not enough cash for the pistol"); return; }
          this.money -= CFG.pistolCost;
          ctx.combat.owned.add("pistol");
          ctx.combat.weapon = "pistol";
          ctx.toast("Pistol bought — press 2 to draw it");
        };
      } else if (!ctx.combat.owned.has("shotgun")) {
        this.prompt = `E — Ironworks: buy a shotgun ($${CFG.shotgunCost})`;
        this.promptAction = () => {
          if (this.money < CFG.shotgunCost) { ctx.toast("Not enough cash for the shotgun"); return; }
          this.money -= CFG.shotgunCost;
          ctx.combat.owned.add("shotgun");
          ctx.combat.weapon = "shotgun";
          ctx.toast("Shotgun bought — press 3 to draw it");
        };
      } else {
        this.prompt = `E — Ironworks: buy armour ($${CFG.armorCost})`;
        this.promptAction = () => {
          if (this.money < CFG.armorCost) { ctx.toast("Not enough cash for armour"); return; }
          this.money -= CFG.armorCost;
          p.armor = CFG.playerArmorMax;
          ctx.toast("Armour fitted");
        };
      }
    } else if (near(PLACES.vossAuto, 10)) {
      if (!p.onFoot && p.inCar) {
        this.prompt = "E — Park in the garage (store this car)";
        this.promptAction = () => {
          if (this.garage.length >= 3) { ctx.toast("Garage is full (3 cars)"); return; }
          this.garage.push(p.inCar.model);
          ctx.game?.exitCar(true);
          ctx.toast(`Stored in the garage (${this.garage.length}/3)`);
        };
      } else if (p.onFoot && this.garage.length > 0) {
        this.prompt = `E — Take out your ${this.garage[this.garage.length - 1]} from the garage`;
        this.promptAction = () => {
          const model = this.garage.pop();
          ctx.game?.spawnOwnedCar(model);
        };
      }
    }
  }

  doPrompt() {
    if (this.promptAction) this.promptAction();
  }
}
