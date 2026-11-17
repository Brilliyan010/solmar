// Traffic AI: cars drive the road grid on the right-hand lane, stop at red
// lights, slow for the car ahead, and respawn near the player when they get
// too far away. Deterministic from the seed.
import * as THREE from "three";
import { CFG } from "./config.js";
import { ROAD_X, ROAD_Z } from "./city.js";
import { MODELS, buildCarMesh } from "./vehicles.js";
import { Rng } from "./rng.js";

const TRAFFIC_MODELS = ["pipit", "corto", "corto", "cabrio", "mule", "pipit", "hauler"];

export class Traffic {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(seed ^ 0x51ab);
    this.cars = [];
    this.lightTimer = 0;
    for (let i = 0; i < CFG.trafficCount; i++) {
      const model = this.rng.pick(TRAFFIC_MODELS);
      const color = this.rng.pick(MODELS[model].colors);
      const mesh = buildCarMesh(model, color);
      scene.add(mesh);
      const car = {
        mesh, model, speed: 0,
        x: 0, z: 0, heading: 0, radius: 2.1,
        from: null, to: null, t: 0, edgeLen: 1,
        targetSpeed: CFG.trafficSpeed,
      };
      this.placeOnRandomEdge(car, 0, 0, 260);
      this.cars.push(car);
    }
  }

  randomNode() {
    return { x: this.rng.pick(ROAD_X), z: this.rng.pick(ROAD_Z) };
  }

  // Put a car on a random road edge near (cx, cz), within maxDist.
  placeOnRandomEdge(car, cx, cz, maxDist) {
    for (let tries = 0; tries < 20; tries++) {
      const a = this.randomNode();
      const horiz = this.rng.chance(0.5);
      const b = { ...a };
      const step = this.rng.pick([-1, 1]) * CFG.pitch;
      if (horiz) b.x = a.x + step;
      else b.z = a.z + step;
      if (b.x < ROAD_X[0] || b.x > ROAD_X[ROAD_X.length - 1]) continue;
      if (b.z < ROAD_Z[0] || b.z > ROAD_Z[ROAD_Z.length - 1]) continue;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      if (Math.hypot(mx - cx, mz - cz) > maxDist) continue;
      car.from = a;
      car.to = b;
      car.t = this.rng.next();
      car.edgeLen = Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
      car.speed = CFG.trafficSpeed * this.rng.range(0.8, 1.1);
      this.syncMesh(car);
      return;
    }
    car.from = { x: 0, z: -186 };
    car.to = { x: 0, z: -124 };
    car.t = 0;
    car.edgeLen = CFG.pitch;
    this.syncMesh(car);
  }

  syncMesh(car) {
    const dx = car.to.x - car.from.x;
    const dz = car.to.z - car.from.z;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len;
    const uz = dz / len;
    // Right-hand lane offset.
    const ox = -uz * 2.4;
    const oz = ux * 2.4;
    car.x = car.from.x + dx * car.t + ox;
    car.z = car.from.z + dz * car.t + oz;
    car.heading = Math.atan2(-uz, ux);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.mesh.userData.wheels) w.rotation.z += (car.speed / 0.36) * 0.016;
  }

  // Traffic-light state for a node: red when the light's NS axis is green
  // and this car travels east-west, and vice versa.
  lightStateAt(x, z, travellingX) {
    for (const l of this.city.trafficLights) {
      if (Math.abs(l.x - x) < 4 && Math.abs(l.z - z) < 4) {
        // nsGreen: north-south has green, east-west must stop.
        if (travellingX) return l.nsGreen ? "stop" : "go";
        return l.nsGreen ? "go" : "stop";
      }
    }
    return "go";
  }

  update(dt, playerPos) {
    // Cycle the lights every 9 seconds.
    this.lightTimer += dt;
    if (this.lightTimer > 9) {
      this.lightTimer = 0;
      for (const l of this.city.trafficLights) {
        l.nsGreen = !l.nsGreen;
        l.red.material.emissiveIntensity = l.nsGreen ? 0.15 : 2.2;
        l.green.material.emissiveIntensity = l.nsGreen ? 2.2 : 0.15;
      }
    }
    for (const car of this.cars) {
      // Respawn near the player when far away.
      if (Math.hypot(car.x - playerPos.x, car.z - playerPos.z) > 280) {
        this.placeOnRandomEdge(car, playerPos.x, playerPos.z, 200);
        continue;
      }
      let target = CFG.trafficSpeed;
      // Car ahead on the same edge?
      for (const o of this.cars) {
        if (o === car || o.from !== car.from || o.to !== car.to) continue;
        if (o.t > car.t && o.t - car.t < 0.16) target = Math.min(target, o.speed);
      }
      // Red light ahead?
      const dx = car.to.x - car.from.x;
      const dz = car.to.z - car.from.z;
      const remain = (1 - car.t) * car.edgeLen;
      if (remain < 14) {
        const travellingX = Math.abs(dx) > 0;
        if (this.lightStateAt(car.to.x, car.to.z, travellingX) === "stop") target = 0;
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 2.2);
      if (car.speed < 0.05) car.speed = 0;
      car.t += (car.speed * dt) / car.edgeLen;
      if (car.t >= 1) {
        // Pick the next edge: any neighbour except the one we came from.
        const at = car.to;
        const prev = car.from;
        const options = [];
        for (const nx of [at.x - CFG.pitch, at.x + CFG.pitch]) {
          if (nx >= ROAD_X[0] && nx <= ROAD_X[ROAD_X.length - 1] && !(nx === prev.x && at.z === prev.z)) {
            options.push({ x: nx, z: at.z });
          }
        }
        for (const nz of [at.z - CFG.pitch, at.z + CFG.pitch]) {
          if (nz >= ROAD_Z[0] && nz <= ROAD_Z[ROAD_Z.length - 1] && !(at.x === prev.x && nz === prev.z)) {
            options.push({ x: at.x, z: nz });
          }
        }
        car.from = at;
        car.to = options.length ? this.rng.pick(options) : prev;
        car.t = 0;
        car.edgeLen = Math.abs(car.to.x - car.from.x) + Math.abs(car.to.z - car.from.z);
      }
      this.syncMesh(car);
    }
  }
}
