// SOLMAR — side jobs: 6 street races, 8 stunt jumps, 5 photo spots,
// courier runs, vigilante hunts. Every one pays cash and Street Cred.
import * as THREE from 'three';
import { TUNE } from './config.js';

// Six race courses: start line plus four checkpoints, in order.
const RACE_COURSES = [
  { name: 'Neon Sprint', x: 93, z: -60, cps: [[93, 60], [31, 93], [-31, 93], [-93, 31]] },
  { name: 'Marina Loop', x: 60, z: 150, cps: [[155, 150], [155, 31], [93, 31], [60, 150]] },
  { name: 'Port Dash', x: -150, z: -60, cps: [[-93, -93], [-31, -93], [-31, 31], [-150, 60]] },
  { name: 'Spire Circuit', x: -31, z: -93, cps: [[31, -93], [93, -93], [93, -31], [-31, -93]] },
  { name: 'Beach Run', x: 31, z: 186, cps: [[93, 186], [155, 150], [93, 93], [31, 186]] },
  { name: 'Downtown GP', x: -93, z: 93, cps: [[-31, 93], [31, 93], [31, 31], [-93, 93]] },
];
// Eight stunt ramps: catch air over one at speed.
const JUMP_RAMPS = [
  { x: 31, z: -120 }, { x: -93, z: 60 }, { x: 93, z: 120 }, { x: -31, z: 150 },
  { x: 155, z: -31 }, { x: -155, z: -120 }, { x: 60, z: -155 }, { x: -60, z: 186 },
];
// Five photo spots: stand in the green orb and press E.
const PHOTO_VIEWS = [
  { x: 93, z: 200, name: 'Sunset Beach' },
  { x: -62, z: -70, name: 'Spire View' },
  { x: -172, z: 100, name: 'Harbor Cranes' },
  { x: 101, z: 0, name: 'Neon Strip' },
  { x: -124, z: 124, name: 'Palm Park' },
];

