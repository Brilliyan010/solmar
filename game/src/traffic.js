// SOLMAR — traffic AI: cars cruise the avenues, stop at red lights, keep distance.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { CAR_DEFS, spawnVehicle } from './vehicles.js';

export function runTraffic(scene, city, rng) {
  const cars = [];
  for (let i = 0; i < TUNE.trafficCount; i++) {
    const def = CAR_DEFS[rng.whole(0, CAR_DEFS.length - 1)];
    const spot = city.roadPos(rng);
    const axis = Math.abs(spot.x - TUNE.avenues[0]) < 40 || rng.odds(0.5) ? 'z' : 'x';
    const v = spawnVehicle(def, spot.x, spot.z, axis === 'z' ? 0 : Math.PI / 2);
    v.speed = rng.between(8, 14);
    v.dir = rng.odds(0.5) ? 1 : -1;
    v.axis = axis;
    v.lane = rng.choose([-2.5, 2.5]);
    scene.add(v.mesh);
    cars.push(v);
  }
  // Traffic lights at the big intersections.
  const lights = [];
  for (const x of [-93, 31, 93]) {
    for (const z of [-93, 31, 93]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 5, 6),
        new THREE.MeshLambertMaterial({ color: 0x222222 }),
      );
      pole.position.set(x + 6, 2.5, z + 6);
      scene.add(pole);
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x33ff55 }),
      );
      lamp.position.set(x + 6, 5.2, z + 6);
      scene.add(lamp);
      lights.push({ x: x + 6, z: z + 6, lamp, t: rng.between(0, 8) });
    }
  }
  let lightClock = 0;
  function update(dt, ctx) {
    lightClock += dt;
    const green = Math.floor(lightClock / 8) % 2 === 0;
    for (const l of lights) l.lamp.material.color.setHex(green ? 0x33ff55 : 0xff3333);
    for (const c of cars) {
      // Red light: stop short of the crossing.
      let stop = false;
      if (!green) {
        for (const l of lights) {
          const near = c.axis === 'z'
            ? Math.abs(c.x - (l.x - 6)) < 6 && Math.abs(c.z - l.z) < 14
            : Math.abs(c.z - (l.z - 6)) < 6 && Math.abs(c.x - l.x) < 14;
          if (near) { stop = true; break; }
        }
      }
      // A car ahead too close: ease off.
      let slow = false;
      for (const o of cars) {
        if (o === c || o.axis !== c.axis) continue;
        const ahead = c.axis === 'z' ? (o.z - c.z) * c.dir : (o.x - c.x) * c.dir;
        const side = c.axis === 'z' ? Math.abs(o.x - c.x) : Math.abs(o.z - c.z);
        if (ahead > 0 && ahead < 9 && side < 4) { slow = true; break; }
      }
      const target = stop ? 0 : slow ? 5 : c.speed;
      c.cur = (c.cur ?? c.speed) + (target - (c.cur ?? c.speed)) * Math.min(1, dt * 2);
      const step = c.cur * dt;
      if (c.axis === 'z') {
        c.z += step * c.dir;
        if (c.z > 185) c.z = -185;
        if (c.z < -185) c.z = 185;
      } else {
        c.x += step * c.dir;
        if (c.x > 185) c.x = -185;
        if (c.x < -185) c.x = 185;
      }
      // Drift gently back onto the lane.
      const road = TUNE.avenues.reduce((a, r) => {
        const d = c.axis === 'z' ? Math.abs(r - c.x) : Math.abs(r - c.z);
        const ad = c.axis === 'z' ? Math.abs(a - c.x) : Math.abs(a - c.z);
        return d < ad ? r : a;
      }, TUNE.avenues[0]);
      if (c.axis === 'z') c.x += (road + c.lane - c.x) * Math.min(1, dt * 1.5);
      else c.z += (road + c.lane - c.z) * Math.min(1, dt * 1.5);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.axis === 'z'
        ? (c.dir > 0 ? 0 : Math.PI)
        : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
  return { cars, update };
}
