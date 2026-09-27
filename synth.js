/* Every sound in the game, generated. No audio files. */
const A = (() => {
  let ctx = null, master = null, muted = false;
  function boot() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.75; master.connect(ctx.destination);
    return ctx;
  }
  const now = () => (ctx ? ctx.currentTime : 0);
  function env(node, t, a, d, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    node.connect(g); g.connect(master);
    return g;
  }
  function tone(f, t, dur, type = 'sine', peak = 0.2, f2) {
    if (muted) return;
    boot();
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(o, t, Math.min(0.02, dur * 0.3), dur, peak);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, peak = 0.2, hp = 800, lp = 6000) {
    if (muted) return;
    boot();
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, Math.max(1, n), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f1 = ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp;
    src.connect(f1); f1.connect(f2);
    env(f2, t, 0.005, dur, peak);
    src.start(t);
  }
  const S = {
    boot, get ctx() { return ctx; },
    get muted() { return muted; }, set muted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.75; },
    /* --- store --- */
    step() { noise(now(), 0.07, 0.07, 200, 1400); },
    pick() { tone(520, now(), 0.09, 'triangle', 0.16, 880); },
    put() { tone(300, now(), 0.12, 'sine', 0.16, 180); },
    beep() { tone(1760, now(), 0.07, 'square', 0.1); tone(1760, now() + 0.1, 0.07, 'square', 0.1); },
    cart() { const t = now(); [440, 660, 880].forEach((f, i) => tone(f, t + i * 0.05, 0.14, 'triangle', 0.14)); },
    deny() { tone(180, now(), 0.16, 'sawtooth', 0.12, 120); },
    coin() { const t = now(); tone(1046, t, 0.07, 'square', 0.1); tone(1568, t + 0.06, 0.16, 'square', 0.09); },
    page() { noise(now(), 0.12, 0.09, 1200, 7000); },
    /* --- building --- */
    snap(pitch = 1) {
      const t = now();
      noise(t, 0.045, 0.22, 1500, 9000);
      tone(300 * pitch, t, 0.05, 'square', 0.1, 190 * pitch);
    },
    lift() { tone(660, now(), 0.06, 'sine', 0.09, 990); },
    wrong() { tone(150, now(), 0.13, 'sawtooth', 0.1, 110); },
    step_done() { const t = now(); [784, 988, 1175].forEach((f, i) => tone(f, t + i * 0.06, 0.18, 'triangle', 0.12)); },
    finish() {
      const t = now();
      [523, 659, 784, 1046, 1318].forEach((f, i) => { tone(f, t + i * 0.09, 0.4, 'triangle', 0.16); tone(f * 2, t + i * 0.09, 0.3, 'sine', 0.06); });
      noise(t + 0.45, 0.5, 0.12, 2000, 12000);
    },
    open() { const t = now(); noise(t, 0.3, 0.16, 600, 5000); tone(220, t, 0.25, 'sine', 0.1, 330); },
    /* --- play --- */
    honk() { const t = now(); tone(392, t, 0.18, 'sawtooth', 0.12); tone(330, t + 0.16, 0.22, 'sawtooth', 0.12); },
    roar() { const t = now(); tone(110, t, 0.5, 'sawtooth', 0.18, 70); noise(t, 0.5, 0.1, 100, 900); },
    zap() { tone(1200, now(), 0.22, 'square', 0.1, 200); },
    pop() { tone(700, now(), 0.06, 'sine', 0.14, 1400); },
  };
  return S;
})();
if (typeof module !== 'undefined') module.exports = A;
