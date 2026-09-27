#!/usr/bin/env node
// Validates every set in sets/ (format, palette, nothing floating) and checks that
// catalog.js is in sync with the set sources. Usage: node test/sets.test.js
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const sets = fs.readdirSync(path.join(root, 'sets')).filter(f => f.endsWith('.json')).sort();
let failed = 0;
for (const f of sets) {
  try {
    const out = execFileSync(process.execPath, [path.join(root, 'tools/validate.js'), path.join(root, 'sets', f)], { encoding: 'utf8' });
    console.log(out.trim().split('\n').pop());
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}\n${(e.stdout || '') + (e.stderr || '')}`);
  }
}
// catalog.js must contain exactly the ids in sets/
const cat = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const ids = [...cat.matchAll(/\{id:"([a-z0-9-]+)"/g)].map(m => m[1]).sort();
const want = sets.map(f => f.replace(/\.json$/, ''));
if (JSON.stringify(ids) !== JSON.stringify(want)) {
  failed++;
  console.log('FAIL catalog.js is out of date: run `node tools/catalog.js`');
}
console.log(failed ? `${failed} problem(s)` : `all ${sets.length} sets valid, catalog in sync`);
process.exit(failed ? 1 : 0);
