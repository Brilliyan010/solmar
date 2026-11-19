// pedestrians.js — sidewalk walkers. They stroll along sidewalk edges,
// cross at intersections, and sprint away from gunfire, crashes and
// speeding cars. Simple capsule people with seeded shirt colours.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng, pick, range } from "./rng.js";

const STREETS = CONFIG.streetOffsets;
const SHIRTS = [0xe23a5a, 0x3a6fd8, 0x4fae5f, 0xffc21a, 0x8a5fc2, 0xe8e8e8, 0x2a2a2a, 0xff7a2a];

export class Pedestrians {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(CONFIG.seed + 202);
    this.peds = [];
    this.flee = { x: 0, z: 0, until: 0 }; // panic centre + expiry (game time)
  }

  spawnAll() {
    for (let i = 0; i < CONFIG.pedCount; i++) {
      const street = pick(this.rng, STREETS);
      const along = range(this.rng, -180, 180);
      const side = this.rng() < 0.5 ? -1 : 1;
      const onX = this.rng() < 0.5;
      const x = onX ? along : street + side * 8.5;
      const z = onX ? street + side * 8.5 : along;
      const g = new THREE.Group();
      const shirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.38, 0.9, 8),
        new THREE.MeshLambertMaterial({ color: pick(this.rng, SHIRTS) }),
      );
      shirt.position.y = 1.05;
      shirt.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
      );
      head.position.y = 1.75;
      const legL = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.6, 0.16),
        new THREE.MeshLambertMaterial({ color: 0x2a2a3a }),
      );
      legL.position.set(-0.14, 0.3, 0);
      const legR = legL.clone();
      legR.position.x = 0.14;
      g.add(shirt, head, legL, legR);
      g.position.set(x, 0, z);
      this.scene.add(g);
      this.peds.push({
        mesh: g, legs: [legL, legR], x, z,
        heading: this.rng() * Math.PI * 2,
        speed: range(this.rng, 1.1, CONFIG.pedSpeed),
        target: null, panic: 0, walkPhase: this.rng() * 6,
      });
    }
  }

  scare(x, z, now) {
    this.flee = { x, z, until: now + 4 };
  }

  update(dt, now) {
    for (const p of this.peds) {
      const dx = p.x - this.flee.x;
      const dz = p.z - this.flee.z;
      const d = Math.hypot(dx, dz);
      let speed = p.speed;
      let heading = p.heading;
      if (now < this.flee.until && d < 26) {
        heading = Math.atan2(dx, dz);
        speed = CONFIG.pedFleeSpeed;
        p.panic = 1;
      } else {
        p.panic = Math.max(0, p.panic - dt * 0.5);
        // Wander: pick a new sidewalk target sometimes.
        if (!p.target || Math.hypot(p.target[0] - p.x, p.target[1] - p.z) < 2 || this.rng() < 0.002) {
          const street = pick(this.rng, STREETS);
          const along = range(this.rng, -180, 180);
          const side = this.rng() < 0.5 ? -1 : 1;
          p.target = this.rng() < 0.5 ? [along, street + side * 8.5] : [street + side * 8.5, along];
        }
        heading = Math.atan2(p.target[0] - p.x, p.target[1] - p.z);
      }
      // Smooth turn.
      let dh = heading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += dh * Math.min(1, dt * 4);
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      // Stay inside the city.
      p.x = Math.max(-205, Math.min(205, p.x));
      p.z = Math.max(-205, Math.min(205, p.z));
      p.walkPhase += dt * speed * 3;
      const swing = Math.sin(p.walkPhase) * 0.5;
      p.legs[0].rotation.x = swing;
      p.legs[1].rotation.x = -swing;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }
}
