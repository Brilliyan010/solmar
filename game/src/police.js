// SOLMAR — a five-star wanted level: patrols, pursuits, a roadblock at
// 3+ stars, and the helicopter at 5. Hide out of sight long enough and
// the heat cools off one star at a time.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { spawnVehicle } from './vehicles.js';

export function runPolice(scene, city, rng) {
  const cruiserDef = { key: 'cop', name: 'Cruiser', color: 0x1a1a1a, top: 40, accel: 20, grip: 3, price: 0 };
  const units = [];
  const heli = { mesh: null, angle: 0 };
  const p = { wanted: 0, hidden: 0, roadblocks: [] };

  function spawnCruiser(x, z) {
    const v = spawnVehicle(cruiserDef, x, z, 0);
    // Red-and-blue light bar on the roof.
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    );
    bar.position.set(0, 1.7, -0.2);
    bar.name = 'copbar';
    v.mesh.add(bar);
    scene.add(v.mesh);
    units.push({ v, state: 'chase', ram: 0 });
    return v;
  }

  // Three cruisers across the road plus a row of cones.
  function spawnRoadblock(x, z, angle) {
    const block = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const c = spawnVehicle(cruiserDef, x + Math.cos(angle) * i * 5, z + Math.sin(angle) * i * 5, angle);
      scene.add(c.mesh);
      block.add(c.mesh);
      units.push({ v: c, state: 'block', ram: 0 });
    }
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xff7722 });
    for (let i = -2; i <= 2; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), coneMat);
      cone.position.set(
        x + Math.cos(angle + Math.PI / 2) * i * 3,
        0.55,
        z + Math.sin(angle + Math.PI / 2) * i * 3,
      );
      scene.add(cone);
      block.add(cone);
    }
    p.roadblocks.push(block);
    return block;
  }

  function makeHeli() {
    const craft = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.2, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x222831 }),
    );
    craft.add(body);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    rotor.position.y = 0.9;
    rotor.name = 'rotor';
    craft.add(rotor);
    // The searchlight cone under the helicopter.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(6, 24, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    beam.position.y = -12;
    craft.add(beam);
    craft.position.set(0, 34, 0);
    scene.add(craft);
    heli.mesh = craft;
  }

  // Add heat (clamped at 5 stars) and reset the hideout timer.
  function addHeat(n, why) {
    if (p.wanted >= 5) return;
    p.wanted = Math.min(5, p.wanted + n);
    p.hidden = 0;
    if (why) p.lastWhy = why;
  }

  function update(dt, ctx) {
    const px = ctx.player.x;
    const pz = ctx.player.z;
    // The active unit count follows the star count.
    const want = p.wanted === 0 ? 0 : p.wanted;
    while (units.length < want) {
      const a = rng.between(0, Math.PI * 2);
      spawnCruiser(px + Math.sin(a) * 55, pz + Math.cos(a) * 55);
    }
    while (units.length > want) {
      const u = units.pop();
      scene.remove(u.v.mesh);
    }
    // At 3+ stars, one roadblock ahead of the player's direction of travel.
    if (p.wanted >= 3 && p.roadblocks.length === 0 && ctx.driving.vehicle) {
      const v = ctx.driving.vehicle;
      spawnRoadblock(v.x + Math.sin(v.angle) * 46, v.z + Math.cos(v.angle) * 46, v.angle + Math.PI / 2);
      ctx.hud?.toast('ROADBLOCK AHEAD — find another way!');
    }
    if (p.wanted < 3) {
      for (const g of p.roadblocks) scene.remove(g);
      p.roadblocks = [];
    }
    // The helicopter only flies at five stars.
    if (p.wanted >= 5 && !heli.mesh) {
      makeHeli();
      ctx.audio?.siren(true);
    }
    if (p.wanted < 5 && heli.mesh) {
      scene.remove(heli.mesh);
      heli.mesh = null;
      ctx.audio?.siren(false);
    }
    if (heli.mesh) {
      heli.angle += dt * 0.5;
      heli.mesh.position.set(px + Math.sin(heli.angle) * 16, 34, pz + Math.cos(heli.angle) * 16);
      heli.mesh.rotation.y = heli.angle;
      const rotor = heli.mesh.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
    }
    // Every unit hunts the player and rams on contact.
    let nearest = 1e9;
    for (const u of units) {
      const v = u.v;
      const dx = px - v.x;
      const dz = pz - v.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      if (u.state === 'block') continue;
      const wantAngle = Math.atan2(dx, dz);
      let da = wantAngle - v.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      v.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, da));
      const chaseSpeed = p.wanted >= 4 ? 38 : 32;
      v.speed += (chaseSpeed - v.speed) * Math.min(1, dt);
      const nx = v.x + Math.sin(v.angle) * v.speed * dt;
      const nz = v.z + Math.cos(v.angle) * v.speed * dt;
      if (!city.blocked(nx, nz, 1.6)) {
        v.x = nx;
        v.z = nz;
      }
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.angle;
      // The light bar strobes red and blue.
      const bar = v.mesh.getObjectByName('copbar');
      if (bar) bar.material.color.setHex(Math.floor(performance.now() / 200) % 2 ? 0xff2233 : 0x2266ff);
      // Ram: shove the player's car, or hurt Mara on foot.
      if (dist < 3.4) {
        u.ram += dt;
        if (u.ram > 0.5) {
          u.ram = 0;
          if (ctx.driving.vehicle) {
            ctx.driving.vehicle.damage += 6;
            ctx.effects?.smoke(px, pz);
            ctx.audio?.crash();
          } else if (ctx.player.hurt(8)) {
            ctx.onBusted?.();
          }
        }
      }
    }
    // Busted: a cop touches Mara on foot while she is wanted.
    if (p.wanted > 0 && !ctx.driving.vehicle && nearest < 2.2) {
      ctx.onBusted?.();
    }
    // Cooling off: stay unseen (no cop within 40) for the hideout time.
    if (p.wanted > 0 && nearest > 40) {
      p.hidden += dt;
      const need = TUNE.hideoutSeconds * (ctx.upgrades?.relicPerk('cooldown') ? 0.5 : 1);
      if (p.hidden > need) {
        p.wanted--;
        p.hidden = 0;
        if (p.wanted === 0) ctx.hud?.toast('You lost the cops.');
      }
    } else {
      p.hidden = 0;
    }
  }

  p.units = units;
  p.addHeat = addHeat;
  p.update = update;
  return p;
}
