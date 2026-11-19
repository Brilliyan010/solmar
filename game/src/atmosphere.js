// SOLMAR — a living sky: four day phases, rain, marina boats, gulls, moon.
import * as THREE from 'three';
import { TUNE } from './config.js';

// Dawn, Golden Hour, Dusk, Neon Night — each with its own sun, sky, and
// whether the lamps and neon boards are lit.
const DAY_PHASES = [
  { name: 'Dawn', sun: 0xffb36b, sunI: 1.1, hemi: 0x8a7a9a, fog: 0xd8a080, sky: 0xe8a06a, lamp: false },
  { name: 'Golden Hour', sun: 0xff9a3d, sunI: 1.6, hemi: 0x9a8a7a, fog: 0xe8b088, sky: 0xf2a35e, lamp: false },
  { name: 'Dusk', sun: 0xff6b4d, sunI: 1.0, hemi: 0x6a5a7a, fog: 0xc07858, sky: 0xd86a4e, lamp: true },
  { name: 'Neon Night', sun: 0x4a5a8a, sunI: 0.35, hemi: 0x2a2a4a, fog: 0x1a2038, sky: 0x141a2e, lamp: true },
];

export function runSky(scene, city, rng) {
  const sun = new THREE.DirectionalLight(0xff9a3d, 1.6);
  sun.position.set(120, 90, -60);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0x9a8a7a, 0x5a4a3a, 0.9);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xe8b088, 180, 520);
  scene.background = new THREE.Color(0xf2a35e);

  // A pale moon that only shows at night.
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(9, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8ecf4 }),
  );
  moon.position.set(-160, 120, -260);
  moon.visible = false;
  scene.add(moon);

  // Boats moored in the marina.
  const boats = [];
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
  for (let i = 0; i < 4; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 6), hullMat);
    hull.position.y = 0.4;
    boat.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0x666666 }),
    );
    mast.position.y = 3;
    boat.add(mast);
    boat.position.set(50 + i * 22, 0.1, 212);
    scene.add(boat);
    boats.push(boat);
  }

  // Gulls circling over the beach.
  const gulls = [];
  const gullMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 6; i++) {
    const gull = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 4), gullMat);
    gull.rotation.z = Math.PI / 2;
    scene.add(gull);
    gulls.push({
      m: gull,
      a: rng.between(0, Math.PI * 2),
      r: rng.between(30, 80),
      h: rng.between(24, 40),
      sp: rng.between(0.1, 0.25),
    });
  }

  // Rain: one Points cloud, hidden until the weather turns.
  const rainGeo = new THREE.BufferGeometry();
  const rainN = 700;
  const rainPos = new Float32Array(rainN * 3);
  for (let i = 0; i < rainN; i++) {
    rainPos[i * 3] = rng.between(-200, 200);
    rainPos[i * 3 + 1] = rng.between(0, 60);
    rainPos[i * 3 + 2] = rng.between(-200, 200);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.55 }),
  );
  rain.visible = false;
  scene.add(rain);

  const at = {
    clock: 18,
    phase: 1,
    rain: false,
    rainT: 40,
    phaseName: 'Golden Hour',
  };

  function applyPhase(i) {
    const ph = DAY_PHASES[i];
    at.phaseName = ph.name;
    sun.color.setHex(ph.sun);
    sun.intensity = ph.sunI;
    hemi.color.setHex(ph.hemi);
    scene.fog.color.setHex(ph.fog);
    scene.background.setHex(ph.sky);
    moon.visible = i === 3;
    for (const l of city.lamps) l.material.color.setHex(ph.lamp ? 0xffe9a8 : 0x555555);
    for (const s of city.neonSigns) {
      s.material.color.setHex(ph.lamp ? (s.userData.c ?? 0xff2fb3) : 0x883344);
    }
    if (city.lighthouseLamp) {
      city.lighthouseLamp.material.color.setHex(ph.lamp ? 0xffe9a8 : 0x8a7a5a);
    }
  }

  // Remember each neon board's true color (daylight dims them).
  for (const s of city.neonSigns) s.userData.c = s.material.color.getHex();

  function update(dt, ctx) {
    at.clock += (dt * 24) / TUNE.daySeconds;
    if (at.clock >= 24) at.clock -= 24;
    // Phases by the hour: 5–9 dawn, 9–17 golden, 17–20 dusk, 20–5 night.
    const h = at.clock;
    const want = h >= 5 && h < 9 ? 0 : h >= 9 && h < 17 ? 1 : h >= 17 && h < 20 ? 2 : 3;
    if (want !== at.phase) {
      at.phase = want;
      applyPhase(want);
    }
    // Weather: a fresh roll about every 40 seconds.
    at.rainT -= dt;
    if (at.rainT <= 0) {
      at.rainT = 40;
      at.rain = Math.random() < TUNE.rainOdds;
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
    // Boats rock, gulls circle, the Spire beacon blinks.
    const t = performance.now() / 1000;
    boats.forEach((b, i) => {
      b.position.y = 0.1 + Math.sin(t * 0.8 + i * 1.7) * 0.15;
      b.rotation.z = Math.sin(t * 0.6 + i) * 0.03;
    });
    for (const g of gulls) {
      g.a += g.sp * dt;
      g.m.position.set(Math.sin(g.a) * g.r, g.h + Math.sin(t + g.r) * 2, 180 + Math.cos(g.a) * g.r * 0.4);
      g.m.rotation.y = -g.a;
    }
    city.beacon.material.color.setHex(Math.floor(t * 1.5) % 2 ? 0xff2222 : 0x881111);
  }

  applyPhase(1);
  at.update = update;
  return at;
}
