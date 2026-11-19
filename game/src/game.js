// SOLMAR — the conductor: every system, input, state machine, camera, fixed loop.
import * as THREE from 'three';
import { TUNE } from './config.js';
import { seedRng } from './rng.js';
import { raiseCity } from './city.js';
import { CAR_DEFS, spawnVehicle } from './vehicles.js';
import { runTraffic } from './traffic.js';
import { runCrowd } from './pedestrians.js';
import { spawnHero } from './player.js';
import { runDriving } from './driving.js';
import { runPolice } from './police.js';
import { runCombat } from './combat.js';
import { runBosses } from './bosses.js';
import { runProgress, UPGRADE_DEFS } from './upgrades.js';
import { runSideJobs } from './activities.js';
import { runStory } from './missions.js';
import { runWallet } from './economy.js';
import { runHud } from './hud.js';
import { runSound } from './audio.js';
import { runFx } from './effects.js';
import { runSky } from './atmosphere.js';
import { runSave } from './save.js';
import { stageShots } from './shots.js';

// Ten Sun Coins scattered across the city.
const COINS = [
  { x: 60, z: 196 }, { x: -62, z: -70 }, { x: -178, z: 100 }, { x: 93, z: 28 },
  { x: -124, z: 120 }, { x: 31, z: -150 }, { x: 155, z: 150 }, { x: -155, z: -60 },
  { x: 0, z: 170 }, { x: -40, z: -120 },
];

