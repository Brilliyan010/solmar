// SOLMAR — 4 scene deterministik (?shot=start|chase|mission|city&seed=1):
// bangun state tetap, simulasi tick tetap tanpa wall clock, lalu pasang kamera
// dari posisi akhir, render 1 frame, set window.__shotReady. Dipakai cdp.mjs shot.
export function setupShots(game) {
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  const seed = Number(params.get('seed') || 1);
  game.setSeed(seed);
  const P = game.player;
  const cam = game.setCamera;
  if (shot === 'start') {
    game.state = 'menu';
    game.hud.showMenu('start');
    P.x = 14; P.z = 110; P.mesh.position.set(14, 0, 110);
    game.ctx.atmosphere.clock = 17;
    for (let i = 0; i < 60; i++) game.step(1 / 60);
    cam(30, 26, 170, 0, 6, 60);
    game.applyCamera();
  } else if (shot === 'chase') {
    game.state = 'playing';
    game.hud.showMenu('none');
    game.ctx.atmosphere.clock = 16.5;
    // Vantara kencang di Neon Strip, polisi di belakang, roadblock di depan.
    const v = game.spawnPlayerCar('vantara', 93, -40, 0);
    v.speed = 34;
    game.driving.enter(v);
    game.police.wanted = 3;
    game.police.update(0.1, game.ctx);
    game.missions.start(1, { debug: true });
    game.missions.enterStep(1, { debug: true });
    game.hud.setObjective('M2 Hot Wheels — Escape the police, reach the Spray Shack');
    for (let i = 0; i < 60; i++) game.step(1 / 60);
    // Staging: 2 cruiser mengepung di samping-belakang mobil agar terlihat di frame.
    const fx = Math.sin(v.angle), fz = Math.cos(v.angle);
    const units = game.police.units;
    if (units[0]) { units[0].v.x = v.x - 5.5; units[0].v.z = v.z - fz * 8; units[0].v.mesh.position.set(units[0].v.x, 0, units[0].v.z); }
    if (units[1]) { units[1].v.x = v.x + 5.5; units[1].v.z = v.z - fz * 12; units[1].v.mesh.position.set(units[1].v.x, 0, units[1].v.z); }
    // Kamera jauh di belakang mobil agar polisi pengejar ikut masuk frame.
    cam(v.x - fx * 22, 8, v.z - fz * 22, v.x + fx * 40, 2, v.z + fz * 40);
    game.applyCamera();
  } else if (shot === 'mission') {
    game.state = 'playing';
    game.hud.showMenu('none');
    game.ctx.atmosphere.clock = 18;
    // Boss fight M5: Kessler fase 2 + 4 guard (dari step 0) + kontainer pelabuhan.
    P.x = -158; P.z = -6; P.mesh.position.set(-158, 0, -6);
    P.angle = Math.PI / 2;
    game.combat.giveWeapon('shotgun');
    P.health = 78; P.armor = 40;
    game.missions.start(4, { debug: true });
    game.missions.enterStep(1, { debug: true });
    const boss = game.bosses.active;
    if (boss) { boss.hp = boss.maxHp * 0.55; boss.phase = 2; }
    game.hud.setObjective('M5 Payback at the Port — Defeat Dario Kessler (Phase 2/3)');
    for (let i = 0; i < 60; i++) game.step(1 / 60);
    // Kamera menghadap boss dari posisi akhir (boss + Mara sama-sama di frame).
    const b2 = game.bosses.active;
    if (b2) { cam(b2.x + 12, 5.5, b2.z - 13, b2.x, 2, b2.z); game.applyCamera(); }
    else { cam(-148, 7, -20, -170, 2, 6); game.applyCamera(); }
  } else if (shot === 'city') {
    game.state = 'playing';
    game.hud.showMenu('none');
    game.ctx.atmosphere.clock = 16;
    P.x = 40; P.z = 170; P.mesh.position.set(40, 0, 170);
    P.angle = Math.PI;
    game.hud.setObjective('Free roam — explore Solmar');
    for (let i = 0; i < 60; i++) game.step(1 / 60);
    // Vista tinggi: skyline + Spire + laut, Mara kecil di foreground.
    cam(95, 58, 252, -40, 6, -60);
    game.applyCamera();
  }
  // Sembunyikan toast sementara agar frame bersih, lalu render sekali.
  const toast = document.getElementById('toast');
  if (toast) toast.style.opacity = '0';
  game.render();
  window.__shotReady = true;
  return true;
}
