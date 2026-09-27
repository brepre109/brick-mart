/* The bedroom floor: everything you have finished, standing where you put it.
   Tap one and it does its trick; smash it and the bricks go everywhere. */
const Play = (() => {
  let models = [], raf = 0, last = 0, t = 0, drag = null, loose = null, focus = null;
  const SPR = 190;

  function build() {
    models = SAVE.s.diorama.map((id, i) => {
      const s = CATALOG.find(q => q.id === id);
      if (!s || !SAVE.built(id)) return null;
      return { s, fx: 0.18 + (i % 3) * 0.32, fy: 0.42 + Math.floor(i / 3) * 0.26, turn: 0, act: 0, verb: (THEMES[s.theme] || THEMES.City).verb };
    }).filter(Boolean);
  }
  function spriteFor(m) {
    const c = App.canvas('playC');
    const w = Math.min(SPR, c.w * 0.44);
    return Art.sprite(m.s, m.turn, w, w * 0.84);
  }
  function poke(m) {
    m.act = 1;
    const v = m.verb;
    if (v === 'roar') A.roar(); else if (v === 'drive') A.honk(); else if (v === 'fly') A.zap();
    else if (v === 'sparkle') A.coin(); else A.pop();
  }
  function smash() {
    if (!focus || loose) return;
    const ps = Art.parts(focus.s, 0);
    loose = {
      m: focus,
      bits: ps.map(p => ({
        p, x: p.x, y: p.y, z: p.z,
        vx: (Math.random() - 0.5) * 0.34, vy: (Math.random() - 0.5) * 0.34,
        vz: 0.22 + Math.random() * 0.4 + p.z * 0.03,
      })),
      t: 0,
    };
    A.roar(); A.pop();
    App.$('btnSmash').textContent = '💥 Smash';
  }
  function rebuild() {
    if (!loose) { if (focus) poke(focus); return; }
    loose.re = 0;
    A.open();
  }
  function draw(now) {
    const dt = Math.min(50, now - last) / 16.67; last = now; t += dt;
    const c = App.canvas('playC'), ctx = c.ctx, W = c.w, H = c.h;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#22304f'); g.addColorStop(0.36, '#2d3c60'); g.addColorStop(0.36, '#8d6a44'); g.addColorStop(1, '#6b4f31');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // rug
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.72, W * 0.46, H * 0.22, 0, 0, 6.2832); ctx.fill();
    // floorboards
    ctx.strokeStyle = 'rgba(0,0,0,.09)'; ctx.lineWidth = 2;
    for (let i = 1; i < 9; i++) { const y = H * 0.36 + i * (H * 0.64) / 9; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    if (loose) return drawLoose(ctx, W, H, dt, now);

    for (const m of models.slice().sort((a, b) => a.fy - b.fy)) {
      const sp = spriteFor(m), x = m.fx * W, y = m.fy * H;
      const sw = sp.width / (Math.min(2, window.devicePixelRatio || 1)), sh = sp.height / (Math.min(2, window.devicePixelRatio || 1));
      m.act = Math.max(0, m.act - dt * 0.018);
      let dx = 0, dy = 0, rot = 0, sx = 1, sy = 1;
      const a = m.act, ph = (1 - a) * 10;
      if (a > 0) {
        if (m.verb === 'drive') { dx = Math.sin(ph) * 22; rot = Math.sin(ph) * 0.05; }
        else if (m.verb === 'fly') { dy = -Math.abs(Math.sin(ph * 0.6)) * 60; rot = Math.sin(ph * 0.6) * 0.16; }
        else if (m.verb === 'roar') { sx = 1 + Math.sin(ph * 1.4) * 0.09; sy = 1 - Math.sin(ph * 1.4) * 0.07; dx = Math.sin(ph * 4) * 5; }
        else if (m.verb === 'hop') { dy = -Math.abs(Math.sin(ph * 0.9)) * 44; sy = 1 + Math.abs(Math.cos(ph * 0.9)) * 0.06; }
        else if (m.verb === 'sail') rot = Math.sin(ph * 0.8) * 0.12;
        else { dy = -Math.abs(Math.sin(ph * 0.7)) * 16; rot = Math.sin(ph) * 0.05; }
      }
      ctx.save(); ctx.globalAlpha = 0.24; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(x, y + 4, sw * 0.3, sw * 0.1, 0, 0, 6.2832); ctx.fill(); ctx.restore();
      ctx.save();
      ctx.translate(x + dx, y + dy); ctx.rotate(rot); ctx.scale(sx, sy);
      if (focus === m) { ctx.shadowColor = 'rgba(245,184,32,.85)'; ctx.shadowBlur = 22; }
      ctx.drawImage(sp, -sw / 2, -sh + sw * 0.06, sw, sh);
      ctx.restore();
      m.hit = { x: x - sw / 2, y: y - sh + sw * 0.06, w: sw, h: sh };
      if (a > 0 && m.verb === 'sparkle') for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#f5b820';
        ctx.beginPath(); ctx.arc(x + Math.sin(ph + i * 2) * 42, y - 40 - ((ph * 8 + i * 22) % 70), 3, 0, 6.2832); ctx.fill();
      }
    }
    if (!models.length) {
      ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = Art.F(600, 16); ctx.textAlign = 'center';
      ctx.fillText('Build something and it will stand here.', W / 2, H * 0.52);
    }
    raf = requestAnimationFrame(draw);
  }
  function drawLoose(ctx, W, H, dt, now) {
    const L = loose, base = L.m.s;
    const ps = Art.parts(base, 0);
    const f = Art.fitU(ps.W, ps.D, base.H, W * 0.8, H * 0.5);
    const u = f.u, v = ISO.view(u), b = ISO.bounds(ps.W, ps.D, base.H, u);
    const ox = W / 2 - b.w / 2 - b.x0, oy = H * 0.6 - b.h / 2 - b.y0;
    L.t += dt;
    if (L.re !== undefined) {
      L.re += dt * 0.014;
      const k = Math.min(1, L.re), e = 1 - Math.pow(1 - k, 3);
      for (const bit of L.bits) {
        bit.x += (bit.p.x - bit.x) * e * 0.3; bit.y += (bit.p.y - bit.y) * e * 0.3; bit.z += (bit.p.z - bit.z) * e * 0.3;
      }
      if (k >= 1) { loose = null; A.step_done(); App.$('btnSmash').textContent = '💥 Smash'; raf = requestAnimationFrame(draw); return; }
    } else {
      for (const bit of L.bits) {
        bit.vz -= 0.028 * dt;
        bit.x += bit.vx * dt * 0.2; bit.y += bit.vy * dt * 0.2; bit.z += bit.vz * dt * 0.2;
        if (bit.z < 0) { bit.z = 0; bit.vz = -bit.vz * 0.34; bit.vx *= 0.7; bit.vy *= 0.7; if (Math.abs(bit.vz) < 0.05) bit.vz = 0; }
      }
    }
    const order = L.bits.slice().sort((a, b2) => (a.x + a.y + a.z * 0.8) - (b2.x + b2.y + b2.z * 0.8));
    for (const bit of order) ISO.paint(ctx, ISO.brick({ ...bit.p, x: bit.x, y: bit.y, z: bit.z }, v, bit.p.hex, ox, oy, 1), u < 9 ? 0.7 : 1.1);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = Art.F(600, 15); ctx.textAlign = 'center';
    ctx.fillText(L.re !== undefined ? 'Putting it back together…' : 'Tap ↻ Rebuild to put it back', W / 2, 44);
    raf = requestAnimationFrame(draw);
  }
  function open(id) {
    build();
    focus = models.find(m => m.s.id === id) || models[0] || null;
    loose = null;
    App.$('playName').textContent = focus ? focus.s.name : 'My models';
    App.go('play'); App.fit();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }
  function wire() {
    const c = App.$('playC');
    c.addEventListener('pointerdown', e => {
      const p = App.pt(e, c);
      if (loose) return;
      for (const m of models.slice().reverse()) {
        const h = m.hit;
        if (h && p.x > h.x && p.x < h.x + h.w && p.y > h.y && p.y < h.y + h.h) {
          focus = m; App.$('playName').textContent = m.s.name;
          drag = { m, dx: p.x - m.fx * App.canvas('playC').w, dy: p.y - m.fy * App.canvas('playC').h, moved: false };
          return;
        }
      }
      drag = null;
    });
    c.addEventListener('pointermove', e => {
      if (!drag) return;
      const p = App.pt(e, c), cc = App.canvas('playC');
      drag.moved = true;
      drag.m.fx = Math.max(0.12, Math.min(0.88, (p.x - drag.dx) / cc.w));
      drag.m.fy = Math.max(0.34, Math.min(0.9, (p.y - drag.dy) / cc.h));
    });
    c.addEventListener('pointerup', () => { if (drag && !drag.moved) poke(drag.m); drag = null; });
    c.addEventListener('pointercancel', () => { drag = null; });
    App.$('btnSmash').onclick = smash;
    App.$('btnRebuild').onclick = rebuild;
    App.$('playBack').onclick = () => { cancelAnimationFrame(raf); raf = 0; App.go('home'); Home.render(); };
  }
  return { open, wire, stop() { cancelAnimationFrame(raf); raf = 0; }, onResize() {} };
})();
