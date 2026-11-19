// SOLMAR — atmosfer hidup: siklus fase hari, hujan, perahu marina, burung camar.
import * as THREE from 'three';
import { CFG } from './config.js';

const PHASES = [
  { name: 'Dawn', sun: 0xffb36b, sunI: 1.1, hemi: 0x8a7a9a, fog: 0xd8a080, sky: 0xe8a06a, lamp: false },
  { name: 'Golden Hour', sun: 0xff9a3d, sunI: 1.6, hemi: 0x9a8a7a, fog: 0xe8b088, sky: 0xf2a35e, lamp: false },
  { name: 'Dusk', sun: 0xff6b4d, sunI: 1.0, hemi: 0x6a5a7a, fog: 0xc07858, sky: 0xd86a4e, lamp: true },
  { name: 'Neon Night', sun: 0x4a5a8a, sunI: 0.35, hemi: 0x2a2a4a, fog: 0x1a2038, sky: 0x141a2e, lamp: true },
];

export function createAtmosphere(scene, city, rng) {
  const sun = new THREE.DirectionalLight(0xff9a3d, 1.6);
  sun.position.set(120, 90, -60);
  scene.add(sun);  const hemi = new THREE.HemisphereLight(0x9a8a7a, 0x5a4a3a, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe8b088, 180, 520);
  scene.background = new THREE.Color(0xf2a35e);
  // Perahu di marina.
  const boats = [];
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 6), hullMat);
    hull.position.y = 0.4; b.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0x666666 }));
    mast.position.y = 3; b.add(mast);
    b.position.set(50 + i * 22, 0.1, 212);
    scene.add(b); boats.push(b);
  }
  // Camar.
  const gulls = [];
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 4), gullMat);
    g.rotation.z = Math.PI / 2;
    scene.add(g);
    gulls.push({ m: g, a: rng.range(0, Math.PI * 2), r: rng.range(30, 80), h: rng.range(24, 40), sp: rng.range(0.1, 0.25) });
  }
  // Hujan: Points.
  const rainGeo = new THREE.BufferGeometry();
  const rainN = 700;
  const rainPos = new Float32Array(rainN * 3);
  for (let i = 0; i < rainN; i++) {
    rainPos[i * 3] = rng.range(-200, 200);
    rainPos[i * 3 + 1] = rng.range(0, 60);
    rainPos[i * 3 + 2] = rng.range(-200, 200);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.55 }));
  rain.visible = false;
  scene.add(rain);
  const at = {
    clock: 18, phase: 1, rain: false, rainT: 40,
    phaseName: 'Golden Hour',
  };
  function applyPhase(i) {
    const ph = PHASES[i];
    at.phaseName = ph.name;
    sun.color.setHex(ph.sun);
    sun.intensity = ph.sunI;
    hemi.color.setHex(ph.hemi);
    scene.fog.color.setHex(ph.fog);
    scene.background.setHex(ph.sky);
    for (const l of city.lamps) l.material.color.setHex(ph.lamp ? 0xffe9a8 : 0x555555);
    for (const s of city.neonSigns) s.material.color.setHex(ph.lamp ? (s.userData.c ?? 0xff2fb3) : 0x883344);
  }
  // Simpan warna neon asli (applyPhase men-dim-kan di siang hari).
  for (const s of city.neonSigns) s.userData.c = s.material.color.getHex();
  function update(dt, ctx) {
    at.clock += (dt * 24) / CFG.dayLength;
    if (at.clock >= 24) at.clock -= 24;
    // Fase dari jam: 5-9 dawn, 9-17 golden, 17-20 dusk, 20-5 night.
    const h = at.clock;
    const want = h >= 5 && h < 9 ? 0 : h >= 9 && h < 17 ? 1 : h >= 17 && h < 20 ? 2 : 3;
    if (want !== at.phase) { at.phase = want; applyPhase(want); }
    // Hujan: ganti tiap ~40 detik dengan peluang.
    at.rainT -= dt;
    if (at.rainT <= 0) {
      at.rainT = 40;
      at.rain = Math.random() < CFG.rainChance;
      rain.visible = at.rain;
      ctx.rain = at.rain;
      if (at.rain) ctx.hud?.toast('Rain — roads are slippery!');
    }
    if (at.rain) {
      const pos = rainGeo.attributes.position;
      for (let i = 0; i < rainN; i++) {
        let y = pos.getY(i) - dt * 55;
        if (y < 0) y = 60;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
    // Perahu bergoyang + camar melayang.
    const t = performance.now() / 1000;
    boats.forEach((b, i) => { b.position.y = 0.1 + Math.sin(t * 0.8 + i * 1.7) * 0.15; b.rotation.z = Math.sin(t * 0.6 + i) * 0.03; });
    for (const g of gulls) {
      g.a += g.sp * dt;
      g.m.position.set(Math.sin(g.a) * g.r, g.h + Math.sin(t + g.r) * 2, 180 + Math.cos(g.a) * g.r * 0.4);
      g.m.rotation.y = -g.a;
    }
    // Beacon Spire berkedip.
    city.beacon.material.color.setHex(Math.floor(t * 1.5) % 2 ? 0xff2222 : 0x881111);
  }
  applyPhase(1);
  at.update = update;
  return at;
}
