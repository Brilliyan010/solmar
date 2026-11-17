// Sound: everything synthesised with WebAudio — engine hum, sirens, horns,
// gunshots, crashes, jingles and a soft city ambience. Zero audio files.
// The context is created on the first user gesture; in headless shot mode
// it is never created at all.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.noiseBuf = null;
    this.ambientOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startAmbient();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  startAmbient() {
    // Waves: looped noise through a low-pass, slowly breathing.
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    // Soft pad: two detuned triangles, very quiet.
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.035;
    padGain.connect(this.master);
    for (const f of [110, 164.8, 220]) {
      const o = this.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(padGain);
      o.start();
    }
    this.ambientOn = true;
  }

  // Continuous engine note; rpm01 0..1, on when driving.
  engine(rpm01, on) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      this.engineOsc.connect(lp).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + rpm01 * 165, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + rpm01 * 0.06 : 0, t, 0.1);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "triangle";
      this.sirenOsc.frequency.value = 820;
      const lfo = this.ctx.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 160;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenOsc._lfo = lfo;
    } else if (!on && this.sirenOsc) {
      try {
        this.sirenOsc._lfo.stop();
        this.sirenOsc.stop();
      } catch {}
      this.sirenOsc = null;
    }
  }

  blip(freq, dur, type = "sine", vol = 0.16) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur);
  }

  noise(dur, filterFreq, vol, type = "lowpass") {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  horn() {
    this.blip(370, 0.28, "square", 0.12);
    this.blip(466, 0.28, "square", 0.1);
  }

  shot() {
    this.noise(0.14, 2400, 0.5, "highpass");
    this.blip(140, 0.1, "square", 0.2);
  }

  crash() {
    this.noise(0.35, 420, 0.5);
  }

  pickup() {
    this.blip(880, 0.09);
    setTimeout(() => this.blip(1318, 0.12), 70);
  }

  jingle() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, "triangle", 0.14), i * 110));
  }

  busted() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, "sawtooth", 0.12), i * 180));
  }
}
