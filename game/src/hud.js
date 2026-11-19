// SOLMAR — HUD: uang/health/wanted/jam/objective, minimap canvas, boss bar, menu.
import { CFG } from './config.js';

export function createHud(ctx) {
  const $ = (id) => document.getElementById(id);
  const h = { waypoint: null, boss: null, toastT: 0 };
  const mm = $('minimap');
  const mmc = mm?.getContext('2d');
  function setObjective(t) { const el = $('objective'); if (el) el.textContent = t; }
  function setWaypoint(w) { h.waypoint = w; }
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.opacity = '1';
    h.toastT = 4;
  }
  function bossBar(boss) {
    h.boss = boss;
    const bar = $('bossbar');
    if (!bar) return;
    if (!boss) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    $('bossname').textContent = `${boss.def.name} — ${boss.def.title} (Phase ${boss.phase}/3)`;
    $('bossfill').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  }
  function flashMoney() { const el = $('money'); if (el) el.style.color = '#7cff5a'; setTimeout(() => { if (el) el.style.color = ''; }, 300); }
  function drawMinimap() {
    if (!mmc) return;
    const S = 150, sc = S / 420;
    mmc.clearRect(0, 0, S, S);
    mmc.fillStyle = 'rgba(10,16,24,0.85)'; mmc.fillRect(0, 0, S, S);
    // Laut + pantai.
    mmc.fillStyle = '#1e6f8e'; mmc.fillRect(0, (200 + 210) * sc, S, S);
    // Jalan.
    mmc.strokeStyle = '#5a6068'; mmc.lineWidth = 4;
    for (const r of CFG.roadAt) {
      mmc.beginPath(); mmc.moveTo((r + 210) * sc, 0); mmc.lineTo((r + 210) * sc, S); mmc.stroke();
      mmc.beginPath(); mmc.moveTo(0, (r + 210) * sc); mmc.lineTo(S, (r + 210) * sc); mmc.stroke();
    }
    // Waypoint.
    if (h.waypoint) {
      mmc.fillStyle = '#ffd24d';
      mmc.beginPath();
      mmc.arc((h.waypoint.x + 210) * sc, (h.waypoint.z + 210) * sc, 5, 0, 7);
      mmc.fill();
    }
    // Polisi (biru) + player (panah putih).
    const p = ctx.player;
    mmc.fillStyle = '#4da6ff';
    for (const u of ctx.police?.units || []) {
      mmc.beginPath(); mmc.arc((u.v.x + 210) * sc, (u.v.z + 210) * sc, 3, 0, 7); mmc.fill();
    }
    mmc.save();
    mmc.translate((p.x + 210) * sc, (p.z + 210) * sc);
    mmc.rotate(p.angle || 0);
    mmc.fillStyle = '#ffffff';
    mmc.beginPath(); mmc.moveTo(0, -6); mmc.lineTo(4, 5); mmc.lineTo(-4, 5); mmc.closePath(); mmc.fill();
    mmc.restore();
  }
  function update(dt) {
    const p = ctx.player;
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('money', `$${ctx.economy?.money ?? 0}`);
    set('health', `HP ${Math.ceil(p.health)}${p.armor > 0 ? ` | ARMOR ${Math.ceil(p.armor)}` : ''}`);
    set('speed', ctx.driving?.vehicle ? `${Math.round(Math.abs(ctx.driving.vehicle.speed) * 3.6)} km/h — ${ctx.driving.vehicle.def.name}` : 'On foot');
    // Wanted stars.
    const w = $('wanted');
    if (w) {
      w.textContent = '★'.repeat(ctx.police?.wanted || 0) + '☆'.repeat(5 - (ctx.police?.wanted || 0));
      w.style.color = (ctx.police?.wanted || 0) >= 3 ? '#ff4444' : '#ffd24d';
    }
    // Jam kota + fase hari + radio.
    const t = ctx.atmosphere?.clock ?? 18;
    const hh = Math.floor(t) % 24, mm2 = Math.floor((t % 1) * 60);
    set('clock', `${String(hh).padStart(2, '0')}:${String(mm2).padStart(2, '0')} — ${ctx.atmosphere?.phaseName || 'Golden Hour'}`);
    set('radio', `♪ ${ctx.audio?.radioName() || 'Solmar FM'}`);
    // Misi + cred + relic.
    const m = ctx.missions;
    set('missionline', m?.active >= 0 ? `${m.defs[m.active].name} (${m.step + 1}/${m.defs[m.active].steps.length})` : 'Free Roam');
    set('credline', `Cred: ${ctx.upgrades?.CRED_RANKS?.[ctx.upgrades?.rank?.() ?? 0] || 'Rookie'} (${ctx.upgrades?.cred ?? 0}) • Relics ${ctx.upgrades?.relicsFound?.size ?? 0}/12 • Coins ${ctx.economy?.coins ?? 0}/10`);
    if (h.toastT > 0) { h.toastT -= dt; if (h.toastT <= 0) { const el = $('toast'); if (el) el.style.opacity = '0'; } }
    drawMinimap();
  }
  function showMenu(name) {
    for (const id of ['menu-start', 'menu-pause', 'menu-missions', 'menu-upgrades', 'menu-dead']) {
      const el = $(id);
      if (el) el.style.display = id === `menu-${name}` ? 'block' : 'none';
    }
    const hud = $('hud');
    if (hud) hud.style.display = name === 'none' ? 'block' : 'none';
  }
  h.setObjective = setObjective; h.setWaypoint = setWaypoint; h.toast = toast;
  h.bossBar = bossBar; h.flashMoney = flashMoney; h.update = update; h.showMenu = showMenu;
  return h;
}
