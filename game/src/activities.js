// SOLMAR — aktivitas sampingan: 6 street race, 8 stunt jump, 5 photo spot,
// courier side-job, vigilante (kejar kurir Kessler). Semua: $ + Street Cred.
import * as THREE from 'three';
import { CFG } from './config.js';

const RACE_SPOTS = [
  { name: 'Neon Sprint', x: 93, z: -60, cps: [[93, 60], [31, 93], [-31, 93], [-93, 31]] },
  { name: 'Marina Loop', x: 60, z: 150, cps: [[155, 150], [155, 31], [93, 31], [60, 150]] },
  { name: 'Port Dash', x: -150, z: -60, cps: [[-93, -93], [-31, -93], [-31, 31], [-150, 60]] },
  { name: 'Spire Circuit', x: -31, z: -93, cps: [[31, -93], [93, -93], [93, -31], [-31, -93]] },
  { name: 'Beach Run', x: 31, z: 186, cps: [[93, 186], [155, 150], [93, 93], [31, 186]] },
  { name: 'Downtown GP', x: -93, z: 93, cps: [[-31, 93], [31, 93], [31, 31], [-93, 93]] },
];
const JUMP_SPOTS = [
  { x: 31, z: -120 }, { x: -93, z: 60 }, { x: 93, z: 120 }, { x: -31, z: 150 },
  { x: 155, z: -31 }, { x: -155, z: -120 }, { x: 60, z: -155 }, { x: -60, z: 186 },
];
const PHOTO_SPOTS = [
  { x: 93, z: 200, name: 'Sunset Beach' }, { x: -62, z: -70, name: 'Spire View' },
  { x: -172, z: 100, name: 'Harbor Cranes' }, { x: 101, z: 0, name: 'Neon Strip' },
  { x: -124, z: 124, name: 'Palm Park' },
];

