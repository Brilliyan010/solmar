// driving.js — arcade car physics plus the shared circle-vs-AABB
// collision used by the player, cars and police. No real physics engine:
// speed, steering that tightens at low speed, handbrake drift, and
// push-out collisions against buildings, traffic and pedestrians.
import { CONFIG } from "./config.js";

// Push a circle (x,z,r) out of every AABB it overlaps. Returns the
// corrected position and whether any collision happened.
export function collideCircle(x, z, r, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - c.minX + r;
        const pr = c.maxX - x + r;
        const pt = z - c.minZ + r;
        const pb = c.maxZ - z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.minX - r;
        else if (m === pr) x = c.maxX + r;
        else if (m === pt) z = c.minZ - r;
        else z = c.maxZ + r;
      }
    }
  }
  return [x, z, hit];
}

export function driveCar(car, dt, input, ctx) {
  const def = car.def;
  const k = input.keys;
  const maxSpeed = CONFIG.carMaxSpeed * def.speed;
  const accel = CONFIG.carAccel * def.accel;
  const handbrake = k.has("Space");

  if (k.has("KeyW")) car.speed += accel * dt;
  else if (k.has("KeyS")) {
    if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
    else car.speed -= accel * 0.5 * dt;
  } else {
    // Engine drag.
    car.speed -= car.speed * 0.8 * dt;
  }
  if (handbrake) car.speed -= car.speed * 2.2 * dt;
  car.speed = Math.max(-CONFIG.carReverseSpeed, Math.min(maxSpeed, car.speed));

  // Steering: stronger at low speed, weaker at full speed; handbrake slides.
  const steerInput = (k.has("KeyA") ? -1 : 0) + (k.has("KeyD") ? 1 : 0);
  const steerAmount = steerInput * CONFIG.carTurn * (1 - Math.min(0.55, Math.abs(car.speed) / maxSpeed * 0.55));
  const grip = handbrake ? CONFIG.handbrakeGrip : CONFIG.carGrip;
  car.steer += (steerAmount - car.steer) * Math.min(1, dt * grip);
  const dirSign = car.speed >= 0 ? 1 : -1;
  car.heading += car.steer * (car.speed / maxSpeed) * dt * 2.4 * dirSign * -1;

  let nx = car.x + Math.sin(car.heading) * car.speed * dt;
  let nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // World bounds: bounce softly off the city edge.
  nx = Math.max(-208, Math.min(208, nx));
  nz = Math.max(-208, Math.min(208, nz));

  const [cx, cz, hitWall] = collideCircle(nx, nz, 1.6, ctx.colliders);
  if (hitWall && Math.abs(car.speed) > 4) {
    ctx.onCrash?.(car, Math.abs(car.speed));
    car.speed *= 0.45;
    car.damaged = Math.min(1, car.damaged + Math.abs(car.speed) * 0.004);
  }
  car.x = cx;
  car.z = cz;

  // Bump into traffic cars: push both, damage both.
  for (const o of ctx.trafficCars ?? []) {
    if (o === car) continue;
    const dx = car.x - o.x;
    const dz = car.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      const ux = dx / d;
      const uz = dz / d;
      car.x += ux * push;
      car.z += uz * push;
      o.x -= ux * push;
      o.z -= uz * push;
      if (Math.abs(car.speed) > 6) {
        ctx.onCrash?.(car, Math.abs(car.speed));
        car.speed *= 0.6;
        o.speed *= 0.5;
        car.damaged = Math.min(1, car.damaged + 0.08);
      }
    }
  }

  // Pedestrian hits: knock the ped down, scare the crowd, raise wanted.
  for (const p of ctx.peds ?? []) {
    const dx = car.x - p.x;
    const dz = car.z - p.z;
    if (Math.hypot(dx, dz) < 1.6 && Math.abs(car.speed) > 3) {
      ctx.onHitPed?.(p);
      p.x += (dx || 0.1) * 2;
      p.z += (dz || 0.1) * 2;
      car.speed *= 0.85;
    }
  }

  car.mesh.position.set(car.x, 0, car.z);
  // The model faces -z (headlights at -z); rotate by heading + PI so its
  // nose points along the (sin h, cos h) travel direction.
  car.mesh.rotation.y = car.heading + Math.PI;
  const spin = (car.speed * dt) / 0.34;
  for (const w of car.wheels) w.rotation.x += spin;
  // Front wheels visually steer.
  car.wheels[0].rotation.y = car.steer * 0.35;
  car.wheels[1].rotation.y = car.steer * 0.35;
}

// Third-person chase camera behind a driven car.
export function chaseCamera(car, camera, dt, camYaw, mode) {
  const back = mode === 0 ? 9 : 13;
  const height = mode === 0 ? 3.6 : 5;
  const tx = car.x - Math.sin(car.heading) * back;
  const tz = car.z - Math.cos(car.heading) * back;
  const k = 1 - Math.pow(0.0001, dt); // smooth follow
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(car.x + Math.sin(car.heading) * 6, 1.2, car.z + Math.cos(car.heading) * 6);
}
