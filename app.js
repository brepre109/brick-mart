/* Boot, the screen router, and the handful of things every screen needs. */
const App = (() => {
  const $ = id => document.getElementById(id);
  const screens = ['home', 'map', 'aisle', 'checkout', 'build', 'play', 'book'];
  const cvs = {};
  let toastT = 0;

  /* Canvas sizing. Backing store in device pixels, drawing in CSS pixels, so every
     screen coordinate in the game is a CSS pixel and pointer maths stays honest. */
  function canvas(id) {
    let o = cvs[id];
    if (!o) { const el = $(id); o = cvs[id] = { el, ctx: el.getContext('2d'), w: 0, h: 0, r: 0 }; }
    return o;
  }
  function sizeOne(id) {
    const o = canvas(id), el = o.el;
    const r = Math.min(2, window.devicePixelRatio || 1);
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    if (o.w === w && o.h === h && o.r === r) return;
    el.width = Math.round(w * r); el.height = Math.round(h * r);
    o.w = w; o.h = h; o.r = r;
    o.ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  function fit() { for (const id of ['aisleC', 'coC', 'buildC', 'tray', 'playC']) if ($(id)) sizeOne(id); }

  function pt(e, el) {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function go(name) {
    for (const s of screens) $(s).classList.toggle('on', s === name);
    if (name !== 'build') Build.stop();
    if (name !== 'aisle') Store.stop();
    if (name !== 'play') Play.stop();
    if (name !== 'checkout') Checkout.stop();
    requestAnimationFrame(fit);
    money();
  }
  function money() {
    for (const id of ['purseHome', 'purseMap', 'purseAisle', 'purseCo', 'purseBook']) {
      const el = $(id); if (el) el.querySelector('b').textContent = SAVE.text;
    }
  }
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), 2200);
  }

  function start() {
    A.muted = SAVE.s.mute;
    $('mute').textContent = SAVE.s.mute ? '🔇' : '🔊';
    Home.wire(); Store.wire(); Build.wire(); Play.wire(); Checkout.wire();
    // iOS keeps a lazily created AudioContext suspended until a real gesture touches it
    const unlock = () => { try { A.boot(); if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); } catch (e) {} };
    document.addEventListener('pointerdown', unlock, { once: true });

    $('bootGo').onclick = () => {
      unlock(); A.open();
      $('boot').classList.add('hide');
      // A brand-new player learns the good half first: a free little set, already paid for.
      if (!SAVE.s.starter) {
        SAVE.s.starter = true;
        const first = CATALOG.slice().sort((a, b) => a.n - b.n)[0];
        SAVE.buy(first.id); SAVE.see(first.id); SAVE.save(true);
        Home.render();
        Build.open(first.id, false);
        setTimeout(() => toast('A free set to start you off!'), 900);
      } else if (SAVE.s.run && CATALOG.some(s => s.id === SAVE.s.run.id)) {
        Home.render();
        Build.open(SAVE.s.run.id, true);
      } else {
        go('home'); Home.render();
      }
    };
    // the address bar sliding away resizes the viewport mid-drag; just re-fit
    let rt = 0;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => { fit(); Store.onResize(); Build.onResize(); Play.onResize(); }, 90);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) SAVE.save(true); });
    go('home'); Home.render(); fit();
  }
  return { $, go, fit, pt, canvas, money, toast, start,
    get dbg() { return { SAVE, CATALOG, Build, Store, Play, Home, Checkout, Art, ISO }; } };
})();
window.addEventListener('DOMContentLoaded', App.start);
window.__bm = () => App.dbg;
