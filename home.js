/* The bedroom: what you still have to build, what you have built, what you are saving for. */
const Home = (() => {
  const PIGGY = 1000;                       // the daily top-up, in cents
  const cheapest = () => Math.min(...CATALOG.map(s => Math.round(s.price * 100)));

  function tile(s, tag, onTap) {
    const el = document.createElement('button');
    el.className = 'tile';
    const c = document.createElement('canvas');
    const r = Math.min(2, window.devicePixelRatio || 1);
    c.width = 90 * r; c.height = 66 * r;
    c.getContext('2d').drawImage(Art.thumb(s, 90, 66, '#fff'), 0, 0, 90 * r, 66 * r);
    el.appendChild(c);
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name; el.appendChild(nm);
    if (tag) { const t = document.createElement('div'); t.className = 'tag'; t.textContent = tag; el.appendChild(t); }
    el.onclick = onTap;
    return el;
  }
  function fillRow(rowId, panelId, sets, mk, emptyMsg) {
    const row = App.$(rowId), panel = App.$(panelId);
    row.innerHTML = '';
    panel.querySelector('.n').textContent = sets.length;
    if (!sets.length) {
      const e = document.createElement('div'); e.className = 'empty'; e.textContent = emptyMsg;
      row.appendChild(e); return;
    }
    for (const s of sets) row.appendChild(mk(s));
  }
  function render() {
    App.money();
    const get = id => CATALOG.find(s => s.id === id);
    const run = SAVE.s.run;
    // to build
    const toy = SAVE.s.toybox.map(get).filter(Boolean);
    fillRow('toyRow', 'pToy', toy, s => tile(s, run && run.id === s.id ? '⏳' : '', () => {
      A.open(); Build.open(s.id, !!(run && run.id === s.id));
    }), 'Nothing waiting. Go to Brick Mart and buy something!');
    // built
    const shelfIds = Object.keys(SAVE.s.owned).filter(id => SAVE.s.owned[id].built);
    const shelf = shelfIds.map(get).filter(Boolean);
    fillRow('shelfRow', 'pShelf', shelf, s => tile(s, '⭐', () => { A.pop(); Play.open(s.id); }),
      'Your shelf is empty. Build a set and it will stand here.');
    // wish list
    const wish = SAVE.s.wish.map(get).filter(Boolean);
    fillRow('wishRow', 'pWish', wish, s => {
      const cents = Math.round(s.price * 100);
      const el = tile(s, SAVE.afford(cents) ? '✅' : '', () => { A.pick(); Store.openAisle(s.theme); });
      const m = document.createElement('div'); m.className = 'meter';
      const i = document.createElement('i'); i.style.width = Math.min(100, SAVE.cents / cents * 100) + '%';
      m.appendChild(i); el.appendChild(m);
      return el;
    }, 'Tap the 💗 on a set you cannot afford yet and it will wait for you here.');
    renderPiggy();
  }
  function renderPiggy() {
    const el = App.$('piggy'), ready = SAVE.piggyReady(cheapest());
    el.className = ready ? '' : 'spent';
    el.innerHTML = `<div class="e">${ready ? '🐷' : '🪙'}</div>
      <div class="tx"><b>${SAVE.text}</b>${ready ? 'Pocket money is ready!' : 'Build a set to earn more.'}</div>`;
    if (ready) {
      const b = document.createElement('button');
      b.textContent = '+' + SAVE.money(PIGGY);
      b.onclick = () => {
        SAVE.piggyTake(PIGGY);
        A.coin(); setTimeout(() => A.cart(), 140);
        App.toast('Pocket money! ' + SAVE.text);
        render();
      };
      el.appendChild(b);
    }
  }
  /* ---- sticker book ---- */
  function renderBook() {
    const grid = App.$('bookGrid'); grid.innerHTML = '';
    for (const s of CATALOG) {
      const o = SAVE.s.owned[s.id], built = o && o.built;
      const el = document.createElement('button');
      el.className = 'sticker' + (built ? '' : ' locked');
      const c = document.createElement('canvas');
      const r = Math.min(2, window.devicePixelRatio || 1), w = 120, h = 90;
      c.width = w * r; c.height = h * r;
      c.getContext('2d').drawImage(Art.thumb(s, w, h, '#fff'), 0, 0, w * r, h * r);
      el.appendChild(c);
      const nm = document.createElement('div'); nm.className = 'nm';
      nm.textContent = built || SAVE.owns(s.id) || !SAVE.isNew(s.id) ? s.name : '???';
      el.appendChild(nm);
      const st = document.createElement('div'); st.className = 'st';
      st.textContent = built ? '⭐' : SAVE.owns(s.id) ? '📦' : '';
      el.appendChild(st);
      el.onclick = () => {
        A.pick();
        App.toast(built ? `${s.name} — built ${o.built}×, best ${(o.bestMs / 1000).toFixed(0)}s`
          : SAVE.owns(s.id) ? `${s.name} is in your toy box` : `${s.name} — $${s.price.toFixed(2)} in the ${s.theme} aisle`);
      };
      grid.appendChild(el);
    }
  }
  function wire() {
    App.$('door').onclick = () => { A.open(); Store.openMap(); };
    App.$('toBook').onclick = () => { A.page(); renderBook(); App.go('book'); };
    App.$('bookBack').onclick = () => { App.go('home'); render(); };
    App.$('mute').onclick = () => {
      SAVE.s.mute = !SAVE.s.mute; SAVE.save(true);
      A.muted = SAVE.s.mute;
      App.$('mute').textContent = SAVE.s.mute ? '🔇' : '🔊';
      if (!SAVE.s.mute) A.pop();
    };
  }
  return { render, renderBook, renderPiggy, wire, PIGGY };
})();
