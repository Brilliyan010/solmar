// SOLMAR — wanted 5 bintang: patroli, kejar-kejaran, roadblock ★3+, heli ★5.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createVehicle, CARS } from './vehicles.js';

export function createPolice(scene, city, rng) {
  const copDef = { key: 'cop', name: 'Cruiser', color: 0x1a1a1a, top: 40, accel: 20, grip: 3, price: 0 };
  const units = [];
  const heli = { mesh: null, angle: 0 };
  const p = { wanted: 0, hidden: 0, roadblocks: [] };
  function spawnCop(x, z) {
    const v = createVehicle(copDef, x, z, 0);
    // Lampu polisi: strip merah-biru di atap.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    bar.position.set(0, 1.7, -0.2); bar.name = 'copbar'; v.mesh.add(bar);
    scene.add(v.mesh);
    units.push({ v, state: 'chase', ram: 0 });
    return v;
  }
  function spawnRoadblock(x, z, angle) {
    const g = new THREE.Group();
    for (let i = -1; i <= 1; i++) {
      const c = createVehicle(copDef, x + Math.cos(angle) * i * 5, z + Math.sin(angle) * i * 5, angle);
      scene.add(c.mesh); g.add(c.mesh);
      units.push({ v: c, state: 'block', ram: 0 });
    }
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xff7722 });
    for (let i = -2; i <= 2; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), coneMat);
      cone.position.set(x + Math.cos(angle + Math.PI / 2) * i * 3, 0.55, z + Math.sin(angle + Math.PI / 2) * i * 3);
      scene.add(cone); g.add(cone);
    }
    p.roadblocks.push(g);
    return g;
  }
  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x222831 }));
    body.position.y = 0; g.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 0.9; rotor.name = 'rotor'; g.add(rotor);
    const spot = new THREE.Mesh(new THREE.ConeGeometry(6, 24, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    spot.position.y = -12; g.add(spot);
    g.position.set(0, 34, 0);
    scene.add(g);
    heli.mesh = g;
  }
  function addHeat(n, why) {
    if (p.wanted >= 5) return;
    p.wanted = Math.min(5, p.wanted + n);
    p.hidden = 0;
    if (why) p.lastWhy = why;
  }
  function update(dt, ctx) {
    const px = ctx.player.x, pz = ctx.player.z;
    // Jumlah unit aktif mengikuti bintang.
    const want = p.wanted === 0 ? 0 : p.wanted === 1 ? 1 : p.wanted === 2 ? 2 : p.wanted === 3 ? 3 : p.wanted === 4 ? 4 : 5;
    while (units.length < want) {
      const a = rng.range(0, Math.PI * 2);
      spawnCop(px + Math.sin(a) * 55, pz + Math.cos(a) * 55);
    }
    while (units.length > want) {
      const u = units.pop();
      scene.remove(u.v.mesh);
    }
    // Roadblock di ★3+: satu di depan arah laju pemain.
    if (p.wanted >= 3 && p.roadblocks.length === 0 && ctx.driving.vehicle) {
      const v = ctx.driving.vehicle;
      spawnRoadblock(v.x + Math.sin(v.angle) * 46, v.z + Math.cos(v.angle) * 46, v.angle + Math.PI / 2);
      ctx.hud?.toast('ROADBLOCK AHEAD — find another way!');
    }
    if (p.wanted < 3) {
      for (const g of p.roadblocks) scene.remove(g);
      p.roadblocks = [];
    }
    // Helikopter di ★5.
    if (p.wanted >= 5 && !heli.mesh) { makeHeli(); ctx.audio?.siren(true); }
    if (p.wanted < 5 && heli.mesh) { scene.remove(heli.mesh); heli.mesh = null; ctx.audio?.siren(false); }
    if (heli.mesh) {
      heli.angle += dt * 0.5;
      heli.mesh.position.set(px + Math.sin(heli.angle) * 16, 34, pz + Math.cos(heli.angle) * 16);
      heli.mesh.rotation.y = heli.angle;
      const rotor = heli.mesh.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
    }
    // Unit mengejar: kejar posisi pemain, ram bila dekat.
    let nearest = 1e9;
    for (const u of units) {
      const v = u.v;
      const dx = px - v.x, dz = pz - v.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      if (u.state === 'block') continue;
      const wantAngle = Math.atan2(dx, dz);
      let da = wantAngle - v.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      v.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, da));
      const sp = p.wanted >= 4 ? 38 : 32;
      v.speed += (sp - v.speed) * Math.min(1, dt);
      const nx = v.x + Math.sin(v.angle) * v.speed * dt;
      const nz = v.z + Math.cos(v.angle) * v.speed * dt;
      if (!city.blocked(nx, nz, 1.6)) { v.x = nx; v.z = nz; }
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.angle;
      const bar = v.mesh.getObjectByName('copbar');
      if (bar) bar.material.color.setHex(Math.floor(performance.now() / 200) % 2 ? 0xff2233 : 0x2266ff);
      // Ram: tabrak pemain / mobil pemain.
      if (dist < 3.4) {
        u.ram += dt;
        if (u.ram > 0.5) {
          u.ram = 0;
          if (ctx.driving.vehicle) {
            ctx.driving.vehicle.damage += 6;
            ctx.effects?.smoke(px, pz);
            ctx.audio?.crash();
          } else if (ctx.player.hurt(8)) ctx.onBusted?.();
        }
      }
    }
    // Busted: polisi menyentuh Mara jalan kaki di wanted ≥1.
    if (p.wanted > 0 && !ctx.driving.vehicle && nearest < 2.2) {
      ctx.onBusted?.();
    }
    // Decay: sembunyi 20 detik (tidak ada polisi dalam 40 unit).
    if (p.wanted > 0 && nearest > 40) {
      p.hidden += dt;
      const need = CFG.heatDecay * (ctx.upgrades?.relicPerk('cooldown') ? 0.5 : 1);
      if (p.hidden > need) { p.wanted--; p.hidden = 0; if (p.wanted === 0) ctx.hud?.toast('You lost the cops.'); }
    } else p.hidden = 0;
  }
  p.units = units; p.addHeat = addHeat; p.update = update;
  return p;
}
