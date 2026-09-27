/* Validate one set file. Usage: node tools/validate.js sets/<id>.json */
const fs = require('fs'), path = require('path');
const { PALETTE, packSet, priceFor } = require(path.join(__dirname, 'pack.js'));
const file = process.argv[2];
if (!file) { console.error('usage: node tools/validate.js sets/<id>.json'); process.exit(2); }
let set; try { set = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.error('NOT VALID JSON: ' + e.message); process.exit(1); }
const err = [], warn = [];
const need = ['id', 'name', 'theme', 'ages', 'blurb', 'boxColor', 'legend', 'layers'];
for (const k of need) if (set[k] === undefined) err.push(`missing field "${k}"`);
if (!err.length) {
  if (!/^[a-z0-9-]+$/.test(set.id)) err.push('id must be lower-case letters, digits and dashes');
  if (!Array.isArray(set.layers) || !set.layers.length) err.push('layers must be a non-empty array');
  else {
    const D = set.layers[0].length, W = set.layers[0][0].length;
    if (W < 3 || W > 16 || D < 3 || D > 16) err.push(`footprint ${W}x${D} must be between 3x3 and 16x16`);
    if (set.layers.length > 14) err.push(`${set.layers.length} layers, max is 14`);
    set.layers.forEach((rows, z) => {
      if (!Array.isArray(rows) || rows.length !== D) { err.push(`layer ${z} has ${rows && rows.length} rows, expected ${D}`); return; }
      rows.forEach((r, y) => {
        if (typeof r !== 'string' || r.length !== W) err.push(`layer ${z} row ${y} is ${r && r.length} wide, expected ${W}`);
        else for (const ch of r) if (ch !== '.' && !set.legend[ch]) err.push(`layer ${z} row ${y}: '${ch}' is not in the legend`);
      });
    });
    for (const k in set.legend) if (!PALETTE[set.legend[k]]) err.push(`legend '${k}' -> "${set.legend[k]}" is not a palette colour`);
      const DRAB = ['white', 'lightGray', 'darkGray', 'black', 'silver', 'darkTan', 'sand'];
      if (DRAB.includes(set.boxColor)) err.push(`boxColor "${set.boxColor}" is a grey — a box on the shelf has to be a colour a child can spot from across the aisle`);
    if (!err.length) {
      const filled = (z, x, y) => z >= 0 && z < set.layers.length && y >= 0 && y < D && x >= 0 && x < W && set.layers[z][y][x] !== '.';
      let cells = 0;
      for (let z = 0; z < set.layers.length; z++) for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) if (filled(z, x, y)) cells++;
      if (cells < 40) err.push(`only ${cells} filled cells — the model is too small to be a set`);
      // buildability: in each layer above the ground, every connected island must rest on something below
      for (let z = 1; z < set.layers.length; z++) {
        const seen = Array.from({ length: D }, () => new Array(W).fill(false));
        for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
          if (seen[y][x] || !filled(z, x, y)) continue;
          const stack = [[x, y]], island = []; seen[y][x] = true; let rests = false;
          while (stack.length) {
            const [cx, cy] = stack.pop(); island.push([cx, cy]);
            if (filled(z - 1, cx, cy)) rests = true;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = cx + dx, ny = cy + dy;
              if (filled(z, nx, ny) && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([nx, ny]); }
            }
          }
          if (!rests) err.push(`layer ${z}: a group of ${island.length} cells near (${x},${y}) floats — nothing under it`);
        }
      }
    }
  }
}
if (err.length) { console.error('INVALID:\n  ' + err.slice(0, 12).join('\n  ')); process.exit(1); }
const { parts, steps, W, D, H } = packSet(set);
if (parts.length < 25) warn.push(`only ${parts.length} bricks — aim for 30 or more`);
if (parts.length > 320) warn.push(`${parts.length} bricks is a lot — simplify`);
console.log(`OK  ${set.id}  "${set.name}" [${set.theme}]  ${parts.length} bricks, ${steps} build steps, ${W}x${D}x${H}, $${priceFor(parts.length)}`);
if (warn.length) console.log('  note: ' + warn.join('; '));
