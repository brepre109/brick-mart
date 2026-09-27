/* One localStorage key holds the whole game. Money is kept in whole cents; floats
   drift and a child's coin purse showing $14.989999 is not acceptable. */
const SAVE = (() => {
  const KEY = 'brickmart.v1';
  const fresh = () => ({
    v: 1,
    cents: 2500,          // pocket money
    owned: {},            // id -> { built, bestMs }
    toybox: [],           // bought, not built yet
    wish: [],
    cart: [],
    run: null,            // { id, placed: [partIndex...], turn, startedAt }
    seen: [],             // ids the player has laid eyes on in the aisle
    diorama: [],          // ids standing on the play floor
    lastPiggy: '',        // YYYY-MM-DD
    mute: false,
    starter: false,       // has the cold-open free build happened
  });
  let s = fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = Object.assign(fresh(), JSON.parse(raw));
  } catch (e) { /* private mode, first run, corrupt — a fresh save is the right answer */ }

  let pending = 0;
  function flush() {
    pending = 0;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  /* autosave after every brick would hit storage 200 times a build; coalesce. */
  function save(now) {
    if (now) { if (pending) clearTimeout(pending); return flush(); }
    if (!pending) pending = setTimeout(flush, 400);
  }
  const money = c => '$' + (c / 100).toFixed(2);

  const API = {
    get s() { return s; },
    save, money,
    get cents() { return s.cents; },
    get text() { return money(s.cents); },
    afford: cents => s.cents >= cents,
    spend(cents) { if (s.cents < cents) return false; s.cents -= cents; save(); return true; },
    earn(cents) { s.cents += cents; save(); return s.cents; },
    owns: id => !!s.owned[id],
    built: id => !!(s.owned[id] && s.owned[id].built),
    inToybox: id => s.toybox.includes(id),
    /* a bought set lands in the toy box; owning it is forever */
    buy(id) {
      if (!s.owned[id]) s.owned[id] = { built: 0, bestMs: 0 };
      if (!s.toybox.includes(id)) s.toybox.push(id);
      save();
    },
    finish(id, ms) {
      const o = s.owned[id] || (s.owned[id] = { built: 0, bestMs: 0 });
      const first = !o.built;
      o.built++;
      if (!o.bestMs || ms < o.bestMs) o.bestMs = ms;
      const i = s.toybox.indexOf(id);
      if (i >= 0) s.toybox.splice(i, 1);
      if (!s.diorama.includes(id) && s.diorama.length < 6) s.diorama.push(id);
      s.run = null;
      save(true);
      return first;
    },
    wish(id, on) {
      const i = s.wish.indexOf(id);
      if (on && i < 0) s.wish.push(id);
      if (!on && i >= 0) s.wish.splice(i, 1);
      save();
    },
    wishing: id => s.wish.includes(id),
    see(id) { if (!s.seen.includes(id)) { s.seen.push(id); save(); } },
    isNew: id => !s.seen.includes(id),
    /* --- the piggy bank ---
       Normally once a calendar day. But if the purse cannot reach the cheapest set on the
       shelf and there is nothing left to build, waiting for tomorrow is a dead end, so it
       unlocks straight away. */
    piggyReady(cheapest) {
      const today = new Date().toISOString().slice(0, 10);
      if (s.lastPiggy !== today) return true;
      return s.cents < cheapest && !s.toybox.length;
    },
    piggyTake(cents) {
      s.lastPiggy = new Date().toISOString().slice(0, 10);
      s.cents += cents;
      save(true);
      return s.cents;
    },
    reset() { s = fresh(); save(true); },
  };
  return API;
})();
if (typeof module !== 'undefined') module.exports = SAVE;
