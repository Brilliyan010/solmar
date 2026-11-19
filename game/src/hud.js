// hud.js — the DOM HUD, the 2D minimap, toasts and menus. The 3D world
// never draws UI itself: this module owns every pixel of interface so
// the screenshots show the full HUD, minimap and objective at a glance.
import { CONFIG } from "./config.js";

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.minimap = $("minimap").getContext("2d");
    this.toastTimer = null;
    this.starFlash = 0;
  }

  fmtMoney(n) {
    return n.toLocaleString("en-US");
  }

  fmtClock(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  update(s) {
    $("money").textContent = this.fmtMoney(s.money);
    $("mission-name").textContent = s.missionName ?? "FREE ROAM";
    $("objective").textContent = s.objective;
    const stars = $("stars");
    let str = "";
    for (let i = 0; i < 5; i++) str += i < s.stars ? "★" : "☆";
    stars.textContent = str;
    stars.className = "stars" + (s.stars === 0 ? " dim" : "");
    if (s.blink) stars.style.opacity = Math.floor(performance.now() / 400) % 2 ? "0.35" : "1";
    else stars.style.opacity = "1";
    $("clock").textContent = this.fmtClock(s.clockMinutes);
    $("health-fill").style.width = `${Math.max(0, s.health)}%`;
    $("armor-fill").style.width = `${Math.max(0, s.armor)}%`;
    $("vignette").style.display = s.health < 35 ? "block" : "none";
    const speedo = $("speedo");
    if (s.inCar) {
      speedo.style.display = "block";
      $("speed").textContent = Math.round(Math.abs(s.speedKmh));
      $("car-name").textContent = `${s.carName}${s.damaged > 0.5 ? " — SMOKING" : ""}`;
    } else {
      speedo.style.display = "none";
    }
    const prompt = $("prompt");
    if (s.prompt) {
      prompt.style.display = "block";
      prompt.textContent = s.prompt;
    } else {
      prompt.style.display = "none";
    }
    $("crosshair").style.display = s.aiming ? "block" : "none";
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const g = this.minimap;
    const W = 208;
    const scale = W / (CONFIG.worldHalf * 2 + 20);
    const toMap = (x, z) => [(x + CONFIG.worldHalf + 10) * scale, (z + CONFIG.worldHalf + 10) * scale];
    g.clearRect(0, 0, W, W);
    g.fillStyle = "#0d1b2a";
    g.fillRect(0, 0, W, W);
    // Sea + beach (north = top).
    g.fillStyle = "#1d7f9e";
    g.fillRect(0, 0, W, 10);
    g.fillStyle = "#e8cf9a";
    g.fillRect(0, 10, W, 4);
    // Roads.
    g.strokeStyle = "#5a5a66";
    g.lineWidth = 4;
    for (const sOff of CONFIG.streetOffsets) {
      const [x1, y1] = toMap(sOff, -CONFIG.worldHalf);
      const [x2, y2] = toMap(sOff, CONFIG.worldHalf);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const [ax, ay] = toMap(-CONFIG.worldHalf, sOff);
      const [bx, by] = toMap(CONFIG.worldHalf, sOff);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }
    // Sun coins.
    g.fillStyle = "#ffd23e";
    for (const [x, z] of CONFIG.sunCoins) {
      const [mx, my] = toMap(x, z);
      g.beginPath(); g.arc(mx, my, 2, 0, Math.PI * 2); g.fill();
    }
    // Waypoint (blinking yellow).
    if (s.waypoint) {
      const [mx, my] = toMap(s.waypoint[0], s.waypoint[1]);
      g.fillStyle = Math.floor(performance.now() / 300) % 2 ? "#ffd23e" : "#ffffff";
      g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#ffd23e";
      g.beginPath(); g.arc(mx, my, 8, 0, Math.PI * 2); g.stroke();
    }
    // Police (red/blue dots).
    for (const [x, z] of s.policeDots ?? []) {
      const [mx, my] = toMap(x, z);
      g.fillStyle = "#ff3a2a";
      g.beginPath(); g.arc(mx, my, 3, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, py] = toMap(s.playerX, s.playerZ);
    g.save();
    g.translate(px, py);
    g.rotate(s.playerHeading);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#000000";
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  toast(text, ms = 3600) {
    const el = $("toast");
    el.textContent = text;
    el.style.display = "block";
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.display = "none"; }, ms);
  }

  showStart(hasSave, missionListHtml) {
    $("start-menu").classList.remove("hidden");
    $("pause-menu").classList.add("hidden");
    $("end-screen").classList.add("hidden");
    $("btn-continue").disabled = !hasSave;
    $("mission-list").innerHTML = missionListHtml;
  }

  hideMenus() {
    $("start-menu").classList.add("hidden");
    $("pause-menu").classList.add("hidden");
    $("end-screen").classList.add("hidden");
  }

  showPause(statsHtml) {
    $("pause-stats").innerHTML = statsHtml;
    $("pause-menu").classList.remove("hidden");
  }

  hidePause() {
    $("pause-menu").classList.add("hidden");
  }

  showEnd(kind, text) {
    const el = $("end-screen");
    el.classList.remove("hidden", "busted", "wasted");
    el.classList.add(kind);
    $("end-title").textContent = kind === "busted" ? "BUSTED" : "WASTED";
    $("end-text").textContent = text;
  }

  bind(handlers) {
    $("btn-new").onclick = () => handlers.newGame();
    $("btn-continue").onclick = () => handlers.continueGame();
    $("btn-resume").onclick = () => handlers.resume();
    $("btn-save").onclick = () => handlers.save();
    $("btn-quit").onclick = () => handlers.quitToMenu();
    $("btn-retry").onclick = () => handlers.retry();
    $("btn-end-menu").onclick = () => handlers.quitToMenu();
    $("btn-missions").onclick = () => {
      const m = $("mission-list");
      m.style.display = m.style.display === "none" ? "block" : "none";
      $("controls-list").style.display = "none";
    };
    $("btn-controls").onclick = () => {
      const c = $("controls-list");
      c.style.display = c.style.display === "none" ? "block" : "none";
      $("mission-list").style.display = "none";
    };
  }
}
