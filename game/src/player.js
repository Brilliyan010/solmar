// player.js — Mara Voss on foot: third-person movement, sprint, jump,
// mouse-orbit camera, and the player mesh. Camera is a chase camera
// that orbits with the mouse and pulls in when a wall is behind it.
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { collideCircle } from "./driving.js";

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 56;
    this.z = 132;
    this.y = 0;
    this.vy = 0;
    this.heading = Math.PI; // facing north, toward the garage
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.camDist = 7;
    this.onGround = true;
    this.walkPhase = 0;
    this.moving = false;

    const g = new THREE.Group();
    // Coral jacket, dark hair, jeans — Mara's look.
    const jacket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.4, 0.95, 10),
      new THREE.MeshLambertMaterial({ color: 0xe2574c }),
    );
    jacket.position.y = 1.05;
    jacket.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
    );
    head.position.y = 1.78;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshLambertMaterial({ color: 0x2a1a12 }),
    );
    hair.position.y = 1.84;
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.62, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x2a3a5a }),
    );
    legL.position.set(-0.15, 0.31, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.6, 0.13),
      new THREE.MeshLambertMaterial({ color: 0xe2574c }),
    );
    armL.position.set(-0.48, 1.15, 0);
    const armR = armL.clone();
    armR.position.x = 0.48;
    g.add(jacket, head, hair, legL, legR, armL, armR);
    g.position.set(this.x, 0, this.z);
    scene.add(g);
    this.mesh = g;
    this.legs = [legL, legR];
    this.arms = [armL, armR];
  }

  update(dt, input, colliders, camera) {
    // Mouse orbit.
    this.camYaw -= input.mouseDX * 0.0032;
    this.camPitch = Math.max(-0.1, Math.min(1.1, this.camPitch + input.mouseDY * 0.0024));

    const k = input.keys;
    let fx = 0;
    let fz = 0;
    if (k.has("KeyW")) fz -= 1;
    if (k.has("KeyS")) fz += 1;
    if (k.has("KeyA")) fx -= 1;
    if (k.has("KeyD")) fx += 1;
    const len = Math.hypot(fx, fz);
    this.moving = len > 0;
    const sprint = k.has("ShiftLeft") || k.has("ShiftRight");
    const speed = sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
    if (len > 0) {
      fx /= len;
      fz /= len;
      const sin = Math.sin(this.camYaw);
      const cos = Math.cos(this.camYaw);
      const mx = fx * cos - fz * sin;
      const mz = fx * sin + fz * cos;
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      const [cx, cz] = collideCircle(nx, nz, CONFIG.playerRadius, colliders);
      this.x = cx;
      this.z = cz;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * speed * 1.6;
    }

    // Jump + gravity.
    if (k.has("Space") && this.onGround) {
      this.vy = CONFIG.jumpSpeed;
      this.onGround = false;
    }
    this.vy -= CONFIG.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }

    // Animate limbs.
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.8;
    this.arms[1].rotation.x = swing * 0.8;

    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;

    // Chase camera.
    const cd = this.camDist;
    const cx = this.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * cd;
    const cz = this.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * cd;
    const cy = this.y + 1.8 + Math.sin(this.camPitch) * cd;
    camera.position.set(cx, Math.max(0.6, cy), cz);
    camera.lookAt(this.x, this.y + 1.5, this.z);
  }

  teleport(x, z) {
    this.x = x;
    this.z = z;
    this.y = 0;
    this.vy = 0;
    this.mesh.position.set(x, 0, z);
  }
}
