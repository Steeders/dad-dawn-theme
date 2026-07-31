/* Do-A-Dot free gift auto-add.
 *
 * Keeps the cart's free-gift line in sync with the gift threshold:
 *  - subtotal (excluding the gift) >= threshold  -> add the gift variant
 *  - subtotal falls back below the threshold     -> remove it
 *  - gift quantity edited by the customer        -> clamp back to 1
 *
 * The gift line is tagged with the _dad_free_gift property (underscore
 * prefix = hidden in Dawn's cart templates). Pricing enforcement lives in
 * the automatic Buy X Get Y discount in Shopify admin — this script only
 * manages the line item, so if it ever fails the customer just doesn't
 * get the gift auto-added; they are never mischarged.
 *
 * Config comes from window.dadFreeGift, set in layout/theme.liquid from
 * theme settings (Cart group).
 */
(function () {
  const cfg = window.dadFreeGift;
  if (!cfg || !cfg.variantId || !cfg.thresholdCents) return;

  let busy = false;
  let pending = false;

  const GIFT_PROP = '_dad_free_gift';
  const SECTIONS = ['cart-drawer', 'cart-icon-bubble'];

  function renderSections(sections) {
    // The cart page's section IDs are template-scoped, so section swapping
    // only covers the drawer + header bubble; on /cart, reload instead.
    if (document.getElementById('main-cart-items')) {
      window.location.reload();
      return;
    }
    if (!sections) return;
    const targets = [
      { id: 'cart-drawer', selector: '#CartDrawer' },
      { id: 'cart-icon-bubble', selector: '#cart-icon-bubble' },
    ];
    targets.forEach(({ id, selector }) => {
      const el = document.querySelector(selector);
      if (!el || !sections[id]) return;
      const doc = new DOMParser().parseFromString(sections[id], 'text/html');
      const fresh = doc.querySelector(selector) || doc.querySelector('.shopify-section');
      if (fresh) el.innerHTML = fresh.innerHTML;
    });
  }

  async function sync() {
    if (busy) {
      pending = true;
      return;
    }
    busy = true;
    try {
      const cart = await (await fetch('/cart.js')).json();
      const giftLines = cart.items.filter(
        (i) => i.properties && i.properties[GIFT_PROP] === 'true'
      );
      const giftTotal = giftLines.reduce((s, i) => s + i.final_line_price, 0);
      const subtotal = cart.total_price - giftTotal;
      const qualifies = subtotal >= cfg.thresholdCents;

      if (qualifies && giftLines.length === 0) {
        const res = await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ id: Number(cfg.variantId), quantity: 1, properties: { [GIFT_PROP]: 'true' } }],
            sections: SECTIONS.join(','),
          }),
        });
        if (res.ok) renderSections((await res.json()).sections);
      } else if (!qualifies && giftLines.length > 0) {
        const res = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: giftLines[0].key, quantity: 0, sections: SECTIONS.join(',') }),
        });
        if (res.ok) renderSections((await res.json()).sections);
      } else if (qualifies && giftLines.length > 0 && giftLines[0].quantity !== 1) {
        const res = await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: giftLines[0].key, quantity: 1, sections: SECTIONS.join(',') }),
        });
        if (res.ok) renderSections((await res.json()).sections);
      }
    } catch (e) {
      /* network hiccup — next cart update retries */
    } finally {
      busy = false;
      if (pending) {
        pending = false;
        sync();
      }
    }
  }

  if (window.subscribe && window.PUB_SUB_EVENTS && PUB_SUB_EVENTS.cartUpdate) {
    subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event && event.source === 'dad-free-gift') return;
      sync();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync);
  } else {
    sync();
  }
})();
