// SOLMAR — HUD: cash, health, wanted stars, clock, objective, minimap,
// boss bar. The minimap is a 2D canvas: sea, avenue grid, waypoint, job
// markers, police in blue, Mara as a white arrow.
import { TUNE } from './config.js';

export function runHud(ctx) {
  const $ = (id) => document.getElementById(id);
  const h = { waypoint: null, boss: null, toastT: 0 };
  const mm = $('minimap');
  const mmc = mm?.getContext('2d');

  function setObjective(t) {
    const el = $('objective');
    if (el) el.textContent = t;
  }
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
    if (!boss) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = 'block';
    $('bossname').textContent = `${boss.def.name} — ${boss.def.title} (Phase ${boss.phase}/3)`;
    $('bossfill').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  }

  function flashMoney() {
    const el = $('money');
    if (!el) return;
    el.style.color = '#7cff5a';
    setTimeout(() => { if (el) el.style.color = ''; }, 300);
  }

  function drawMinimap() {
    if (!mmc) return;
    const S = 150;
    const sc = S / 420;
    mmc.clearRect(0, 0, S, S);
    mmc.fillStyle = 'rgba(10,16,24,0.85)';
    mmc.fillRect(0, 0, S, S);
    // The sea along the bottom edge.
    mmc.fillStyle = '#1e6f8e';
    mmc.fillRect(0, (200 + 210) * sc, S, S);
    // The avenue grid.
    mmc.strokeStyle = '#5a6068';
    mmc.lineWidth = 4;
    for (const r of TUNE.avenues) {
      mmc.beginPath();
      mmc.moveTo((r + 210) * sc, 0);
      mmc.lineTo((r + 210) * sc, S);
      mmc.stroke();
      mmc.beginPath();
      mmc.moveTo(0, (r + 210) * sc);
      mmc.lineTo(S, (r + 210) * sc);
      mmc.stroke();
    }
    // Waypoint (gold), taxi fare (green) and courier drop-off (pink).
    const mark = (x, z, color, r) => {
      mmc.fillStyle = color;
      mmc.beginPath();
      mmc.arc((x + 210) * sc, (z + 210) * sc, r, 0, 7);
      mmc.fill();
    };
    if (h.waypoint) mark(h.waypoint.x, h.waypoint.z, '#ffd24d', 5);
    if (ctx.economy?.taxi) mark(ctx.economy.taxi.x, ctx.economy.taxi.z, '#7cff5a', 4);
    if (ctx.activities?.courier) mark(ctx.activities.courier.x, ctx.activities.courier.z, '#ff7ad9', 4);
    // Police cruisers in blue, Mara as a white arrow.
    const p = ctx.player;
    mmc.fillStyle = '#4da6ff';
    for (const u of ctx.police?.units || []) {
      mmc.beginPath();
      mmc.arc((u.v.x + 210) * sc, (u.v.z + 210) * sc, 3, 0, 7);
      mmc.fill();
    }
    mmc.save();
    mmc.translate((p.x + 210) * sc, (p.z + 210) * sc);
    mmc.rotate(p.angle || 0);
    mmc.fillStyle = '#ffffff';
    mmc.beginPath();
    mmc.moveTo(0, -6);
    mmc.lineTo(4, 5);
    mmc.lineTo(-4, 5);
    mmc.closePath();
    mmc.fill();
    mmc.restore();
  }

  function update(dt) {
    const p = ctx.player;
    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = v;
    };
    set('money', `$${ctx.economy?.money ?? 0}`);
    set('health', `HP ${Math.ceil(p.health)}${p.armor > 0 ? ` | ARMOR ${Math.ceil(p.armor)}` : ''}`);
    set('speed', ctx.driving?.vehicle
      ? `${Math.round(Math.abs(ctx.driving.vehicle.speed) * 3.6)} km/h — ${ctx.driving.vehicle.def.name}`
      : 'On foot');
    // Wanted stars, red once the heat is serious.
    const w = $('wanted');
    if (w) {
      w.textContent = '★'.repeat(ctx.police?.wanted || 0) + '☆'.repeat(5 - (ctx.police?.wanted || 0));
      w.style.color = (ctx.police?.wanted || 0) >= 3 ? '#ff4444' : '#ffd24d';
    }
    // City clock, day phase and the radio station.
    const t = ctx.atmosphere?.clock ?? 18;
    const hh = Math.floor(t) % 24;
    const mm2 = Math.floor((t % 1) * 60);
    set('clock', `${String(hh).padStart(2, '0')}:${String(mm2).padStart(2, '0')} — ${ctx.atmosphere?.phaseName || 'Golden Hour'}`);
    set('radio', `♪ ${ctx.audio?.radioName() || 'Solmar FM'}`);
    // Mission line and the progression line.
    const m = ctx.missions;
    set('missionline', m?.active >= 0
      ? `${m.defs[m.active].name} (${m.step + 1}/${m.defs[m.active].steps.length})`
      : 'Free Roam');
    set('credline', `Cred: ${ctx.upgrades?.CRED_TITLES?.[ctx.upgrades?.rank?.() ?? 0] || 'Rookie'} (${ctx.upgrades?.cred ?? 0}) • Relics ${ctx.upgrades?.relicsFound?.size ?? 0}/12 • Coins ${ctx.economy?.coins ?? 0}/10`);
    if (h.toastT > 0) {
      h.toastT -= dt;
      if (h.toastT <= 0) {
        const el = $('toast');
        if (el) el.style.opacity = '0';
      }
    }
    drawMinimap();
  }

  // Exactly one menu is visible at a time; 'none' means the HUD itself.
  function showMenu(name) {
    for (const id of ['menu-start', 'menu-pause', 'menu-missions', 'menu-upgrades', 'menu-dead']) {
      const el = $(id);
      if (el) el.style.display = id === `menu-${name}` ? 'block' : 'none';
    }
    const hud = $('hud');
    if (hud) hud.style.display = name === 'none' ? 'block' : 'none';
  }

  h.setObjective = setObjective;
  h.setWaypoint = setWaypoint;
  h.toast = toast;
  h.bossBar = bossBar;
  h.flashMoney = flashMoney;
  h.update = update;
  h.showMenu = showMenu;
  return h;
}
