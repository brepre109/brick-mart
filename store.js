/* Brick Mart: the aisle you push a cart down, the box you turn over, and the checkout belt. */
const Store = (() => {
  /* Deck heights are not free parameters: a box plus its price tag has to clear the deck
     above it, and the bottom deck has to clear the cart. 146 + 30 fits the 0.47 -> 0.79 gap. */
  const DECK = [0.17, 0.47, 0.79];
  let theme = null, shelf = [], scenery = [], scroll = 0, vel = 0, maxScroll = 0;
  let padDir = 0, raf = 0, last = 0, walk = 0, cur = null, flip = false;

  const themeSets = t => CATALOG.filter(s => s.theme === t);
  const cents = s => Math.round(s.price * 100);
  // price is in DOLLARS; comparing it against cents put every set in the smallest box
  const boxSize = s => cents(s) >= 3000 ? [118, 146] : cents(s) >= 1900 ? [104, 130] : [92, 114];

  function layout() {
    const c = App.canvas('aisleC');
    shelf = []; scenery = [];
    let x = 96;
    themeSets(theme).forEach(s => {
      const [w, h] = boxSize(s);
      const deck = cents(s) >= 3000 ? 2 : 1;      // the big heavy boxes live on the bottom shelf
      shelf.push({ s, x, w, h, deck, hop: 0 });
      x += Math.max(w + 44, 168);
    });
    // fill the empty decks so the aisle looks stocked rather than picked clean
    const pal = ['#2f7de1', '#e8112d', '#f5b820', '#22a75b', '#8a3fb0', '#e0509a', '#e08a16', '#2bb7c4'];
    for (let i = 0; i * 74 < x + 220; i++) {
      scenery.push({ x: 60 + i * 74, deck: 0, w: 62, h: 84, c: pal[(i * 5 + 3) % pal.length] });
      scenery.push({ x: 52 + i * 86, deck: 2, w: 66, h: 96, c: pal[(i * 3 + 1) % pal.length] });
      if (i % 2) scenery.push({ x: 96 + i * 86, deck: 1, w: 58, h: 92, c: pal[(i * 7 + 5) % pal.length] });
    }
    // a filler box standing where a real one does just makes the shelf look muddled
    scenery = scenery.filter(b => !shelf.some(it => it.deck === b.deck && b.x < it.x + it.w + 16 && b.x + b.w > it.x - 16));
    maxScroll = Math.max(0, x + 120 - c.w);
    scroll = Math.min(scroll, maxScroll);
  }
  function deckY(c, d) { return c.h * DECK[d]; }

  function draw(now) {
    const dt = Math.min(50, now - last) / 16.67; last = now;
    const c = App.canvas('aisleC'), ctx = c.ctx;
    if (padDir) vel += padDir * 1.9 * dt;
    vel *= Math.pow(0.9, dt);
    scroll = Math.max(0, Math.min(maxScroll, scroll + vel * dt));
    if (scroll === 0 || scroll === maxScroll) vel *= 0.4;
    if (Math.abs(vel) > 0.4) { walk += Math.abs(vel) * dt; if (walk > 46) { walk = 0; A.step(); } }

    ctx.clearRect(0, 0, c.w, c.h);
    // ceiling, back wall, floor
    const g = ctx.createLinearGradient(0, 0, 0, c.h);
    g.addColorStop(0, '#f4f7fb'); g.addColorStop(0.62, '#e6ebf3'); g.addColorStop(0.62, '#c9cfda'); g.addColorStop(1, '#aab2c1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = -1; i * 210 < c.w + 420; i++) ctx.fillRect(i * 210 - (scroll * 0.35) % 210, 8, 96, 9);   // light bars
    ctx.strokeStyle = 'rgba(0,0,0,.05)'; ctx.lineWidth = 1;
    for (let i = -1; i * 26 < c.w + 52; i++) { const x = i * 26 - (scroll * 0.6) % 26; ctx.beginPath(); ctx.moveTo(x, c.h * 0.16); ctx.lineTo(x, c.h * 0.62); ctx.stroke(); }

    for (let d = 0; d < 3; d++) {
      const y = deckY(c, d);
      for (const b of scenery) if (b.deck === d) {
        const x = b.x - scroll;
        if (x < -90 || x > c.w + 90) continue;
        ctx.fillStyle = ISO.shade(b.c, 0.82); ctx.fillRect(x, y - b.h, b.w, b.h);
        ctx.fillStyle = b.c; ctx.fillRect(x, y - b.h, b.w - 9, b.h);
        ctx.fillStyle = 'rgba(255,255,255,.34)'; ctx.fillRect(x + 7, y - b.h + 12, b.w - 23, b.h * 0.42);
      }
      for (const it of shelf) if (it.deck === d) {
        const x = it.x - scroll;
        if (x < -170 || x > c.w + 170) continue;
        it.hop *= 0.86;
        const yy = y - it.h - it.hop;
        ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(x + it.w / 2, y + 3, it.w * 0.46, 7, 0, 0, 6.2832); ctx.fill(); ctx.restore();
        ctx.drawImage(Art.box(it.s, it.w, it.h), x, yy, it.w, it.h);
        if (SAVE.isNew(it.s.id)) {
          ctx.save(); ctx.translate(x + it.w - 9, yy + 10); ctx.rotate(-0.25);
          ctx.fillStyle = '#f5b820'; ctx.beginPath();
          for (let k = 0; k < 20; k++) { const a = k / 20 * 6.2832, r = k % 2 ? 11 : 19; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#4a3200'; ctx.font = Art.F(700, 10); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('NEW', 0, 0); ctx.restore();
        }
        if (SAVE.built(it.s.id)) { ctx.font = '18px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('⭐', x + 4, yy + 3); }
        // price tag on the shelf lip
        const can = SAVE.afford(cents(it.s)), lab = can ? '$' + it.s.price.toFixed(2) : '🐷 $' + it.s.price.toFixed(2);
        ctx.font = Art.F(700, 13);
        const tw = ctx.measureText(lab).width + 16;
        ctx.fillStyle = can ? '#fff' : '#eceef3';
        Art.roundRect(ctx, x + it.w / 2 - tw / 2, y + 7, tw, 22, 7); ctx.fill();
        ctx.strokeStyle = can ? '#22a75b' : '#b9c0cd'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = can ? '#187f45' : '#8d95a5'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lab, x + it.w / 2, y + 19);
      }
      // the deck board itself
      ctx.fillStyle = '#9aa3b2'; ctx.fillRect(0, y, c.w, 7);
      ctx.fillStyle = '#c3cad6'; ctx.fillRect(0, y + 7, c.w, 5);
    }
    drawCart(ctx, c, now);
    App.$('cartBtn').querySelector('.cn').textContent = SAVE.s.cart.length;
    raf = requestAnimationFrame(draw);
  }
  function drawCart(ctx, c, now) {
    const x = c.w / 2, y = c.h - 16, w = 96, h = 40;
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 4, w * 0.5, 8, 0, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
    SAVE.s.cart.forEach((id, i) => {
      const s = CATALOG.find(q => q.id === id); if (!s) return;
      ctx.drawImage(Art.box(s, 44, 55), -w / 2 + 14 + i * 15, -h - 30 + i * 3, 44, 55);
    });
    ctx.strokeStyle = '#4a5468'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(w / 2 - 8, -h); ctx.lineTo(w / 2 - 20, -8); ctx.lineTo(-w / 2 + 10, -8); ctx.closePath();
    ctx.fillStyle = 'rgba(210,216,226,.72)'; ctx.fill(); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + i * 6, -h + i * 2); ctx.lineTo(w / 2 - 22 + i * 3, -h + i * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(w / 2 - 8, -h); ctx.lineTo(w / 2 + 6, -h - 16); ctx.stroke();
    const spin = now / 90;
    ctx.fillStyle = '#39414f';
    for (const wx of [-w / 2 + 16, w / 2 - 26]) {
      ctx.beginPath(); ctx.arc(wx, -2, 7, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = '#aeb6c4'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(wx + Math.cos(spin) * 5, -2 + Math.sin(spin) * 5); ctx.lineTo(wx - Math.cos(spin) * 5, -2 - Math.sin(spin) * 5); ctx.stroke();
      ctx.strokeStyle = '#4a5468'; ctx.lineWidth = 5;
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ box view */
  function openBox(s) {
    cur = s; flip = false;
    SAVE.see(s.id);
    renderBox();
    App.$('ovBox').classList.add('on');
    A.pick();
  }
  function renderBox() {
    const s = cur, sheet = App.$('boxSheet'), owned = SAVE.owns(s.id), inCart = SAVE.s.cart.includes(s.id);
    const can = SAVE.afford(cents(s)), th = THEMES[s.theme] || THEMES.City;
    const wide = Math.min(360, window.innerWidth - 64);
    sheet.innerHTML = '';
    const cvs = document.createElement('canvas');
    const r = Math.min(2, window.devicePixelRatio || 1), bh = Math.round(wide * 1.25);
    cvs.width = wide * r; cvs.height = bh * r; cvs.className = 'boxart';
    cvs.style.height = bh + 'px';
    const x = cvs.getContext('2d'); x.scale(r, r);
    Art.paintBox(x, s, wide, bh, flip);
    sheet.appendChild(cvs);
    cvs.onclick = () => { flip = !flip; A.page(); renderBox(); };
    const h = document.createElement('div');
    h.innerHTML = `<h2>${s.name}</h2><div class="sub">${s.blurb}</div>
      <div class="facts"><span class="fact">${th.icon} ${s.theme}</span><span class="fact">🧱 <b>${s.n}</b> bricks</span>
      <span class="fact">📋 ${s.steps} steps</span><span class="fact">👶 ${s.ages}</span>
      <span class="fact">🏷️ <b>$${s.price.toFixed(2)}</b></span>${owned ? '<span class="fact">⭐ owned</span>' : ''}</div>`;
    sheet.appendChild(h);
    const btns = document.createElement('div'); btns.className = 'btns';
    const close = () => { App.$('ovBox').classList.remove('on'); A.put(); };
    const mk = (cls, label, fn) => { const b = document.createElement('button'); b.className = 'big ' + cls; b.textContent = label; b.onclick = fn; btns.appendChild(b); };
    mk('grey', '↩ Put back', close);
    mk('grey', '🔄 Turn over', () => { flip = !flip; A.page(); renderBox(); });
    sheet.appendChild(btns);
    const btns2 = document.createElement('div'); btns2.className = 'btns';
    const mk2 = (cls, label, fn) => { const b = document.createElement('button'); b.className = 'big ' + cls; b.textContent = label; b.onclick = fn; btns2.appendChild(b); };
    if (owned) {
      mk2('go', SAVE.inToybox(s.id) ? '🧱 Build it!' : '🧱 Build again', () => { close(); Build.open(s.id, SAVE.s.run && SAVE.s.run.id === s.id); });
    } else if (inCart) {
      mk2('grey', '🛒 In your cart', () => { const i = SAVE.s.cart.indexOf(s.id); SAVE.s.cart.splice(i, 1); SAVE.save(); A.put(); renderBox(); });
    } else if (can) {
      mk2('go', '🛒 Add to cart', () => { SAVE.s.cart.push(s.id); SAVE.save(); A.cart(); const it = shelf.find(q => q.s === s); if (it) it.hop = 16; close(); });
    } else {
      const on = SAVE.wishing(s.id);
      mk2(on ? 'grey' : '', on ? '💗 On your wish list' : '💗 Add to wish list', () => { SAVE.wish(s.id, !on); A.coin(); renderBox(); });
      const need = document.createElement('div');
      need.className = 'sub';
      need.style.cssText = 'text-align:center;margin-top:9px';
      need.textContent = `You have ${SAVE.text} — you need ${SAVE.money(cents(s) - SAVE.cents)} more. Build a set to earn some!`;
      sheet.appendChild(need);
    }
    sheet.appendChild(btns2);
  }

  /* ------------------------------------------------------------------ cart */
  function openCart() {
    const sheet = App.$('cartSheet');
    const ids = SAVE.s.cart, sets = ids.map(id => CATALOG.find(s => s.id === id)).filter(Boolean);
    const tot = sets.reduce((n, s) => n + cents(s), 0);
    sheet.innerHTML = `<h2>🛒 Your cart</h2><div class="sub">${sets.length ? 'Tap the ✕ to put one back.' : 'Your cart is empty. Go and find something!'}</div>`;
    sets.forEach((s, i) => {
      const row = document.createElement('div'); row.className = 'cartrow';
      const c = document.createElement('canvas'); c.width = 148; c.height = 108;
      c.getContext('2d').drawImage(Art.box(s, 74, 54), 0, 0, 148, 108);
      row.appendChild(c);
      const nm = document.createElement('div'); nm.className = 'nm';
      nm.innerHTML = `${s.name}<small>${s.n} bricks · ${s.steps} steps</small>`;
      row.appendChild(nm);
      const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = '$' + s.price.toFixed(2); row.appendChild(pr);
      const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕';
      x.onclick = () => { SAVE.s.cart.splice(i, 1); SAVE.save(); A.put(); openCart(); };
      row.appendChild(x);
      sheet.appendChild(row);
    });
    if (sets.length) {
      const t = document.createElement('div'); t.className = 'total';
      t.innerHTML = `Total <span>${SAVE.money(tot)}</span>`; sheet.appendChild(t);
    }
    const btns = document.createElement('div'); btns.className = 'btns';
    const back = document.createElement('button'); back.className = 'big grey'; back.textContent = '‹ Keep shopping';
    back.onclick = () => App.$('ovCart').classList.remove('on');
    btns.appendChild(back);
    if (sets.length) {
      const go = document.createElement('button'); go.className = 'big go';
      const enough = SAVE.cents >= tot;
      go.textContent = enough ? '💳 Check out' : 'Not enough 🐷';
      go.disabled = !enough;
      go.onclick = () => { App.$('ovCart').classList.remove('on'); Checkout.open(sets); };
      btns.appendChild(go);
    }
    sheet.appendChild(btns);
    App.$('ovCart').classList.add('on');
  }

  /* ------------------------------------------------------------------ screens */
  function openMap() {
    const bays = App.$('bays'); bays.innerHTML = '';
    for (const t of Object.keys(THEMES)) {
      const list = themeSets(t);
      if (!list.length) continue;
      const fresh = list.filter(s => SAVE.isNew(s.id)).length;
      const b = document.createElement('button'); b.className = 'bay';
      b.innerHTML = `<div class="strip" style="background:${THEMES[t].tint}"></div><span class="e">${THEMES[t].icon}</span>
        <div class="t">${t}</div><div class="c">${list.length} sets · from $${Math.min(...list.map(s => s.price)).toFixed(2)}</div>
        ${fresh ? `<div class="nu">${fresh} NEW</div>` : ''}`;
      b.onclick = () => { A.page(); openAisle(t); };
      bays.appendChild(b);
    }
    App.go('map');
  }
  function openAisle(t) {
    theme = t; scroll = 0; vel = 0;
    App.$('aisleName').textContent = THEMES[t].icon + '  ' + t;
    App.go('aisle'); App.fit(); layout();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; padDir = 0; }

  function wire() {
    const c = App.$('aisleC');
    let down = null;
    c.addEventListener('pointerdown', e => { down = { ...App.pt(e, c), s0: scroll, moved: false }; vel = 0; });
    c.addEventListener('pointermove', e => {
      if (!down) return;
      const p = App.pt(e, c), dx = p.x - down.x;
      if (Math.abs(dx) > 10) down.moved = true;
      if (down.moved) { const n = Math.max(0, Math.min(maxScroll, down.s0 - dx)); vel = (n - scroll) * 0.5; scroll = n; }
    });
    c.addEventListener('pointerup', e => {
      if (!down) return;
      const p = App.pt(e, c);
      if (!down.moved) {
        const cc = App.canvas('aisleC');
        for (const it of shelf) {
          const x = it.x - scroll, y = deckY(cc, it.deck) - it.h;
          if (p.x > x - 12 && p.x < x + it.w + 12 && p.y > y - 12 && p.y < y + it.h + 24) { it.hop = 13; openBox(it.s); break; }
        }
      }
      down = null;
    });
    c.addEventListener('pointercancel', () => { down = null; });
    const hold = (el, dir) => {
      const on = e => { e.preventDefault(); padDir = dir; };
      const off = () => { padDir = 0; };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
    };
    hold(App.$('padL'), -1); hold(App.$('padR'), 1);
    App.$('cartBtn').onclick = openCart;
    App.$('aisleBack').onclick = () => { stop(); openMap(); };
    App.$('mapBack').onclick = () => { App.go('home'); Home.render(); };
    App.$('ovBox').addEventListener('pointerdown', e => { if (e.target.id === 'ovBox') App.$('ovBox').classList.remove('on'); });
    App.$('ovCart').addEventListener('pointerdown', e => { if (e.target.id === 'ovCart') App.$('ovCart').classList.remove('on'); });
  }
  return { openMap, openAisle, openBox, openCart, wire, stop, layout, cents, onResize: () => { if (theme) layout(); } };
})();

/* ------------------------------------------------------------------ checkout */
const Checkout = (() => {
  let items = [], raf = 0, last = 0, t = 0, scanned = 0, total = 0, coins = [], phase = 'belt';
  /* a box has to reach the scanner in about a second — any slower and a child taps at
     nothing and decides the game is broken */
  const SPD = 0.0105;

  function open(sets) {
    items = sets.map((s, i) => ({ s, x: -0.18 - i * 0.26, done: false }));
    scanned = 0; total = 0; coins = []; phase = 'belt'; t = 0;
    App.go('checkout'); App.fit();
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
  }
  function scan(it) {
    if (it.done) return;
    it.done = true; scanned++;
    total += Store.cents(it.s);
    A.beep();
    if (scanned === items.length) setTimeout(pay, 700);
  }
  function pay() {
    phase = 'pay';
    SAVE.spend(total);
    for (const it of items) { SAVE.buy(it.s.id); }
    SAVE.s.cart = []; SAVE.save(true);
    App.money();
    for (let i = 0; i < 26; i++) coins.push({ x: 0.12, y: 0.2, vx: 0.5 + Math.random() * 0.7, vy: -0.4 - Math.random() * 0.6, r: Math.random() * 6 });
    A.coin(); setTimeout(() => A.cart(), 260);
    setTimeout(() => { phase = 'bag'; }, 1100);
  }
  function draw(now) {
    const dt = Math.min(50, now - last) / 16.67; last = now; t += dt;
    const c = App.canvas('coC'), ctx = c.ctx, W = c.w, H = c.h;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#eef1f6'); g.addColorStop(1, '#cdd4e0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const beltY = H * 0.62, beltH = 54;
    // register + scanner
    const rx = W * 0.72;
    ctx.fillStyle = '#39414f'; Art.roundRect(ctx, rx - 10, beltY - 148, W * 0.3, 128, 14); ctx.fill();
    ctx.fillStyle = '#7ef5b0'; Art.roundRect(ctx, rx + 2, beltY - 136, W * 0.3 - 34, 52, 8); ctx.fill();
    ctx.fillStyle = '#12351f'; ctx.font = Art.F(700, 23); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(SAVE.money(total), rx + W * 0.3 - 40, beltY - 110);
    ctx.fillStyle = '#e8112d'; ctx.font = Art.F(700, 12); ctx.textAlign = 'left';
    ctx.fillText('BRICK MART', rx + 4, beltY - 66);
    // scanner window
    const sx = W * 0.56;
    ctx.fillStyle = '#2b3140'; Art.roundRect(ctx, sx - 34, beltY - 34, 68, 34, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(232,17,45,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx - 26, beltY - 17 + Math.sin(t / 7) * 8); ctx.lineTo(sx + 26, beltY - 17 + Math.sin(t / 7) * 8); ctx.stroke();

    // belt
    ctx.fillStyle = '#4a5364'; ctx.fillRect(0, beltY, W, beltH);
    ctx.fillStyle = '#5c6679';
    for (let i = -1; i * 32 < W + 64; i++) ctx.fillRect(i * 32 - (t * 2.2) % 32, beltY, 17, beltH);
    ctx.fillStyle = '#39414f'; ctx.fillRect(0, beltY + beltH, W, 9);

    let allPast = true;
    for (const it of items) {
      if (!it.done) it.x += SPD * dt;
      else it.x += SPD * dt * 1.8;
      if (it.x < 1.35) allPast = false;
      const bx = it.x * W, by = beltY - 74;
      if (bx > -140 && bx < W + 140) {
        ctx.save();
        if (!it.done && Math.abs(bx - sx) < 60) { ctx.translate(0, Math.sin(t / 3) * 2); }
        ctx.drawImage(Art.box(it.s, 62, 78), bx - 31, by - 4, 62, 78);
        ctx.restore();
        if (!it.done && bx > sx - 130 && bx < sx + 40) {
          ctx.fillStyle = '#e8112d'; ctx.font = Art.F(700, 22); ctx.textAlign = 'center';
          ctx.fillText('👆', bx, by - 16 + Math.sin(t / 5) * 4);
        }
      }
      // it scans itself if nobody taps it, so nobody is ever stuck
      if (!it.done && bx > sx - 14 && bx < sx + 22) scan(it);
    }
    // cashier
    ctx.font = '46px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('🧑‍🦰', W * 0.88, beltY - 152 + Math.sin(t / 22) * 3);
    ctx.font = Art.F(600, 13); ctx.fillStyle = '#5a6376';
    ctx.fillText(phase === 'bag' ? 'Thank you!' : scanned ? 'Beep!' : 'Tap your boxes', W * 0.88, beltY - 148 + 22);

    for (const k of coins) {
      k.vy += 0.035 * dt; k.x += k.vx * dt * 0.012; k.y += k.vy * dt * 0.02; k.r += dt * 0.2;
      ctx.save(); ctx.translate(k.x * W, k.y * H); ctx.scale(Math.cos(k.r) * 0.6 + 0.6, 1);
      ctx.fillStyle = '#f5b820'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#1d2330'; ctx.font = Art.F(700, 19); ctx.textAlign = 'center';
    ctx.fillText(phase === 'bag' ? '🛍️ All bagged up!' : `${scanned}/${items.length} scanned`, W / 2, 40);
    if (phase === 'bag') {
      ctx.font = Art.F(600, 14); ctx.fillStyle = '#5a6376';
      ctx.fillText('Everything is in your toy box at home.', W / 2, 64);
      drawBtn(ctx, W, H);
    }
    raf = requestAnimationFrame(draw);
  }
  let btnRect = null;
  function drawBtn(ctx, W, H) {
    const w = Math.min(300, W - 48), h = 58, x = (W - w) / 2, y = H - h - 26;
    btnRect = { x, y, w, h };
    ctx.fillStyle = '#157a40'; Art.roundRect(ctx, x, y + 4, w, h, 18); ctx.fill();
    ctx.fillStyle = '#22a75b'; Art.roundRect(ctx, x, y, w, h, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = Art.F(700, 20); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🏠  Carry it home', x + w / 2, y + h / 2);
  }
  function wire() {
    const c = App.$('coC');
    c.addEventListener('pointerdown', e => {
      const p = App.pt(e, c), W = App.canvas('coC').w;
      if (phase === 'bag' && btnRect && p.x > btnRect.x && p.x < btnRect.x + btnRect.w && p.y > btnRect.y && p.y < btnRect.y + btnRect.h) {
        cancelAnimationFrame(raf); raf = 0;
        const next = items[0] && items[0].s.id;
        A.open();
        if (next) Build.open(next, false); else { App.go('home'); Home.render(); }
        return;
      }
      for (const it of items) {
        const bx = it.x * W;
        if (!it.done && Math.abs(p.x - bx) < 46) { scan(it); break; }
      }
    });
  }
  return { open, wire, stop() { cancelAnimationFrame(raf); raf = 0; } };
})();
