// Pedestrians: low-poly walkers on the sidewalks. They stroll between
// intersections, cross at corners, and run away from gunshots and crashes.
import * as THREE from "three";
import { CFG } from "./config.js";
import { ROAD_X, ROAD_Z } from "./city.js";
import { Rng } from "./rng.js";

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0x9b59b6, 0xe67e22, 0xecf0f1, 0x1abc9c];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export class Pedestrians {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = new Rng(seed ^ 0x9e37);
    this.peds = [];
    this.walkTime = 0;
    for (let i = 0; i < CFG.pedCount; i++) {
      const mesh = this.buildMesh();
      scene.add(mesh);
      const ped = {
        mesh, x: 0, z: 0, heading: 0, speed: 0,
        target: null, fleeUntil: 0, fallen: false, bobPhase: this.rng.range(0, 6),
      };
      this.placeRandom(ped);
      this.peds.push(ped);
    }
  }

  buildMesh() {
    const g = new THREE.Group();
    const shirt = this.rng.pick(SHIRTS);
    const skin = this.rng.pick(SKINS);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.32, 0.95, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 }),
    );
    body.position.y = 0.95;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 10, 8),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }),
    );
    head.position.y = 1.62;
    head.castShadow = true;
    g.add(head);
    const legGeo = new THREE.BoxGeometry(0.14, 0.5, 0.14);
    legGeo.translate(0, -0.25, 0); // pivot at the hip
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(0, 0.5, 0.11);
    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0, 0.5, -0.11);
    g.add(legL, legR);
    g.userData.legs = [legL, legR];
    return g;
  }

  randomCorner() {
    const rx = this.rng.pick(ROAD_X);
    const rz = this.rng.pick(ROAD_Z);
    const sx = this.rng.chance(0.5) ? 1 : -1;
    const sz = this.rng.chance(0.5) ? 1 : -1;
    return { x: rx + sx * (CFG.roadHalf + 2.2), z: rz + sz * (CFG.roadHalf + 2.2) };
  }

  placeRandom(ped) {
    const p = this.randomCorner();
    ped.x = p.x;
    ped.z = p.z;
    ped.target = this.randomCorner();
    ped.speed = this.rng.range(1.1, 1.9);
    ped.mesh.position.set(ped.x, 0, ped.z);
  }

  // Make every ped near (x, z) run away for a few seconds.
  scare(x, z, radius = 26) {
    for (const ped of this.peds) {
      if (ped.fallen) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.fleeUntil = this.walkTime + 3;
        ped.fleeFrom = { x, z };
      }
    }
  }

  update(dt) {
    this.walkTime += dt;
    for (const ped of this.peds) {
      if (ped.fallen) continue;
      let tx;
      let tz;
      let speed = ped.speed;
      if (this.walkTime < ped.fleeUntil && ped.fleeFrom) {
        // Run directly away from the scare point.
        const dx = ped.x - ped.fleeFrom.x;
        const dz = ped.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.x + (dx / d) * 10;
        tz = ped.z + (dz / d) * 10;
        speed = 4.2;
      } else {
        tx = ped.target.x;
        tz = ped.target.z;
      }
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        if (this.walkTime >= ped.fleeUntil) ped.target = this.randomCorner();
        continue;
      }
      const step = Math.min(d, speed * dt);
      ped.x += (dx / d) * step;
      ped.z += (dz / d) * step;
      ped.heading = Math.atan2(-dz, dx);
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(this.walkTime * 7 + ped.bobPhase)) * 0.05, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(this.walkTime * 7 + ped.bobPhase) * 0.5;
      ped.mesh.userData.legs[0].rotation.z = swing;
      ped.mesh.userData.legs[1].rotation.z = -swing;
    }
  }

  // Knock a ped down (hit by a car). Returns the ped.
  knockDown(x, z, radius = 2.2) {
    for (const ped of this.peds) {
      if (ped.fallen) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.fallen = true;
        ped.mesh.rotation.z = Math.PI / 2;
        ped.mesh.position.y = 0.3;
        return ped;
      }
    }
    return null;
  }
}
