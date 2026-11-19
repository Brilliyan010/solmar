// SOLMAR — Mara Voss on foot: third-person, WASD + Shift + Space, orbit
// camera. The hero is a small procedural figure: jacket, head, hair, legs,
// and a sidearm that only shows once she owns a gun.
import * as THREE from 'three';
import { TUNE } from './config.js';

export function spawnHero(scene, city) {
  const figure = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f5c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.45), jacket);
  torso.position.y = 1.2;
  figure.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }),
  );
  head.position.y = 2.0;
  figure.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 10, 10, 0, Math.PI * 2, 0, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x2a1a0e }),
  );
  hair.position.y = 2.05;
  figure.add(hair);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.85, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x24344a }),
  );
  legs.position.y = 0.42;
  figure.add(legs);
  // The sidearm at her hip, hidden until she owns a real gun.
  const sidearm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  sidearm.position.set(0.5, 1.25, 0.2);
  sidearm.name = 'gun';
  sidearm.visible = false;
  figure.add(sidearm);
  scene.add(figure);

  const hero = {
    mesh: figure,
    x: 14,
    z: 110,
    y: 0,
    vy: 0,
    angle: Math.PI,
    camYaw: Math.PI,
    health: TUNE.heroMaxHp,
    armor: 0,
    onGround: true,
    moving: false,
  };

  function update(dt, input, ctx) {
    // Sprinting costs nothing but moves faster (faster still in good shoes).
    const sprintBonus = ctx.upgrades?.has('m_sprint') ? 1.25 : 1;
    const pace = (input.shift ? TUNE.sprintSpeed : TUNE.walkSpeed) * sprintBonus;
    // WASD relative to the camera's yaw, not the world's axes.
    let mx = 0;
    let mz = 0;
    if (input.w) { mx -= Math.sin(hero.camYaw); mz -= Math.cos(hero.camYaw); }
    if (input.s) { mx += Math.sin(hero.camYaw); mz += Math.cos(hero.camYaw); }
    if (input.a) { mx -= Math.cos(hero.camYaw); mz += Math.sin(hero.camYaw); }
    if (input.d) { mx += Math.cos(hero.camYaw); mz -= Math.sin(hero.camYaw); }
    const len = Math.hypot(mx, mz);
    hero.moving = len > 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      // Slide along walls: each axis is tested on its own.
      const nx = hero.x + mx * pace * dt;
      const nz = hero.z + mz * pace * dt;
      if (!city.blocked(nx, hero.z, 0.7)) hero.x = nx;
      if (!city.blocked(hero.x, nz, 0.7)) hero.z = nz;
      hero.angle = Math.atan2(mx, mz);
    }
    // Jump, then gravity until the ground catches her again.
    if (input.space && hero.onGround) {
      hero.vy = TUNE.jumpSpeed;
      hero.onGround = false;
    }
    if (!hero.onGround) {
      hero.vy -= TUNE.gravityPull * dt;
      hero.y += hero.vy * dt;
      if (hero.y <= 0) {
        hero.y = 0;
        hero.vy = 0;
        hero.onGround = true;
      }
    }
    // The mouse orbits the camera; the movement keys follow it.
    hero.camYaw += (input.mouseDX || 0) * 0.004;
    input.mouseDX = 0;
    figure.position.set(hero.x, hero.y, hero.z);
    figure.rotation.y = hero.angle;
    // A small step bob while she is moving.
    const bob = hero.moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.08 : 0;
    torso.position.y = 1.2 + bob;
  }

  // Damage soaks into armor first, then health. Returns true on death.
  function hurt(n) {
    let rest = n;
    if (hero.armor > 0) {
      const soaked = Math.min(hero.armor, rest);
      hero.armor -= soaked;
      rest -= soaked;
    }
    hero.health -= rest;
    if (hero.health < 0) hero.health = 0;
    return hero.health <= 0;
  }

  function heal(n) {
    const cap = ctx.upgrades?.has('m_health') ? 150 : TUNE.heroMaxHp;
    hero.health = Math.min(cap, hero.health + n);
  }

  hero.update = update;
  hero.hurt = hurt;
  hero.heal = heal;
  return hero;
}