export function runSideJobs(scene, city, ctx) {
  const a = {
    race: null,
    raceCp: 0,
    raceT: 0,
    courier: null,
    vigilante: null,
    done: { races: new Set(), jumps: new Set(), photos: new Set() },
  };
  const ringGeo = new THREE.TorusGeometry(3, 0.3, 8, 20);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd24d });

  // Cyan start pads at each race line.
  const startPads = [];
  for (const r of RACE_COURSES) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.4, 3),
      new THREE.MeshBasicMaterial({ color: 0x2ee6ff }),
    );
    pad.position.set(r.x, 0.2, r.z);
    scene.add(pad);
    startPads.push(pad);
  }
  // Orange ramps for the stunt jumps.
  const jumpMeshes = [];
  for (const j of JUMP_RAMPS) {
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.8, 6),
      new THREE.MeshLambertMaterial({ color: 0xff7722 }),
    );
    ramp.position.set(j.x, 0.4, j.z);
    ramp.rotation.x = -0.35;
    scene.add(ramp);
    jumpMeshes.push(ramp);
  }
  // Green orbs for the photo spots.
  const photoMeshes = [];
  for (const p of PHOTO_VIEWS) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x7cff5a }),
    );
    orb.position.set(p.x, 2, p.z);
    scene.add(orb);
    photoMeshes.push(orb);
  }

  // One golden ring marks the current checkpoint / drop-off / target.
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
    a.race = RACE_COURSES[i];
    a.raceCp = 0;
    a.raceT = 0;
    showCp(...a.race.cps[0]);
    ctx.hud?.setObjective(`RACE — ${a.race.name}: checkpoint 1/${a.race.cps.length}`);
    ctx.hud?.toast(`RACE START — ${a.race.name} ($${TUNE.racePay})`);
    return true;
  }

  function startCourier() {
    if (a.courier) return false;
    const dest = city.roadPos(ctx.rng);
    a.courier = { x: dest.x, z: dest.z, t: 75 };
    ctx.hud?.setObjective('COURIER — deliver the package in 75s');
    ctx.hud?.toast(`COURIER — deliver to the marker ($${TUNE.courierPay})`);
    showCp(dest.x, dest.z);
    return true;
  }

  function startVigilante() {
    if (a.vigilante || !ctx.traffic) return false;
    const p = city.roadPos(ctx.rng);
    a.vigilante = { x: p.x, z: p.z, t: 60, hp: 100 };
    ctx.hud?.setObjective('VIGILANTE — ram the Kessler courier!');
    ctx.hud?.toast(`VIGILANTE — stop the black courier ($${TUNE.vigilantePay})`);
    showCp(p.x, p.z);
    return true;
  }

  // A race win pays the purse plus a speed bonus for a fast time.
  function finishRace() {
    const bonus = Math.max(0, Math.round((90 - a.raceT) * 5));
    ctx.economy?.add(TUNE.racePay + bonus, `race ${a.race.name}`);
    ctx.upgrades?.addCred(120);
    a.done.races.add(a.race.name);
    ctx.hud?.toast(`RACE WON — ${a.race.name} +$${TUNE.racePay + bonus}`);
    a.race = null;
    hideCp();
    ctx.missions?.refreshObjective?.();
  }

  function update(dt) {
    const p = ctx.player;
    const inCar = !!ctx.driving?.vehicle;
    // Race: drive through each checkpoint in order, before the 150s limit.
    if (a.race) {
      a.raceT += dt;
      const [cx, cz] = a.race.cps[a.raceCp];
      const d = Math.hypot(cx - p.x, cz - p.z);
      if (d < 6) {
        a.raceCp++;
        ctx.audio?.sting('checkpoint');
        if (a.raceCp >= a.race.cps.length) {
          finishRace();
        } else {
          showCp(...a.race.cps[a.raceCp]);
          ctx.hud?.setObjective(`RACE — ${a.race.name}: checkpoint ${a.raceCp + 1}/${a.race.cps.length}`);
        }
      }
      if (a.raceT > 150) {
        ctx.hud?.toast('RACE FAILED — too slow');
        a.race = null;
        hideCp();
      }
    }
    // Courier: reach the drop-off before the timer runs out.
    if (a.courier) {
      a.courier.t -= dt;
      if (Math.hypot(a.courier.x - p.x, a.courier.z - p.z) < 6) {
        ctx.economy?.add(TUNE.courierPay, 'courier');
        ctx.upgrades?.addCred(50);
        ctx.hud?.toast(`COURIER DONE +$${TUNE.courierPay}`);
        a.courier = null;
        hideCp();
        ctx.missions?.refreshObjective?.();
      } else if (a.courier.t <= 0) {
        ctx.hud?.toast('COURIER FAILED — late');
        a.courier = null;
        hideCp();
      }
    }
    // Vigilante: ram the courier until its health is gone.
    if (a.vigilante) {
      a.vigilante.t -= dt;
      a.vigilante.x += Math.sin(a.vigilante.t) * 6 * dt;
      showCp(a.vigilante.x, a.vigilante.z);
      if (inCar && Math.hypot(a.vigilante.x - p.x, a.vigilante.z - p.z) < 5) {
        a.vigilante.hp -= 60 * dt;
        if (a.vigilante.hp <= 0) {
          ctx.economy?.add(TUNE.vigilantePay, 'vigilante');
          ctx.upgrades?.addCred(100);
          ctx.hud?.toast(`VIGILANTE DONE +$${TUNE.vigilantePay}`);
          a.vigilante = null;
          hideCp();
          ctx.missions?.refreshObjective?.();
        }
      }
      if (a.vigilante && a.vigilante.t <= 0) {
        ctx.hud?.toast('VIGILANTE FAILED — target escaped');
        a.vigilante = null;
        hideCp();
      }
    }
    // Stunt jump: catch air over a ramp at speed, once per ramp.
    if (inCar) {
      for (let i = 0; i < JUMP_RAMPS.length; i++) {
        const j = JUMP_RAMPS[i];
        if (!a.done.jumps.has(i) && Math.hypot(j.x - p.x, j.z - p.z) < 4 && Math.abs(ctx.driving.vehicle.speed) > 20) {
          a.done.jumps.add(i);
          ctx.economy?.add(TUNE.jumpPay, 'stunt jump');
          ctx.upgrades?.addCred(40);
          ctx.hud?.toast(`STUNT JUMP! +$${TUNE.jumpPay}`);
          ctx.audio?.sting('jump');
        }
      }
    }
    // Photo orbs bob and spin until photographed.
    photoMeshes.forEach((orb, i) => {
      orb.rotation.y += dt;
      orb.position.y = 2 + Math.sin(performance.now() / 400 + i) * 0.2;
    });
  }

  function tryPhoto() {
    const p = ctx.player;
    for (let i = 0; i < PHOTO_VIEWS.length; i++) {
      const s = PHOTO_VIEWS[i];
      if (!a.done.photos.has(i) && Math.hypot(s.x - p.x, s.z - p.z) < 4) {
        a.done.photos.add(i);
        ctx.economy?.add(TUNE.photoPay, `photo ${s.name}`);
        ctx.upgrades?.addCred(30);
        ctx.hud?.toast(`PHOTO — ${s.name} +$${TUNE.photoPay}`);
        ctx.audio?.sting('photo');
        return true;
      }
    }
    return false;
  }

  function nearRaceStart() {
    const p = ctx.player;
    for (let i = 0; i < RACE_COURSES.length; i++) {
      const r = RACE_COURSES[i];
      if (Math.hypot(r.x - p.x, r.z - p.z) < 5) return i;
    }
    return -1;
  }

  a.startRace = startRace;
  a.startCourier = startCourier;
  a.startVigilante = startVigilante;
  a.update = update;
  a.tryPhoto = tryPhoto;
  a.nearRaceStart = nearRaceStart;
  a.RACE_COURSES = RACE_COURSES;
  a.PHOTO_VIEWS = PHOTO_VIEWS;
  return a;
}
