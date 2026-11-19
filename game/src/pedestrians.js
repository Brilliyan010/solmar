// SOLMAR — pejalan kaki AI: jalan di trotoar, menyeberang, lari bila ada bahaya.
import * as THREE from 'three';
import { CFG } from './config.js';

const SHIRT = [0xd65a5a, 0x5a8fd6, 0x5ad68a, 0xd6c25a, 0xb45ad6, 0xe8e8e8, 0x333333];

export function createPedestrians(scene, city, rng) {
  const peds = [];
  const bodyGeo = new THREE.BoxGeometry(0.7, 1.1, 0.4);
  const headGeo = new THREE.SphereGeometry(0.32, 8, 8);
  const legGeo = new THREE.BoxGeometry(0.6, 0.8, 0.35);
  for (let i = 0; i < CFG.pedN; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRT[i % SHIRT.length] });
    const body = new THREE.Mesh(bodyGeo, shirt); body.position.y = 1.15; g.add(body);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
    head.position.y = 1.95; g.add(head);
    const legs = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0x2a2f3a }));
    legs.position.y = 0.4; g.add(legs);
    const p = city.roadPos(rng);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    peds.push({
      mesh: g, x: p.x, z: p.z, axis,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(1, 2.2), flee: 0,
      side: rng.pick([-7.5, 7.5]),
    });
  }
  function update(dt, ctx) {
    const danger = ctx.dangerPos;
    for (const p of peds) {
      let run = 0;
      if (danger) {
        const d = Math.hypot(p.x - danger.x, p.z - danger.z);
        if (d < 26) { run = 1; p.flee = 2.5; }
      }
      if (p.flee > 0) p.flee -= dt;
      const sp = p.speed * (p.flee > 0 || run ? 3.2 : 1);
      if (p.axis === 'x') {
        p.x += sp * p.dir * dt;
        if (p.x > 184) { p.x = 184; p.dir = -1; }
        if (p.x < -184) { p.x = -184; p.dir = 1; }
        const road = CFG.roadAt.reduce((a, r) => Math.abs(r - p.z) < Math.abs(a - p.z) ? r : a, CFG.roadAt[0]);
        p.z += (road + p.side - p.z) * Math.min(1, dt);
      } else {
        p.z += sp * p.dir * dt;
        if (p.z > 184) { p.z = 184; p.dir = -1; }
        if (p.z < -184) { p.z = -184; p.dir = 1; }
        const road = CFG.roadAt.reduce((a, r) => Math.abs(r - p.x) < Math.abs(a - p.x) ? r : a, CFG.roadAt[0]);
        p.x += (road + p.side - p.x) * Math.min(1, dt);
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      // Animasi jalan: goyang kecil.
      p.mesh.position.y = Math.abs(Math.sin((p.x + p.z) * 2.2)) * 0.06;
    }
  }
  return { peds, update };
}
