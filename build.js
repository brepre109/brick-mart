/* The build screen: a tray of loose bricks, a ghost showing where the next one goes,
   and a turntable that always turns the work toward you. */
const Build = (() => {
  const SNAP = 92;              // how close a drop has to land, in screen pixels
  let set = null, ps = null, turn = 0, H = 0;
  let placed = null, step = 1, steps = 1, startedAt = 0, done = false;
  let cam = { u: 20, px: 0, py: 0 }, want = { u: 20, px: 0, py: 0 }, userCam = false;
  let anims = [], confetti = [], held = null, hintAt = 0, spinT = 0;
  let chips = [], trayGeo = { u: 13 };
  let raf = 0, last = 0;

  const view = u => ISO.view(u);
  const P = (u, x, y, z) => ISO.P(view(u), x, y, z);
  const inStep = p => p.step === step;
  const isPlaced = p => placed.has(p.i);
  const live = () => ps.filter(p => inStep(p) && !isPlaced(p));          // sockets still open
  const active = () => live()[0];

  /* screen centre of a part's stud face */
  function socketXY(p) {
    const q = P(cam.u, p.x + p.w / 2, p.y + p.d / 2, p.z + 1);
    return { x: q[0] + cam.px, y: q[1] + cam.py };
  }
  /* frame a list of parts: project at u=1 (everything scales linearly), then fit */
  function frameOf(list, w, h, pad) {
    if (!list.length) return { u: cam.u, px: cam.px, py: cam.py };
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const v = view(1);
    for (const p of list) for (const X of [p.x, p.x + p.w]) for (const Y of [p.y, p.y + p.d]) for (const Z of [p.z, p.z + 1]) {
      const q = ISO.P(v, X, Y, Z);
      x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
    const u = Math.max(5, Math.min(34, Math.min((w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, y1 - y0))));
    return { u, px: w / 2 - (x0 + x1) / 2 * u, py: h / 2 - (y0 + y1) / 2 * u };
  }
  /* pick the turntable angle with the fewest finished bricks standing in front of this step */
  function bestTurn() {
    let best = turn, score = 1e9;
    for (let t = 0; t < 4; t++) {
      const arr = Art.parts(set, t);
      const tgt = arr.filter(inStep), pl = arr.filter(isPlaced);
      if (!tgt.length) continue;
      let n = 0;
      for (const g of tgt) for (const p of pl) if (ISO.inFront(g, p) && !ISO.inFront(p, g)) n++;
      if (n < score - 0.5) { score = n; best = t; }
    }
    return best;
  }
  function reframe(snapTo) {
    const c = App.canvas('buildC');
    const list = ps.filter(p => isPlaced(p) || inStep(p));
    want = frameOf(list, c.w, c.h - 40, 46);
    if (snapTo) cam = { u: want.u, px: want.px, py: want.py };
  }
  function layTray() {
    const c = App.canvas('tray');
    const L = live();
    chips = [];
    if (!L.length) return;
    const n = L.length, slot = Math.min(84, (c.w - 16) / n), u = Math.max(5, Math.min(13, slot / 5.4));
    trayGeo.u = u;
    const total = n * slot, x0 = (c.w - total) / 2;
    L.forEach((p, k) => chips.push({ p, cx: x0 + slot * (k + 0.5), cy: c.h * 0.48, r: Math.min(slot, c.h * 0.8) / 2 }));
  }

  /* ------------------------------------------------------------------ placing */
  function place(p, quiet) {
    if (!p || isPlaced(p)) return;
    placed.add(p.i);
    anims.push({ i: p.i, t: 0 });
    if (!quiet) A.snap(Math.pow(2, p.z / 14) * 0.95);
    if (navigator.vibrate) { try { navigator.vibrate(11); } catch (e) {} }
    SAVE.s.run = { id: set.id, placed: [...placed], turn, startedAt };
    SAVE.save();
    hintAt = performance.now();
    if (!live().length) stepDone();
    else layTray();
  }
  function stepDone() {
    if (step >= steps) return finishBuild();
    step++;
    A.step_done();
    if (!userCam) { const t = bestTurn(); if (t !== turn) { turn = t; ps = Art.parts(set, turn); } }
    reframe(false);
    layTray();
  }
  function finishBuild() {
    done = true;
    const ms = Date.now() - startedAt;
    const first = SAVE.finish(set.id, ms);
    const pay = set.steps * 100 + (first ? 400 : 0);
    SAVE.earn(pay);
    A.finish();
    for (let i = 0; i < 90; i++) confetti.push({
      x: Math.random(), y: -Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.4, vy: 0.25 + Math.random() * 0.5,
      r: Math.random() * 6.283, vr: (Math.random() - 0.5) * 0.3,
      c: ['#e8112d', '#f5b820', '#2f7de1', '#22a75b', '#fff', '#ff4f9a'][i % 6], s: 7 + Math.random() * 7,
    });
    App.$('finTitle').textContent = first ? 'You built it!' : 'Built it again!';
    App.$('finPay').textContent = '+' + SAVE.money(pay) + (first ? '  ★ first build!' : '');
    App.$('finish').classList.add('on');
    App.money();
  }
  /* a tap on the model: nearest open socket, else just place the next brick */
  function tapModel(x, y) {
    let best = null, bd = SNAP * SNAP;
    for (const p of live()) {
      const q = socketXY(p), d = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    place(best || active());
  }

  /* ------------------------------------------------------------------ drawing */
  function draw(now) {
    const dt = Math.min(50, now - last) / 16.67; last = now;
    const c = App.canvas('buildC'), ctx = c.ctx;
    // ease the camera
    const k = 1 - Math.pow(0.86, dt);
    cam.u += (want.u - cam.u) * k; cam.px += (want.px - cam.px) * k; cam.py += (want.py - cam.py) * k;
    ctx.clearRect(0, 0, c.w, c.h);

    // baseplate
    const v = view(cam.u), W = ps.W, D = ps.D;
    const corner = (X, Y) => { const q = ISO.P(v, X, Y, 0); return [q[0] + cam.px, q[1] + cam.py]; };
    ctx.beginPath();
    const c0 = corner(0, 0), c1 = corner(W, 0), c2 = corner(W, D), c3 = corner(0, D);
    ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.closePath();
    ctx.fillStyle = 'rgba(96,180,120,.26)'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,230,180,.42)'; ctx.lineWidth = 2; ctx.stroke();

    const act = active(), flying = new Set(anims.map(a => a.i));
    for (const p of ps) {
      const pl = isPlaced(p), st = inStep(p);
      p.hidden = (!pl && !st) || flying.has(p.i);
      if (pl) {
        // a finished brick standing between you and the live socket gets out of the way
        p.alpha = act && ISO.inFront(act, p) && !ISO.inFront(p, act) ? 0.34 : (p.glass ? 0.62 : 1);
      } else if (st) {
        p.alpha = p === act ? 0.34 + Math.sin(now / 260) * 0.1 : 0.17;
      }
    }
    ISO.paint(ctx, ISO.scene(ps, { u: cam.u, ox: cam.px, oy: cam.py }), cam.u < 9 ? 0.7 : 1.1);

    // bricks in flight: appear three brick-heights up, drop, overshoot, settle
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]; a.t += dt * 16.67;
      const p = ps.find(q => q.i === a.i);
      let dz;
      if (a.t < 110) { const s = a.t / 110; dz = (1 - s * s) * v.bh * 3 - (1 - (1 - s) * (1 - s)) * 2; }
      else if (a.t < 170) dz = -2 * (1 - (a.t - 110) / 60);
      else { anims.splice(i, 1); continue; }
      if (p) ISO.paint(ctx, ISO.brick(p, v, p.hex, cam.px, cam.py - dz, 1), 1.1);
    }
    // the held brick rides under the finger, lifted so a thumb never covers it
    if (held && held.x !== undefined) {
      const p = held.p, q = P(cam.u, p.x + p.w / 2, p.y + p.d / 2, p.z + 1);
      ISO.paint(ctx, ISO.brick(p, v, p.hex, held.x - q[0], held.y - 26 - q[1], 0.92), 1.1);
      const s = socketXY(p), near = Math.hypot(s.x - held.x, s.y - held.y) < SNAP;
      ctx.save(); ctx.globalAlpha = near ? 0.95 : 0.4; ctx.strokeStyle = '#fff';
      ctx.lineWidth = near ? 4 : 2; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 30, 16, 0, 0, 6.2832); ctx.stroke(); ctx.restore();
    }
    // a bobbing finger for anyone who has stalled
    if (act && !held && now - hintAt > 4200) {
      const s = socketXY(act), bob = Math.sin(now / 300) * 7;
      ctx.save(); ctx.font = '30px serif'; ctx.textAlign = 'center';
      ctx.fillText('👆', s.x, s.y + 44 + bob); ctx.restore();
    }
    if (done) {
      spinT += dt;
      if (spinT > 34) { spinT = 0; turn = (turn + 1) % 4; ps = Art.parts(set, turn); reframe(false); }
      for (const f of confetti) {
        f.y += f.vy * dt * 0.012; f.x += f.vx * dt * 0.006; f.r += f.vr * dt * 0.1;
        if (f.y > 1.2) f.y = -0.1;
        ctx.save(); ctx.translate(f.x * c.w, f.y * c.h); ctx.rotate(f.r);
        ctx.fillStyle = f.c; ctx.fillRect(-f.s / 2, -f.s / 3, f.s, f.s * 0.66); ctx.restore();
      }
    }
    drawTray(now);
    App.$('stepTxt').textContent = Math.min(step, steps) + '/' + steps;
    raf = requestAnimationFrame(draw);
  }
  function drawTray(now) {
    const c = App.canvas('tray'), ctx = c.ctx;
    ctx.clearRect(0, 0, c.w, c.h);
    const u = trayGeo.u, v = view(u);
    chips.forEach((ch, k) => {
      if (held && held.p === ch.p) return;
      const p = ch.p, first = ch.p === active();
      const wob = Math.sin(now / 900 + k * 1.7) * 0.022;          // loose parts, not UI icons
      ctx.save(); ctx.translate(ch.cx, ch.cy + (first ? -5 + Math.sin(now / 320) * 2.5 : 0)); ctx.rotate(wob);
      const sc = first ? 1.14 : 1; ctx.scale(sc, sc);
      const q = ISO.P(v, p.w / 2, p.d / 2, 0.5);
      if (first) {
        ctx.save(); ctx.globalAlpha = 0.34 + Math.sin(now / 300) * 0.12; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(0, 0, ch.r * 0.92, ch.r * 0.68, 0, 0, 6.2832); ctx.fill(); ctx.restore();
      }
      ISO.paint(ctx, ISO.brick({ ...p, x: 0, y: 0, z: 0 }, v, p.hex, -q[0], -q[1], 1), 1);
      ctx.restore();
      ctx.save();
      ctx.font = Art.F(700, 11); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.fillText(p.w + '×' + p.d, ch.cx, c.h - 9);
      ctx.restore();
    });
    if (!chips.length) {
      ctx.font = Art.F(600, 15); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillText(done ? 'All done!' : 'Next bag…', c.w / 2, c.h / 2);
    }
  }

  /* ------------------------------------------------------------------ input */
  function wire() {
    const bc = App.$('buildC'), tc = App.$('tray');
    let down = null;
    bc.addEventListener('pointerdown', e => { down = { ...App.pt(e, bc), t: performance.now(), moved: false }; });
    bc.addEventListener('pointermove', e => {
      if (!down) return;
      const p = App.pt(e, bc);
      if (Math.hypot(p.x - down.x, p.y - down.y) > 12) down.moved = true;
      if (down.moved) { userCam = true; want.px += p.x - down.x; want.py += p.y - down.y; cam.px = want.px; cam.py = want.py; down.x = p.x; down.y = p.y; }
    });
    bc.addEventListener('pointerup', e => {
      if (!down) return;
      const p = App.pt(e, bc);
      if (!down.moved && !done) tapModel(p.x, p.y);
      down = null;
    });
    bc.addEventListener('pointercancel', () => { down = null; });

    tc.addEventListener('pointerdown', e => {
      const p = App.pt(e, tc);
      const ch = chips.find(c => Math.hypot(c.cx - p.x, c.cy - p.y) < c.r + 10);
      if (!ch || done) return;
      tc.setPointerCapture(e.pointerId);
      held = { p: ch.p, ox: p.x, oy: p.y, moved: false };
      A.lift();
    });
    tc.addEventListener('pointermove', e => {
      if (!held) return;
      const r = bc.getBoundingClientRect();
      held.x = e.clientX - r.left; held.y = e.clientY - r.top;
      if (Math.abs(held.y) < 1e6 && Math.hypot(e.clientX - r.left - held.ox, 0) > 8) held.moved = true;
      held.moved = true;
    });
    const release = e => {
      if (!held) return;
      const p = held.p, h = held; held = null;
      if (h.x === undefined) { place(p); return; }                 // a tap, not a drag
      const s = socketXY(p);
      if (Math.hypot(s.x - h.x, s.y - h.y) < SNAP) place(p);
      else { A.pop(); layTray(); }                                  // no penalty, it just goes home
    };
    tc.addEventListener('pointerup', release);
    tc.addEventListener('pointercancel', () => { held = null; });

    App.$('spin').onclick = () => { userCam = false; turn = (turn + 1) % 4; ps = Art.parts(set, turn); reframe(false); A.page(); };
    App.$('buildBack').onclick = () => { stop(); App.go('home'); };
    App.$('finShelf').onclick = () => { stop(); App.go('home'); };
    App.$('finPlay').onclick = () => { stop(); Play.open(set.id); };
  }

  function open(id, resume) {
    set = CATALOG.find(s => s.id === id);
    if (!set) return App.go('home');
    steps = set.steps; H = set.H; done = false;
    anims = []; confetti = []; held = null; userCam = false;
    const r = resume && SAVE.s.run && SAVE.s.run.id === id ? SAVE.s.run : null;
    placed = new Set(r ? r.placed : []);
    turn = r ? r.turn : 0;
    startedAt = r ? r.startedAt : Date.now();
    ps = Art.parts(set, turn);
    step = 1;
    while (step < steps && !ps.some(p => p.step === step && !isPlaced(p))) step++;
    SAVE.s.run = { id, placed: [...placed], turn, startedAt }; SAVE.save();
    App.$('finish').classList.remove('on');
    // step dots
    const dots = App.$('dots'); dots.innerHTML = '';
    for (let i = 1; i <= steps; i++) { const el = document.createElement('i'); el.dataset.s = i; dots.appendChild(el); }
    App.go('build');
    App.fit();
    const gc = App.$('goalArt').getContext('2d');
    gc.clearRect(0, 0, 168, 210); gc.save(); gc.scale(1.5, 1.5);
    Art.paintBox(gc, set, 112, 140, false); gc.restore();
    reframe(true); layTray();
    if (r && placed.size) A.open();
    hintAt = performance.now(); last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
    tickDots();
  }
  function tickDots() {
    const dots = App.$('dots').children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].className = (i + 1) < step ? 'on' : (i + 1) === step ? 'cur' : '';
    }
    if (App.$('build').classList.contains('on')) setTimeout(tickDots, 260);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  return { open, stop, wire, onResize: () => { if (ps) { reframe(false); layTray(); } },
    get _() { return { set, step, steps, placed, turn, live, active, place, tapModel, socketXY, done, finishBuild }; } };
})();
