/* Tiny software rasteriser + PNG writer, so set models can be eyeballed offline.
   Supersamples 3x and boxes down, which is enough to judge a silhouette. */
const zlib = require('zlib');
const SS = 3;

function Surface(w, h, bg) {
  const W = w * SS, H = h * SS, buf = Buffer.alloc(W * H * 3);
  const c = [parseInt(bg.slice(1, 3), 16), parseInt(bg.slice(3, 5), 16), parseInt(bg.slice(5, 7), 16)];
  for (let i = 0; i < W * H; i++) { buf[i * 3] = c[0]; buf[i * 3 + 1] = c[1]; buf[i * 3 + 2] = c[2]; }
  return { w, h, W, H, buf };
}
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function px(s, x, y, c, a) {
  if (x < 0 || y < 0 || x >= s.W || y >= s.H) return;
  const i = (y * s.W + x) * 3;
  if (a >= 1) { s.buf[i] = c[0]; s.buf[i + 1] = c[1]; s.buf[i + 2] = c[2]; return; }
  s.buf[i] += (c[0] - s.buf[i]) * a; s.buf[i + 1] += (c[1] - s.buf[i + 1]) * a; s.buf[i + 2] += (c[2] - s.buf[i + 2]) * a;
}
function fillPoly(s, pts, col, a) {
  const c = hex(col), P = pts.map(p => [p[0] * SS, p[1] * SS]);
  let y0 = Math.max(0, Math.floor(Math.min(...P.map(p => p[1])))), y1 = Math.min(s.H - 1, Math.ceil(Math.max(...P.map(p => p[1]))));
  for (let y = y0; y <= y1; y++) {
    const xs = [], cy = y + 0.5;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > cy) !== (yj > cy)) xs.push((xj - xi) * (cy - yi) / (yj - yi) + xi);
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(s.W, Math.round(xs[k + 1])); x++) px(s, x, y, c, a);
  }
}
function fillEll(s, cx, cy, rx, ry, col, a) {
  const c = hex(col); cx *= SS; cy *= SS; rx *= SS; ry *= SS;
  for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(s.H - 1, Math.ceil(cy + ry)); y++) {
    const t = 1 - ((y + 0.5 - cy) / ry) ** 2; if (t <= 0) continue;
    const hx = rx * Math.sqrt(t);
    for (let x = Math.max(0, Math.round(cx - hx)); x < Math.min(s.W, Math.round(cx + hx)); x++) px(s, x, y, c, a);
  }
}
function line(s, pts, col, a) {
  const c = hex(col), P = pts.map(p => [p[0] * SS, p[1] * SS]);
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let k = 0; k <= n; k++) px(s, Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), c, a);
  }
}
function draw(s, cmds) {
  for (const cmd of cmds) {
    const a = cmd.alpha === undefined ? 1 : cmd.alpha;
    if (cmd.ell) fillEll(s, cmd.ell[0], cmd.ell[1], cmd.ell[2], cmd.ell[3], cmd.fill, a);
    else { fillPoly(s, cmd.poly, cmd.fill, a); if (cmd.line) line(s, cmd.poly, cmd.line, a * 0.75); }
  }
}
function toPNG(s) {
  const raw = Buffer.alloc(s.h * (1 + s.w * 3));
  for (let y = 0; y < s.h; y++) {
    const o = y * (1 + s.w * 3); raw[o] = 0;
    for (let x = 0; x < s.w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
        const i = ((y * SS + dy) * s.W + x * SS + dx) * 3; r += s.buf[i]; g += s.buf[i + 1]; b += s.buf[i + 2];
      }
      const n = SS * SS, p = o + 1 + x * 3;
      raw[p] = r / n; raw[p + 1] = g / n; raw[p + 2] = b / n;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s.w, 0); ihdr.writeUInt32BE(s.h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
let TBL = null;
function crc32(buf) {
  if (!TBL) { TBL = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; TBL[n] = c; } }
  let c = -1; for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return c ^ -1;
}
module.exports = { Surface, draw, toPNG, fillPoly, fillEll, line };