export function buildGame(canvas, seed = 1) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);

  // Every system, built in dependency order on one shared context.
  const ctx = { rng: seedRng(seed), rain: false, dangerPos: null, state: 'menu' };
  ctx.city = raiseCity(scene, ctx.rng);
  ctx.player = spawnHero(scene, ctx.city);
  ctx.traffic = runTraffic(scene, ctx.city, ctx.rng);
  ctx.pedestrians = runCrowd(scene, ctx.city, ctx.rng);
  ctx.driving = runDriving(ctx);
  ctx.police = runPolice(scene, ctx.city, ctx.rng);
  ctx.combat = runCombat(scene, ctx);
  ctx.bosses = runBosses(scene, ctx);
  ctx.upgrades = runProgress(scene, ctx);
  ctx.activities = runSideJobs(scene, ctx.city, ctx);
  ctx.missions = runStory(ctx);
  ctx.economy = runWallet(ctx);
  ctx.hud = runHud(ctx);
  ctx.audio = runSound();
  ctx.effects = runFx(scene);
  ctx.atmosphere = runSky(scene, ctx.city, ctx.rng);
  ctx.save = runSave(ctx);

  const g = {
    ctx,
    state: 'menu',
    seed,
    shotCam: null,
    ownedGuns: new Set(['fists']),
    player: ctx.player,
    missions: ctx.missions,
    police: ctx.police,
    driving: ctx.driving,
    combat: ctx.combat,
    bosses: ctx.bosses,
    economy: ctx.economy,
    upgrades: ctx.upgrades,
    activities: ctx.activities,
    hud: ctx.hud,
    audio: ctx.audio,
    city: ctx.city,
  };
  ctx.state = 'menu';
  ctx.onBusted = () => busted(false);
  ctx.onWasted = () => busted(true);

  // Parked cars to steal: the Pipit at the Voss Auto yard, plus five more.
  ctx.parked = [];
  function park(defKey, x, z, angle) {
    const def = CAR_DEFS.find((c) => c.key === defKey);
    const v = spawnVehicle(def, x, z, angle);
    v.mesh.position.set(x, 0, z);
    v.mesh.rotation.y = angle;
    scene.add(v.mesh);
    ctx.parked.push(v);
    return v;
  }
  park('pipit', 14, 110, 0);
  park('corto', 40, -48, Math.PI / 2);
  park('cabrio', 93, 60, 0);
  park('mule', -40, 48, Math.PI);
  park('vantara', -170, -60, Math.PI / 2);
  park('hauler', 150, 100, 0);
  g.spawnPlayerCar = (key, x, z, angle) => {
    const def = CAR_DEFS.find((c) => c.key === key);
    const v = spawnVehicle(def, x, z, angle);
    v.mesh.position.set(x, 0, z);
    v.mesh.rotation.y = angle;
    scene.add(v.mesh);
    ctx.parked.push(v);
    return v;
  };

  // Ten Sun Coins scattered across the city.
  const coinMeshes = [];
  for (const c of COINS) {
    const coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.28, 8, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd24d }),
    );
    coin.position.set(c.x, 1.4, c.z);
    coin.rotation.x = Math.PI / 2;
    scene.add(coin);
    coinMeshes.push({ m: coin, x: c.x, z: c.z, got: false });
  }

  // ---- Input ----
  const input = { w: false, a: false, s: false, d: false, shift: false, space: false, mouseDX: 0 };
  const KEYMAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ShiftLeft: 'shift', ShiftRight: 'shift', Space: 'space' };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code] !== undefined) {
      input[KEYMAP[e.code]] = true;
      if (e.code === 'Space') e.preventDefault();
    }
    if (e.code === 'Enter') onEnter();
    if (e.code === 'Escape' || e.code === 'KeyP') onPause();
    if (e.code === 'KeyF') onCarKey();
    if (e.code === 'KeyE') tryInteract();
    if (e.code === 'KeyR') ctx.combat.reload();
    if (e.code === 'KeyT') {
      ctx.audio.nextRadio();
      ctx.hud.toast(`Radio — ${ctx.audio.radioName()}`);
    }
    if (e.code === 'KeyM' && !e.shiftKey) toggleMenu('missions');
    if (e.code === 'KeyU') {
      buildUpgradeMenu();
      toggleMenu('upgrades');
    }
    if (e.code === 'Digit1') ctx.missions.start(0);
    if (e.code === 'Digit2') ctx.missions.start(1);
    if (e.code === 'Digit3') ctx.missions.start(2);
    if (e.code === 'Digit4') ctx.missions.start(3);
    if (e.code === 'Digit5') ctx.missions.start(4);
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (g.state !== 'playing' && g.state !== 'complete') return;
    ctx.audio.ensure();
    if (e.button === 0) ctx.combat.shoot();
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) input.mouseDX += e.movementX || 0;
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- Menus ----
  function toggleMenu(name) {
    if (g.state === 'playing' || g.state === 'complete') {
      g.state = 'paused';
      ctx.state = 'paused';
      ctx.hud.showMenu(name);
    } else if (g.state === 'paused') {
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
    }
  }

  function onEnter() {
    ctx.audio.ensure();
    if (g.state === 'menu') {
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
      ctx.hud.setObjective('Free roam — press M for missions, E to interact');
    } else if (g.state === 'busted' || g.state === 'wasted') {
      respawn();
    }
  }

  function onPause() {
    if (g.state === 'playing' || g.state === 'complete') {
      g.state = 'paused';
      ctx.state = 'paused';
      ctx.hud.showMenu('pause');
    } else if (g.state === 'paused') {
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
    }
  }

  function busted(wasted) {
    if (g.state !== 'playing' && g.state !== 'complete') return;
    g.state = wasted ? 'wasted' : 'busted';
    ctx.state = g.state;
    const fine = wasted ? 200 : 100;
    ctx.economy.money = Math.max(0, ctx.economy.money - fine);
    ctx.police.wanted = 0;
    ctx.hud.showMenu('dead');
    const title = document.getElementById('dead-title');
    if (title) title.textContent = wasted ? 'WASTED' : 'BUSTED';
    const sub = document.getElementById('dead-sub');
    if (sub) {
      sub.textContent = wasted
        ? `You died. Hospital bill: $${fine}. Press Enter to respawn.`
        : `Caught by the police. Bail: $${fine}. Press Enter to respawn.`;
    }
    ctx.audio.sting('boss');
  }

  function respawn() {
    ctx.player.health = ctx.upgrades.has('m_health') ? 150 : TUNE.heroMaxHp;
    ctx.player.armor = ctx.upgrades.has('m_vest') ? 50 : 0;
    ctx.player.x = 14;
    ctx.player.z = 110;
    ctx.player.mesh.position.set(14, 0, 110);
    if (ctx.driving.vehicle) ctx.driving.exit();
    g.state = 'playing';
    ctx.state = 'playing';
    ctx.hud.showMenu('none');
  }

  function onCarKey() {
    if (g.state !== 'playing' && g.state !== 'complete') return;
    if (ctx.driving.vehicle) {
      ctx.driving.exit();
      return;
    }
    const v = ctx.driving.nearestParked(4.5);
    if (v) {
      ctx.parked = ctx.parked.filter((x) => x !== v);
      ctx.driving.enter(v);
      // Stealing a car in front of a witness raises the heat.
      let seen = false;
      for (const p of ctx.pedestrians.peds) {
        if (Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) < 25) {
          seen = true;
          break;
        }
      }
      if (seen || ctx.police.units.length > 0) ctx.police.addHeat(1, 'steal');
      ctx.hud.toast(`Driving ${v.def.name} — W/S gas, Space handbrake`);
    }
  }

  function buyNextGun() {
    const order = ['shotgun', 'smg'];
    for (const key of order) {
      if (!g.ownedGuns.has(key)) {
        if (ctx.economy.buyGun(key)) {
          g.ownedGuns.add(key);
          ctx.combat.giveWeapon(key);
        }
        return;
      }
    }
    ctx.hud.toast('IRONWORKS — you own every gun. Press U for upgrades.');
  }

  function tryInteract() {
    if (g.state !== 'playing' && g.state !== 'complete') return;
    const p = ctx.player;
    const lm = ctx.city.landmarks;
    if (ctx.missions.sabotage()) return;
    if (ctx.activities.tryPhoto()) return;
    const ri = ctx.activities.nearRaceStart();
    if (ri >= 0) {
      ctx.activities.startRace(ri);
      return;
    }
    if (Math.hypot(lm.sprayShack.x - p.x, lm.sprayShack.z - p.z) < 9) {
      ctx.economy.sprayPaint();
      return;
    }
    if (Math.hypot(lm.ironworks.x - p.x, lm.ironworks.z - p.z) < 9) {
      buyNextGun();
      return;
    }
    if (Math.hypot(lm.vossAuto.x - p.x, lm.vossAuto.z - p.z) < 12) {
      ctx.economy.startTaxi();
      return;
    }
    ctx.hud.toast('Nothing to interact with here — try the race markers (cyan) or shops');
  }

  // ---- Dynamic menus: upgrades and missions ----
  function buildUpgradeMenu() {
    const list = document.getElementById('upgrades-list');
    if (!list) return;
    list.innerHTML = '';
    for (const u of UPGRADE_DEFS) {
      const owned = ctx.upgrades.has(u.id);
      const b = document.createElement('button');
      b.textContent = `${owned ? '✓ ' : ''}${u.name} — $${u.cost} — ${u.desc}`;
      b.disabled = owned;
      b.onclick = () => {
        if (ctx.upgrades.buy(u.id)) buildUpgradeMenu();
      };
      list.appendChild(b);
    }
    const info = document.getElementById('upgrades-info');
    if (info) {
      info.textContent = `Money $${ctx.economy.money} • Relics ${ctx.upgrades.relicsFound.size}/12 • Cred ${ctx.upgrades.CRED_TITLES[ctx.upgrades.rank()]} (${ctx.upgrades.cred})`;
    }
  }

  function buildMissionMenu() {
    const list = document.getElementById('missions-list');
    if (!list) return;
    list.innerHTML = '';
    ctx.missions.defs.forEach((d, i) => {
      const b = document.createElement('button');
      b.textContent = `${ctx.missions.done.has(i) ? '✓ ' : ''}M${i + 1} ${d.name} — $${d.reward} — ${d.desc}`;
      b.onclick = () => {
        if (ctx.missions.start(i)) {
          g.state = 'playing';
          ctx.state = 'playing';
          ctx.hud.showMenu('none');
        }
      };
      list.appendChild(b);
    });
    const addSideJob = (label, fn) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => {
        fn();
        g.state = 'playing';
        ctx.state = 'playing';
        ctx.hud.showMenu('none');
      };
      list.appendChild(b);
    };
    addSideJob('Side: Courier Job ($350)', () => ctx.activities.startCourier());
    addSideJob('Side: Vigilante ($800)', () => ctx.activities.startVigilante());
    addSideJob('Side: Taxi Job ($120)', () => ctx.economy.startTaxi());
  }

  function wireButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };
    on('btn-new', () => {
      ctx.save.wipe();
      ctx.audio.ensure();
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
      ctx.hud.setObjective('M1 First Delivery — get in the Pipit at Voss Auto');
      ctx.missions.start(0, { debug: true });
    });
    on('btn-continue', () => {
      ctx.save.load();
      ctx.audio.ensure();
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
    });
    on('btn-missions', () => {
      buildMissionMenu();
      ctx.hud.showMenu('missions');
    });
    on('btn-upgrades', () => {
      buildUpgradeMenu();
      ctx.hud.showMenu('upgrades');
    });
    on('btn-controls', () => {
      const el = document.getElementById('controls-box');
      if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
    });
    on('btn-close-missions', () => {
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
    });
    on('btn-close-upgrades', () => {
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
    });
    on('btn-resume', () => {
      g.state = 'playing';
      ctx.state = 'playing';
      ctx.hud.showMenu('none');
    });
    on('btn-quit', () => {
      ctx.save.save();
      g.state = 'menu';
      ctx.state = 'menu';
      ctx.hud.showMenu('start');
    });
    on('btn-respawn', () => respawn());
  }

  // ---- Camera ----
  const camTarget = new THREE.Vector3();
  function updateCamera(dt) {
    if (g.shotCam) {
      camera.position.set(g.shotCam.pos[0], g.shotCam.pos[1], g.shotCam.pos[2]);
      camera.lookAt(g.shotCam.look[0], g.shotCam.look[1], g.shotCam.look[2]);
      return;
    }
    const p = ctx.player;
    const v = ctx.driving.vehicle;
    const yaw = v ? v.angle : p.camYaw;
    const back = v ? 13 : 9;
    const height = v ? 5.5 : 4.2;
    const tx = (v ? v.x : p.x) - Math.sin(yaw) * back;
    const tz = (v ? v.z : p.z) - Math.cos(yaw) * back;
    camTarget.set(tx, height, tz);
    camera.position.lerp(camTarget, Math.min(1, dt * 5));
    camera.lookAt(v ? v.x : p.x, 1.8, v ? v.z : p.z);
    if (ctx.effects.shakeMag > 0) {
      camera.position.x += (Math.random() - 0.5) * ctx.effects.shakeMag;
      camera.position.y += (Math.random() - 0.5) * ctx.effects.shakeMag;
    }
  }
  g.setCamera = (x, y, z, lx, ly, lz) => {
    g.shotCam = { pos: [x, y, z], look: [lx, ly, lz] };
  };
  g.applyCamera = () => updateCamera(0.016);
  g.setSeed = (s) => {
    g.seed = s;
  };

  // ---- Step (fixed 1/60) and render ----
  function step(dt) {
    const playing = g.state === 'playing' || g.state === 'complete';
    const p = ctx.player;
    if (playing) {
      if (ctx.driving.vehicle) ctx.driving.update(dt, input);
      else p.update(dt, input, ctx);
      ctx.traffic.update(dt, ctx);
      ctx.pedestrians.update(dt, ctx);
      ctx.police.update(dt, ctx);
      ctx.combat.update(dt);
      ctx.bosses.update(dt);
      ctx.upgrades.update(dt);
      ctx.activities.update(dt);
      ctx.missions.update(dt);
      ctx.economy.update(dt);
      // Sun Coins: picked up on touch.
      for (const c of coinMeshes) {
        if (!c.got && Math.hypot(c.x - p.x, c.z - p.z) < 2.6) {
          c.got = true;
          c.m.visible = false;
          ctx.economy.collectCoin();
        }
        if (!c.got) {
          c.m.rotation.y += dt;
          c.m.position.y = 1.4 + Math.sin(performance.now() / 400) * 0.15;
        }
      }
      // Running a pedestrian over raises the heat (2s per hit, at most).
      g.hitCd = Math.max(0, (g.hitCd || 0) - dt);
      for (const ped of ctx.pedestrians.peds) {
        const v = ctx.driving.vehicle;
        if (v && g.hitCd <= 0 && Math.hypot(ped.x - v.x, ped.z - v.z) < 2.2) {
          g.hitCd = 2;
          ctx.police.addHeat(1, 'hit-ped');
          ctx.effects.smoke(ped.x, ped.z);
          ctx.dangerPos = { x: v.x, z: v.z };
        }
      }
    } else if (g.state === 'menu') {
      ctx.traffic.update(dt, ctx);
      ctx.pedestrians.update(dt, ctx);
    }
    ctx.atmosphere.update(dt, ctx);
    ctx.effects.update(dt);
    ctx.audio.update(dt);
    ctx.audio.engine(ctx.driving.vehicle ? Math.abs(ctx.driving.vehicle.speed) / ctx.driving.vehicle.def.top : 0);
    ctx.hud.update(dt);
    updateCamera(dt);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function debugState() {
    const p = ctx.player;
    return `state=${g.state} x=${p.x.toFixed(1)} z=${p.z.toFixed(1)} hp=${Math.round(p.health)} wanted=${ctx.police.wanted} money=${ctx.economy.money} mission=${ctx.missions.active >= 0 ? ctx.missions.defs[ctx.missions.active].name : 'none'} car=${ctx.driving.vehicle ? ctx.driving.vehicle.def.name : 'none'} speed=${ctx.driving.vehicle ? Math.round(Math.abs(ctx.driving.vehicle.speed) * 3.6) : 0} cred=${ctx.upgrades.cred} relics=${ctx.upgrades.relicsFound.size}`;
  }

  g.step = step;
  g.render = render;
  g.debugState = debugState;
  g.input = input;

  // ---- Start ----
  wireButtons();
  ctx.hud.showMenu('start');
  ctx.hud.setObjective('Press Enter — New Game or Continue');
  window.__game = g;
  const isShot = stageShots(g);
  if (!isShot) {
    let last = performance.now();
    let acc = 0;
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      acc += dt;
      let n = 0;
      while (acc >= 1 / 60 && n < 5) {
        step(1 / 60);
        acc -= 1 / 60;
        n++;
      }
      if (n === 5) acc = 0;
      render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  return g;
}
