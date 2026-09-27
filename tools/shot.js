/* Render set models to a PNG contact sheet.  node tools/shot.js out.png [id ...] */
const fs = require('fs'), path = require('path'), D = path.join(__dirname, '..');
const { PALETTE, packSet, priceFor } = require(path.join(D, 'tools/pack.js'));
const ISO = require(path.join(D, 'iso.js'));
const { Surface, draw, toPNG, fillPoly } = require(path.join(D, 'tools/png.js'));
const GLASS = { glassClear: 1, glassBlue: 1, glassRed: 1 };

function model(set, u) {
  const { parts, W, D: Dp, H } = packSet(set);
  const b = ISO.bounds(W, Dp, H, u);
  const cmds = ISO.scene(parts.map(p => ({ ...p, hex: PALETTE[set.legend[p.c]], glass: GLASS[set.legend[p.c]] })),
    { u, ox: -b.x0, oy: -b.y0 });
  return { cmds, w: Math.ceil(b.w), h: Math.ceil(b.h), parts, W, D: Dp, H };
}

const out = process.argv[2] || 'sheet.png';
let argv = process.argv.slice(3);
const SPIN = argv.includes('--spin');            // one set, all four turntable angles
argv = argv.filter(a => a !== '--spin');
let ids = argv;
if (!ids.length) ids = fs.readdirSync(path.join(D, 'sets')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort();
const CELL = +(process.env.SHOT_CELL || 300), PAD = 10;
if (SPIN) {
  if (ids.length !== 1) { console.error('--spin takes exactly one set id'); process.exit(2); }
  const set = JSON.parse(fs.readFileSync(path.join(D, 'sets', ids[0] + '.json'), 'utf8'));
  const base = packSet(set);
  const s2 = Surface(4 * CELL, CELL + 26, '#141a2c');
  for (let t = 0; t < 4; t++) {
    const r = ISO.rotate(base.parts, t, base.W, base.D);
    let u = 24, b, cmds;
    for (;;) {
      b = ISO.bounds(r.W, r.D, base.H, u);
      if ((b.w <= CELL - PAD * 2 && b.h <= CELL - PAD * 2) || u <= 3) break;
      u -= 1;
    }
    cmds = ISO.scene(r.parts.map(p => ({ ...p, hex: PALETTE[set.legend[p.c]], glass: GLASS[set.legend[p.c]] })),
      { u, ox: -b.x0, oy: -b.y0 });
    const cx = t * CELL + (CELL - b.w) / 2, cy = 20 + (CELL - 40 - b.h) / 2;
    fillPoly(s2, [[t * CELL + 3, 3], [t * CELL + CELL - 3, 3], [t * CELL + CELL - 3, CELL + 18], [t * CELL + 3, CELL + 18]], '#1d2540', 1);
    draw(s2, cmds.map(c => c.ell ? { ...c, ell: [c.ell[0] + cx, c.ell[1] + cy, c.ell[2], c.ell[3]] } : { ...c, poly: c.poly.map(p => [p[0] + cx, p[1] + cy]) }));
  }
  fs.writeFileSync(out, toPNG(s2));
  console.log(`${ids[0]} "${set.name}" ${base.parts.length} bricks ${base.W}x${base.D}x${base.H} -> ${out}`);
  console.log('four panels, left to right: turn 0 (as authored), turn 1, turn 2, turn 3');
  process.exit(0);
}
const COLS = Math.min(5, ids.length);
const rows = Math.ceil(ids.length / COLS);
const s = Surface(COLS * CELL, rows * (CELL + 26), '#141a2c');
ids.forEach((id, i) => {
  const set = JSON.parse(fs.readFileSync(path.join(D, 'sets', id + '.json'), 'utf8'));
  let u = 16, m;
  for (;;) { m = model(set, u); if ((m.w <= CELL - PAD * 2 && m.h <= CELL - PAD * 2) || u <= 3) break; u -= 1; }
  const cx = (i % COLS) * CELL + (CELL - m.w) / 2, cy = Math.floor(i / COLS) * (CELL + 26) + 20 + (CELL - 40 - m.h) / 2;
  fillPoly(s, [[(i % COLS) * CELL + 3, Math.floor(i / COLS) * (CELL + 26) + 3], [(i % COLS) * CELL + CELL - 3, Math.floor(i / COLS) * (CELL + 26) + 3],
    [(i % COLS) * CELL + CELL - 3, Math.floor(i / COLS) * (CELL + 26) + CELL + 18], [(i % COLS) * CELL + 3, Math.floor(i / COLS) * (CELL + 26) + CELL + 18]], '#1d2540', 1);
  draw(s, m.cmds.map(c => c.ell ? { ...c, ell: [c.ell[0] + cx, c.ell[1] + cy, c.ell[2], c.ell[3]] } : { ...c, poly: c.poly.map(p => [p[0] + cx, p[1] + cy]) }));
  console.log(`${String(i + 1).padStart(2)}  ${id.padEnd(22)} ${set.name.padEnd(20)} ${String(m.parts.length).padStart(3)} bricks  ${m.W}x${m.D}x${m.H}  $${priceFor(m.parts.length)}  u=${u}`);
});
fs.writeFileSync(out, toPNG(s));
console.log(`\n${ids.length} models -> ${out}  (${s.w}x${s.h}, row order left to right)`);
