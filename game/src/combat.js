// Combat: fists, pistol and shotgun (hitscan), Kessler guards with simple
// AI, and line-of-sight checks against the city so walls actually block
// bullets. Enemies are plain figures; the boss (Dario Kessler) just has more
// health and a faster trigger finger.
import * as THREE from "three";
import { CFG } from "./config.js";
import { Rng } from "./rng.js";

// Sampled line-of-sight: true when no building AABB blocks the segment.
export function hasLineOfSight(ax, az, bx, bz, colliders) {
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    for (const c of colliders) {
      if (x > c.minX - 0.4 && x < c.maxX + 0.4 && z > c.minZ - 0.4 && z < c.maxZ + 0.4) return false;
    }
  }
  return true;
}

export class Combat {
  constructor(scene, colliders, seed) {
    this.scene = scene;
    this.colliders = colliders;
    this.rng = new Rng(seed ^ 0x3c3c);
    this.enemies = [];
    this.weapon = "fists";
    this.owned = new Set(["fists"]);
    this.lastShotAt = -99;
    this.time = 0;
    this.onPlayerHit = null; // (damage) => void, wired by game.js
  }

  buildGuardMesh(boss) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: boss ? 0x6b1a1a : 0x222226, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.0, 8), suit);
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.7 }));
    head.position.y = 1.68;
    g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.09), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    gun.position.set(0.3, 1.25, 0);
    g.add(gun);
    g.userData.gun = gun;
    return g;
  }

  spawnGuard(x, z, boss = false) {
    const mesh = this.buildGuardMesh(boss);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const e = {
      mesh, x, z, boss,
      hp: boss ? CFG.bossHealth : CFG.guardHealth,
      heading: 0, shootAt: this.time + this.rng.range(0.6, 1.6),
      dead: false, deadAt: 0,
    };
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  aliveCount() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  // Hitscan shot from origin along dir (unit Vector3). Returns the enemy hit
  // (if any) plus the end point for the tracer effect.
  shoot(origin, dir) {
    const now = this.time;
    const rate = this.weapon === "shotgun" ? CFG.shotgunRate : this.weapon === "pistol" ? CFG.pistolRate : 0.4;
    if (now - this.lastShotAt < rate) return null;
    this.lastShotAt = now;
    const range = this.weapon === "shotgun" ? CFG.shotgunRange : this.weapon === "pistol" ? CFG.pistolRange : CFG.fistRange;
    const pellets = this.weapon === "shotgun" ? CFG.shotgunPellets : 1;
    let best = null;
    let bestT = range;
    for (let p = 0; p < pellets; p++) {
      const d = dir.clone();
      if (this.weapon === "shotgun") {
        d.x += this.rng.range(-0.06, 0.06);
        d.z += this.rng.range(-0.06, 0.06);
        d.normalize();
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        // Ray vs vertical capsule approximated as a sphere at chest height.
        const cx = e.x - origin.x;
        const cy = 1.1 - origin.y;
        const cz = e.z - origin.z;
        const t = cx * d.x + cy * d.y + cz * d.z;
        if (t < 0 || t > range) continue;
        const px = origin.x + d.x * t;
        const py = origin.y + d.y * t;
        const pz = origin.z + d.z * t;
        const dist = Math.hypot(px - e.x, py - 1.1, pz - e.z);
        if (dist < 0.95 && t < bestT && hasLineOfSight(origin.x, origin.z, e.x, e.z, this.colliders)) {
          bestT = t;
          best = e;
        }
      }
    }
    const end = origin.clone().addScaledVector(dir, best ? bestT : range);
    if (best) {
      const dmg = this.weapon === "shotgun" ? CFG.shotgunDamage : this.weapon === "pistol" ? CFG.pistolDamage : CFG.fistDamage;
      best.hp -= dmg;
      if (best.hp <= 0) {
        best.dead = true;
        best.deadAt = now;
        best.mesh.rotation.z = Math.PI / 2;
        best.mesh.position.y = 0.3;
      }
    }
    return { hit: best, end, range };
  }

  // Fists: same hitscan but short range; called on click when unarmed.
  punch(origin, dir) {
    const save = this.weapon;
    this.weapon = "fists";
    const r = this.shoot(origin, dir);
    this.weapon = save;
    return r;
  }

  update(dt, player) {
    this.time += dt;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const dist = Math.hypot(dx, dz);
      const los = dist < 46 && hasLineOfSight(e.x, e.z, player.x, player.z, this.colliders);
      if (los && player.onFoot) {
        e.heading = Math.atan2(-dz, dx);
        e.mesh.rotation.y = e.heading;
        // Close to a firing stance, then shoot.
        if (dist > 16) {
          e.x += (dx / dist) * 3.2 * dt;
          e.z += (dz / dist) * 3.2 * dt;
          e.mesh.position.set(e.x, 0, e.z);
        }
        if (this.time >= e.shootAt) {
          e.shootAt = this.time + (e.boss ? 0.9 : 1.5) + this.rng.range(0, 0.7);
          // Hit chance falls with distance; point-blank almost always hits.
          const p = Math.max(0.12, 0.75 - dist * 0.012);
          if (this.rng.next() < p && this.onPlayerHit) {
            this.onPlayerHit(e.boss ? 14 : 9);
          }
          e.mesh.userData.gunFlash = 0.08;
        }
      } else if (dist > 46) {
        // Drift back to the post.
        e.mesh.rotation.y += dt * 0.4;
      }
    }
  }
}
