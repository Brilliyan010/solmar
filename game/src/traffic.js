// SOLMAR — traffic AI: mobil mengikuti jalan, berhenti di lampu merah, menghindar.
import * as THREE from 'three';
import { CFG } from './config.js';
import { CARS, createVehicle } from './vehicles.js';

export function createTraffic(scene, city, rng) {
  const cars = [];
  for (let i = 0; i < CFG.trafficN; i++) {
    const def = CARS[rng.int(0, CARS.length - 1)];
    const p = city.roadPos(rng);
    const axis = Math.abs(p.x - CFG.roadAt[0]) < 40 || rng.chance(0.5) ? 'z' : 'x';
    const v = createVehicle(def, p.x, p.z, axis === 'z' ? 0 : Math.PI / 2);
    v.speed = rng.range(8, 14);
    v.dir = rng.chance(0.5) ? 1 : -1;
    v.axis = axis;
    v.lane = rng.pick([-2.5, 2.5]);
    scene.add(v.mesh);
    cars.push(v);
  }
  // Lampu lalu lintas di persimpangan utama.
  const lights = [];
  for (const x of [-93, 31, 93]) for (const z of [-93, 31, 93]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pole.position.set(x + 6, 2.5, z + 6); scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x33ff55 }));
    lamp.position.set(x + 6, 5.2, z + 6); scene.add(lamp);
    lights.push({ x: x + 6, z: z + 6, lamp, t: rng.range(0, 8) });
  }
  let lightClock = 0;
  function update(dt, ctx) {
    lightClock += dt;
    const green = Math.floor(lightClock / 8) % 2 === 0;
    for (const l of lights) l.lamp.material.color.setHex(green ? 0x33ff55 : 0xff3333);
    for (const c of cars) {
      // Lampu merah: berhenti sebelum persimpangan.
      let stop = false;
      if (!green) {
        for (const l of lights) {
          const d = c.axis === 'z'
            ? Math.abs(c.x - (l.x - 6)) < 6 && Math.abs(c.z - l.z) < 14
            : Math.abs(c.z - (l.z - 6)) < 6 && Math.abs(c.x - l.x) < 14;
          if (d) { stop = true; break; }
        }
      }
      // Mobil di depan terlalu dekat: pelan.
      let slow = false;
      for (const o of cars) {
        if (o === c || o.axis !== c.axis) continue;
        const along = c.axis === 'z' ? (o.z - c.z) * c.dir : (o.x - c.x) * c.dir;
        const side = c.axis === 'z' ? Math.abs(o.x - c.x) : Math.abs(o.z - c.z);
        if (along > 0 && along < 9 && side < 4) { slow = true; break; }
      }
      const target = stop ? 0 : slow ? 5 : c.speed;
      c.cur = (c.cur ?? c.speed) + (target - (c.cur ?? c.speed)) * Math.min(1, dt * 2);
      const step = c.cur * dt;
      if (c.axis === 'z') {
        c.z += step * c.dir;
        if (c.z > 185) { c.z = -185; }
        if (c.z < -185) { c.z = 185; }
      } else {
        c.x += step * c.dir;
        if (c.x > 185) { c.x = -185; }
        if (c.x < -185) { c.x = 185; }
      }
      // Jaga di jalurnya (snap halus ke lajur).
      const road = CFG.roadAt.reduce((a, r) => {
        const d = c.axis === 'z' ? Math.abs(r - c.x) : Math.abs(r - c.z);
        const ad = c.axis === 'z' ? Math.abs(a - c.x) : Math.abs(a - c.z);
        return d < ad ? r : a;
      }, CFG.roadAt[0]);
      if (c.axis === 'z') c.x += (road + c.lane - c.x) * Math.min(1, dt * 1.5);
      else c.z += (road + c.lane - c.z) * Math.min(1, dt * 1.5);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.axis === 'z' ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  return { cars, update };
}
