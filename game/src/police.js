// Wanted + police: five stars, patrol at 0, pursuit from 1 star, roadblocks
// at 3+, a helicopter at 5. Stars fall when the player stays clean and out
// of sight. Getting caught on foot means BUSTED.
import * as THREE from "three";
import { CFG } from "./config.js";
import { ROAD_X, ROAD_Z } from "./city.js";
import { buildCarMesh } from "./vehicles.js";
import { collideCircleAABB } from "./driving.js";
import { Rng } from "./rng.js";

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = new Rng(seed ^ 0x77aa);
    this.wanted = 0;
    this.lastCrimeAt = -999;
    this.time = 0;
    this.bustedTimer = 0;
    this.busted = false;
    this.roadblockAt = -999;
    this.cars = [];
    for (let i = 0; i < 5; i++) {
      const mesh = buildCarMesh("police");
      scene.add(mesh);
      const car = {
        mesh, x: this.rng.pick(ROAD_X), z: this.rng.pick(ROAD_Z),
        heading: 0, speed: 0, radius: 2.1, mode: "patrol",
        target: null, parked: false,
      };
      car.target = this.randomNode();
      this.cars.push(car);
    }
    // Helicopter (hidden until 5 stars).
    const heli = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2), new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.5, metalness: 0.4 }));
    body.castShadow = true;
    heli.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), body.material);
    tail.position.set(-3.6, 0.3, 0);
    heli.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 9), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1;
    heli.add(rotor);
    const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.32, 0.45, 1.2);
    spot.position.set(0, -0.5, 0);
    heli.add(spot);
    heli.add(spot.target);
    heli.visible = false;
    scene.add(heli);
    this.heli = { mesh: heli, rotor, spot };
  }

  randomNode() {
    return { x: this.rng.pick(ROAD_X), z: this.rng.pick(ROAD_Z) };
  }

  get stars() {
    return Math.round(this.wanted);
  }

  addWanted(n) {
    this.wanted = Math.min(CFG.wantedMax, this.wanted + n);
    this.lastCrimeAt = this.time;
  }

  clearWanted() {
    this.wanted = 0;
    for (const car of this.cars) {
      car.mode = "patrol";
      car.parked = false;
      car.target = this.randomNode();
    }
    this.heli.mesh.visible = false;
  }

  update(dt, player, colliders) {
    this.time += dt;
    // Decay: clean for a while and no cruiser nearby -> stars fall.
    const nearestCop = Math.min(...this.cars.map((c) => Math.hypot(c.x - player.x, c.z - player.z)));
    if (this.wanted > 0 && this.time - this.lastCrimeAt > CFG.wantedDecayDelay && nearestCop > 55) {
      this.wanted = Math.max(0, this.wanted - dt / CFG.wantedDecayStep);
      if (this.wanted < 0.5) this.clearWanted();
    }
    const active = this.stars >= 1 ? (this.stars >= 3 ? 4 : 3) : 2;
    // Roadblock at 3+ stars: two cruisers park across the road ahead.
    if (this.stars >= 3 && this.time - this.roadblockAt > 25) {
      this.roadblockAt = this.time;
      const fx = Math.cos(player.heading || 0);
      const fz = -Math.sin(player.heading || 0);
      const bx = player.x + fx * 55;
      const bz = player.z + fz * 55;
      for (let i = 0; i < 2; i++) {
        const car = this.cars[3 + i] ?? this.cars[i];
        car.mode = "block";
        car.parked = true;
        car.x = bx - fz * (i === 0 ? 4 : -4);
        car.z = bz + fx * (i === 0 ? 4 : -4);
        car.heading = (player.heading || 0) + Math.PI / 2;
        car.speed = 0;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
      }
    }
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (i >= active) {
        // Idle cruisers wait off-stage.
        car.mode = "patrol";
        if (Math.hypot(car.x - player.x, car.z - player.z) > 300) {
          car.x = player.x + this.rng.range(-160, 160);
          car.z = player.z + this.rng.range(-160, 160);
        }
      }
      if (car.parked) continue;
      let tx;
      let tz;
      let maxSpeed = 12;
      if (this.stars >= 1 && i < active) {
        car.mode = "chase";
        tx = player.x;
        tz = player.z;
        maxSpeed = 33;
      } else {
        car.mode = "patrol";
        tx = car.target.x;
        tz = car.target.z;
        if (Math.hypot(tx - car.x, tz - car.z) < 6) car.target = this.randomNode();
      }
      const dx = tx - car.x;
      const dz = tz - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(-dz, dx);
      const dh = wrapAngle(targetHeading - car.heading);
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const want = dist > 10 ? maxSpeed : maxSpeed * 0.4;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.6);
      let nx = car.x + Math.cos(car.heading) * car.speed * dt;
      let nz = car.z - Math.sin(car.heading) * car.speed * dt;
      const col = collideCircleAABB(nx, nz, car.radius, colliders);
      if (col.hit) {
        car.speed *= 0.5;
        car.heading += 0.6; // scrape along the wall
        nx = col.x;
        nz = col.z;
      }
      car.x = nx;
      car.z = nz;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      const bar = car.mesh.userData.lightBar;
      if (bar) bar.material.emissiveIntensity = 1 + Math.sin(this.time * 12 + i) * 1.2;
    }
    // Helicopter at 5 stars.
    const heliOn = this.stars >= 5;
    this.heli.mesh.visible = heliOn;
    if (heliOn) {
      const h = this.heli.mesh;
      h.position.set(player.x + Math.sin(this.time * 0.3) * 12, 46, player.z + Math.cos(this.time * 0.23) * 12);
      h.rotation.y = this.time * 0.2;
      this.heli.rotor.rotation.y += dt * 22;
      this.heli.spot.target.position.set(player.x - h.position.x, -46, player.z - h.position.z);
      this.heli.spot.target.updateMatrixWorld();
    }
    // Busted: on foot, a cruiser sits on the player while they crawl.
    if (player.onFoot) {
      const close = nearestCop < 3.4;
      const slow = true; // on foot the player is always catchable up close
      if (close && slow) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) this.busted = true;
      } else {
        this.bustedTimer = 0;
      }
    } else {
      this.bustedTimer = 0;
    }
  }
}
