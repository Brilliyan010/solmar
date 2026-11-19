// SOLMAR — synthesized WebAudio: engine hum, sirens, gunshots, jingles, 3 radios.
export function runSound() {
  const a = { ctx: null, muted: false, eng: null, sirenOn: false, radioI: 0, radioT: 0 };
  const STATIONS = [
    { name: 'Solmar FM — Sunset Drive', bpm: 96, root: 220 },
    { name: 'Neon Nights — Synthwave', bpm: 112, root: 174.6 },
    { name: 'Harbor Blues — Chill', bpm: 72, root: 146.8 },
  ];
  function ensure() {
    if (a.ctx) {
      if (a.ctx.state === 'suspended') a.ctx.resume();
      return;
    }
    try {
      a.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = a.ctx.createGain();
      master.gain.value = 0.5;
      master.connect(a.ctx.destination);
      a.master = master;
      // The engine: a continuous sawtooth through a low-pass filter.
      const osc = a.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 50;
      const oscGain = a.ctx.createGain();
      oscGain.gain.value = 0;
      const filter = a.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(master);
      osc.start();
      a.eng = { o: osc, g: oscGain };
      // The radio: a soft pulsing pad that steps through the station's scale.
      const pad = a.ctx.createOscillator();
      pad.type = 'triangle';
      pad.frequency.value = STATIONS[0].root;
      const padGain = a.ctx.createGain();
      padGain.gain.value = 0.045;
      const padFilter = a.ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 900;
      pad.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(master);
      pad.start();
      a.radio = { o: pad, g: padGain };
      a.radioStep = 0;
      setInterval(() => {
        if (!a.ctx || a.muted) return;
        const st = STATIONS[a.radioI];
        const scale = [1, 1.189, 1.335, 1.498, 1.782];
        const note = scale[a.radioStep % scale.length];
        a.radio.o.frequency.setTargetAtTime(st.root * note, a.ctx.currentTime, 0.05);
        a.radioStep++;
      }, 60000 / STATIONS[0].bpm / 2);
    } catch {
      a.ctx = null;
    }
  }
  function beep(freq, dur, type = 'square', vol = 0.2, slide = 0) {
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(a.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.25, freq = 1200) {
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime;
    const len = Math.floor(a.ctx.sampleRate * dur);
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    const f = a.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = a.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(a.master);
    src.start(t);
  }
  function engine(rpm01) {
    if (!a.eng) return;
    a.eng.o.frequency.value = 45 + rpm01 * 130;
    a.eng.g.gain.value = a.muted ? 0 : 0.02 + rpm01 * 0.05;
  }
  function siren(on) { a.sirenOn = on; }
  function shot(kind) {
    if (kind === 'pistol') noise(0.12, 0.3, 2400);
    else if (kind === 'shotgun') noise(0.25, 0.4, 1400);
    else if (kind === 'smg') noise(0.08, 0.22, 2800);
    else if (kind === 'enemy') noise(0.1, 0.16, 2000);
    else if (kind === 'punch') beep(140, 0.08, 'sine', 0.3, -60);
    else if (kind === 'dry') beep(900, 0.05, 'square', 0.12);
  }
  function crash() {
    noise(0.3, 0.35, 700);
    beep(70, 0.25, 'sine', 0.3, -30);
  }
  function sting(name) {
    const seq = {
      mission: [523, 659, 784],
      win: [523, 659, 784, 1046],
      buy: [660, 880],
      relic: [880, 1174, 1568],
      rankup: [392, 523, 659, 784],
      boss: [196, 185, 165],
      phase: [220, 207, 196],
      checkpoint: [784, 988],
      jump: [523, 784, 1046],
      photo: [988, 1318],
      sabotage: [330, 415],
      spray: [440, 554, 659],
      reload: [300, 380],
      enter: [262, 330],
      radio: [440, 587],
    }[name] || [440];
    seq.forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.2), i * 95));
  }
  function radioName() { return STATIONS[a.radioI].name; }
  function nextRadio() {
    a.radioI = (a.radioI + 1) % STATIONS.length;
    if (a.radio) a.radio.o.frequency.value = STATIONS[a.radioI].root;
    sting('radio');
  }
  function setMuted(m) {
    a.muted = m;
    if (a.master) a.master.gain.value = m ? 0 : 0.5;
  }
  function update(dt) {
    if (!a.ctx) return;
    if (a.sirenOn && !a.muted) {
      a.sirenT = (a.sirenT || 0) + dt;
      if (a.sirenT > 0.45) {
        a.sirenT = 0;
        a.sirenHi = !a.sirenHi;
        beep(a.sirenHi ? 950 : 700, 0.4, 'sine', 0.05);
      }
    }
  }
  a.ensure = ensure;
  a.engine = engine;
  a.siren = siren;
  a.shot = shot;
  a.crash = crash;
  a.sting = sting;
  a.radioName = radioName;
  a.nextRadio = nextRadio;
  a.setMuted = setMuted;
  a.update = update;
  return a;
}
