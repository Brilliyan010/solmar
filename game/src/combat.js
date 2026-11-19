// SOLMAR — combat: tinju/pistol/shotgun/SMG, guard AI Kessler, health/armor.
import * as THREE from 'three';

const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, rate: 2.2, range: 2.6, mag: Infinity, auto: false },
  pistol: { name: 'Pistol', dmg: 20, rate: 3.5, range: 42, mag: 12, auto: false },
  shotgun: { name: 'Shotgun', dmg: 15, rate: 1.1, range: 20, mag: 6, auto: false, pellets: 5 },
  smg: { name: 'SMG', dmg: 11, rate: 9, range: 34, mag: 30, auto: true },
};

export function createCombat(scene, ctx) {
  const c = {
    weapons: WEAPONS, current: 'fists', ammo: 12, cooldown: 0,
    guards: [], tracers: [],
  };
  const guardGeo = new THREE.BoxGeometry(0.8, 1.15, 0.45);
  const guardHead = new THREE.SphereGeometry(0.33, 8, 8);
  function spawnGuard(x, z, opts = {}) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(guardGeo, new THREE.MeshLambertMaterial({ color: opts.boss ? 0x8a1a1a : 0x3a3a3a }));
    body.position.y = 1.2; g.add(body);
    const head = new THREE.Mesh(guardHead, new THREE.MeshLambertMaterial({ color: 0xc9a184 }));
    head.position.y = 2.0; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.45, 1.3, 0.3); g.add(gun);
    g.position.set(x, 0, z);
    scene.add(g);
    const guard = {
      mesh: g, x, z, hp: opts.hp || 60, speed: opts.speed || 3.4,
      dmg: opts.dmg || 8, shootT: 0, boss: !!opts.boss, name: opts.name || 'Guard',
    };
    c.guards.push(guard);
    return guard;
  }
  function damageGuard(guard, n) {
    guard.hp -= n;
    ctx.effects?.flash(guard.x, 1.4, guard.z);
    if (guard.hp <= 0) {
      guard.mesh.rotation.x = Math.PI / 2;
      guard.mesh.position.y = 0.4;
      guard.dead = true;
      ctx.effects?.smoke(guard.x, guard.z);
      return true;
    }
    return false;
  }
  function shoot() {
    if (c.cooldown > 0) return;
    const w = WEAPONS[c.current];
    const up = ctx.upgrades;
    const dmgMul = (up?.has('w_dmg') ? 1.35 : 1) * (up?.has('w_armor_pierce') ? 1.15 : 1);
    const rateMul = up?.has('w_rate') ? 1.3 : 1;
    c.cooldown = 1 / (w.rate * rateMul);
    const p = ctx.player;
    if (c.current === 'fists') {
      ctx.audio?.shot('punch');
      for (const gd of c.guards) {
        if (!gd.dead && Math.hypot(gd.x - p.x, gd.z - p.z) < w.range) damageGuard(gd, w.dmg * dmgMul);
      }
      const boss = ctx.bosses?.active;
      if (boss && boss.hp > 0 && Math.hypot(boss.x - p.x, boss.z - p.z) < w.range + 1) ctx.bosses.damage(boss, w.dmg * dmgMul);
      return;
    }
    if (c.ammo <= 0) { ctx.audio?.shot('dry'); ctx.hud?.toast('RELOAD — press R'); return; }
    c.ammo--;
    ctx.audio?.shot(c.current);
    ctx.effects?.flash(p.x + Math.sin(p.angle) * 1.2, 1.4, p.z + Math.cos(p.angle) * 1.2);
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const a = p.angle + (Math.random() - 0.5) * (w.pellets ? 0.24 : 0.03);
      const dx = Math.sin(a), dz = Math.cos(a);
      let best = null, bd = w.range;
      for (const gd of c.guards) {
        if (gd.dead) continue;
        const gx = gd.x - p.x, gz = gd.z - p.z;
        const along = gx * dx + gz * dz;
        const perp = Math.abs(gx * dz - gz * dx);
        if (along > 0 && along < bd && perp < 1.4) { bd = along; best = gd; }
      }
      if (best) {
        if (damageGuard(best, w.dmg * dmgMul)) {
          ctx.economy?.add(25, 'guard down');
          ctx.police?.addHeat(1, 'kill');
        }
      } else {
        // Boss aktif juga bisa ditembak (ray test yang sama, target lebih besar).
        const boss = ctx.bosses?.active;
        if (boss && boss.hp > 0) {
          const gx = boss.x - p.x, gz = boss.z - p.z;
          const along = gx * dx + gz * dz;
          const perp = Math.abs(gx * dz - gz * dx);
          if (along > 0 && along < w.range && perp < 2.2) ctx.bosses.damage(boss, w.dmg * dmgMul);
        }
      }
    }
    if (ctx.police) ctx.police.addHeat(0, 'shot'); // tembakan terdengar
    ctx.dangerPos = { x: p.x, z: p.z };
  }
  function reload() {
    const w = WEAPONS[c.current];
    const mag = w.mag * (ctx.upgrades?.has('w_mag') ? 1.6 : 1);
    c.ammo = mag;
    ctx.audio?.sting('reload');
  }
  function giveWeapon(key) {
    c.current = key;
    const w = WEAPONS[key];
    c.ammo = w.mag * (ctx.upgrades?.has('w_mag') ? 1.6 : 1);
    ctx.player.mesh.getObjectByName('gun').visible = key !== 'fists';
  }
  function update(dt) {
    c.cooldown = Math.max(0, c.cooldown - dt);
    const p = ctx.player;
    for (const gd of [...c.guards]) {
      if (gd.dead) continue;
      const dx = p.x - gd.x, dz = p.z - gd.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 46) continue;
      const sp = gd.speed * (dist > 14 ? 1 : 0.4);
      gd.x += (dx / dist) * sp * dt;
      gd.z += (dz / dist) * sp * dt;
      gd.mesh.position.set(gd.x, 0, gd.z);
      gd.mesh.rotation.y = Math.atan2(dx, dz);
      gd.shootT -= dt;
      if (dist < 30 && gd.shootT <= 0) {
        gd.shootT = 1.4;
        ctx.audio?.shot('enemy');
        ctx.effects?.flash(gd.x, 1.4, gd.z);
        if (Math.random() < 0.55 && p.hurt(gd.dmg)) ctx.onWasted?.();
      }
    }
    // Bersihkan guard mati yang jauh.
    c.guards = c.guards.filter((gd) => !gd.dead || Math.hypot(gd.x - p.x, gd.z - p.z) < 60);
  }
  c.spawnGuard = spawnGuard; c.shoot = shoot; c.reload = reload;
  c.giveWeapon = giveWeapon; c.update = update; c.damageGuard = damageGuard;
  return c;
}
