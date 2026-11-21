// Optional sound, synthesised with Web Audio (no audio files).
// Off by default; the browser only allows audio after the user turns it on.

export function createSound() {
  let ctx = null;
  let master, noise, grind, pour, on = false;

  function noiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function loop(filterSetup) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let node = src;
    for (const f of filterSetup) {
      const biq = ctx.createBiquadFilter();
      Object.assign(biq, { type: f.type });
      biq.frequency.value = f.freq;
      biq.Q.value = f.q ?? 0.7;
      node.connect(biq);
      node = biq;
    }
    node.connect(gain).connect(master);
    src.start();
    return gain;
  }

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    noise = noiseBuffer();
    // burr grinder: gritty mid-high crunch
    grind = loop([{ type: 'bandpass', freq: 2400, q: 0.9 }, { type: 'highshelf', freq: 4000 }]);
    // pouring water: soft low rush
    pour = loop([{ type: 'lowpass', freq: 1300, q: 0.5 }, { type: 'highpass', freq: 180 }]);
  }

  const level = (g, v) => g && g.gain.setTargetAtTime(v, ctx.currentTime, 0.08);

  // one bean ticking against glass
  function tick(gainAmount) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2500 + Math.random() * 3500;
    bp.Q.value = 8;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gainAmount, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp).connect(g).connect(master);
    src.start(t, Math.random(), 0.06);
  }

  return {
    get on() { return on; },
    async toggle() {
      if (!ctx) init();
      on = !on;
      if (on) await ctx.resume();
      master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.15);
      return on;
    },
    /** Called every frame with how much of each sound the scene wants (0..1). */
    update({ grind: gv = 0, pour: pv = 0, rattle = 0 }, dt) {
      if (!on || !ctx) return;
      level(grind, gv * (0.12 + Math.random() * 0.1)); // flicker makes it crunch
      level(pour, pv * 0.22);
      if (rattle > 0 && Math.random() < rattle * dt * 28) tick(0.05 + Math.random() * 0.08);
    },
    /** A drop landing in coffee: a short falling "plip". */
    plip() {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.25);
    },
  };
}
