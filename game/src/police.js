// police.js — the wanted system and the police who answer it: patrol
// cruisers, pursuit ramming, roadblocks at 3+ stars, and a helicopter
// with a searchlight at 5 stars. Busted when a cruiser catches Mara
// on foot; wanted fades after 20 seconds out of sight.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng, range } from "./rng.js";
import { createCar, carDef } from "./vehicles.js";
import { collideCircle } from "./driving.js";

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(CONFIG.seed + 303);
    this.stars = 0;
    this.hiddenTimer = 0;
    this.blink = false;
    this.cruisers = [];
    this.roadblock = [];
    this.heli = null;
    this.heliLight = null;
    this.bustedCheck = 0;
    // Two patrol cruisers always on the map.
    for (let i = 0; i < 2; i++) {
      const c = this.spawnCruiser(range(this.rng, -120, 120), range(this.rng, -120, 120), "patrol");
      this.cruisers.push(c);
    }
  }

  spawnCruiser(x, z, mode) {
    const def = { ...carDef("corto"), color: 0x1a1a1a, name: "Cruiser" };
    const car = createCar(def, x, z, 0, { police: true, driver: "police" });
    // Black-and-white cruiser: white doors via a second box is overkill;
    // use a dark body with a white roof panel.
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.12, 1.9),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    );
    roof.position.set(0, 1.5, 0.1);
    car.mesh.add(roof);
    car.mode = mode;
    car.ramCooldown = 0;
    this.scene.add(car.mesh);
    return car;
  }

  addWanted(n) {
    this.stars = Math.min(CONFIG.wantedMax, this.stars + n);
    this.hiddenTimer = 0;
    if (this.stars >= 1 && this.cruisers.filter((c) => c.mode === "chase").length < 2) {
      const c = this.spawnCruiser(this.rng() < 0.5 ? -140 : 140, this.rng() < 0.5 ? -140 : 140, "chase");
      this.cruisers.push(c);
    }
  }

  clearWanted() {
    this.stars = 0;
    this.hiddenTimer = 0;
    for (const c of this.cruisers) c.mode = "patrol";
    this.clearRoadblock();
    this.clearHeli();
  }

  clearRoadblock() {
    for (const c of this.roadblock) this.scene.remove(c.mesh);
    this.roadblock = [];
  }

  clearHeli() {
    if (this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
    if (this.heliLight) {
      this.scene.remove(this.heliLight);
      this.heliLight = null;
    }
  }

  makeRoadblock(px, pz, heading) {
    this.clearRoadblock();
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (let i = -1; i <= 1; i++) {
      const x = px + fx * 26 - fz * i * 4.5;
      const z = pz + fz * 26 + fx * i * 4.5;
      const c = this.spawnCruiser(x, z, "block");
      c.heading = heading + Math.PI / 2;
      c.mesh.rotation.y = c.heading + Math.PI;
      c.speed = 0;
      this.roadblock.push(c);
    }
  }

  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 5),
      new THREE.MeshLambertMaterial({ color: 0x20242e }),
    );
    body.castShadow = true;
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x20242e }),
    );
    tail.position.set(0, 0.3, 3.6);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    rotor.position.y = 1.1;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    lamp.position.set(0, -0.9, -1.5);
    g.add(body, tail, rotor, lamp);
    g.userData.rotor = rotor;
    this.scene.add(g);
    this.heli = g;
    const spot = new THREE.SpotLight(0xfff2b0, 400, 90, 0.32, 0.5, 1.2);
    this.scene.add(spot);
    this.scene.add(spot.target);
    this.heliLight = spot;
  }

  update(dt, ctx) {
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    const now = ctx.time;

    // Wanted decay: hidden = no cruiser within 40m.
    let nearest = 999;
    for (const c of this.cruisers) nearest = Math.min(nearest, Math.hypot(c.x - px, c.z - pz));
    if (this.stars > 0 && nearest > 40) {
      this.hiddenTimer += dt;
      this.blink = this.hiddenTimer > CONFIG.wantedDecaySeconds - 5;
      if (this.hiddenTimer > CONFIG.wantedDecaySeconds) {
        this.stars = 0;
        this.hiddenTimer = 0;
        for (const c of this.cruisers) c.mode = "patrol";
        this.clearRoadblock();
        this.clearHeli();
        ctx.onToast?.("You lost the cops.");
      }
    } else {
      this.hiddenTimer = 0;
      this.blink = false;
    }

    // Roadblock at 3+ stars, helicopter at 5.
    if (this.stars >= CONFIG.roadblockAtStars && this.roadblock.length === 0 && ctx.inCar) {
      this.makeRoadblock(px, pz, ctx.playerHeading);
    }
    if (this.stars < CONFIG.roadblockAtStars) this.clearRoadblock();
    if (this.stars >= CONFIG.heliAtStars && !this.heli) this.makeHeli();
    if (this.stars < CONFIG.heliAtStars) this.clearHeli();

    // Cruisers: patrol wanders, chase pursues and rams.
    for (const c of this.cruisers) {
      c.ramCooldown = Math.max(0, c.ramCooldown - dt);
      if (c.mode === "patrol" || this.stars === 0) {
        c.mode = this.stars > 0 ? "chase" : "patrol";
        if (c.mode === "patrol") {
          c.speed += (9 - c.speed) * dt;
          c.heading += Math.sin(now * 0.1 + c.x) * dt * 0.2;
        }
      }
      if (c.mode === "chase") {
        const wantHeading = Math.atan2(px - c.x, pz - c.z);
        let dh = wantHeading - c.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
        c.speed += (CONFIG.policeChaseSpeed - c.speed) * Math.min(1, dt * 1.2);
        // Ram the player's car.
        const d = Math.hypot(px - c.x, pz - c.z);
        if (d < 3.6 && c.ramCooldown <= 0) {
          c.ramCooldown = 1.2;
          ctx.onRam?.(c);
        }
        // Busted: caught on foot, slow and close.
        if (!ctx.inCar && d < 2.6 && ctx.playerSpeed < 2) {
          this.bustedCheck += dt;
          if (this.bustedCheck > 1.2) ctx.onBusted?.();
        } else {
          this.bustedCheck = 0;
        }
      }
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const [cx, cz] = collideCircle(nx, nz, 1.6, ctx.colliders);
      c.x = cx;
      c.z = cz;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading + Math.PI;
      const spin = (c.speed * dt) / 0.34;
      for (const w of c.wheels) w.rotation.x += spin;
      // Flash the light bar.
      if (c.lightBar) {
        const on = Math.floor(now * 6) % 2 === 0;
        c.lightBar.userData.red.material.color.setHex(on ? 0xff2020 : 0x550000);
        c.lightBar.userData.blue.material.color.setHex(on ? 0x000088 : 0x2040ff);
      }
    }

    // Helicopter follows from above, searchlight on the player.
    if (this.heli) {
      this.heli.position.set(px + 8, 34, pz + 8);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heliLight.position.set(px + 8, 34, pz + 8);
      this.heliLight.target.position.set(px, 0, pz);
    }
  }
}
