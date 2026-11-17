// Effects: one pooled THREE.Points particle system (dust, smoke, sparks),
// muzzle-flash sprites, skid-mark decals and camera shake. Everything is
// recycled — no allocations in the hot loop.
import * as THREE from "three";
import { Rng } from "./rng.js";

const MAX_PARTICLES = 600;

export class Effects {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = new Rng(seed ^ 0xef3c);
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.grav = new Float32Array(MAX_PARTICLES);
    this.head = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    // Soft round sprite so particles render as dots, not squares.
    const cv = document.createElement("canvas");
    cv.width = 64;
    cv.height = 64;
    const g2 = cv.getContext("2d");
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.65)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(cv);
    const mat = new THREE.PointsMaterial({ size: 0.55, map: sprite, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    // Muzzle flash: one additive sprite, reused.
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    scene.add(this.flash);
    this.flashLife = 0;
    // Skid marks: pool of fading dark quads.
    this.skids = [];
    const skidGeo = new THREE.PlaneGeometry(0.45, 1.4);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x141414, transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      scene.add(m);
      this.skids.push({ mesh: m, life: 0 });
    }
    this.skidHead = 0;
    this.shakeAmt = 0;
  }

  spawn(x, y, z, count, color, speed, life, gravity, spread = 1) {
    const col = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX_PARTICLES;
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
      const a = this.rng.next() * Math.PI * 2;
      const s = speed * (0.4 + this.rng.next() * 0.8);
      this.vel[i * 3] = Math.cos(a) * s * spread;
      this.vel[i * 3 + 1] = this.rng.range(0.2, 1) * speed * 0.7;
      this.vel[i * 3 + 2] = Math.sin(a) * s * spread;
      this.colors[i * 3] = col.r;
      this.colors[i * 3 + 1] = col.g;
      this.colors[i * 3 + 2] = col.b;
      this.life[i] = life * (0.6 + this.rng.next() * 0.7);
      this.maxLife[i] = this.life[i];
      this.grav[i] = gravity;
    }
  }

  dust(x, z) {
    this.spawn(x, 0.3, z, 3, 0xcbb89a, 1.6, 0.9, -0.4, 1);
  }

  smoke(x, y, z) {
    this.spawn(x, y, z, 6, 0x555555, 1.2, 1.6, 0.8, 0.8);
  }

  sparks(x, y, z) {
    this.spawn(x, y, z, 10, 0xffa030, 7, 0.5, -6, 1);
  }

  explosion(x, z, scale = 1) {
    this.spawn(x, 1, z, Math.round(26 * scale), 0xff7a20, 8 * scale, 0.8, 2, 1);
    this.spawn(x, 1.5, z, Math.round(16 * scale), 0x444444, 3 * scale, 2.2, 1.5, 1);
    this.shake(0.5 * scale);
  }

  muzzle(pos, dir) {
    this.flash.position.copy(pos).addScaledVector(dir, 0.9);
    this.flash.lookAt(pos.clone().addScaledVector(dir, 3));
    this.flashLife = 0.07;
    this.flash.material.opacity = 0.95;
  }

  skid(x, z, heading) {
    const s = this.skids[this.skidHead];
    this.skidHead = (this.skidHead + 1) % this.skids.length;
    s.mesh.position.set(x, 0.02, z);
    s.mesh.rotation.z = -heading;
    s.life = 4;
    s.mesh.material.opacity = 0.55;
  }

  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  shakeOffset() {
    if (this.shakeAmt <= 0.001) return { x: 0, y: 0 };
    return {
      x: (this.rng.next() - 0.5) * this.shakeAmt * 0.5,
      y: (this.rng.next() - 0.5) * this.shakeAmt * 0.5,
    };
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        this.vel[i * 3 + 1] = 0;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.material.opacity = Math.max(0, this.flashLife / 0.07) * 0.95;
    }
    for (const s of this.skids) {
      if (s.life > 0) {
        s.life -= dt;
        s.mesh.material.opacity = Math.max(0, s.life / 4) * 0.55;
      }
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.6);
  }
}
