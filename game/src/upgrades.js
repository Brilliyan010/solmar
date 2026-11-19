// SOLMAR — progression: 12 upgrade (senjata/mobil/Mara) + 12 Sun Relic + Street Cred.
import * as THREE from 'three';
import { CFG } from './config.js';

export const UPGRADES = CFG.upgrades;
export const CRED_RANKS = CFG.credRanks;

// 12 posisi Sun Relic tersembunyi di kota (atap, pantai, pelabuhan, taman...).
export const RELIC_SPOTS = [
  { x: -62, z: -58, hint: 'Solmar Spire base' }, { x: 150, z: 196, hint: 'Marina pier end' },
  { x: -178, z: 120, hint: 'Old Port containers' }, { x: 60, z: 204, hint: 'Beach south' },
  { x: -124, z: 124, hint: 'Park fountain' }, { x: 93, z: 28, hint: 'Neon Strip roof' },
  { x: -31, z: -155, hint: 'North road end' }, { x: 155, z: -93, hint: 'East ridge' },
  { x: -155, z: -31, hint: 'West ridge' }, { x: 31, z: 155, hint: 'South plaza' },
  { x: 0, z: -178, hint: 'Airport fence' }, { x: -93, z: 93, hint: 'Old town alley' },
];

export function createUpgrades(scene, ctx) {
  const u = {
    owned: new Set(), relicsFound: new Set(), cred: 0,
    relicMeshes: [],
  };
  // Mesh relic: bola emas melayang + cahaya.
  for (let i = 0; i < RELIC_SPOTS.length; i++) {
    const s = RELIC_SPOTS[i];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd24d }));
    m.position.set(s.x, 1.6, s.z);
    scene.add(m);
    u.relicMeshes.push(m);
  }
  function has(id) { return u.owned.has(id); }
  function buy(id) {
    const def = UPGRADES.find((x) => x.id === id);
    if (!def || u.owned.has(id)) return false;
    const cost = Math.round(def.cost * (u.relicPerk('discount') ? 0.7 : 1));
    if (!ctx.economy?.spend(cost)) return false;
    u.owned.add(id);
    if (id === 'm_vest') ctx.player.armor = 50;
    if (id === 'm_health') ctx.player.health = 150;
    ctx.hud?.toast(`UPGRADE — ${def.name}: ${def.desc}`);
    ctx.audio?.sting('buy');
    return true;
  }
  function relicPerk(kind) {
    const n = u.relicsFound.size;
    if (kind === 'hp' && n >= 3) return true;
    if (kind === 'cooldown' && n >= 6) return true;
    if (kind === 'money' && n >= 9) return true;
    if (kind === 'discount' && n >= 12) return true;
    return false;
  }
  function collectRelic(i) {
    if (u.relicsFound.has(i)) return false;
    u.relicsFound.add(i);
    const m = u.relicMeshes[i];
    if (m) m.visible = false;
    ctx.economy?.add(200, 'Sun Relic');
    ctx.audio?.sting('relic');
    const n = u.relicsFound.size;
    const perk = CFG.relicPerks.find((p) => p.n === n);
    if (perk) {
      ctx.hud?.toast(`SUN BLESSING — ${perk.name}: ${perk.desc}`);
      if (perk.n === 3) ctx.player.health = Math.min(150, ctx.player.health + 25);
    } else ctx.hud?.toast(`Sun Relic ${n}/12 found (+$200)`);
    return true;
  }
  function addCred(n) {
    const before = rank();
    u.cred += n;
    const after = rank();
    if (after !== before) {
      ctx.hud?.toast(`STREET CRED — Rank up: ${CRED_RANKS[after]}!`);
      ctx.audio?.sting('rankup');
    }
  }
  function rank() {
    let r = 0;
    for (let i = 0; i < CFG.credNeed.length; i++) if (u.cred >= CFG.credNeed[i]) r = i;
    return r;
  }
  function update(dt) {
    const t = performance.now() / 500;
    u.relicMeshes.forEach((m, i) => {
      if (u.relicsFound.has(i)) return;
      m.position.y = 1.6 + Math.sin(t + i) * 0.35;
      m.rotation.y += dt;
    });
    // Ambil relic bila Mara dekat.
    const p = ctx.player;
    RELIC_SPOTS.forEach((s, i) => {
      if (!u.relicsFound.has(i) && Math.hypot(s.x - p.x, s.z - p.z) < 2.4) collectRelic(i);
    });
  }
  u.has = has; u.buy = buy; u.relicPerk = relicPerk; u.collectRelic = collectRelic;
  u.addCred = addCred; u.rank = rank; u.update = update;
  u.CRED_RANKS = CRED_RANKS; u.UPGRADES = UPGRADES;
  return u;
}
