/* Box art, shelf thumbnails and everything else that has to show a model as a picture.
   Every render is cached: the aisle alone would otherwise redraw thirty models a frame. */
const THEMES = {
  City:      { icon: '🚕', tint: '#2f7de1', verb: 'drive' },
  Vehicles:  { icon: '🏎️', tint: '#d4342a', verb: 'drive' },
  Space:     { icon: '🚀', tint: '#4a4fb5', verb: 'fly'   },
  Castle:    { icon: '🏰', tint: '#7b6a4e', verb: 'flag'  },
  Pirates:   { icon: '🏴‍☠️', tint: '#2b2b33', verb: 'sail'  },
  Dino:      { icon: '🦕', tint: '#2f8b4c', verb: 'roar'  },
  Creatures: { icon: '🐙', tint: '#8a3fb0', verb: 'hop'   },
  Hangout:   { icon: '🍦', tint: '#e0509a', verb: 'hop'   },
  Machines:  { icon: '🚜', tint: '#e08a16', verb: 'work'  },
  Holiday:   { icon: '🎁', tint: '#c02c3e', verb: 'sparkle' },
};
const Art = (() => {
  const GLASS = { glassClear: 1, glassBlue: 1, glassRed: 1 };
  const F = (w, px) => `${w} ${px}px Fredoka, system-ui, -apple-system, sans-serif`;
  const pc = new Map(), bc = new Map();

  /* Parts as objects, at a given turntable angle. The SAME array instance comes back every
     time, which is what lets ISO.order keep its cached topological sort. */
  function parts(set, turn) {
    turn = ((turn || 0) % 4 + 4) % 4;
    const k = set.id + '|' + turn;
    let p = pc.get(k);
    if (p) return p;
    const base = set.parts.map((a, i) => ({
      x: a[0], y: a[1], z: a[2], w: a[3], d: a[4], c: a[5], step: a[6], i,
      hex: PALETTE[set.legend[a[5]]], glass: !!GLASS[set.legend[a[5]]],
    }));
    if (turn) { const r = ISO.rotate(base, turn, set.W, set.D); p = r.parts; p.W = r.W; p.D = r.D; }
    else { p = base; p.W = set.W; p.D = set.D; }
    pc.set(k, p);
    return p;
  }
  /* biggest unit size whose model still fits the box */
  function fitU(W, D, H, w, h, cap) {
    let u = cap || 34;
    for (;;) {
      const b = ISO.bounds(W, D, H, u);
      if ((b.w <= w && b.h <= h) || u <= 1.5) return { u, b };
      u -= u > 10 ? 1 : 0.35;
    }
  }
  /* Draw a model centred in a rect. Returns the placement so callers can hit-test. */
  function model(ctx, set, turn, x, y, w, h, o) {
    o = o || {};
    const ps = o.parts || parts(set, turn);
    const H = o.H || set.H;
    const f = fitU(ps.W, ps.D, H, w, h, o.cap);
    const u = o.u || f.u, b = ISO.bounds(ps.W, ps.D, H, u);
    const ox = (o.ox !== undefined ? o.ox : x + (w - b.w) / 2) - b.x0;
    const oy = (o.oy !== undefined ? o.oy : y + (h - b.h) / 2) - b.y0;
    if (o.shadow !== false) {
      ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(ox + (ps.W - ps.D) * u / 2, oy + (ps.W + ps.D) * u / 2, (ps.W + ps.D) * u * 0.34, (ps.W + ps.D) * u * 0.14, 0, 0, 6.2832);
      ctx.fill(); ctx.restore();
    }
    ISO.paint(ctx, ISO.scene(ps, { u, ox, oy }), u < 6 ? 0 : u < 11 ? 0.7 : 1.1);
    return { u, ox, oy };
  }
  function fitText(ctx, s, max, start, weight) {
    let px = start;
    for (;;) { ctx.font = F(weight || 700, px); if (ctx.measureText(s).width <= max || px <= 8) return px; px -= 1; }
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* ---- the box on the shelf ---- */
  function paintBox(ctx, set, w, h, back) {
    const base = PALETTE[set.boxColor] || '#2f7de1';
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, ISO.shade(base, 1.28)); g.addColorStop(1, ISO.shade(base, 0.7));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // a lighter window for the model to sit in
    const pad = Math.round(w * 0.045);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    roundRect(ctx, pad, Math.round(h * 0.15), w - pad * 2, Math.round(h * 0.58), Math.round(w * 0.05)); ctx.fill();
    if (back) {
      // back of the box: the model from the other side plus the blurb
      model(ctx, set, 2, pad, h * 0.13, w - pad * 2, h * 0.5);
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      const fs = Math.max(9, Math.round(w * 0.052));
      ctx.font = F(500, fs); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const words = set.blurb.split(' ');
      let line = '', ly = h * 0.68;
      for (const wd of words) {
        if (ctx.measureText(line + wd).width > w - pad * 2 && line) { ctx.fillText(line.trim(), pad, ly); ly += fs * 1.25; line = ''; }
        line += wd + ' ';
      }
      if (line.trim()) ctx.fillText(line.trim(), pad, ly);
      ctx.restore();
      return;
    }
    model(ctx, set, 0, pad, h * 0.13, w - pad * 2, h * 0.56);
    // piece pill first, so the name knows how much room is left and stops overlapping it
    const pp = Math.round(h * 0.062);
    ctx.font = F(700, pp); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    const lbl = set.n + ' pcs', lw2 = ctx.measureText(lbl).width + pp * 1.1;
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    roundRect(ctx, w - pad - lw2, h - pad - pp * 1.8, lw2, pp * 1.7, pp * 0.85); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(lbl, w - pad - pp * 0.55, h - pad - pp * 0.55);
    // name
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const npx = fitText(ctx, set.name, w - pad * 2 - lw2 - pad, Math.round(h * 0.115));
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, npx * 0.22);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeText(set.name, pad, h - pad * 2.4);
    ctx.fillStyle = '#fff'; ctx.fillText(set.name, pad, h - pad * 2.4);
    // age flag, top-LEFT: the aisle stamps its NEW starburst over the top-right corner
    ctx.textBaseline = 'top';
    const ag = Math.round(h * 0.085), aw = ag * 1.9;
    ctx.fillStyle = 'rgba(255,255,255,.93)';
    roundRect(ctx, pad, pad * 0.7, aw, ag * 1.5, ag * 0.42); ctx.fill();
    ctx.fillStyle = ISO.shade(base, 0.55); ctx.font = F(700, ag);
    ctx.textAlign = 'center'; ctx.fillText(set.ages, pad + aw / 2, pad * 0.7 + ag * 0.26);
    ctx.restore();
  }
  function cv(w, h) {
    const c = document.createElement('canvas'), r = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * r); c.height = Math.round(h * r);
    const x = c.getContext('2d'); x.scale(r, r);
    return { c, x };
  }
  function box(set, w, h, back) {
    const k = set.id + '|b' + w + 'x' + h + (back ? 'B' : '');
    let hit = bc.get(k);
    if (hit) return hit;
    const { c, x } = cv(w, h);
    paintBox(x, set, w, h, back);
    bc.set(k, c);
    return c;
  }
  function thumb(set, w, h, bg) {
    const k = set.id + '|t' + w + 'x' + h + (bg || '');
    let hit = bc.get(k);
    if (hit) return hit;
    const { c, x } = cv(w, h);
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    model(x, set, 0, 3, 3, w - 6, h - 6);
    bc.set(k, c);
    return c;
  }
  /* a model on transparent glass, pre-rendered once so the diorama can just blit it */
  function sprite(set, turn, w, h) {
    const k = set.id + '|s' + turn + '|' + w + 'x' + h;
    let hit = bc.get(k);
    if (hit) return hit;
    const { c, x } = cv(w, h);
    model(x, set, turn, 0, 0, w, h, { shadow: false });
    bc.set(k, c);
    return c;
  }
  /* fonts land after first paint; throw the cache away once so nothing stays in Times */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => bc.clear());
  return { parts, model, box, thumb, sprite, paintBox, fitU, fitText, roundRect, F, clear: () => bc.clear() };
})();
