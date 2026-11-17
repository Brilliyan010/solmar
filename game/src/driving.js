// Arcade driving physics + collisions. Cars are circles in the XZ plane;
// buildings are AABBs. No physics engine: a few dozen lines of push-out and
// speed exchange, tuned to feel like a street arcade racer.
import { CFG } from "./config.js";

// Push a circle (x, z, radius r) out of every AABB it overlaps.
// Returns { x, z, hit } with hit true when any collider was touched.
export function collideCircleAABB(x, z, r, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = x - c.minX;
      const pr = c.maxX - x;
      const pt = z - c.minZ;
      const pb = c.maxZ - z;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = c.minX - r;
      else if (m === pr) x = c.maxX + r;
      else if (m === pt) z = c.minZ - r;
      else z = c.maxZ + r;
    }
  }
  return { x, z, hit };
}

// One fixed step of arcade driving. input: { throttle: -1..1, steer: -1..1,
// handbrake: bool }. others: other cars {x, z, radius, speed} for bumps.
// Returns an event object the game uses for sound, wanted and damage.
export function driveCarStep(car, input, dt, colliders, others) {
  const ev = { hitWall: false, hitCar: false, impact: 0 };
  const m = car;
  const speedSign = m.speed >= 0 ? 1 : -1;
  // Longitudinal.
  if (input.throttle > 0) m.speed += m.accel * input.throttle * dt;
  else if (input.throttle < 0) {
    if (m.speed > 0.5) m.speed -= CFG.driveBrake * dt;
    else m.speed -= m.accel * 0.7 * dt; // reverse
  }
  m.speed -= m.speed * 0.35 * dt; // rolling drag
  if (input.handbrake) m.speed -= m.speed * 1.4 * dt;
  if (m.speed > m.maxSpeed) m.speed = m.maxSpeed;
  if (m.speed < -CFG.driveReverseMax) m.speed = -CFG.driveReverseMax;
  if (Math.abs(m.speed) < 0.05 && input.throttle === 0) m.speed = 0;
  // Steering: sharper at low speed, duller at top speed; handbrake slides.
  const spd = Math.abs(m.speed);
  const grip = CFG.driveGrip * (input.handbrake ? CFG.handbrakeTurn : 1);
  const turn = input.steer * grip * Math.min(spd / 7, 1) * (1 - Math.min(spd / m.maxSpeed, 1) * 0.45);
  m.heading += turn * dt * speedSign;
  // Integrate.
  const fx = Math.cos(m.heading);
  const fz = -Math.sin(m.heading);
  let nx = m.x + fx * m.speed * dt;
  let nz = m.z + fz * m.speed * dt;
  // City bounds: soft wall at the ground edge.
  const B = 360;
  nx = Math.max(-B, Math.min(B, nx));
  nz = Math.max(-B, Math.min(B, nz));
  const r = (m.mesh?.userData.length ?? 4.4) * 0.42;
  const col = collideCircleAABB(nx, nz, r, colliders);
  if (col.hit) {
    ev.hitWall = true;
    ev.impact = Math.abs(m.speed);
    m.speed *= 0.45;
    m.damage += ev.impact * 0.02;
  }
  nx = col.x;
  nz = col.z;
  // Car-to-car bumps.
  for (const o of others) {
    if (o === m) continue;
    const dx = nx - o.x;
    const dz = nz - o.z;
    const or = o.radius ?? 2;
    const rr = r + or;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    const push = (rr - d) / 2;
    nx += (dx / d) * push;
    nz += (dz / d) * push;
    ev.hitCar = true;
    ev.impact = Math.max(ev.impact, Math.abs(m.speed - (o.speed ?? 0)) * 0.5);
    m.speed *= 0.6;
    m.damage += 0.5;
    if (o.speed !== undefined && o.push) o.push(-(dx / d) * push, -(dz / d) * push);
  }
  m.x = nx;
  m.z = nz;
  if (m.mesh) {
    m.mesh.position.set(m.x, 0, m.z);
    m.mesh.rotation.y = m.heading;
    // Wheel spin + front-wheel steer (visual only).
    const spin = (m.speed * dt) / 0.36;
    for (const w of m.mesh.userData.wheels ?? []) w.rotation.z += spin;
  }
  return ev;
}

// Resolve a bump between the player's car and a traffic/police car.
// Returns the impact speed for wanted/sound.
export function bumpCars(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const d2 = dx * dx + dz * dz;
  const rr = 2.1 + 2.1;
  if (d2 >= rr * rr || d2 < 1e-6) return 0;
  const d = Math.sqrt(d2);
  const push = (rr - d) / 2;
  const ux = dx / d;
  const uz = dz / d;
  a.x += ux * push;
  a.z += uz * push;
  b.x -= ux * push;
  b.z -= uz * push;
  const impact = Math.abs(a.speed - b.speed);
  a.speed *= 0.6;
  b.speed *= 0.6;
  return impact;
}
