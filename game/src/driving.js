// SOLMAR — mengemudi arcade: gas/rem/belok, handbrake drift, nitro, tabrakan.
import { CFG } from './config.js';

export function createDriving(ctx) {
  const d = { vehicle: null };
  function enter(v) {
    d.vehicle = v;
    ctx.player.mesh.visible = false;
    ctx.audio?.sting('enter');
    return true;
  }
  function exit() {
    if (!d.vehicle) return;
    const v = d.vehicle;
    d.vehicle = null;
    const p = ctx.player;
    p.mesh.visible = true;
    p.x = v.x + Math.sin(v.angle + Math.PI / 2) * 2.5;
    p.z = v.z + Math.cos(v.angle + Math.PI / 2) * 2.5;
    p.mesh.position.set(p.x, 0, p.z);
  }
  function nearestParked(maxD = 4) {
    let best = null, bd = maxD;
    for (const v of ctx.parked) {
      const dist = Math.hypot(v.x - ctx.player.x, v.z - ctx.player.z);
      if (dist < bd) { bd = dist; best = v; }
    }
    return best;
  }
  function update(dt, input) {
    const v = d.vehicle;
    if (!v) return;
    const up = ctx.upgrades;
    const topMul = up?.has('c_engine') ? 1.25 : 1;
    const accMul = up?.has('c_engine') ? 1.2 : 1;
    const grip = v.def.grip * (up?.has('c_grip') ? 1.3 : 1) * (ctx.rain ? 0.75 : 1);
    const top = v.def.top * topMul;
    if (input.w) v.speed += v.def.accel * accMul * dt;
    else if (input.s) v.speed -= v.def.accel * 1.4 * dt;
    else v.speed -= Math.sign(v.speed) * 6 * dt;
    if (input.space) v.speed -= Math.sign(v.speed) * 26 * dt; // handbrake
    // Nitro (Shift di mobil).
    if (input.shift && up?.has('c_nitro') && v.nitro > 0 && v.speed > 5) {
      v.speed += 18 * dt; v.nitro -= 30 * dt;
      ctx.effects?.dust(v.x, v.z);
    } else v.nitro = Math.min(100, v.nitro + 4 * dt);
    v.speed = Math.max(-top * 0.45, Math.min(top, v.speed));
    if (Math.abs(v.speed) < 0.15) v.speed = 0;
    const steer = (input.a ? 1 : 0) - (input.d ? 1 : 0);
    if (v.speed !== 0) {
      const dir = v.speed > 0 ? 1 : -1;
      v.angle += steer * grip * 0.55 * dir * dt * Math.min(1, Math.abs(v.speed) / 12);
    }
    const nx = v.x + Math.sin(v.angle) * v.speed * dt;
    const nz = v.z + Math.cos(v.angle) * v.speed * dt;
    // Tabrakan gedung: geser sepanjang sumbu yang bebas, rusak bila keras.
    const hitX = ctx.city.blocked(nx, v.z, 1.6);
    const hitZ = ctx.city.blocked(v.x, nz, 1.6);
    if (hitX || hitZ) {
      const impact = Math.abs(v.speed);
      if (impact > 12) {
        v.damage += impact * 0.6;
        ctx.effects?.smoke(v.x, v.z);
        ctx.audio?.crash();
        if (ctx.police && impact > 18) ctx.police.addHeat(1, 'crash');
        if (v.damage > 100) { v.speed = 0; }
      }
      if (!hitX) v.x = nx;
      if (!hitZ) v.z = nz;
      v.speed *= 0.45;
    } else { v.x = nx; v.z = nz; }
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.angle;
    v.mesh.rotation.z = -steer * Math.min(0.12, Math.abs(v.speed) * 0.004);
    // Kamera mengikuti dari belakang mobil — game.js membaca d.vehicle.
    ctx.audio?.engine(Math.abs(v.speed) / top);
  }
  d.enter = enter; d.exit = exit; d.update = update; d.nearestParked = nearestParked;
  return d;
}
