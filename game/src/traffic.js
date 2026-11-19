// traffic.js — AI traffic cars. Each car drives along a street centre
// line (x-streets or z-streets), keeps to the right-hand lane, slows for
// the car ahead, and at intersections sometimes turns onto the cross
// street. Traffic lights at the four central intersections gate flow.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng, pick, range } from "./rng.js";
import { createCar, carDef } from "./vehicles.js";
import { nearestStreet } from "./city.js";

const STREETS = CONFIG.streetOffsets;

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.rng = makeRng(CONFIG.seed + 101);
    // Traffic lights: state per central intersection, cycles on a timer.
    this.lights = [];
    for (const sx of [-31, 31]) {
      for (const sz of [-31, 31]) {
        this.lights.push({ x: sx, z: sz, t: this.rng() * 8, green: this.rng() < 0.5 });
      }
    }
    this.lightMeshes = [];
    for (const l of this.lights) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 4.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      pole.position.set(l.x + 7.5, 2.2, l.z + 7.5);
      scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x37d67a }),
      );
      lamp.position.set(l.x + 7.5, 4.6, l.z + 7.5);
      scene.add(lamp);
      this.lightMeshes.push(lamp);
    }
  }

  spawnAll() {
    const defs = CONFIG.cars.filter((c) => c.id !== "vantara");
    for (let i = 0; i < CONFIG.trafficCount; i++) {
      const alongX = this.rng() < 0.5;
      const street = pick(this.rng, STREETS);
      const along = range(this.rng, -180, 180);
      const dir = this.rng() < 0.5 ? 1 : -1;
      const lane = 3; // right-hand lane offset
      const x = alongX ? along : street + dir * lane * -1;
      const z = alongX ? street + dir * lane : along;
      const def = pick(this.rng, defs);
      const car = createCar(def, x, z, alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), { driver: "traffic" });
      car.axis = alongX ? "x" : "z";
      car.dir = dir;
      car.street = street;
      car.targetSpeed = range(this.rng, 8, CONFIG.trafficSpeed);
      car.wait = 0;
      this.scene.add(car.mesh);
      this.cars.push(car);
    }
  }

  // Is a light red for a car approaching intersection (x,z) on its axis?
  redLight(car) {
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const d = car.axis === "x" ? Math.abs(car.z - l.z) : Math.abs(car.x - l.x);
      const along = car.axis === "x" ? car.x - l.x : car.z - l.z;
      if (d < 7 && Math.abs(along) < 14 && Math.sign(along) === -car.dir) {
        // Green for the axis whose index parity matches the light phase.
        const greenForX = l.green;
        if ((car.axis === "x") !== greenForX) return true;
      }
    }
    return false;
  }

  update(dt) {
    for (const l of this.lights) {
      l.t += dt;
      if (l.t > 8) { l.t = 0; l.green = !l.green; }
    }
    this.lightMeshes.forEach((m, i) => {
      m.material.color.setHex(this.lights[i].green ? 0x37d67a : 0xff3a2a);
    });

    for (const car of this.cars) {
      // Slow for the car ahead on the same street.
      let ahead = 99;
      for (const o of this.cars) {
        if (o === car || o.axis !== car.axis || o.street !== car.street) continue;
        const d = car.axis === "x" ? (o.x - car.x) * car.dir : (o.z - car.z) * car.dir;
        if (d > 0 && d < ahead) ahead = d;
      }
      let want = car.targetSpeed;
      if (ahead < 10) want = Math.min(want, Math.max(0, (ahead - 5) * 1.2));
      if (this.redLight(car)) want = 0;
      if (car.wait > 0) { car.wait -= dt; want = 0; }

      car.speed += (want - car.speed) * Math.min(1, dt * 2);
      const step = car.speed * dt;
      if (car.axis === "x") car.x += step * car.dir;
      else car.z += step * car.dir;

      // Reached the city edge: turn around.
      const pos = car.axis === "x" ? car.x : car.z;
      if (Math.abs(pos) > 200) {
        car.dir *= -1;
        if (car.axis === "x") car.z = car.street - car.dir * 3;
        else car.x = car.street - car.dir * 3;
        car.heading = car.axis === "x" ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      }

      // At an intersection, sometimes turn onto the cross street.
      const cross = nearestStreet(car.axis === "x" ? car.x : car.z);
      const distToCross = Math.abs((car.axis === "x" ? car.x : car.z) - cross);
      if (distToCross < 0.6 && this.rng() < 0.06 && Math.abs(car.speed) > 3) {
        const newStreet = cross;
        const newAxis = car.axis === "x" ? "z" : "x";
        const newDir = this.rng() < 0.5 ? 1 : -1;
        const oldStreet = car.street;
        if (newAxis === "x") {
          car.z = newStreet + newDir * 3;
          car.x = oldStreet;
        } else {
          car.x = newStreet + newDir * 3;
          car.z = oldStreet;
        }
        car.axis = newAxis;
        car.dir = newDir;
        car.street = newStreet;
        car.heading = newAxis === "x" ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
      }

      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading + Math.PI;
      const spin = (car.speed * dt) / 0.34;
      for (const w of car.wheels) w.rotation.x += spin;
    }
  }
}
