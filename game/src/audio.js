// audio.js — fully synthesized WebAudio: engine hum, police siren,
// gunshots, explosions, coins, mission jingles and a soft city ambience.
// Zero audio files. The context starts on the first user gesture.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.ambientOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: sawtooth through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 50;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: two-tone square, toggled by a timer in update().
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = "square";
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
    this.sirenOsc.start();
    // Ambience: soft pad + slow waves (filtered noise, very quiet).
    const pad = this.ctx.createOscillator();
    pad.type = "triangle";
    pad.frequency.value = 110;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.015;
    pad.connect(padGain).connect(this.ctx.destination);
    pad.start();
    const pad2 = this.ctx.createOscillator();
    pad2.type = "sine";
    pad2.frequency.value = 165;
    const pad2Gain = this.ctx.createGain();
    pad2Gain.gain.value = 0.01;
    pad2.connect(pad2Gain).connect(this.ctx.destination);
    pad2.start();
    this.ambientOn = true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.ctx.destination.gain?.value;
    if (this.engineGain) this.engineGain.gain.value = this.muted ? 0 : this.engineGain.gain.value;
    return this.muted;
  }

  setEngine(speedNorm, driving) {
    if (!this.ctx || this.muted) return;
    this.engineOsc.frequency.value = 45 + speedNorm * 160;
    this.engineGain.gain.value = driving ? 0.03 + speedNorm * 0.05 : 0.012;
  }

  setSiren(wanted, now) {
    if (!this.ctx) return;
    const on = wanted > 0 && !this.muted;
    this.sirenGain.gain.value = on ? 0.02 : 0;
    if (on) this.sirenOsc.frequency.value = Math.floor(now * 2) % 2 ? 700 : 950;
  }

  tone(freq, dur, type = "sine", vol = 0.08, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  noise(dur, vol = 0.15, low = 400) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = low;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  shoot(kind) {
    if (kind === "shotgun") { this.noise(0.35, 0.3, 900); this.tone(90, 0.2, "square", 0.12, 40); }
    else if (kind === "pistol") { this.noise(0.16, 0.22, 1400); this.tone(160, 0.1, "square", 0.08, 60); }
    else this.noise(0.08, 0.1, 800); // punch whoosh
  }

  enemyShot() { this.noise(0.14, 0.1, 1200); }
  explosion() { this.noise(0.8, 0.35, 300); this.tone(60, 0.7, "sine", 0.2, 28); }
  coin() { this.tone(880, 0.12, "sine", 0.08); setTimeout(() => this.tone(1320, 0.18, "sine", 0.08), 90); }
  click() { this.tone(600, 0.05, "square", 0.05); }
  horn() { this.tone(370, 0.3, "square", 0.06); this.tone(466, 0.3, "square", 0.05); }
  crash() { this.noise(0.3, 0.25, 500); }
  missionStart() { this.tone(523, 0.15, "triangle", 0.09); setTimeout(() => this.tone(659, 0.15, "triangle", 0.09), 130); setTimeout(() => this.tone(784, 0.25, "triangle", 0.09), 260); }
  missionComplete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, "triangle", 0.09), i * 120)); }
  stepDone() { this.tone(784, 0.12, "triangle", 0.08); setTimeout(() => this.tone(1046, 0.18, "triangle", 0.08), 100); }
  raceStart() { this.tone(440, 0.15, "square", 0.08); setTimeout(() => this.tone(440, 0.15, "square", 0.08), 200); setTimeout(() => this.tone(880, 0.4, "square", 0.1), 400); }
}