export function createActivities(scene, city, ctx) {
  const a = {
    race: null, raceCp: 0, raceT: 0,
    courier: null, vigilante: null,
    done: { races: new Set(), jumps: new Set(), photos: new Set() },
  };
  const ringGeo = new THREE.TorusGeometry(3, 0.3, 8, 20);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd24d });
  const rings = [];
  for (const r of RACE_SPOTS) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 3),
      new THREE.MeshBasicMaterial({ color: 0x2ee6ff }));
    m.position.set(r.x, 0.2, r.z); scene.add(m); rings.push(m);
  }
  const jumpMeshes = [];
  for (const j of JUMP_SPOTS) {
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 6),
      new THREE.MeshLambertMaterial({ color: 0xff7722 }));
    ramp.position.set(j.x, 0.4, j.z); ramp.rotation.x = -0.35;
    scene.add(ramp); jumpMeshes.push(ramp);
  }
  const photoMeshes = [];
  for (const p of PHOTO_SPOTS) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x7cff5a }));
    m.position.set(p.x, 2, p.z); scene.add(m); photoMeshes.push(m);
  }
  let cpMarker = null;
  function showCp(x, z) {
    if (!cpMarker) {
      cpMarker = new THREE.Mesh(ringGeo, ringMat);
      scene.add(cpMarker);
    }
    cpMarker.visible = true;
    cpMarker.position.set(x, 2.4, z);
  }
  function hideCp() { if (cpMarker) cpMarker.visible = false; }
  function startRace(i) {
    if (a.race) return false;
    a.race = RACE_SPOTS[i]; a.raceCp = 0; a.raceT = 0;
    showCp(...a.race.cps[0]);
    ctx.hud?.setObjective(`RACE — ${a.race.name}: checkpoint 1/${a.race.cps.length}`);
    ctx.hud?.toast(`RACE START — ${a.race.name} ($${CFG.raceReward})`);
    return true;
  }
  function startCourier() {
    if (a.courier) return false;
    const dest = city.roadPos(ctx.rng);
    a.courier = { x: dest.x, z: dest.z, t: 75 };
    ctx.hud?.setObjective('COURIER — deliver the package in 75s');
    ctx.hud?.toast(`COURIER — deliver to the marker ($${CFG.courierReward})`);
    showCp(dest.x, dest.z);
    return true;
  }
  function startVigilante() {
    if (a.vigilante || !ctx.traffic) return false;
    const p = city.roadPos(ctx.rng);
    a.vigilante = { x: p.x, z: p.z, t: 60, hp: 100 };
    ctx.hud?.setObjective('VIGILANTE — ram the Kessler courier!');
    ctx.hud?.toast(`VIGILANTE — stop the black courier ($${CFG.vigilanteReward})`);
    showCp(p.x, p.z);
    return true;
  }
  function finishRace() {
    const bonus = Math.max(0, Math.round((90 - a.raceT) * 5));
    ctx.economy?.add(CFG.raceReward + bonus, `race ${a.race.name}`);
    ctx.upgrades?.addCred(120);
    a.done.races.add(a.race.name);
    ctx.hud?.toast(`RACE WON — ${a.race.name} +$${CFG.raceReward + bonus}`);
    a.race = null; hideCp();
    ctx.missions?.refreshObjective?.();
  }
  function update(dt) {
    const p = ctx.player;
    const inCar = !!ctx.driving?.vehicle;
    // Race: checkpoint berikut.
    if (a.race) {
      a.raceT += dt;
      const [cx, cz] = a.race.cps[a.raceCp];
      const d = Math.hypot(cx - p.x, cz - p.z);
      if (d < 6) {
        a.raceCp++;
        ctx.audio?.sting('checkpoint');
        if (a.raceCp >= a.race.cps.length) finishRace();
        else {
          showCp(...a.race.cps[a.raceCp]);
          ctx.hud?.setObjective(`RACE — ${a.race.name}: checkpoint ${a.raceCp + 1}/${a.race.cps.length}`);
        }
      }
      if (a.raceT > 150) { ctx.hud?.toast('RACE FAILED — too slow'); a.race = null; hideCp(); }
    }
    // Courier: sampai tujuan.
    if (a.courier) {
      a.courier.t -= dt;
      if (Math.hypot(a.courier.x - p.x, a.courier.z - p.z) < 6) {
        ctx.economy?.add(CFG.courierReward, 'courier');
        ctx.upgrades?.addCred(50);
        ctx.hud?.toast(`COURIER DONE +$${CFG.courierReward}`);
        a.courier = null; hideCp(); ctx.missions?.refreshObjective?.();
      } else if (a.courier.t <= 0) { ctx.hud?.toast('COURIER FAILED — late'); a.courier = null; hideCp(); }
    }
    // Vigilante: tabrak kurir (posisi marker bergerak pelan).
    if (a.vigilante) {
      a.vigilante.t -= dt;
      a.vigilante.x += Math.sin(a.vigilante.t) * 6 * dt;
      showCp(a.vigilante.x, a.vigilante.z);
      if (inCar && Math.hypot(a.vigilante.x - p.x, a.vigilante.z - p.z) < 5) {
        a.vigilante.hp -= 60 * dt;
        if (a.vigilante.hp <= 0) {
          ctx.economy?.add(CFG.vigilanteReward, 'vigilante');
          ctx.upgrades?.addCred(100);
          ctx.hud?.toast(`VIGILANTE DONE +$${CFG.vigilanteReward}`);
          a.vigilante = null; hideCp(); ctx.missions?.refreshObjective?.();
        }
      }
      if (a.vigilante && a.vigilante.t <= 0) { ctx.hud?.toast('VIGILANTE FAILED — target escaped'); a.vigilante = null; hideCp(); }
    }
    // Stunt jump: mobil di udara di atas ramp.
    if (inCar) {
      for (let i = 0; i < JUMP_SPOTS.length; i++) {
        const j = JUMP_SPOTS[i];
        if (!a.done.jumps.has(i) && Math.hypot(j.x - p.x, j.z - p.z) < 4 && Math.abs(ctx.driving.vehicle.speed) > 20) {
          a.done.jumps.add(i);
          ctx.economy?.add(CFG.jumpReward, 'stunt jump');
          ctx.upgrades?.addCred(40);
          ctx.hud?.toast(`STUNT JUMP! +$${CFG.jumpReward}`);
          ctx.audio?.sting('jump');
        }
      }
    }
    // Photo spot: berdiri dekat + tekan E (game.js memanggil tryPhoto).
    photoMeshes.forEach((m, i) => {
      m.rotation.y += dt;
      m.position.y = 2 + Math.sin(performance.now() / 400 + i) * 0.2;
    });
  }
  function tryPhoto() {
    const p = ctx.player;
    for (let i = 0; i < PHOTO_SPOTS.length; i++) {
      const s = PHOTO_SPOTS[i];
      if (!a.done.photos.has(i) && Math.hypot(s.x - p.x, s.z - p.z) < 4) {
        a.done.photos.add(i);
        ctx.economy?.add(CFG.photoReward, `photo ${s.name}`);
        ctx.upgrades?.addCred(30);
        ctx.hud?.toast(`PHOTO — ${s.name} +$${CFG.photoReward}`);
        ctx.audio?.sting('photo');
        return true;
      }
    }
    return false;
  }
  function nearRaceStart() {
    const p = ctx.player;
    for (let i = 0; i < RACE_SPOTS.length; i++) {
      const r = RACE_SPOTS[i];
      if (Math.hypot(r.x - p.x, r.z - p.z) < 5) return i;
    }
    return -1;
  }
  a.startRace = startRace; a.startCourier = startCourier; a.startVigilante = startVigilante;
  a.update = update; a.tryPhoto = tryPhoto; a.nearRaceStart = nearRaceStart;
  a.RACE_SPOTS = RACE_SPOTS; a.PHOTO_SPOTS = PHOTO_SPOTS;
  return a;
}
