// combat.js — fists, pistol, shotgun and the Kessler guards who shoot
// back. Shooting is a ray test against guards and police cars; guards
// are simple state machines (idle / chase / shoot / dead) with a
// fall-over death. The player takes damage through the game callback,
// which owns health, armor, the vignette and the WASTED screen.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { makeRng, pick } from "./rng.js";

export const WEAPONS = {
  fists: { name: "Fists", damage: CONFIG.punchDamage, range: 2.4, rate: 0.45, auto: false },
  pistol: { name: "Pistol", damage: CONFIG.pistolDamage, range: 55, rate: 0.28, auto: false },
  shotgun: { name: "Shotgun", damage: CONFIG.shotgunDamage, range: 26, rate: 0.9, auto: false, pellets: 6, spread: 0.09 },
};

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(CONFIG.seed + 404);
    this.weapon = "fists";
    this.ammo = { pistol: 48, shotgun: 18 };
    this.cooldown = 0;
    this.guards = [];
    this.tracers = [];
  }

  hasWeapon(id) {
    if (id === "fists") return true;
    return (this.ammo[id] ?? 0) > 0 || id === "pistol" && this.unlockedPistol;
  }

  unlock(id) {
    if (id === "pistol") this.unlockedPistol = true;
    if (id === "shotgun") this.unlockedShotgun = true;
  }

  select(id) {
    if (id === "fists") this.weapon = "fists";
    if (id === "pistol" && this.unlockedPistol) this.weapon = "pistol";
    if (id === "shotgun" && this.unlockedShotgun) this.weapon = "shotgun";
  }

  spawnGuard(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 1.0, 10),
      new THREE.MeshLambertMaterial({ color: 0x3a3a3a }),
    );
    body.position.y = 1.0;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a888 }),
    );
    head.position.y = 1.78;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    cap.position.y = 1.98;
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    gun.position.set(0.3, 1.3, -0.4);
    g.add(body, head, cap, gun);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const guard = { mesh: g, x, z, health: CONFIG.guardHealth, state: "idle", shootCd: 0, dead: false, fallT: 0 };
    this.guards.push(guard);
    return guard;
  }

  clearGuards() {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards = [];
  }

  // Fire the current weapon from (ox,oy,oz) along direction (dx,dz).
  // ctx: { guards, policeCars, trafficCars, effects, audio, onHitGuard,
  //   onKillGuard, onWanted, cameraForward }.
  fire(ox, oy, oz, dx, dz, ctx) {
    if (this.cooldown > 0) return false;
    const w = WEAPONS[this.weapon];
    if (this.weapon !== "fists" && (this.ammo[this.weapon] ?? 0) <= 0) {
      ctx.audio?.click();
      this.cooldown = 0.3;
      return false;
    }
    this.cooldown = w.rate;
    if (this.weapon !== "fists") this.ammo[this.weapon]--;
    ctx.audio?.shoot(this.weapon);
    ctx.effects?.muzzle(ox + dx * 1.2, oy, oz + dz * 1.2);

    const pellets = w.pellets ?? 1;
    for (let i = 0; i < pellets; i++) {
      const spread = w.spread ? (this.rng() - 0.5) * 2 * w.spread : 0;
      const px = dx * Math.cos(spread) - dz * Math.sin(spread);
      const pz = dx * Math.sin(spread) + dz * Math.cos(spread);
      this.rayHit(ox, oz, px, pz, w, ctx);
    }
    return true;
  }

  rayHit(ox, oz, dx, dz, w, ctx) {
    // Nearest guard hit along the ray (2D, generous radius).
    let best = null;
    let bestD = w.range;
    for (const g of this.guards) {
      if (g.dead) continue;
      const rx = g.x - ox;
      const rz = g.z - oz;
      const along = rx * dx + rz * dz;
      if (along < 0 || along > bestD) continue;
      const perp = Math.abs(rx * dz - rz * dx);
      if (perp < 1.1) { best = g; bestD = along; }
    }
    if (best) {
      best.health -= w.damage;
      ctx.effects?.blood(best.x, 1.2, best.z);
      if (best.health <= 0) {
        best.dead = true;
        best.fallT = 0;
        ctx.onKillGuard?.(best);
      } else {
        ctx.onHitGuard?.(best);
      }
      return;
    }
    // Police cars can be shot too (raises wanted).
    for (const c of ctx.policeCars ?? []) {
      const rx = c.x - ox;
      const rz = c.z - oz;
      const along = rx * dx + rz * dz;
      if (along < 0 || along > w.range) continue;
      if (Math.abs(rx * dz - rz * dx) < 1.8) {
        c.damaged = Math.min(1, (c.damaged ?? 0) + 0.25);
        ctx.effects?.sparks(c.x, 1, c.z);
        ctx.onWanted?.(CONFIG.shootWanted);
        return;
      }
    }
  }

  punchTarget(ox, oz, dx, dz, ctx) {
    return this.fire(ox, 1.2, oz, dx, dz, ctx);
  }

  update(dt, ctx) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const g of this.guards) {
      if (g.dead) {
        g.fallT += dt;
        g.mesh.rotation.x = Math.min(Math.PI / 2, g.fallT * 4);
        if (g.fallT > 6) g.mesh.visible = false;
        continue;
      }
      const dx = ctx.playerX - g.x;
      const dz = ctx.playerZ - g.z;
      const d = Math.hypot(dx, dz);
      g.shootCd -= dt;
      if (d < 34) {
        g.state = "shoot";
        g.mesh.rotation.y = Math.atan2(dx, dz);
        if (d > 8) {
          g.x += (dx / d) * 3.4 * dt;
          g.z += (dz / d) * 3.4 * dt;
        }
        if (g.shootCd <= 0 && d < 30) {
          g.shootCd = 1.4 + this.rng() * 0.8;
          ctx.audio?.enemyShot();
          ctx.effects?.tracer(g.x, 1.3, g.z, ctx.playerX, 1.2, ctx.playerZ);
          if (this.rng() < 0.55) ctx.onPlayerDamage?.(CONFIG.guardDamage);
        }
      } else {
        g.state = "idle";
      }
      g.mesh.position.set(g.x, 0, g.z);
    }
  }
}
