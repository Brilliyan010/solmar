// SOLMAR — Mara Voss jalan kaki: third-person, WASD + Shift + Space, kamera orbit.
import * as THREE from 'three';
import { CFG } from './config.js';

export function createPlayer(scene, city) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f5c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.45), jacket);
  body.position.y = 1.2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 2.0; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 10, 0, Math.PI * 2, 0, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x2a1a0e }));
  hair.position.y = 2.05; g.add(hair);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x24344a }));
  legs.position.y = 0.42; g.add(legs);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.5, 1.25, 0.2); gun.name = 'gun'; gun.visible = false; g.add(gun);
  scene.add(g);
  const p = {
    mesh: g, x: 14, z: 110, y: 0, vy: 0, angle: Math.PI, camYaw: Math.PI,
    health: CFG.maxHp, armor: 0, onGround: true, moving: false,
  };
  function update(dt, input, ctx) {
    const sprintMul = ctx.upgrades?.has('m_sprint') ? 1.25 : 1;
    const speed = (input.shift ? CFG.sprint : CFG.walk) * sprintMul;
    let mx = 0, mz = 0;
    if (input.w) { mx -= Math.sin(p.camYaw); mz -= Math.cos(p.camYaw); }
    if (input.s) { mx += Math.sin(p.camYaw); mz += Math.cos(p.camYaw); }
    if (input.a) { mx -= Math.cos(p.camYaw); mz += Math.sin(p.camYaw); }
    if (input.d) { mx += Math.cos(p.camYaw); mz -= Math.sin(p.camYaw); }
    const len = Math.hypot(mx, mz);
    p.moving = len > 0;
    if (len > 0) {
      mx /= len; mz /= len;
      const nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
      if (!city.blocked(nx, p.z, 0.7)) p.x = nx;
      if (!city.blocked(p.x, nz, 0.7)) p.z = nz;
      p.angle = Math.atan2(mx, mz);
    }
    if (input.space && p.onGround) { p.vy = CFG.jumpV; p.onGround = false; }
    if (!p.onGround) {
      p.vy -= CFG.gravity * dt; p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
    }
    p.camYaw += (input.mouseDX || 0) * 0.004;
    input.mouseDX = 0;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = p.angle;
    // Animasi langkah.
    const bob = p.moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.08 : 0;
    body.position.y = 1.2 + bob;
  }
  function hurt(n) {
    let rest = n;
    if (p.armor > 0) { const ab = Math.min(p.armor, rest); p.armor -= ab; rest -= ab; }
    p.health -= rest;
    if (p.health < 0) p.health = 0;
    return p.health <= 0;
  }
  function heal(n) { p.health = Math.min(ctx.upgrades?.has('m_health') ? 150 : CFG.maxHp, p.health + n); }
  p.update = update; p.hurt = hurt; p.heal = heal;
  return p;
}
