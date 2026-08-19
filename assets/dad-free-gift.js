/* Do-A-Dot free gift auto-add.
 *
 * Keeps the cart's free-gift lines in sync with their thresholds:
 *  - subtotal (excluding every gift) >= tier threshold -> add that tier's gift
 *  - subtotal falls back below a threshold             -> remove that gift
 *  - a gift quantity edited by the customer            -> clamp back to 1
 *
 * Supports multiple tiers. Each tier's line is tagged with its own property
 * (`_dad_free_gift`, `_dad_free_gift_2`, ...) so tiers unlock and lapse
 * independently; the underscore prefix hides them in Dawn's cart templates.
 * The first tier keeps the original `_dad_free_gift` key so carts created
 * before the second tier existed still resolve.
 *
 * Pricing enforcement lives in the automatic Buy X Get Y discount in Shopify
 * admin, one per tier — this script only manages the line item, so if it ever
 * fails the customer just doesn't get the gift auto-added; they are never
 * mischarged.
 *
 * Config comes from window.dadFreeGift, set in layout/theme.liquid from theme
 * settings (Cart group).
 */
(function () {
  const cfg = window.dadFreeGift;
  if (!cfg) return;

  // Accept the pre-multi-tier config shape as a single tier.
  const rawTiers = Array.isArray(cfg.tiers)
    ? cfg.tiers
    : [{ prop: '_dad_free_gift', variantId: cfg.variantId, thresholdCents: cfg.thresholdCents }];

  const TIERS = rawTiers.filter((t) => t && t.variantId && t.thresholdCents > 0);
  if (!TIERS.length) return;

  const GIFT_PREFIX = '_dad_free_gift';
  const SECTIONS = ['cart-drawer', 'cart-icon-bubble'];

  let busy = false;
  let pending = false;

  function isGiftLine(item) {
    const props = item.properties;
    if (!props) return false;
    return Object.keys(props).some((k) => k.indexOf(GIFT_PREFIX) === 0 && props[k]);
  }

  function linesFor(cart, prop) {
    return cart.items.filter((i) => i.properties && i.properties[prop]);
  }

  function renderSections(sections) {
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

  async function post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ sections: SECTIONS.join(',') }, body)),
    });
    if (!res.ok) return null;
    return (await res.json()).sections;
  }

  /* One reconciliation step: fix at most one line, so each mutation works from
   * a freshly read cart instead of a stale snapshot. Returns the response
   * sections when it acted, or false when the cart already matches. */
  async function step() {
    const cart = await (await fetch('/cart.js')).json();
    const giftTotal = cart.items.reduce((s, i) => (isGiftLine(i) ? s + i.final_line_price : s), 0);
    const subtotal = cart.total_price - giftTotal;

    for (const tier of TIERS) {
      const lines = linesFor(cart, tier.prop);
      const qualifies = subtotal >= tier.thresholdCents;

      if (qualifies && lines.length === 0) {
        return post('/cart/add.js', {
          items: [
            {
              id: Number(tier.variantId),
              quantity: 1,
              properties: { [tier.prop]: 'true' },
            },
          ],
        });
      }
      if (!qualifies && lines.length > 0) {
        return post('/cart/change.js', { id: lines[0].key, quantity: 0 });
      }
      if (qualifies && lines.length > 1) {
        return post('/cart/change.js', { id: lines[1].key, quantity: 0 });
      }
      if (qualifies && lines.length === 1 && lines[0].quantity !== 1) {
        return post('/cart/change.js', { id: lines[0].key, quantity: 1 });
      }
    }
    return false;
  }

  async function sync() {
    if (busy) {
      pending = true;
      return;
    }
    busy = true;
    let sections = null;
    let acted = false;
    try {
      // Each tier needs at most an add plus a clamp; the cap is a runaway guard.
      const maxSteps = TIERS.length * 2 + 2;
      for (let i = 0; i < maxSteps; i += 1) {
        const result = await step();
        if (!result) break;
        acted = true;
        sections = result;
      }
    } catch (e) {
      /* network hiccup — next cart update retries */
    } finally {
      busy = false;
    }

    if (acted) {
      // The cart page's section IDs are template-scoped, so section swapping
      // only covers the drawer + header bubble; on /cart, reload instead.
      if (document.getElementById('main-cart-items')) {
        window.location.reload();
        return;
      }
      renderSections(sections);
    }

    if (pending) {
      pending = false;
      sync();
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
