// SOLMAR — the three named bosses: Rico Vane (M3), Neon King (M4),
// Dario Kessler (M5). Each has three phases; Kessler calls in guards as
// he weakens and heats the wanted level at phase 3.
import * as THREE from 'three';
import { TUNE } from './config.js';

export function runBosses(scene, ctx) {
  const b = { active: null, defeated: {}, list: [] };

  function spawn(id, x, z) {
    const def = TUNE.bosses[id];
    if (!def) return null;
    const figure = new THREE.Group();
    const scale = id === 'kessler' ? 1.25 : 1.1;
    const coat = id === 'kessler' ? 0x6b1a2e : id === 'neonking' ? 0xd8a02e : 0x5a2e1a;
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.95 * scale, 1.35 * scale, 0.55 * scale),
      new THREE.MeshLambertMaterial({ color: coat }),
    );
    torso.position.y = 1.3 * scale;
    figure.add(torso);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38 * scale, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xc9a184 }),
    );
    head.position.y = 2.2 * scale;
    figure.add(head);
    // Kessler's gold ring; the Neon King's glowing helm.
    if (id === 'kessler') {
      const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.07, 6, 12),
        new THREE.MeshBasicMaterial({ color: 0xffd24d }),
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 2.62;
      figure.add(crown);
    }
    if (id === 'neonking') {
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0x2ee6ff }),
      );
      helm.position.y = 2.2;
      helm.scale.set(1, 0.7, 1);
      figure.add(helm);
    }
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    gun.position.set(0.55, 1.4, 0.3);
    figure.add(gun);
    figure.position.set(x, 0, z);
    scene.add(figure);
    const boss = {
      id,
      def,
      mesh: figure,
      x,
      z,
      hp: def.hp,
      maxHp: def.hp,
      phase: 1,
      shootT: 1,
      moveT: 0,
      strafe: 0,
      minions: [],
    };
    b.active = boss;
    b.list.push(boss);
    ctx.hud?.bossBar(boss);
    ctx.hud?.toast(`BOSS — ${def.name}, ${def.title}`);
    ctx.audio?.sting('boss');
    return boss;
  }

  // Phases flip at 2/3 and 1/3 health; each flip is announced.
  function phaseCheck(boss) {
    const frac = boss.hp / boss.maxHp;
    const want = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (want !== boss.phase) {
      boss.phase = want;
      ctx.hud?.toast(`${boss.def.name} — PHASE ${want}!`);
      ctx.audio?.sting('phase');
      if (boss.id === 'kessler' && want >= 2 && ctx.combat) {
        for (let i = 0; i < 2; i++) {
          const gd = ctx.combat.spawnGuard(boss.x + (i ? 6 : -6), boss.z + 8, { hp: 60, dmg: 9 });
          boss.minions.push(gd);
        }
      }
      if (boss.id === 'kessler' && want === 3) ctx.police?.addHeat(2, 'boss');
    }
  }

  // Hurt a boss; returns true when the hit kills him.
  function damage(boss, n) {
    if (!boss || boss.hp <= 0) return false;
    boss.hp -= n;
    phaseCheck(boss);
    ctx.effects?.flash(boss.x, 1.6, boss.z);
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.mesh.rotation.x = Math.PI / 2;
      boss.mesh.position.y = 0.5;
      b.defeated[boss.id] = true;
      if (b.active === boss) b.active = null;
      ctx.hud?.bossBar(null);
      ctx.economy?.add(boss.def.reward, `boss ${boss.def.name} down`);
      ctx.upgrades?.addCred(300);
      ctx.hud?.toast(`${boss.def.name} DEFEATED — $${boss.def.reward}`);
      ctx.audio?.sting('win');
      return true;
    }
    return false;
  }

  function update(dt) {
    const boss = b.active;
    if (!boss || boss.hp <= 0) return;
    const p = ctx.player;
    const dx = p.x - boss.x;
    const dz = p.z - boss.z;
    const dist = Math.hypot(dx, dz) || 1;
    // Keep a firing distance: close in when far, back off when crowded,
    // strafe sideways in between.
    boss.moveT -= dt;
    const wantDist = boss.id === 'neonking' ? 10 : 16;
    let mx = 0;
    let mz = 0;
    if (dist > wantDist + 4) {
      mx = dx / dist;
      mz = dz / dist;
    } else if (dist < wantDist - 4) {
      mx = -dx / dist;
      mz = -dz / dist;
    } else if (boss.moveT <= 0) {
      boss.strafe = Math.random() < 0.5 ? 1 : -1;
      boss.moveT = 1.6;
    }
    if (boss.strafe && dist <= wantDist + 4) {
      mx += -dz / dist * boss.strafe;
      mz += dx / dist * boss.strafe;
    }
    const sp = boss.def.speed * (boss.phase === 3 ? 1.35 : 1);
    boss.x += mx * sp * dt;
    boss.z += mz * sp * dt;
    boss.mesh.position.set(boss.x, 0, boss.z);
    boss.mesh.rotation.y = Math.atan2(dx, dz);
    // Attack: periodic shots; phase 3 fires bursts of three.
    boss.shootT -= dt;
    if (dist < 40 && boss.shootT <= 0) {
      const burst = boss.phase === 3 ? 3 : 1;
      boss.shootT = boss.phase === 3 ? 0.9 : 1.5;
      for (let i = 0; i < burst; i++) {
        setTimeout(() => {
          if (boss.hp <= 0) return;
          ctx.audio?.shot('enemy');
          ctx.effects?.flash(boss.x, 1.6, boss.z);
          if (Math.random() < 0.5 && p.hurt(boss.def.dmg)) ctx.onWasted?.();
        }, i * 130);
      }
    }
    ctx.hud?.bossBar(boss);
  }

  b.spawn = spawn;
  b.damage = damage;
  b.update = update;
  return b;
}
