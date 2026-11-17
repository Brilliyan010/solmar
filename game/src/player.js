// Mara Voss on foot: third-person walker with camera-relative WASD, sprint,
// jump and a simple walk cycle. The mesh faces +X at heading 0, matching the
// car convention, so heading = atan2(-mz, mx) everywhere.
import * as THREE from "three";
import { CFG } from "./config.js";

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.vy = 0;
    this.heading = 0;
    this.health = CFG.playerHealth;
    this.armor = 0;
    this.onFoot = true;
    this.inCar = null; // car state when driving
    this.walkPhase = 0;
    this.mesh = this.buildMesh();
    scene.add(this.mesh);
  }

  buildMesh() {
    const g = new THREE.Group();
    g.name = "mara";
    const jacket = new THREE.MeshStandardMaterial({ color: 0x0e7c7b, roughness: 0.8 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.62, 10), jacket);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
    head.position.y = 1.56;
    head.castShadow = true;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x2c1a10, roughness: 0.9 }));
    hair.position.y = 1.6;
    g.add(hair);
    const legGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
    legGeo.translate(0, -0.31, 0); // pivot at the hip
    const legL = new THREE.Mesh(legGeo, jeans);
    legL.position.set(0, 0.67, 0.12);
    const legR = new THREE.Mesh(legGeo, jeans);
    legR.position.set(0, 0.67, -0.12);
    g.add(legL, legR);
    const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.13);
    armGeo.translate(0, -0.27, 0); // pivot at the shoulder
    const armL = new THREE.Mesh(armGeo, jacket);
    armL.position.set(0, 1.38, 0.36);
    const armR = new THREE.Mesh(armGeo, jacket);
    armR.position.set(0, 1.38, -0.36);
    g.add(armL, armR);
    g.userData = { legL, legR, armL, armR, torso };
    return g;
  }

  // input: { fwd, strafe } in camera space (-1..1), sprint, jump.
  // camFwd: THREE.Vector3 camera forward projected on XZ, normalised.
  updateOnFoot(dt, input, camFwd) {
    const right = new THREE.Vector3().crossVectors(camFwd, new THREE.Vector3(0, 1, 0));
    const mx = camFwd.x * input.fwd + right.x * input.strafe;
    const mz = camFwd.z * input.fwd + right.z * input.strafe;
    const len = Math.hypot(mx, mz);
    const speed = input.sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    if (len > 0.01) {
      this.x += (mx / len) * speed * dt;
      this.z += (mz / len) * speed * dt;
      this.heading = Math.atan2(-mz, mx);
      this.walkPhase += dt * speed * 1.6;
    }
    // Jump + gravity.
    if (input.jump && this.y === 0) this.vy = CFG.jumpSpeed;
    if (this.y > 0 || this.vy !== 0) {
      this.vy -= CFG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
      }
    }
    // City bounds.
    const B = 360;
    this.x = Math.max(-B, Math.min(B, this.x));
    this.z = Math.max(-B, Math.min(B, this.z));
    // Animate: legs and arms swing forward/back around the lateral (Z) axis.
    const swing = len > 0.01 ? Math.sin(this.walkPhase) * 0.7 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.z = swing;
    u.legR.rotation.z = -swing;
    u.armL.rotation.z = -swing * 0.8;
    u.armR.rotation.z = swing * 0.8;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    return len > 0.01;
  }

  damage(amount) {
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(CFG.playerHealth, this.health + amount);
  }

  hide() {
    this.mesh.visible = false;
  }

  show() {
    this.mesh.visible = true;
  }
}
