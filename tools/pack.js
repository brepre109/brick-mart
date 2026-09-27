/* Turn a set's voxel layers into real brick parts, merging cells into the largest
   standard brick that fits. Shared by the validator, the build screen and the box art. */
const PALETTE = {
  white: '#f4f4f4', lightGray: '#a3a6a8', darkGray: '#6c6e68', black: '#1b1b1b',
  red: '#c91a09', orange: '#f57f20', yellow: '#f2cd37', lime: '#bbe90b',
  green: '#237841', darkGreen: '#184632', cyan: '#26bfd4', blue: '#0055bf',
  darkBlue: '#0a3463', purple: '#81007b', magenta: '#e4adc8', pink: '#fc97ac',
  brown: '#582a12', tan: '#e4cd9e', darkTan: '#958a73', sand: '#a0bcac',
  gold: '#dcbe61', silver: '#c0c4c8', glassClear: '#eef6f7', glassBlue: '#aee9ef', glassRed: '#f6a3a3',
};
// largest area first; each is a real brick footprint
const SIZES = [[8, 2], [6, 2], [8, 1], [4, 2], [6, 1], [3, 2], [2, 2], [4, 1], [3, 1], [2, 1], [1, 1]];

function packLayer(rows, W, D) {
  const used = Array.from({ length: D }, () => new Array(W).fill(false));
  const out = [];
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const c = rows[y][x];
    if (used[y][x] || c === '.' || c === ' ') continue;
    let best = [1, 1];
    for (const [a, b] of SIZES) {
      const tries = a === b ? [[a, b]] : [[a, b], [b, a]];
      let found = null;
      for (const [w, d] of tries) {
        if (x + w > W || y + d > D) continue;
        let ok = true;
        for (let dy = 0; dy < d && ok; dy++) for (let dx = 0; dx < w; dx++)
          if (used[y + dy][x + dx] || rows[y + dy][x + dx] !== c) { ok = false; break; }
        if (ok) { found = [w, d]; break; }
      }
      if (found) { best = found; break; }
    }
    const [w, d] = best;
    for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) used[y + dy][x + dx] = true;
    out.push({ x, y, w, d, c });
  }
  return out;
}

/* layers -> parts with build steps. Each part: {x,y,z,w,d,c,step}, z in layer units.
   Chunking each layer separately leaves a ragged tail — a roof apex becomes a step of one
   brick, and a one-brick step does not deserve a fanfare. So steps run at a target size and
   only close on a layer boundary once they are worth closing; a thin layer joins the step
   below it, and a tiny final step is folded back into its predecessor. */
function packSet(set, perStep = 9) {
  const layers = set.layers, D = layers[0].length, W = layers[0][0].length;
  const parts = [];
  let step = 1, inStep = 0;
  layers.forEach((rows, z) => {
    for (const p of packLayer(rows, W, D)) {
      if (inStep >= perStep) { step++; inStep = 0; }
      parts.push({ ...p, z, step }); inStep++;
    }
    if (inStep >= 3) { step++; inStep = 0; }
  });
  if (inStep === 0) step--;
  else if (step > 1 && inStep < 3) { for (const p of parts) if (p.step === step) p.step = step - 1; step--; }
  return { parts, steps: step, W, D, H: layers.length };
}
/* Tiers tuned to the catalogue that actually exists. The old ladder topped out at a tier no
   legal model could reach: the largest the validator permits, a solid 16x16x14, packs to 224
   bricks, so nothing ever cost more than the fourth rung. */
const priceFor = n => n < 40 ? 9.99 : n < 70 ? 14.99 : n < 100 ? 19.99 : n < 140 ? 29.99 : n < 190 ? 39.99 : 59.99;
if (typeof module !== 'undefined') module.exports = { PALETTE, packLayer, packSet, priceFor, SIZES };
