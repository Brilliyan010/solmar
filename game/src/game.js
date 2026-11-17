// SOLMAR — game orchestrator. Owns the renderer, the fixed-step loop, the
// state machine (menu / playing / paused / dead / ending), input, camera,
// car enter/exit, shooting, wanted consequences and saving. Every system
// (city, traffic, police, missions, economy, combat, effects, audio, HUD)
// is built here and ticked in one place.
import * as THREE from "three";
import { CFG } from "./config.js";
import { Rng } from "./rng.js";
import { buildCity, PLACES, ROAD_X, ROAD_Z } from "./city.js";
import { MODELS, buildCarMesh, makeCarState } from "./vehicles.js";
import { driveCarStep, collideCircleAABB } from "./driving.js";
import { Traffic } from "./traffic.js";
import { Pedestrians } from "./pedestrians.js";
import { Player } from "./player.js";
import { Police } from "./police.js";
import { Combat } from "./combat.js";
import { MissionManager, MISSIONS } from "./missions.js";
import { Economy } from "./economy.js";
import { HUD } from "./hud.js";
import { AudioEngine } from "./audio.js";
import { Effects } from "./effects.js";
import { saveGame, loadGame, hasSave } from "./save.js";

const SEED = 20261117;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Game {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);
    this.state = "menu";
    this.time = 0;
    this.clockHour = CFG.clockStartHour;
    this.camYaw = 0.6;
    this.camPitch = 0.32;
    this.camDist = 8;
    this.keys = new Set();
    this.mouseDown = false;
    this.interactPressed = false;
    this.stolenCar = null;
    this.missionWaypointOverride = null;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.fps = 0;
    this.deadKind = "";
    this.shotMode = false;
    this.raf = 0;
    this.destroyed = false;
  }

  init(saveData) {
    const rng = new Rng(SEED);
    this.city = buildCity(this.scene, rng);
    this.colliders = this.city.colliders;
    this.traffic = new Traffic(this.scene, this.city, SEED);
    this.peds = new Pedestrians(this.scene, SEED);
    this.player = new Player(this.scene);
    this.police = new Police(this.scene, SEED);
    this.combat = new Combat(this.scene, this.colliders, SEED);
    this.combat.onPlayerHit = (dmg) => {
      if (this.state !== "playing") return;
      if (this.player.damage(dmg)) this.die("WASTED");
      this.hud.toast("You took a hit!");
    };
    this.missions = new MissionManager(this.scene, SEED);
    this.economy = new Economy(this.scene, SEED);
    this.effects = new Effects(this.scene, SEED);
    this.audio = new AudioEngine();
    this.hud = new HUD();
    this.missions.onStep = (t) => this.hud.toast(t, 4200);
    this.missions.onMissionComplete = (i, reward) => {
      this.hud.toast(`Mission complete: ${MISSIONS[i].name}  +$${reward}`, 5000);
      this.audio.jingle();
      if (i === 1) {
        this.combat.owned.add("pistol");
        this.hud.toast("Pistol unlocked — press 2 to draw it", 4000);
      }
      if (i === 3) {
        this.combat.owned.add("shotgun");
        this.hud.toast("Shotgun unlocked — press 3 to draw it", 4000);
      }
      if (i === 4) this.finishStory();
      this.doSave();
    };
    this.hud.onButton = (a) => this.onButton(a);
    this.hud.setMissionList(MISSIONS, this.missions.done, this.missions.current, (i) => {
      this.missions.start(i);
      this.startPlaying();
    });
    // Parked cars around the city (stealable), placed on road edges so they
    // never sit inside a building. The Vantara by the warehouse is M2's target.
    this.parkedCars = [];
    const spots = [
      ["pipit", 36, -100], ["corto", -26, 48], ["cabrio", 222, -40],
      ["pipit", 250, 60], ["mule", -98, -48], ["corto", 36, -150],
      ["hauler", -88, 76], ["pipit", -150, 100], ["corto", 36, -186],
      ["vantara", -88, 124],
    ];
    for (const [model, x, z] of spots) {
      const mesh = buildCarMesh(model);
      mesh.position.set(x, 0, z);
      mesh.rotation.y = rng.range(0, Math.PI * 2);
      this.scene.add(mesh);
      const st = makeCarState(model, x, z, mesh.rotation.y);
      st.mesh = mesh;
      this.parkedCars.push({ ...st, owned: false, missionTarget: model === "vantara" });
    }
    // Player start: at Voss Auto, on foot.
    this.player.x = PLACES.vossAuto.x + 6;
    this.player.z = PLACES.vossAuto.z + 10;
    this.player.heading = Math.PI / 2;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    if (saveData) this.applySave(saveData);
    this.bindInput();
    this.hud.showScreen("menu-start");
    this.hud.setMoney(this.economy.money);
    this.updateContinueButton();
    window.__game = this;
  }

  updateContinueButton() {
    const b = document.getElementById("btn-continue");
    if (b) b.classList.toggle("hidden", !hasSave());
  }

  bindInput() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.audio.ensure();
      if (e.code === "KeyM") this.audio.setMuted(!this.audio.muted);
      if (e.code === "Digit1") this.combat.weapon = "fists";
      if (e.code === "Digit2" && this.combat.owned.has("pistol")) this.combat.weapon = "pistol";
      if (e.code === "Digit3" && this.combat.owned.has("shotgun")) this.combat.weapon = "shotgun";
      if (e.code === "KeyE") this.interactPressed = true;
      if (e.code === "KeyF") this.toggleCar();
      if (e.code === "KeyR") this.audio.horn();
      if (e.code === "Escape" || e.code === "KeyP") this.togglePause();
      if (e.code === "Enter" && this.state === "menu") this.startPlaying();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    const cv = this.renderer.domElement;
    cv.addEventListener("mousedown", (e) => {
      this.mouseDown = true;
      this.audio.ensure();
      if (this.state === "playing" && e.button === 0) {
        if (document.pointerLockElement !== cv) cv.requestPointerLock?.();
        this.tryShoot();
      }
    });
    window.addEventListener("mouseup", () => (this.mouseDown = false));
    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === cv || this.mouseDown) {
        this.camYaw -= e.movementX * 0.0042;
        this.camPitch = Math.max(0.08, Math.min(1.1, this.camPitch + e.movementY * 0.003));
      }
    });
    window.addEventListener("resize", () => this.onResize());
  }

  onResize() {
    const w = this.container.clientWidth || 1280;
    const h = this.container.clientHeight || 720;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  onButton(action) {
    if (action === "continue") {
      const data = loadGame();
      if (data) {
        this.applySave(data);
        this.startPlaying();
      }
    } else if (action === "new") {
      this.startPlaying();
      this.missions.start(0);
      this.hud.toast("M1: First Delivery — get in a car", 4500);
    } else if (action === "missions") {
      this.hud.setMissionList(MISSIONS, this.missions.done, this.missions.current, (i) => {
        this.missions.start(i);
        this.startPlaying();
      });
      this.hud.showScreen("menu-missions");
    } else if (action === "controls") {
      this.hud.showScreen("menu-controls");
    } else if (action === "back-start") {
      this.state = "menu";
      this.hud.showScreen("menu-start");
      this.updateContinueButton();
    } else if (action === "resume") {
      this.startPlaying();
    } else if (action === "save") {
      this.doSave();
      this.hud.toast("Game saved");
    } else if (action === "quit") {
      this.state = "menu";
      this.hud.showScreen("menu-start");
      this.updateContinueButton();
    } else if (action === "respawn") {
      this.respawn();
    } else if (action === "free-roam") {
      this.startPlaying();
    }
  }

  startPlaying() {
    this.state = "playing";
    this.hud.showScreen(null);
    document.exitPointerLock?.();
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.hud.setStats(this.statsText());
      this.hud.showScreen("menu-pause");
      document.exitPointerLock?.();
    } else if (this.state === "paused") {
      this.startPlaying();
    }
  }

  statsText() {
    const done = this.missions.done.filter(Boolean).length;
    return `Missions done: ${done}/5 · Cars stolen: ${this.stolenCount ?? 0} · Sun Coins: ${this.economy.coinsCollected}/10 · Garage: ${this.economy.garage.length}/3 · Top wanted: ${this.topWanted ?? 0}★`;
  }

  finishStory() {
    this.state = "ending";
    const el = document.getElementById("end-stats");
    if (el) el.textContent = this.statsText();
    this.hud.showScreen("menu-end");
    this.audio.jingle();
  }

  die(kind) {
    this.deadKind = kind;
    this.state = "dead";
    this.audio.busted();
    const title = document.getElementById("dead-title");
    if (title) title.textContent = kind;
    const sub = document.getElementById("dead-sub");
    if (sub) {
      sub.textContent =
        kind === "BUSTED"
          ? "The Solmar PD caught up with you. You pay the fine and walk free."
          : "Mara wakes up at Solmar General, lighter in the wallet.";
    }
    this.hud.showScreen("menu-dead");
    document.exitPointerLock?.();
  }

  respawn() {
    this.player.health = CFG.playerHealth;
    this.player.armor = 0;
    this.player.x = PLACES.hospital.x + 8;
    this.player.z = PLACES.hospital.z + 8;
    this.player.y = 0;
    this.player.vy = 0;
    if (this.player.inCar) this.exitCar(false);
    this.player.show();
    this.economy.money = Math.max(0, this.economy.money * (this.deadKind === "BUSTED" ? 1 : 0.9) - (this.deadKind === "BUSTED" ? CFG.bustedFine : 0));
    this.police.clearWanted();
    this.combat.clearEnemies();
    this.startPlaying();
  }

  // ---- cars -------------------------------------------------------------
  nearestParkedCar(maxDist = 4) {
    let best = null;
    let bd = maxDist;
    for (const c of this.parkedCars) {
      const d = Math.hypot(this.player.x - c.x, this.player.z - c.z);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  toggleCar() {
    if (this.state !== "playing") return;
    if (this.player.inCar) this.exitCar(false);
    else {
      const car = this.nearestParkedCar();
      if (car) this.enterCar(car);
    }
  }

  enterCar(car) {
    // Stealing: wanted stars rise when a witness sees it.
    if (!car.owned) {
      car.owned = true;
      this.stolenCount = (this.stolenCount ?? 0) + 1;
      this.stolenCar = car.model;
      const witnessed =
        this.peds.peds.some((p) => !p.fallen && Math.hypot(p.x - car.x, p.z - car.z) < 30) ||
        this.police.cars.some((c) => Math.hypot(c.x - car.x, c.z - car.z) < 80);
      if (witnessed) {
        this.police.addWanted(CFG.wantedForSteal);
        this.hud.toast("Someone saw you steal that car!");
      }
      this.parkedCars = this.parkedCars.filter((c) => c !== car);
    }
    this.player.inCar = car;
    this.player.onFoot = false;
    this.player.hide();
    this.camDist = 11;
    this.audio.ensure();
  }

  exitCar(store) {
    const car = this.player.inCar;
    if (!car) return;
    const fx = Math.cos(car.heading);
    const fz = -Math.sin(car.heading);
    this.player.x = car.x - fz * 2.2;
    this.player.z = car.z + fx * 2.2;
    this.player.y = 0;
    this.player.inCar = null;
    this.player.onFoot = true;
    this.player.show();
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
    if (!store) this.parkedCars.push(car);
    this.camDist = 8;
  }

  spawnOwnedCar(model) {
    const x = PLACES.vossAuto.x + 12;
    const z = PLACES.vossAuto.z + 4;
    const mesh = buildCarMesh(model);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const st = makeCarState(model, x, z, 0);
    st.mesh = mesh;
    const car = { ...st, owned: true, missionTarget: false };
    this.enterCar(car);
    this.hud.toast(`Your ${MODELS[model].name} is ready`);
  }

  // ---- combat -----------------------------------------------------------
  tryShoot() {
    if (this.state !== "playing" || !this.player.onFoot) return;
    const origin = new THREE.Vector3(this.player.x, 1.45, this.player.z);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const res = this.combat.weapon === "fists" ? this.combat.punch(origin, dir) : this.combat.shoot(origin, dir);
    if (!res) return;
    this.effects.muzzle(origin, dir);
    if (this.combat.weapon !== "fists") {
      this.audio.shot();
      this.police.addWanted(CFG.wantedForShot);
      this.peds.scare(this.player.x, this.player.z, 30);
    }
    if (res.hit) {
      this.effects.sparks(res.end.x, res.end.y, res.end.z);
      if (res.hit.dead) {
        this.hud.toast(res.hit.boss ? "Kessler is down!" : "Guard down");
      }
    }
  }

  // ---- save -------------------------------------------------------------
  serialize() {
    return {
      money: this.economy.money,
      missionsDone: this.missions.done,
      currentMission: this.missions.current,
      garage: this.economy.garage,
      weapons: [...this.combat.owned],
      weapon: this.combat.weapon,
      armor: this.player.armor,
      health: this.player.health,
      coinsTaken: this.economy.coins.filter((c) => c.taken).length,
      px: this.player.x,
      pz: this.player.z,
      clockHour: this.clockHour,
    };
  }

  doSave() {
    saveGame(this.serialize());
  }

  applySave(d) {
    this.economy.money = d.money ?? CFG.startMoney;
    if (Array.isArray(d.missionsDone)) this.missions.done = d.missionsDone;
    this.missions.current = d.currentMission ?? 0;
    if (Array.isArray(d.garage)) this.economy.garage = d.garage;
    if (Array.isArray(d.weapons)) {
      this.combat.owned = new Set(d.weapons);
      this.combat.weapon = d.weapon ?? "fists";
    }
    this.player.armor = d.armor ?? 0;
    this.player.health = d.health ?? CFG.playerHealth;
    this.player.x = d.px ?? this.player.x;
    this.player.z = d.pz ?? this.player.z;
    this.clockHour = d.clockHour ?? CFG.clockStartHour;
    const taken = d.coinsTaken ?? 0;
    this.economy.coins.forEach((c, i) => {
      if (i < taken) {
        c.taken = true;
        c.mesh.visible = false;
      }
    });
    this.economy.coinsCollected = taken;
    this.player.mesh.position.set(this.player.x, 0, this.player.z);
  }

  // ---- loop -------------------------------------------------------------
  start() {
    const loop = (t) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - (this.lastT ?? t)) / 1000 || 0.016);
      this.lastT = t;
      this.acc = (this.acc ?? 0) + dt;
      let n = 0;
      while (this.acc >= CFG.fixedStep && n < 5) {
        this.step(CFG.fixedStep);
        this.acc -= CFG.fixedStep;
        n++;
      }
      if (n === 5) this.acc = 0;
      this.render();
      this.fpsFrames++;
      if (t - this.fpsTime > 1000) {
        this.fps = this.fpsFrames;
        this.fpsFrames = 0;
        this.fpsTime = t;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  step(dt) {
    if (this.state === "paused" || this.state === "dead" || this.state === "ending") return;
    this.time += dt;
    this.clockHour += dt * CFG.clockRate;
    if (this.state === "menu") {
      // Slow orbit over the city behind the start menu.
      this.camYaw += dt * 0.03;
      const cx = Math.sin(this.camYaw) * 150;
      const cz = Math.cos(this.camYaw) * 150;
      this.camera.position.set(cx, 90, cz);
      this.camera.lookAt(0, 10, -40);
      this.traffic.update(dt, { x: 0, z: 0 });
      this.peds.update(dt);
      return;
    }
    if (this.state !== "playing") return;
    const p = this.player;
    const k = this.keys;
    const ctx = this.stepContext();
    // ---- movement -------------------------------------------------------
    if (p.onFoot) {
      const camFwd = new THREE.Vector3();
      this.camera.getWorldDirection(camFwd);
      camFwd.y = 0;
      camFwd.normalize();
      const input = {
        fwd: (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0),
        strafe: (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0),
        sprint: k.has("ShiftLeft") || k.has("ShiftRight"),
        jump: k.has("Space"),
      };
      p.updateOnFoot(dt, input, camFwd);
      const col = collideCircleAABB(p.x, p.z, CFG.playerRadius, this.colliders);
      p.x = col.x;
      p.z = col.z;
      p.mesh.position.set(p.x, p.y, p.z);
      if (this.interactPressed) {
        this.economy.doPrompt();
      }
    } else {
      const car = p.inCar;
      const input = {
        throttle: (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0),
        steer: (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0),
        handbrake: k.has("Space"),
      };
      const others = [...this.traffic.cars, ...this.police.cars.filter((c) => !c.parked)];
      const ev = driveCarStep(car, input, dt, this.colliders, others);
      if (ev.hitWall && ev.impact > 6) {
        this.audio.crash();
        this.effects.shake(0.35);
        this.effects.smoke(car.x, 1, car.z);
      }
      if (ev.hitCar && ev.impact > 4) {
        this.audio.crash();
        this.police.addWanted(CFG.wantedForHitCar);
      }
      // Run over pedestrians.
      if (Math.abs(car.speed) > 3) {
        const hit = this.peds.knockDown(car.x, car.z, 2.4);
        if (hit) {
          this.police.addWanted(CFG.wantedForHitPed);
          this.peds.scare(car.x, car.z, 30);
          this.audio.crash();
          this.hud.toast("You hit a pedestrian!");
        }
        // Dust + skid marks at speed.
        if (Math.abs(car.speed) > 12) {
          if (Math.random() < 0.25) this.effects.dust(car.x - Math.cos(car.heading) * 2, car.z + Math.sin(car.heading) * 2);
          if (input.handbrake) this.effects.skid(car.x, car.z, car.heading);
        }
      }
      p.x = car.x;
      p.z = car.z;
      p.heading = car.heading;
      // Smoke when wrecked.
      if (car.damage > 25 && Math.random() < 0.2) this.effects.smoke(car.x, 1.2, car.z);
      if (this.interactPressed) this.economy.doPrompt();
    }
    this.interactPressed = false;
    // ---- car prompts ----------------------------------------------------
    if (p.onFoot && this.state === "playing") {
      const near = this.nearestParkedCar();
      if (near) {
        const label = near.missionTarget ? `E — Steal the ${MODELS[near.model].name}` : `E — Steal ${MODELS[near.model].name}`;
        this.hud.setPrompt(label);
      } else if (this.economy.prompt) {
        this.hud.setPrompt(this.economy.prompt);
      } else {
        this.hud.setPrompt("");
      }
    } else if (!p.onFoot && this.economy.prompt) {
      this.hud.setPrompt(this.economy.prompt);
    } else {
      this.hud.setPrompt("");
    }
    // ---- systems --------------------------------------------------------
    this.traffic.update(dt, { x: p.x, z: p.z });
    this.peds.update(dt);
    this.police.update(dt, p, this.colliders);
    this.combat.update(dt, p);
    this.missions.update(dt, ctx);
    this.economy.update(dt, ctx);
    this.effects.update(dt);
    // ---- audio ----------------------------------------------------------
    const driving = !p.onFoot;
    this.audio.engine(driving ? Math.abs(p.inCar.speed) / p.inCar.maxSpeed : 0, driving);
    this.audio.siren(this.police.stars >= 2);
    // ---- HUD ------------------------------------------------------------
    this.hud.setMoney(this.economy.money);
    this.hud.setClock(this.clockHour);
    this.hud.setWanted(this.police.stars);
    this.hud.setHealth(p.health, p.armor);
    this.hud.setObjective(this.missions.active ? this.missions.objective : this.economy.taxi ? "Taxi: pick up the passenger" : "");
    if (!p.onFoot) {
      this.hud.setSpeed(Math.abs(p.inCar.speed) * 3.6, MODELS[p.inCar.model].name);
    } else {
      this.hud.setSpeed(null);
    }
    this.hud.setCrosshair(p.onFoot);
    const wp = this.missionWaypointOverride ?? (this.missions.active ? this.missions.waypoint : null) ?? (this.economy.taxi ? { x: this.economy.taxi.px, z: this.economy.taxi.pz } : null);
    this.hud.drawMinimap({
      roadsX: ROAD_X,
      roadsZ: ROAD_Z,
      player: { x: p.x, z: p.z, heading: p.heading },
      police: this.police.cars.map((c) => ({ x: c.x, z: c.z, mode: c.mode })),
      waypoint: wp,
      coins: this.economy.coins,
      enemies: this.combat.enemies.filter((e) => !e.dead),
      time: this.time,
    });
    // ---- camera ---------------------------------------------------------
    this.updateCamera(dt);
    // ---- wanted consequences --------------------------------------------
    this.topWanted = Math.max(this.topWanted ?? 0, this.police.stars);
    if (this.police.busted) {
      this.police.busted = false;
      this.die("BUSTED");
    }
    if (p.health <= 0) this.die("WASTED");
  }

  stepContext() {
    return {
      player: this.player,
      police: this.police,
      combat: this.combat,
      economy: this.economy,
      effects: this.effects,
      audio: this.audio,
      hud: this.hud,
      game: this,
      now: this.time,
      interactPressed: this.interactPressed,
      stolenCar: this.stolenCar,
      missionWaypointOverride: this.missionWaypointOverride,
      toast: (t) => this.hud.toast(t),
    };
  }

  updateCamera(dt) {
    const p = this.player;
    if (!p.onFoot && p.inCar) {
      // Chase cam: ease behind the car, mouse can orbit.
      const behind = Math.atan2(-Math.cos(p.heading), Math.sin(p.heading));
      this.camYaw += wrapAngle(behind - this.camYaw) * Math.min(1, dt * 1.6);
      this.camPitch += (0.24 - this.camPitch) * Math.min(1, dt * 2);
      this.camDist += (11 - this.camDist) * Math.min(1, dt * 2);
    }
    const tx = p.x;
    const ty = p.y + 1.6;
    const tz = p.z;
    const cp = Math.cos(this.camPitch);
    let cx = tx + Math.sin(this.camYaw) * cp * this.camDist;
    let cy = ty + Math.sin(this.camPitch) * this.camDist;
    let cz = tz + Math.cos(this.camYaw) * cp * this.camDist;
    // Pull the camera out of buildings.
    for (let i = 0; i < 4; i++) {
      let inside = false;
      for (const c of this.colliders) {
        if (cx > c.minX - 0.6 && cx < c.maxX + 0.6 && cz > c.minZ - 0.6 && cz < c.maxZ + 0.6) {
          inside = true;
          break;
        }
      }
      if (!inside || cy > 40) break;
      cx = (cx + tx) / 2;
      cy = (cy + ty) / 2;
      cz = (cz + tz) / 2;
    }
    cy = Math.max(cy, 0.7);
    const sh = this.effects.shakeOffset();
    this.camera.position.set(cx + sh.x, cy + sh.y, cz);
    this.camera.lookAt(tx, ty, tz);
  }

  hideToast() {
    const t = document.getElementById("toast");
    if (t) t.classList.add("hidden");
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ---- deterministic shots ----------------------------------------------
  // Builds one fixed scene, simulates a fixed number of ticks, renders one
  // frame and leaves the game ready for a screenshot. No wall clock, no
  // audio, no random input — the same seed renders the same frame.
  buildShot(name) {
    this.shotMode = true;
    this.state = "playing";
    this.hud.showScreen(null);
    const p = this.player;
    const tick = (input, n) => {
      for (let i = 0; i < n; i++) {
        this.keys = new Set(input ?? []);
        this.step(CFG.fixedStep);
      }
      this.keys = new Set();
    };
    if (name === "chase") {
      // Cover: police chase on the Strip (road x=31), wanted 3, M2 escape.
      // The roadblock ahead is placed by the police system on the first tick.
      this.missions.start(1);
      this.missions.stepIndex = 2;
      this.missions.enterStep(2);
      const car = this.parkedCars.find((c) => c.missionTarget);
      this.parkedCars = this.parkedCars.filter((c) => c !== car);
      car.owned = true; // already "stolen" for this scene; no extra wanted
      car.x = 31;
      car.z = -150;
      car.heading = -Math.PI / 2;
      car.speed = 24;
      this.enterCar(car);
      this.police.wanted = 3;
      this.police.lastCrimeAt = this.time;
      this.economy.money = 2450;
      // Two cruisers flanking (they chase in during the ticks).
      this.police.cars[0].x = 25;
      this.police.cars[0].z = -138;
      this.police.cars[0].heading = -Math.PI / 2;
      this.police.cars[0].speed = 30;
      this.police.cars[1].x = 37;
      this.police.cars[1].z = -132;
      this.police.cars[1].heading = -Math.PI / 2;
      this.police.cars[1].speed = 30;
      this.peds.scare(31, -120, 60);
      tick(["KeyW"], 70);
      // Frame the pursuit: pull the two cruisers up beside the Vantara so
      // the chase reads in one still (they are behind the camera otherwise).
      const pc0 = this.police.cars[0];
      const pc1 = this.police.cars[1];
      pc0.x = car.x - 6.5;
      pc0.z = car.z + 4;
      pc0.heading = -Math.PI / 2;
      pc0.mesh.position.set(pc0.x, 0, pc0.z);
      pc0.mesh.rotation.y = pc0.heading;
      pc1.x = car.x + 6.5;
      pc1.z = car.z - 2;
      pc1.heading = -Math.PI / 2;
      pc1.mesh.position.set(pc1.x, 0, pc1.z);
      pc1.mesh.rotation.y = pc1.heading;
      this.camYaw = Math.PI;
      this.updateCamera(0.016);
      this.hideToast();
    } else if (name === "city") {
      // Vista: player on foot on the beach, camera low behind them looking
      // west over the skyline, the Spire and the Strip.
      p.x = 225;
      p.z = -108;
      p.y = 0;
      p.heading = Math.PI; // facing the city
      p.mesh.position.set(p.x, 0, p.z);
      this.hud.setObjective("");
      this.camYaw = Math.PI * 0.5;
      this.camPitch = 0.42;
      this.camDist = 26;
      tick([], 30);
      this.camera.position.set(242, 7, -116);
      this.camera.lookAt(-60, 12, -75);
      this.hideToast();
    } else if (name === "mission") {
      // M3 on foot at the port: aiming at a guard, containers, waypoint.
      this.missions.start(2);
      this.missions.stepIndex = 1;
      this.missions.enterStep(1);
      this.missions.stepState.sabotaged = [{ x: -178, z: 128 }, { x: -156, z: 150 }];
      p.x = -168;
      p.z = 132;
      p.heading = -Math.PI / 4; // facing the guard by the containers
      p.health = 78;
      p.armor = 40;
      p.mesh.position.set(p.x, 0, p.z);
      this.combat.owned.add("pistol");
      this.combat.weapon = "pistol";
      this.combat.spawnGuard(-160, 140);
      this.combat.spawnGuard(-172, 148);
      this.combat.spawnGuard(-150, 132);
      this.economy.money = 3100;
      tick([], 40);
      // Camera behind the player (opposite her facing) so the guards ahead
      // of her are in frame.
      this.camYaw = Math.atan2(-Math.cos(p.heading), Math.sin(p.heading));
      this.updateCamera(0.016);
      this.hideToast();
    } else if (name === "start") {
      // Start screen over the city.
      this.state = "menu";
      this.camYaw = 0.9;
      this.camera.position.set(150, 90, 150);
      this.camera.lookAt(0, 10, -40);
      this.hud.showScreen("menu-start");
      this.hud.setMoney(150);
      this.hud.setObjective("");
    }
    this.render();
  }

  debugState() {
    const p = this.player;
    return {
      state: this.state,
      fps: this.fps,
      x: Math.round(p.x),
      z: Math.round(p.z),
      onFoot: p.onFoot,
      speed: p.inCar ? Math.round(p.inCar.speed * 3.6) : 0,
      health: Math.round(p.health),
      wanted: this.police.stars,
      money: this.economy.money,
      mission: this.missions.active ? `${this.missions.mission.name} step ${this.missions.stepIndex + 1}` : "none",
      traffic: this.traffic.cars.length,
      peds: this.peds.peds.length,
      enemies: this.combat.aliveCount(),
    };
  }
}