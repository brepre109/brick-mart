/* Isometric brick drawing, shared by the browser and the offline set previewer.
   It does not touch a canvas: it turns a list of packed parts into an ordered list of
   flat draw commands ({poly,fill} / {ell,fill}), so the same geometry can be painted
   onto a 2D context in the game or rasterised to a PNG by tools/shot.js. */
const ISO = (() => {
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const m = c => Math.round(clamp(c * f, 0, 255)).toString(16).padStart(2, '0');
    return '#' + m((n >> 16) & 255) + m((n >> 8) & 255) + m(n & 255);
  }
  function mix(hex, hex2, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(hex2.slice(1), 16);
    const m = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t).toString(16).padStart(2, '0');
    return '#' + m(16) + m(8) + m(0);
  }
  // unit -> the three screen basis vectors. +x goes right-down, +y goes left-down, +z goes up.
  // a real brick is 1.2 stud-pitches tall, and one unit along x measures u*sqrt(1.25) on screen
  const view = u => ({ u, hw: u, hh: u * 0.5, bh: u * 1.25 });
  const P = (v, x, y, z) => [(x - y) * v.hw, (x + y) * v.hh - z * v.bh];

  /* screen box for a WxDxH model at unit u, before any offset */
  function bounds(W, D, H, u) {
    const v = view(u);
    return { x0: -D * v.hw, y0: -H * v.bh, w: (W + D) * v.hw, h: (W + D) * v.hh + H * v.bh };
  }

  const TOP = 1.0, RIGHT = 0.74, FRONT = 0.52;

  /* one brick -> its polygons. ox/oy shift the whole model on screen. */
  function brick(p, v, hex, ox, oy, alpha) {
    const { x, y, z, w, d } = p, out = [];
    const pt = (X, Y, Z) => { const q = P(v, X, Y, Z); return [q[0] + ox, q[1] + oy]; };
    const glass = p.glass;
    const top = glass ? mix(hex, '#ffffff', 0.22) : hex;
    out.push({ poly: [pt(x, y, z + 1), pt(x + w, y, z + 1), pt(x + w, y + d, z + 1), pt(x, y + d, z + 1)],
      fill: shade(top, TOP), line: shade(hex, 0.42), alpha });
    out.push({ poly: [pt(x + w, y, z + 1), pt(x + w, y + d, z + 1), pt(x + w, y + d, z), pt(x + w, y, z)],
      fill: shade(hex, RIGHT), line: shade(hex, 0.36), alpha });
    out.push({ poly: [pt(x, y + d, z + 1), pt(x + w, y + d, z + 1), pt(x + w, y + d, z), pt(x, y + d, z)],
      fill: shade(hex, FRONT), line: shade(hex, 0.3), alpha });
    // studs, one per cell of the footprint
    const lift = v.bh * 0.15, rx = v.hw * 0.33, ry = v.hh * 0.33;
    for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) {
      const c = pt(x + dx + 0.5, y + dy + 0.5, z + 1);
      out.push({ ell: [c[0], c[1], rx, ry], fill: shade(hex, RIGHT * 0.94), alpha });
      out.push({ ell: [c[0], c[1] - lift, rx, ry], fill: shade(top, TOP * 1.07), line: shade(hex, 0.45), alpha });
    }
    return out;
  }

  /* Painter's order.  The view ray for this projection is (1,1,0.8) — moving along it
     leaves the screen point unchanged — so along any ray that meets both bricks, the one
     whose x (or y, or z) range lies entirely beyond the other's is the nearer one.
     No single numeric key gets this right: a ray-cast check over the whole catalogue put
     805 of 23,725 overlapping pairs in the wrong order under a far-corner key, which shows
     up as a long brick painted over the small one standing in front of it. So build the
     "must be drawn before" graph and topologically sort it.
     If each brick looks in front of the other, no ray can meet both (they are disjoint on
     screen) and the pair needs no edge at all — which is also why this never has a cycle. */
  const depth = p => (p.x + p.w) + (p.y + p.d) + p.z * 2;   // tie-break only
  const inFront = (A, B) => B.x >= A.x + A.w || B.y >= A.y + A.d || B.z >= A.z + 1;

  const cache = new WeakMap();
  function order(parts) {
    const hit = cache.get(parts);
    if (hit && hit.n === parts.length) return hit.ord;
    const n = parts.length, adj = [], indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) adj.push([]);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = parts[i], b = parts[j], bf = inFront(a, b), af = inFront(b, a);
      if (bf === af) continue;                       // disjoint on screen, order is free
      if (bf) { adj[i].push(j); indeg[j]++; } else { adj[j].push(i); indeg[i]++; }
    }
    const key = parts.map(depth), ord = [], ready = [];
    for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
    while (ready.length) {
      let b = 0;                                     // among the free ones take the deepest
      for (let k = 1; k < ready.length; k++) if (key[ready[k]] < key[ready[b]]) b = k;
      const i = ready[b]; ready[b] = ready[ready.length - 1]; ready.pop();
      ord.push(i);
      for (const j of adj[i]) if (--indeg[j] === 0) ready.push(j);
    }
    for (let i = 0; i < n; i++) if (indeg[i] > 0) ord.push(i);   // belt and braces
    cache.set(parts, { n, ord });
    return ord;
  }

  /* 90-degree yaw, done on the integer grid so every face stays axis-aligned and the
     depth logic, topFace and inPoly all keep working untouched. */
  function rotate(parts, turns, W, D) {
    let ps = parts, w = W, d = D;
    for (let t = ((turns % 4) + 4) % 4; t > 0; t--) {
      ps = ps.map(p => ({ ...p, x: d - p.y - p.d, y: p.x, w: p.d, d: p.w }));
      const s = w; w = d; d = s;
    }
    return { parts: ps, W: w, D: d };
  }

  /* parts: [{x,y,z,w,d,hex,glass?,ghost?}]  ->  {cmds, box} */
  function scene(parts, o) {
    const u = o.u, v = view(u), ox = o.ox || 0, oy = o.oy || 0;
    const cmds = [];
    for (const i of order(parts)) {
      const p = parts[i];
      if (p.hidden) continue;
      // glass really is see-through: the topological order guarantees whatever sits behind
      // a windscreen has already been painted by the time the glass goes over it
      const a = p.alpha !== undefined ? p.alpha : p.glass ? 0.62 : 1;
      cmds.push(...brick(p, v, p.hex, ox, oy, a));
    }
    return cmds;
  }

  /* the flat diamond a brick's top face covers, for hit testing */
  function topFace(p, u, ox, oy) {
    const v = view(u), pt = (X, Y, Z) => { const q = P(v, X, Y, Z); return [q[0] + ox, q[1] + oy]; };
    return [pt(p.x, p.y, p.z + 1), pt(p.x + p.w, p.y, p.z + 1), pt(p.x + p.w, p.y + p.d, p.z + 1), pt(p.x, p.y + p.d, p.z + 1)];
  }
  function inPoly(px, py, poly) {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }
  /* paint a command list onto a 2D context */
  function paint(ctx, cmds, lw) {
    for (const c of cmds) {
      ctx.globalAlpha = c.alpha === undefined ? 1 : c.alpha;
      ctx.beginPath();
      if (c.ell) ctx.ellipse(c.ell[0], c.ell[1], c.ell[2], c.ell[3], 0, 0, 6.2832);
      else { ctx.moveTo(c.poly[0][0], c.poly[0][1]); for (let i = 1; i < c.poly.length; i++) ctx.lineTo(c.poly[i][0], c.poly[i][1]); ctx.closePath(); }
      ctx.fillStyle = c.fill; ctx.fill();
      if (c.line && lw !== 0) { ctx.strokeStyle = c.line; ctx.lineWidth = lw || 1; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  return { view, P, bounds, brick, scene, topFace, inPoly, paint, shade, mix, depth, order, rotate, inFront };
})();
if (typeof module !== 'undefined') module.exports = ISO;
