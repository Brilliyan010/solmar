// SOLMAR — kota pesisir prosedural: grid jalan, gedung, landmark, pelabuhan, pantai.
import * as THREE from 'three';
import { CFG } from './config.js';

function textTex(text, bg, fg, w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = `bold ${h * 0.55}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTex(base, lit) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) for (let x = 6; x < 58; x += 14) {
    g.fillStyle = Math.random() < 0.45 ? lit : '#20242c';
    g.fillRect(x, y, 9, 11);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const R = CFG.roadAt, B = CFG.bound;
  const footprints = [];
  const group = new THREE.Group();
  scene.add(group);

  // Tanah + laut + pantai.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520),
    new THREE.MeshLambertMaterial({ color: 0x8f8578 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 20); group.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 120),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8e }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, 260); group.add(sea);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(520, 22),
    new THREE.MeshLambertMaterial({ color: 0xe0c98f }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.01, 197); group.add(beach);

  // Jalan (aspal) + trotoar.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x7d7468 });
  for (const x of R) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, B * 2 + 30), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, 0); group.add(r);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW + 6, B * 2 + 30), walkMat);
    w.rotation.x = -Math.PI / 2; w.position.set(x, 0.015, 0); group.add(w);
  }
  for (const z of R) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(B * 2 + 30, CFG.roadW), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.03, z); group.add(r);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(B * 2 + 30, CFG.roadW + 6), walkMat);
    w.rotation.x = -Math.PI / 2; w.position.set(0, 0.015, z); group.add(w);
  }
  // Garis tengah jalan.
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  for (const x of R) for (let z = -180; z < 180; z += 12) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
    d.rotation.x = -Math.PI / 2; d.position.set(x, 0.05, z); group.add(d);
  }

  // Gedung: blok di antara jalan. Interval blok:
  const edges = [-B, ...R, B];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const winMats = [
    new THREE.MeshLambertMaterial({ map: windowTex('#5a5148', '#ffd27a'), emissive: 0x332211, emissiveMap: windowTex('#000000', '#ffca6a') }),
    new THREE.MeshLambertMaterial({ map: windowTex('#4a5a66', '#9fd8ff'), emissive: 0x112233, emissiveMap: windowTex('#000000', '#7ec8ff') }),
    new THREE.MeshLambertMaterial({ map: windowTex('#6b4a3a', '#ffb08a'), emissive: 0x221111, emissiveMap: windowTex('#000000', '#ff9a6a') }),
  ];
  // Blok khusus: Voss Auto yard, Old Port, marina, taman.
  const special = (cx, cz) => {
    if (cx > -31 && cx < 31 && cz > 93 && cz < 155) return 'voss';
    if (cx < -155) return 'port';
    if (cz > 155 && cx > 31) return 'marina';
    if (Math.abs(cx + 124) < 1 && Math.abs(cz - 124) < 1) return 'park';
    if (Math.abs(cx + 62) < 1 && Math.abs(cz + 62) < 1) return 'spire';
    return null;
  };
  const buildings = [];
  for (let i = 0; i < edges.length - 1; i++) for (let j = 0; j < edges.length - 1; j++) {
    const x0 = edges[i] + 8, x1 = edges[i + 1] - 8, z0 = edges[j] + 8, z1 = edges[j + 1] - 8;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sp = special(cx, cz);
    if (sp === 'voss' || sp === 'port' || sp === 'marina' || sp === 'park' || sp === 'spire') continue;
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const w = rng.range(10, Math.max(12, (x1 - x0) / n - 4));
      const d = rng.range(10, Math.max(12, (z1 - z0) - 4));
      const h = rng.range(8, 42);
      const bx = rng.range(x0 + w / 2, x1 - w / 2), bz = rng.range(z0 + d / 2, z1 - d / 2);
      const m = new THREE.Mesh(boxGeo, winMats[rng.int(0, 2)]);
      m.scale.set(w, h, d); m.position.set(bx, h / 2, bz);
      group.add(m); buildings.push(m);
      footprints.push({ x0: bx - w / 2, x1: bx + w / 2, z0: bz - d / 2, z1: bz + d / 2 });
      // Unit AC di atap.
      const ac = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x888888 }));
      ac.scale.set(2, 1, 2); ac.position.set(bx, h + 0.5, bz); group.add(ac);
    }
  }

  // Solmar Spire (menara landmark + beacon merah).
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 90, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a4a5a, emissive: 0x111111 }));
  spire.position.set(-62, 45, -62); group.add(spire);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(-62, 91, -62); beacon.name = 'beacon'; group.add(beacon);

  // Old Port: kontainer + crane.
  const contCols = [0xc23b2e, 0x2e6fc2, 0x3fae5a, 0xd8a02e];
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contCols[i % 4] }));
    const cx = rng.range(-182, -160), cz = rng.range(-180, 180);
    const h = rng.chance(0.4) ? 5.4 : 2.7;
    c.scale.set(6, h, 2.6); c.position.set(cx, h / 2, cz);
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    group.add(c);
    footprints.push({ x0: cx - 3.5, x1: cx + 3.5, z0: cz - 3.5, z1: cz + 3.5 });
  }
  for (const cz of [-90, 60]) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd8a02e }));
    leg.scale.set(3, 34, 3); leg.position.y = 17; crane.add(leg);
    const jib = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd8a02e }));
    jib.scale.set(26, 2, 2); jib.position.set(8, 33, 0); crane.add(jib);
    crane.position.set(-172, 0, cz); group.add(crane);
  }

  // Marina: dermaga kayu.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  for (let i = 0; i < 5; i++) {
    const dock = new THREE.Mesh(boxGeo, dockMat);
    dock.scale.set(4, 0.6, 26); dock.position.set(50 + i * 22, 0.4, 196); group.add(dock);
  }

  // Voss Auto: bengkel + papan nama + yard.
  const voss = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2f4a6b }));
  voss.scale.set(34, 9, 14); voss.position.set(0, 4.5, 100); group.add(voss);
  footprints.push({ x0: -17, x1: 17, z0: 93, z1: 107 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5),
    new THREE.MeshBasicMaterial({ map: textTex('VOSS AUTO', '#123a5c', '#ffd27a', 512, 128) }));
  sign.position.set(0, 8.5, 92.8); sign.rotation.y = Math.PI; group.add(sign);
  // Spray Shack + Ironworks.
  const spray = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc22e8a }));
  spray.scale.set(12, 6, 10); spray.position.set(40, 3, -40); group.add(spray);
  footprints.push({ x0: 34, x1: 46, z0: -45, z1: -35 });
  const spraySign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: textTex('SPRAY SHACK', '#40102e', '#ff7ad9', 512, 128) }));
  spraySign.position.set(40, 6.5, -34.8); group.add(spraySign);
  const iron = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x4a4a52 }));
  iron.scale.set(12, 6, 10); iron.position.set(-40, 3, 40); group.add(iron);
  footprints.push({ x0: -46, x1: -34, z0: 35, z1: 45 });
  const ironSign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3),
    new THREE.MeshBasicMaterial({ map: textTex('IRONWORKS', '#22222a', '#e8e8e8', 512, 128) }));
  ironSign.position.set(-40, 6.5, 34.8); ironSign.rotation.y = Math.PI; group.add(ironSign);

  // Neon Strip: papan neon di jalan x=93.
  const neonCols = [0xff2fb3, 0x2ee6ff, 0xffe14d, 0x7cff5a];
  const neonSigns = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(6, 12), rng.range(2, 4)),
      new THREE.MeshBasicMaterial({ color: neonCols[i % 4] }));
    const z = -28 + i * 6.2;
    s.position.set(93 + (i % 2 ? 8 : -8), rng.range(6, 12), z);
    s.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
    s.name = 'neon'; group.add(s); neonSigns.push(s);
  }

  // Palm + lampu jalan.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 46; i++) {
    const x = rng.pick(R) + rng.pick([-9, 9]), z = rng.range(-180, 180);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z); group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.4, 7), leafMat);
    leaves.position.set(x, 8.2, z); group.add(leaves);
  }
  const lamps = [];
  for (const x of R) for (let z = -170; z <= 170; z += 34) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x333333 }));
    pole.position.set(x + 7, 3.5, z); group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lampMat);
    bulb.position.set(x + 7, 7.1, z); bulb.name = 'lamp'; group.add(bulb); lamps.push(bulb);
  }

  // Taman: pohon + bangku di blok park.
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(rng.range(2, 3.4), 8, 8), leafMat);
    t.position.set(rng.range(-150, -100), 3, rng.range(100, 148)); group.add(t);
  }

  function blocked(x, z, r = 0.8) {
    if (Math.abs(x) > B + 8 || z < -B - 8 || z > 208) return true;
    for (const f of footprints) {
      if (x > f.x0 - r && x < f.x1 + r && z > f.z0 - r && z < f.z1 + r) return true;
    }
    return false;
  }
  function onRoad(x, z) {
    for (const r of R) if (Math.abs(x - r) < CFG.roadW / 2 + 1 || Math.abs(z - r) < CFG.roadW / 2 + 1) return true;
    return false;
  }
  function roadPos(rng2) {
    const rx = rng2.pick(R), rz = rng2.range(-175, 175);
    return rng2.chance(0.5) ? { x: rx, z: rz } : { x: rng2.range(-175, 175), z: rx };
  }
  return {
    group, buildings, footprints, blocked, onRoad, roadPos,
    neonSigns, lamps, beacon,
    landmarks: {
      spire: { x: -62, z: -62 }, port: { x: -172, z: 0 }, marina: { x: 94, z: 196 },
      neonStrip: { x: 93, z: 0 }, vossAuto: { x: 0, z: 124 }, sprayShack: { x: 40, z: -40 },
      ironworks: { x: -40, z: 40 }, beach: { x: 60, z: 200 }, park: { x: -124, z: 124 },
    },
  };
}
