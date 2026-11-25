/* Do-A-Dot door-buster weekend: click to claim a free Art and Activity Book.
 * Markup: snippets/dad-doorbuster.liquid (mode 'claim'). Config: window.dadDoorbuster from layout/theme.liquid.
 *
 * - Add button: adds the picked $0 variant with property _dad_free_gift_db, then re-renders the drawer
 *   (or reloads /cart).
 * - Keeps the cart honest on every cart update: one book, quantity 1, only while the cart has a paid item,
 *   and none at all once the door-buster is off (dates passed or close-out switch set).
 */
(function () {
  const cfg = window.dadDoorbuster;
  if (!cfg) return;
  const PROP = cfg.prop || '_dad_free_gift_db';
  const SECTIONS = ['cart-drawer', 'cart-icon-bubble'];
  let busy = false;

  function isDb(item) { return item.properties && item.properties[PROP]; }
  function isAnyGift(item) {
    return item.properties && Object.keys(item.properties).some((k) => k.indexOf('_dad_free_gift') === 0 && item.properties[k]);
  }

  function renderSections(sections) {
    if (document.getElementById('main-cart-items')) { window.location.reload(); return; }
    if (!sections) return;
    [{ id: 'cart-drawer', sel: '#CartDrawer' }, { id: 'cart-icon-bubble', sel: '#cart-icon-bubble' }].forEach(({ id, sel }) => {
      const el = document.querySelector(sel);
      if (!el || !sections[id]) return;
      const doc = new DOMParser().parseFromString(sections[id], 'text/html');
      const fresh = doc.querySelector(sel) || doc.querySelector('.shopify-section');
      if (fresh) el.innerHTML = fresh.innerHTML;
    });
    const drawer = document.querySelector('cart-drawer');
    if (drawer && drawer.classList.contains('is-empty')) {
      const hasItems = document.querySelector('#CartDrawer .cart-item');
      if (hasItems) drawer.classList.remove('is-empty');
    }
  }

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.assign({ sections: SECTIONS.join(',') }, body)),
    });
    if (!res.ok) return null;
    return (await res.json()).sections || {};
  }

  /* Fix at most one thing per pass, re-reading the cart each time. */
  async function step() {
    const cart = await (await fetch('/cart.js')).json();
    const db = cart.items.filter(isDb);
    const paid = cart.items.filter((i) => !isAnyGift(i)).reduce((s, i) => s + i.final_line_price, 0);
    if (db.length && (!cfg.on || paid <= 0)) return post('/cart/change.js', { id: db[0].key, quantity: 0 });
    if (db.length > 1) return post('/cart/change.js', { id: db[1].key, quantity: 0 });
    if (db.length === 1 && db[0].quantity !== 1) return post('/cart/change.js', { id: db[0].key, quantity: 1 });
    return false;
  }

  async function sync() {
    if (busy) return;
    busy = true;
    let sections = false;
    try {
      for (let i = 0; i < 4; i++) {
        const r = await step();
        if (!r) break;
        sections = r;
      }
    } catch (e) { /* retry on the next cart update */ }
    busy = false;
    if (sections) renderSections(sections);
  }

  if (cfg.on) {
    document.addEventListener('change', (e) => {
      const sel = e.target.closest && e.target.closest('[data-dad-db-select]');
      if (!sel) return;
      e.stopPropagation();
      const card = sel.closest('[data-dad-db-claim]');
      card.querySelectorAll('[data-dad-db-img]').forEach((img) => { img.hidden = img.dataset.dadDbImg !== sel.value; });
    }, true);

    document.addEventListener('click', async (e) => {
      const btn = e.target.closest && e.target.closest('[data-dad-db-add]');
      if (!btn) return;
      e.preventDefault();
      const card = btn.closest('[data-dad-db-claim]');
      const sel = card.querySelector('[data-dad-db-select]');
      btn.disabled = true;
      btn.textContent = 'Adding...';
      try {
        const sections = await post('/cart/add.js', { items: [{ id: Number(sel.value), quantity: 1, properties: { [PROP]: 'Door-buster' } }] });
        if (sections === null) throw new Error('add failed');
        renderSections(sections);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Try again';
      }
    });
  }

  if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined' && PUB_SUB_EVENTS.cartUpdate) {
    subscribe(PUB_SUB_EVENTS.cartUpdate, () => sync());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
