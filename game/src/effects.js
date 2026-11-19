// effects.js — particles, muzzle flashes, tracers, blood, smoke and
// screen shake. One pooled sprite set is reused for every burst so the
// game never allocates in the hot loop.
import * as THREE from "three";
import { makeRng } from "./rng.js";

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rng = makeRng(777);
    this.tex = dotTexture();
    this.pool = [];
    for (let i = 0; i < 90; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.pool.push({ sprite: s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0 });
    }
    this.tracers = [];
    this.shake = 0;
    this.marks = [];
  }

  spawn(x, y, z, color, n, speed, life, size, grav = -4) {
    let placed = 0;
    for (const p of this.pool) {
      if (placed >= n) break;
      if (p.life > 0) continue;
      p.life = life * (0.7 + this.rng() * 0.6);
      p.max = p.life;
      const a = this.rng() * Math.PI * 2;
      const up = this.rng() * 0.9 + 0.2;
      p.vx = Math.cos(a) * speed * this.rng();
      p.vz = Math.sin(a) * speed * this.rng();
      p.vy = up * speed;
      p.grav = grav;
      p.sprite.position.set(x, y, z);
      p.sprite.material.color.setHex(color);
      p.sprite.material.opacity = 1;
      p.sprite.scale.setScalar(size);
      p.sprite.visible = true;
      placed++;
    }
  }

  muzzle(x, y, z) {
    this.spawn(x, y, z, 0xffe14d, 6, 3, 0.12, 1.6, 0);
    this.shake = Math.max(this.shake, 0.12);
  }

  blood(x, y, z) { this.spawn(x, y, z, 0xc02020, 10, 2.5, 0.5, 0.7); }
  sparks(x, y, z) { this.spawn(x, y, z, 0xffd23e, 12, 5, 0.4, 0.6, -8); }
  smoke(x, y, z) { this.spawn(x, y, z, 0x666666, 3, 1.2, 1.4, 2.2, 1.2); }

  explosion(x, y, z) {
    this.spawn(x, y, z, 0xff7a2a, 22, 7, 0.7, 2.4);
    this.spawn(x, y, z, 0x333333, 10, 3, 1.6, 3.2, 1.5);
    this.shake = Math.max(this.shake, 0.7);
  }

  dust(x, z) { this.spawn(x, 0.3, z, 0xb8a888, 2, 1.5, 0.7, 1.4, 0.5); }

  tracer(x1, y1, z1, x2, y2, z2) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x2, y2, z2),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  // Floating diamond marker (sabotage spots, pickups).
  mark(x, z) {
    const m = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.8),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    m.position.set(x, 2.4, z);
    this.scene.add(m);
    this.marks.push({ mesh: m, baseY: 2.4, t: this.rng() * 6 });
    return m;
  }

  addShake(n) { this.shake = Math.max(this.shake, n); }

  update(dt, time) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.sprite.visible = false; continue; }
      p.vy += p.grav * dt;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.material.opacity = p.life / p.max;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / 0.12;
      }
    }
    for (const m of this.marks) {
      m.t += dt;
      m.mesh.rotation.y += dt * 2;
      m.mesh.position.y = m.baseY + Math.sin(m.t * 3) * 0.3;
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }

  applyShake(camera) {
    if (this.shake <= 0) return;
    const s = this.shake * 0.5;
    camera.position.x += (this.rng() - 0.5) * s;
    camera.position.y += (this.rng() - 0.5) * s;
  }
}
