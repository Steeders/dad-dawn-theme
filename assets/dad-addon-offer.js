/*
  dad-addon-offer: the PDP "Add-on offer" block (snippets/dad-addon-offer.liquid).

  Variant changes: on Dawn's variantChange the block refills itself from the
  section HTML Dawn already fetched (same pattern as dad-variant-gallery).
  When Dawn swaps the whole product-info instead, the block is re-created
  from server HTML. Either way the shopper's own tick/untick is kept.

  Add to cart, box checked: a capture-phase submit listener runs before
  product-form.js, adds the add-on variant (qty 1, normal price, its own line)
  through /cart/add.js, then re-submits the form so product-form.js adds the
  main item exactly as it does today. Because the add-on is already in the
  cart, the drawer and the cart count Dawn renders from that response show
  both lines in one paint, and dad-free-gift sees the full subtotal.
  - add-on add fails      -> ignored; the main item is still added, no error.
  - main add fails        -> the add-on line we just added is taken back out.
  Box unchecked (or no add-on) -> the listener does nothing.
*/
(function () {
  if (window.dadAddonOffer) return;
  window.dadAddonOffer = true;

  const choices = {}; // sectionId -> the shopper's last tick state
  let pending = null; // add-on line added for the submit in flight
  let inFlight = false;

  if (!customElements.get('dad-addon-offer')) {
    customElements.define(
      'dad-addon-offer',
      class DadAddonOffer extends HTMLElement {
        connectedCallback() {
          this.section = this.dataset.section;
          if (!this.bound) {
            this.bound = true;
            this.addEventListener('change', (event) => {
              if (event.target.classList.contains('dad-addon-offer__check')) {
                choices[this.section] = event.target.checked;
              }
            });
          }
          if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
            this.unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, this.onVariantChange.bind(this));
          }
          this.restore();
        }

        disconnectedCallback() {
          if (this.unsubscribe) this.unsubscribe();
        }

        get checkbox() {
          return this.querySelector('.dad-addon-offer__check');
        }

        restore() {
          const box = this.checkbox;
          if (box && Object.prototype.hasOwnProperty.call(choices, this.section)) {
            box.checked = choices[this.section];
          }
        }

        onVariantChange(event) {
          const data = event && event.data;
          if (!data || data.sectionId !== this.section || !data.html) return;
          const fresh = data.html.getElementById(this.id);
          if (!fresh) return;
          this.innerHTML = fresh.innerHTML;
          this.restore();
        }
      }
    );
  }

  function url(route, fallback) {
    const base = (window.routes && window.routes[route]) || fallback;
    return `${base}.js`;
  }

  function setLoading(productForm, on) {
    const button = productForm.submitButton || productForm.querySelector('[type="submit"]');
    const spinner = productForm.querySelector('.loading__spinner');
    if (button) button.classList.toggle('loading', on);
    if (spinner) spinner.classList.toggle('hidden', !on);
  }

  async function addAddon(variantId) {
    const response = await fetch(url('cart_add_url', '/cart/add'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity: 1 }] }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const line = json && json.items && json.items[0];
    return line ? { key: line.key, quantity: line.quantity } : null;
  }

  document.addEventListener(
    'submit',
    async (event) => {
      const form = event.target;
      // getAttribute, not form.id: Dawn's product form holds an <input name="id">,
      // which shadows the form's .id property.
      const formId = form instanceof HTMLFormElement ? form.getAttribute('id') : null;
      if (!formId) return;

      if (form.dataset.dadAddonPass === '1') {
        delete form.dataset.dadAddonPass;
        return;
      }

      const productForm = form.closest('product-form');
      const offer = productForm && document.querySelector(`dad-addon-offer[data-form-id="${CSS.escape(formId)}"]`);
      const box = offer && offer.checkbox;
      if (!box || !box.checked || !box.dataset.addonVariantId) return;

      const button = productForm.submitButton || productForm.querySelector('[type="submit"]');
      if (button && (button.disabled || button.getAttribute('aria-disabled') === 'true')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (inFlight) return;
      inFlight = true;
      setLoading(productForm, true);

      pending = null;
      try {
        const line = await addAddon(box.dataset.addonVariantId);
        if (line) pending = Object.assign({ at: Date.now() }, line);
      } catch (e) {
        // The add-on is optional: never block or fail the main add over it.
      }

      inFlight = false;
      form.dataset.dadAddonPass = '1';
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    },
    true
  );

  function start() {
    if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;

    subscribe(PUB_SUB_EVENTS.cartUpdate, (data) => {
      if (data && data.source === 'product-form') pending = null;
    });

    // Main item rejected (sold out, quantity rule): take back the add-on line
    // we added a moment ago, so the cart never holds the add-on alone.
    subscribe(PUB_SUB_EVENTS.cartError, (data) => {
      if (!pending || !data || data.source !== 'product-form') return;
      const line = pending;
      pending = null;
      if (Date.now() - line.at > 60000) return;
      fetch(url('cart_change_url', '/cart/change'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: line.key, quantity: Math.max(0, line.quantity - 1) }),
      }).catch(() => {});
    });
  }

  if (typeof subscribe === 'function') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
