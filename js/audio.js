export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.muted = false;
    this.phase = 'day';
    this.heartTimer = 0;
    this.creakTimer = 6;
    this.ready = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.6;
    this.ambBus.connect(this.master);

    this.noiseBuf = this.makeNoise(2.5);

    // ---- ambient hum ----
    this.ambientNoise = this.loopNoise();
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 150;
    this.ambientNoiseGain = ctx.createGain();
    this.ambientNoiseGain.gain.value = 0.05;
    this.ambientNoise.connect(nf).connect(this.ambientNoiseGain).connect(this.ambBus);

    this.drones = [];
    for (const [freq, vol, type] of [[42, 0.016, 'sine'], [57, 0.008, 'triangle'], [83, 0.004, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(this.ambBus);
      o.start();
      this.drones.push({ o, g, base: freq, vol });
    }

    // ---- machine hum ----
    this.machineGain = ctx.createGain();
    this.machineGain.gain.value = 0;
    this.machineGain.connect(this.ambBus);
    const mOsc = ctx.createOscillator();
    mOsc.type = 'sawtooth';
    mOsc.frequency.value = 54;
    const mFilter = ctx.createBiquadFilter();
    mFilter.type = 'lowpass';
    mFilter.frequency.value = 240;
    mOsc.connect(mFilter).connect(this.machineGain);
    mOsc.start();
    const mNoise = ctx.createBufferSource();
    mNoise.buffer = this.noiseBuf;
    mNoise.loop = true;
    const mNoiseFilter = ctx.createBiquadFilter();
    mNoiseFilter.type = 'bandpass';
    mNoiseFilter.frequency.value = 320;
    mNoiseFilter.Q.value = 0.8;
    const mNoiseGain = ctx.createGain();
    mNoiseGain.gain.value = 0.35;
    mNoise.connect(mNoiseFilter).connect(mNoiseGain).connect(this.machineGain);
    mNoise.start();
    this.machineOsc = mOsc;

    // ---- pull / creak loop ----
    this.pullGain = ctx.createGain();
    this.pullGain.gain.value = 0;
    this.pullGain.connect(this.sfxBus);
    const pOsc = ctx.createOscillator();
    pOsc.type = 'sawtooth';
    pOsc.frequency.value = 74;
    const pFilter = ctx.createBiquadFilter();
    pFilter.type = 'lowpass';
    pFilter.frequency.value = 420;
    pOsc.connect(pFilter).connect(this.pullGain);
    pOsc.start();
    this.pullOsc = pOsc;
    this.pullNoise = ctx.createBufferSource();
    this.pullNoise.buffer = this.noiseBuf;
    this.pullNoise.loop = true;
    const pnFilter = ctx.createBiquadFilter();
    pnFilter.type = 'bandpass';
    pnFilter.frequency.value = 900;
    pnFilter.Q.value = 1.8;
    const pnGain = ctx.createGain();
    pnGain.gain.value = 0.12;
    this.pullNoise.connect(pnFilter).connect(pnGain).connect(this.pullGain);
    this.pullNoise.start();

    // ---- winding loop ----
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windGain.connect(this.ambBus);
    const wOsc = ctx.createOscillator();
    wOsc.type = 'square';
    wOsc.frequency.value = 155;
    const wFilter = ctx.createBiquadFilter();
    wFilter.type = 'lowpass';
    wFilter.frequency.value = 700;
    wOsc.connect(wFilter).connect(this.windGain);
    wOsc.start();

    this.ready = true;
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  loopNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.start();
    return src;
  }

  /* ---------------- helpers ---------------- */
  tone(freq, endFreq, dur, vol, type = 'sine', delay = 0, bus = null) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseBurst(dur, vol, filterType = 'lowpass', freq = 800, q = 1, delay = 0, bus = null) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  /* ---------------- one-shots ---------------- */
  click() { this.tone(880, 660, 0.06, 0.05, 'square'); }
  uiOpen() { this.tone(320, 520, 0.12, 0.05, 'triangle'); }
  uiClose() { this.tone(420, 240, 0.12, 0.04, 'triangle'); }
  footstep(sprint) {
    this.noiseBurst(0.09, sprint ? 0.06 : 0.04, 'lowpass', 480, 0.7);
    this.tone(sprint ? 95 : 80, 45, 0.09, 0.025, 'sine');
  }
  jump() {
    this.noiseBurst(0.07, 0.03, 'highpass', 1150, 0.8);
    this.tone(160, 320, 0.11, 0.022, 'sine');
  }
  land(impact = 1) {
    const k = Math.max(0.3, Math.min(1, impact));
    this.noiseBurst(0.15, 0.025 + 0.045 * k, 'lowpass', 300, 0.8);
    this.tone(100, 42, 0.17, 0.02 + 0.03 * k, 'sine');
  }
  coin() {
    this.tone(1046, 1046, 0.09, 0.05, 'sine');
    this.tone(1568, 1568, 0.16, 0.04, 'sine', 0.07);
  }
  windDone() {
    this.tone(523, 784, 0.18, 0.05, 'triangle');
  }
  snap() {
    this.noiseBurst(0.22, 0.16, 'highpass', 1400, 0.7);
    this.tone(300, 60, 0.28, 0.1, 'sawtooth');
    this.noiseBurst(0.1, 0.1, 'bandpass', 2400, 2);
  }
  creak() {
    const base = 220 + Math.random() * 260;
    this.tone(base, base * 1.6, 0.5 + Math.random() * 0.4, 0.017, 'sawtooth');
  }
  creakLong() {
    this.tone(120, 320, 1.2, 0.022, 'sawtooth');
    this.noiseBurst(1.0, 0.012, 'bandpass', 1600, 4);
  }
  siren() {
    this.tone(620, 980, 0.9, 0.06, 'sine');
    this.tone(980, 560, 1.1, 0.06, 'sine', 0.9);
    this.noiseBurst(2.0, 0.02, 'bandpass', 900, 1.5);
  }
  nightSting() {
    this.tone(80, 38, 1.6, 0.18, 'sine');
    this.tone(160, 74, 1.2, 0.08, 'triangle');
    this.noiseBurst(1.4, 0.06, 'lowpass', 300, 0.6);
  }
  bang() {
    this.tone(70, 32, 0.4, 0.22, 'sine');
    this.noiseBurst(0.24, 0.12, 'bandpass', 620, 1.2);
    this.tone(140, 90, 0.16, 0.05, 'square');
  }
  doorBreak() {
    this.noiseBurst(0.8, 0.28, 'bandpass', 420, 0.8);
    this.tone(60, 24, 0.9, 0.18, 'sawtooth');
    this.tone(200, 40, 0.6, 0.08, 'square');
  }
  dollStep(dist) {
    const vol = Math.max(0.01, Math.min(0.3, 0.42 * Math.pow(Math.max(0, 1 - dist / 22), 2)));
    this.tone(52, 26, 0.5, vol, 'sine');
    this.noiseBurst(0.18, vol * 0.3, 'lowpass', 220, 0.7);
  }
  jumpscare() {
    this.noiseBurst(0.7, 0.38, 'highpass', 700, 0.6);
    this.tone(700, 90, 0.8, 0.16, 'sawtooth');
    this.tone(193, 48, 1.0, 0.08, 'square');
    this.tone(60, 25, 1.2, 0.25, 'sine');
    for (let i = 0; i < 5; i++) {
      this.tone(320 + Math.random() * 900, 120, 0.25, 0.04, 'sawtooth', i * 0.04);
    }
  }
  dawn() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, n, 0.5, 0.04, 'sine', i * 0.13));
  }
  heartbeat(vol = 0.12) {
    this.tone(58, 30, 0.22, vol, 'sine');
    this.tone(48, 26, 0.2, vol * 0.7, 'sine', 0.19);
  }
  sale() {
    this.tone(660, 660, 0.1, 0.05, 'triangle');
    this.tone(990, 990, 0.14, 0.04, 'triangle', 0.08);
    this.tone(1320, 1320, 0.22, 0.03, 'triangle', 0.16);
  }
  glint(vol = 0.03) {
    this.tone(1240, 1580, 0.09, vol, 'sine');
  }
  pickup() {
    this.tone(520, 880, 0.12, 0.06, 'triangle');
    this.tone(990, 1320, 0.16, 0.05, 'triangle', 0.09);
  }
  nightMod() {
    this.tone(150, 90, 1.1, 0.05, 'sawtooth');
    this.noiseBurst(0.9, 0.03, 'bandpass', 700, 1.2);
  }
  machineStart() {
    this.tone(180, 320, 0.35, 0.05, 'square');
  }
  sabotage() {
    this.tone(220, 60, 0.7, 0.1, 'sawtooth');
    this.noiseBurst(0.4, 0.1, 'lowpass', 500, 0.8);
  }

  /* ---------------- continuous ---------------- */
  setPull(active, tension) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const target = active ? 0.025 + tension * 0.00055 : 0;
    this.pullGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    this.pullOsc.frequency.setTargetAtTime(66 + tension * 1.35, ctx.currentTime, 0.1);
  }

  setWinding(active) {
    if (!this.ready) return;
    this.windGain.gain.setTargetAtTime(active ? 0.03 : 0, this.ctx.currentTime, 0.12);
  }

  setMachine(on) {
    if (!this.ready) return;
    this.machineGain.gain.setTargetAtTime(on ? 0.045 : 0, this.ctx.currentTime, 0.5);
  }

  setPhase(phase) {
    this.phase = phase;
    if (!this.ready) return;
    const ctx = this.ctx;
    const amp = phase === 'night' ? 1.6 : phase === 'dusk' ? 1.25 : 1;
    this.ambientNoiseGain.gain.setTargetAtTime(0.05 * amp, ctx.currentTime, 1.2);
    for (const d of this.drones) {
      d.o.frequency.setTargetAtTime(d.base * (phase === 'night' ? 0.92 : 1), ctx.currentTime, 1.5);
    }
    if (phase === 'night') this.nightSting();
  }

  update(dt, ctxState) {
    if (!this.ready) return;
    const night = ctxState.phase === 'night' || ctxState.scare;
    const dist = ctxState.dollDist ?? 25;
    const close = Math.max(0, Math.min(1, 1 - dist / 14));
    this.heartTimer -= dt;
    if (night && this.heartTimer <= 0) {
      this.heartTimer = ctxState.insideSafe ? 1.55 : 0.55 + (1 - close) * 0.65;
      this.heartbeat(ctxState.insideSafe ? 0.05 : 0.08 + close * 0.09);
    } else if (ctxState.phase === 'day' && close > 0.25 && this.heartTimer <= 0) {
      this.heartTimer = 1.55 - close * 0.75;
      this.heartbeat(0.02 + close * 0.045);
    }
    this.creakTimer -= dt;
    if (this.creakTimer <= 0) {
      this.creakTimer = 9 + Math.random() * 14;
      if (Math.random() < 0.65) this.creak();
      else this.noiseBurst(1.5, 0.012, 'lowpass', 200, 0.8);
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, 0.05);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
  }

  setInsideSafe(inside) {
    this.insideSafe = inside;
  }
}
