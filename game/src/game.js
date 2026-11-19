// game.js — the orchestrator: state machine (menu / playing / paused /
// busted / wasted), the fixed-step loop, input, car enter/exit, the
// wanted/combat/economy glue, HUD state, save/load and the debug hooks
// the playtest driver uses (window.__game, debugState, __shotReady).
import * as THREE from "three";
import { CONFIG } from "./config.js";
import { buildCity } from "./city.js";
import { Player } from "./player.js";
import { driveCar, chaseCamera } from "./driving.js";
import { Traffic } from "./traffic.js";
import { Pedestrians } from "./pedestrians.js";
import { Police } from "./police.js";
import { Combat } from "./combat.js";
import { Missions } from "./missions.js";
import { Economy } from "./economy.js";
import { Hud } from "./hud.js";
import { SoundBank } from "./audio.js";
import { Effects } from "./effects.js";
import { saveGame, loadGame, hasSave, clearSave } from "./save.js";
import { createCar, carDef } from "./vehicles.js";
import { applyShot } from "./shots.js";

const FIXED = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2a35e);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(56, 8, 145);

    this.state = "menu";
    this.time = 0;
    this.clockMinutes = CONFIG.startClockMinutes;
    this.health = CONFIG.playerHealth;
    this.armor = 0;
    this.camMode = 0;
    this.input = { keys: new Set(), mouseDX: 0, mouseDY: 0 };
    this.accumulator = 0;
    this.lastT = 0;
    this.shotName = null;

    const { colliders } = buildCity(this.scene);
    this.colliders = colliders;

    this.player = new Player(this.scene);
    this.traffic = new Traffic(this.scene);
    this.traffic.spawnAll();
    this.peds = new Pedestrians(this.scene);
    this.peds.spawnAll();
    this.police = new Police(this.scene);
    this.combat = new Combat(this.scene);
    this.missions = new Missions(this.scene);
    this.economy = new Economy(this.scene);
    this.hud = new Hud();
    this.audio = new SoundBank();
    this.effects = new Effects(this.scene);

    // Parked cars: Mara's own Pipit at Voss Auto, plus street parking.
    this.parked = [];
    this.spawnParked("pipit", 62, 132, 0, { owned: true });
    this.spawnParked("corto", 93, -20, Math.PI / 2);
    this.spawnParked("cabrio", -31, 60, 0);
    this.spawnParked("mule", 155, 93, -Math.PI / 2);
    this.spawnParked("hauler", -93, -150, Math.PI);
    // The M2 prize: a Vantara locked at Kessler's warehouse.
    this.spawnParked("vantara", 140, 20, Math.PI / 2);
    this.car = null; // currently driven car

    this.bindInput();
    this.hud.bind({
      newGame: () => this.newGame(),
      continueGame: () => this.continueGame(),
      resume: () => this.resume(),
      save: () => { this.doSave(); this.hud.toast("Game saved."); },
      quitToMenu: () => this.toMenu(),
      retry: () => this.respawn(),
    });
    this.refreshMenu();
    this.hud.update(this.hudState());
  }

  spawnParked(id, x, z, heading, opts = {}) {
    const car = createCar(carDef(id), x, z, heading, opts);
    this.scene.add(car.mesh);
    this.parked.push(car);
    return car;
  }

  // ---- context shared with the subsystems -------------------------------
  ctx() {
    return {
      time: this.time,
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.player.heading,
      playerSpeed: this.inCar() ? Math.abs(this.car.speed) : (this.player.moving ? 6 : 0),
      inCar: this.inCar(),
      car: this.car,
      carId: this.car?.def.id,
      colliders: this.colliders,
      trafficCars: this.traffic.cars,
      peds: this.peds.peds,
      policeCars: [...this.police.cruisers, ...this.police.roadblock],
      missions: this.missions,
      economy: this.economy,
      combat: this.combat,
      police: this.police,
      effects: this.effects,
      audio: this.audio,
      onToast: (t) => this.hud.toast(t),
      onRam: (c) => this.onRam(c),
      onCrash: (car, speed) => this.onCrash(car, speed),
      onHitPed: (p) => this.onHitPed(p),
      onBusted: () => this.endGame("busted"),
      onPlayerDamage: (n) => this.damagePlayer(n),
      onWanted: (n) => this.police.addWanted(n),
      onHitGuard: () => {},
      onKillGuard: () => this.missions.onGuardKilled(this.ctx()),
      save: () => this.doSave(),
    };
  }

  inCar() { return this.car !== null; }

  // ---- input -------------------------------------------------------------
  bindInput() {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.input.keys.add(e.code);
      this.audio.ensure();
      if (this.state === "playing") {
        if (e.code === "KeyF") this.toggleCar();
        if (e.code === "KeyE") this.interact();
        if (e.code === "KeyC") this.camMode = (this.camMode + 1) % 2;
        if (e.code === "KeyR") this.audio.horn();
        if (e.code === "Digit1") this.combat.select("fists");
        if (e.code === "Digit2") this.combat.select("pistol");
        if (e.code === "Digit3") this.combat.select("shotgun");
        if (e.code === "KeyM") this.audio.toggleMute();
        if (e.code === "KeyP" || e.code === "Escape") this.pause();
      } else if (this.state === "paused" && (e.code === "KeyP" || e.code === "Escape")) {
        this.resume();
      } else if (this.state === "menu" && e.code === "Enter") {
        this.newGame();
      }
    });
    window.addEventListener("keyup", (e) => this.input.keys.delete(e.code));
    window.addEventListener("blur", () => this.input.keys.clear());
    this.canvas.addEventListener("click", () => {
      this.audio.ensure();
      if (this.state === "playing") {
        this.canvas.requestPointerLock?.();
        this.attack();
      }
    });
    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.input.mouseDX += e.movementX;
        this.input.mouseDY += e.movementY;
      }
    });
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  attack() {
    if (this.inCar()) return; // no drive-by in this build; shoot on foot
    const dx = Math.sin(this.player.camYaw);
    const dz = Math.cos(this.player.camYaw);
    this.combat.fire(this.player.x, 1.4, this.player.z, dx, dz, this.ctx());
    if (this.combat.weapon !== "fists" && this.police.stars < CONFIG.wantedMax) {
      this.police.addWanted(CONFIG.shootWanted);
    }
    this.peds.scare(this.player.x, this.player.z, this.time);
  }

  interact() {
    const done = this.economy.interactPrompt(this.ctx(), true);
    if (!done && this.missions.currentStep()?.kind === "sabotage") {
      this.missions.trySabotage(this.player.x, this.player.z, this.ctx());
    }
  }

  nearestCar(maxD = 4) {
    let best = null;
    let bestD = maxD;
    for (const c of [...this.parked, ...this.traffic.cars]) {
      const d = Math.hypot(c.x - this.player.x, c.z - this.player.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  toggleCar() {
    if (this.inCar()) {
      // Exit: step out to the side, car becomes parked.
      const car = this.car;
      car.speed = 0;
      const side = car.heading + Math.PI / 2;
      this.player.teleport(car.x + Math.sin(side) * 2.4, car.z + Math.cos(side) * 2.4);
      this.player.camYaw = car.heading;
      this.player.mesh.visible = true;
      this.car = null;
      if (!this.parked.includes(car)) this.parked.push(car);
      // Parked inside the Voss Auto yard = stored in the garage.
      if (car.x > 37 && car.x < 87 && car.z > 99 && car.z < 149 && !car.owned
        && this.economy.garage.length < CONFIG.garageSlots) {
        car.owned = true;
        this.economy.garage.push(car.def.id);
        this.hud.toast(`${car.def.name} stored in the garage.`);
        this.doSave();
      }
      return;
    }
    const car = this.nearestCar();
    if (!car) return;
    // Steal it unless it is Mara's own.
    if (!car.owned) {
      const witnessed = this.peds.peds.some((p) => Math.hypot(p.x - car.x, p.z - car.z) < 25)
        || this.police.cruisers.some((c) => Math.hypot(c.x - car.x, c.z - car.z) < 40);
      if (witnessed) {
        this.police.addWanted(CONFIG.stealWanted);
        this.hud.toast(`You stole the ${car.def.name}! The cops saw it.`);
      } else {
        this.hud.toast(`You took the ${car.def.name}.`);
      }
      this.economy.stats.stolen++;
      const ti = this.traffic.cars.indexOf(car);
      if (ti >= 0) this.traffic.cars.splice(ti, 1);
      const pi = this.parked.indexOf(car);
      if (pi >= 0) this.parked.splice(pi, 1);
    }
    this.car = car;
    car.driver = "player";
    this.player.mesh.visible = false;
    this.audio.setEngine(0, true);
  }

  // ---- damage / end states ------------------------------------------------
  damagePlayer(n) {
    let rest = n;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    this.effects.addShake(0.3);
    if (this.health <= 0) {
      this.health = 0;
      this.endGame("wasted");
    }
  }

  onCrash(car, speed) {
    this.effects.sparks(car.x, 1, car.z);
    this.effects.addShake(0.25);
    this.audio.crash();
    if (speed > 18) this.damagePlayer(4);
  }

  onHitPed() {
    this.police.addWanted(CONFIG.hitPedWanted);
    this.peds.scare(this.player.x, this.player.z, this.time);
    this.audio.crash();
    this.hud.toast("You hit a pedestrian! Wanted level up.");
  }

  onRam() {
    if (this.car) {
      this.car.speed *= 0.5;
      this.car.damaged = Math.min(1, this.car.damaged + 0.12);
    }
    this.effects.sparks(this.player.x, 1, this.player.z);
    this.effects.addShake(0.4);
    this.audio.crash();
  }

  endGame(kind) {
    if (this.state !== "playing") return;
    this.state = kind;
    document.exitPointerLock?.();
    const lost = Math.min(this.economy.money, 200);
    this.economy.money -= lost;
    this.police.clearWanted();
    this.hud.showEnd(
      kind,
      kind === "busted"
        ? `The Solmar PD caught you. You lost $${lost} in fines. Mara will be out soon — the city is still waiting.`
        : `Mara is down. The hospital bill cost you $${lost}. Kessler is still out there.`,
    );
    this.audio.setEngine(0, false);
  }

  respawn() {
    this.health = CONFIG.playerHealth;
    this.armor = 25;
    this.player.teleport(56, 132);
    this.player.camYaw = Math.PI;
    if (this.car) { this.car.speed = 0; this.car = null; }
    this.player.mesh.visible = true;
    this.state = "playing";
    this.hud.hideMenus();
  }

  // ---- menu / save ---------------------------------------------------------
  missionListHtml() {
    return CONFIG.missionNames.map((n, i) =>
      `${this.missions.completed[i] ? "✓" : "○"} ${n} — $${CONFIG.missionRewards[i].toLocaleString("en-US")}`).join("<br>");
  }

  refreshMenu() {
    this.hud.showStart(hasSave(), this.missionListHtml());
  }

  newGame() {
    clearSave();
    this.economy.money = 250;
    this.missions.completed = [false, false, false, false, false];
    this.health = CONFIG.playerHealth;
    this.armor = 0;
    this.player.teleport(56, 132);
    this.state = "playing";
    this.hud.hideMenus();
    this.hud.toast("Welcome to Solmar, Mara. Take the next mission at Voss Auto.");
  }

  continueGame() {
    const s = loadGame();
    if (!s) return;
    this.economy.money = s.money ?? 250;
    this.missions.completed = s.completed ?? [false, false, false, false, false];
    this.economy.coinsTaken = s.coinsTaken ?? 0;
    for (const c of this.economy.coins) {
      if (s.coins?.includes(`${c.x},${c.z}`)) { c.taken = true; this.scene.remove(c.mesh); }
    }
    if (s.unlockedPistol) this.combat.unlock("pistol");
    if (s.unlockedShotgun) this.combat.unlock("shotgun");
    this.player.teleport(s.px ?? 56, s.pz ?? 132);
    this.health = CONFIG.playerHealth;
    this.armor = s.armor ?? 0;
    this.state = "playing";
    this.hud.hideMenus();
    this.hud.toast("Welcome back to Solmar.");
  }

  doSave() {
    saveGame({
      money: this.economy.money,
      completed: this.missions.completed,
      coinsTaken: this.economy.coinsTaken,
      coins: this.economy.coins.filter((c) => c.taken).map((c) => `${c.x},${c.z}`),
      unlockedPistol: !!this.combat.unlockedPistol,
      unlockedShotgun: !!this.combat.unlockedShotgun,
      armor: this.armor,
      px: this.player.x,
      pz: this.player.z,
      stats: this.economy.stats,
    });
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    document.exitPointerLock?.();
    const s = this.economy.stats;
    this.hud.showPause(
      `Cash $${this.economy.money.toLocaleString("en-US")} &middot; Missions ${this.missions.completed.filter(Boolean).length}/5 &middot; ` +
      `Cars stolen ${s.stolen} &middot; Sun Coins ${this.economy.coinsTaken}/10 &middot; Top wanted ${"★".repeat(s.topWanted || 0) || "—"}`,
    );
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.hud.hidePause();
  }

  toMenu() {
    this.state = "menu";
    this.doSave();
    this.refreshMenu();
  }

  // ---- HUD state ------------------------------------------------------------
  hudState() {
    const m = this.missions.current();
    return {
      money: this.economy.money,
      health: this.health,
      armor: this.armor,
      stars: this.police.stars,
      blink: this.police.blink,
      clockMinutes: this.clockMinutes,
      missionName: m ? m.name : "FREE ROAM",
      objective: this.missions.objectiveText(),
      speedKmh: this.inCar() ? this.car.speed * 3.6 : 0,
      carName: this.car?.def.name ?? "",
      damaged: this.car?.damaged ?? 0,
      inCar: this.inCar(),
      prompt: this.state === "playing" ? this.promptText() : null,
      aiming: this.state === "playing" && !this.inCar() && this.combat.weapon !== "fists",
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.inCar() ? this.car.heading : this.player.heading,
      waypoint: this.missions.waypoint,
      policeDots: this.police.cruisers.map((c) => [c.x, c.z]),
    };
  }

  promptText() {
    if (!this.inCar()) {
      const car = this.nearestCar();
      if (car) return `F — ${car.owned ? "Drive" : "Steal"} ${car.def.name}`;
    }
    return this.economy.interactPrompt(this.ctx(), false);
  }

  // ---- main update ------------------------------------------------------------
  update(dt) {
    this.time += dt;
    this.clockMinutes = (this.clockMinutes + dt * (CONFIG.clockRate / 60)) % 1440;
    const ctx = this.ctx();
    this.economy.stats.topWanted = Math.max(this.economy.stats.topWanted, this.police.stars);

    // World life goes on in every state (menu backdrop stays alive).
    this.traffic.update(dt);
    this.peds.update(dt, this.time);
    this.effects.update(dt, this.time);

    if (this.state === "playing") {
      if (this.inCar()) {
        driveCar(this.car, dt, this.input, ctx);
        chaseCamera(this.car, this.camera, dt, this.player.camYaw, this.camMode);
        this.player.x = this.car.x;
        this.player.z = this.car.z;
        this.audio.setEngine(Math.abs(this.car.speed) / CONFIG.carMaxSpeed, true);
        if (Math.abs(this.car.speed) > 20 && this.input.keys.has("Space")) {
          this.effects.dust(this.car.x, this.car.z);
        }
        if (this.car.damaged > 0.6 && Math.random() < dt * 8) {
          this.effects.smoke(this.car.x, 1.2, this.car.z);
        }
      } else {
        this.player.update(dt, this.input, this.colliders, this.camera);
        this.audio.setEngine(0, false);
      }
      this.police.update(dt, ctx);
      this.combat.update(dt, ctx);
      this.missions.update(dt, ctx);
      this.economy.update(dt, ctx);
      this.audio.setSiren(this.police.stars, this.time);
      this.effects.applyShake(this.camera);
    } else if (this.state === "menu") {
      // Slow orbit around the Spire for the menu backdrop.
      const a = this.time * 0.05;
      this.camera.position.set(Math.sin(a) * 130, 55, Math.cos(a) * 130 - 20);
      this.camera.lookAt(0, 18, 0);
      this.police.update(dt, { ...ctx, playerX: 56, playerZ: 132, inCar: false, playerSpeed: 0, playerHeading: 0 });
    }
    this.input.mouseDX = 0;
    this.input.mouseDY = 0;
    // Deterministic screenshot scenes pin the camera; the live camera
    // code above must not move it during a shot.
    if (this.shotCamera) {
      this.camera.position.set(...this.shotCamera.pos);
      this.camera.lookAt(...this.shotCamera.look);
    }
    this.hud.update(this.hudState());
  }

  step(n = 1) {
    for (let i = 0; i < n; i++) this.update(FIXED);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.lastT) / 1000 || FIXED);
    this.lastT = now;
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED && steps < 5) {
      this.update(FIXED);
      this.accumulator -= FIXED;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
    this.render();
  }

  // Deterministic screenshot path: apply the scene, step fixed ticks,
  // render once, flag ready. No wall clock involved.
  renderShot(name) {
    this.shotName = name;
    this.state = "playing";
    this.hud.hideMenus();
    applyShot(this, name);
    this.step(90);
    // Mission briefing toasts are for live play; a screenshot should
    // show the HUD clean, so hide any toast before the capture.
    document.getElementById("toast").style.display = "none";
    this.hud.update(this.hudState());
    this.render();
    window.__shotReady = true;
  }

  debugState() {
    return `state=${this.state} x=${this.player.x.toFixed(1)} z=${this.player.z.toFixed(1)} ` +
      `speed=${this.inCar() ? (this.car.speed * 3.6).toFixed(0) : 0}km/h wanted=${this.police.stars} ` +
      `mission=${this.missions.active >= 0 ? this.missions.active + 1 : "-"}:${this.missions.step} ` +
      `health=${Math.round(this.health)} money=$${this.economy.money} ` +
      `traffic=${this.traffic.cars.length} peds=${this.peds.peds.length} guards=${this.combat.guards.filter((g) => !g.dead).length}`;
  }
}
