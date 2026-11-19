// shots.js — deterministic screenshot scenes (?shot=<name>&seed=1).
// Each scene builds a fixed game state from the seeded world, steps the
// simulation 90 fixed ticks, and renders one frame. The driver waits for
// window.__shotReady, then captures the frame. No wall clock, no input.
import { createCar, carDef } from "./vehicles.js";

export function applyShot(g, name) {
  const S = g; // the Game instance
  if (name === "chase") {
    // Cover: police chase on the Neon Strip, Vantara at speed, wanted 3.
    const v = createCar(carDef("vantara"), 31, 0, 0, { driver: "player" });
    S.scene.add(v.mesh);
    S.car = v;
    v.speed = 30;
    S.player.mesh.visible = false;
    S.player.x = 31;
    S.player.z = 0;
    S.police.stars = 3;
    S.police.addWanted(0);
    const c1 = S.police.spawnCruiser(28, -28, "chase");
    c1.heading = 0;
    c1.speed = 28;
    const c2 = S.police.spawnCruiser(24, 2, "chase");
    c2.heading = 0;
    c2.speed = 30;
    S.police.cruisers.push(c1, c2);
    S.police.makeRoadblock(31, 60, 0);
    S.missions.start(1, S.ctx());
    S.missions.enterStep(2, S.ctx());
    S.peds.scare(31, 0, S.time);
    S.economy.money = 2450;
    // Hold the gas during the shot so the chase is mid-flight.
    S.input.keys.add("KeyW");
    // A few traffic cars sharing the strip.
    const t1 = createCar(carDef("corto"), 31, 40, 0, { driver: "traffic" });
    S.scene.add(t1.mesh);
    S.traffic.cars.push(t1);
    const t2 = createCar(carDef("cabrio"), 93, 70, Math.PI / 2, { driver: "traffic" });
    S.scene.add(t2.mesh);
    S.traffic.cars.push(t2);
  } else if (name === "city") {
    // Vista: golden-hour skyline from the Marina Bay pier, Mara on foot.
    S.player.teleport(0, -168);
    S.player.camYaw = 0; // camera behind her, looking south at the city
    S.player.heading = 0;
    S.camera.position.set(25, 28, -218);
    S.camera.lookAt(0, 14, 60);
    S.economy.money = 1250;
    // Freeze the camera for the shot: mark it so update() does not move it.
    S.shotCamera = { pos: [25, 28, -218], look: [0, 14, 60] };
  } else if (name === "mission") {
    // M3 Old Port: Mara aiming at a Kessler guard by the containers.
    S.missions.start(2, S.ctx());
    S.missions.enterStep(1, S.ctx());
    S.player.teleport(128, -16);
    S.player.heading = Math.atan2(126 - 128, -2 - -16);
    S.player.camYaw = S.player.heading;
    S.health = 78;
    S.armor = 40;
    S.combat.unlock("pistol");
    S.combat.select("pistol");
    S.economy.money = 3200;
    S.police.stars = 1;
  } else if (name === "start") {
    // Start screen over the city at golden hour.
    S.state = "menu";
    S.camera.position.set(110, 42, -150);
    S.camera.lookAt(0, 20, 20);
    S.shotCamera = { pos: [110, 42, -150], look: [0, 20, 20] };
    S.refreshMenu();
  } else {
    // Unknown scene: plain free-roam frame at Voss Auto.
    S.player.teleport(56, 132);
  }
}
