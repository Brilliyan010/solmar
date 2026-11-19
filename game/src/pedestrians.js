// SOLMAR — the crowd: pedestrians stroll the pavements, cross roads, flee danger.
import * as THREE from 'three';
import { TUNE } from './config.js';

const SHIRTS = [0xd65a5a, 0x5a8fd6, 0x5ad68a, 0xd6c25a, 0xb45ad6, 0xe8e8e8, 0x333333];

export function runCrowd(scene, city, rng) {
  const peds = [];
  const torsoGeo = new THREE.BoxGeometry(0.7, 1.1, 0.4);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
  const legsGeo = new THREE.BoxGeometry(0.6, 0.8, 0.35);
  for (let i = 0; i < TUNE.crowdCount; i++) {
    const figure = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[i % SHIRTS.length] });
    const torso = new THREE.Mesh(torsoGeo, shirt);
    torso.position.y = 1.15;
    figure.add(torso);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
    head.position.y = 1.95;
    figure.add(head);
    const legs = new THREE.Mesh(legsGeo, new THREE.MeshLambertMaterial({ color: 0x2a2f3a }));
    legs.position.y = 0.4;
    figure.add(legs);
    const spot = city.roadPos(rng);
    const axis = rng.odds(0.5) ? 'x' : 'z';
    figure.position.set(spot.x, 0, spot.z);
    scene.add(figure);
    peds.push({
      mesh: figure,
      x: spot.x,
      z: spot.z,
      axis,
      dir: rng.odds(0.5) ? 1 : -1,
      speed: rng.between(1, 2.2),
      flee: 0,
      side: rng.choose([-7.5, 7.5]),
    });
  }
  function update(dt, ctx) {
    const danger = ctx.dangerPos;
    for (const p of peds) {
      let spooked = false;
      if (danger) {
        const d = Math.hypot(p.x - danger.x, p.z - danger.z);
        if (d < 26) { spooked = true; p.flee = 2.5; }
      }
      if (p.flee > 0) p.flee -= dt;
      const pace = p.speed * (p.flee > 0 || spooked ? 3.2 : 1);
      if (p.axis === 'x') {
        p.x += pace * p.dir * dt;
        if (p.x > 184) { p.x = 184; p.dir = -1; }
        if (p.x < -184) { p.x = -184; p.dir = 1; }
        const road = TUNE.avenues.reduce((a, r) => Math.abs(r - p.z) < Math.abs(a - p.z) ? r : a, TUNE.avenues[0]);
        p.z += (road + p.side - p.z) * Math.min(1, dt);
      } else {
        p.z += pace * p.dir * dt;
        if (p.z > 184) { p.z = 184; p.dir = -1; }
        if (p.z < -184) { p.z = -184; p.dir = 1; }
        const road = TUNE.avenues.reduce((a, r) => Math.abs(r - p.x) < Math.abs(a - p.x) ? r : a, TUNE.avenues[0]);
        p.x += (road + p.side - p.x) * Math.min(1, dt);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.axis === 'x'
        ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
        : (p.dir > 0 ? 0 : Math.PI);
      // A small walking bob.
      p.mesh.position.y = Math.abs(Math.sin((p.x + p.z) * 2.2)) * 0.06;
    }
  }
  return { peds, update };
}
