/*
 * Cart upsell (snippets/dad-cart-upsell.liquid mounts it, sections/dad-cart-upsell.liquid
 * supplies the candidates). Picks which products to show:
 *  1. if the cart is short of free shipping, the cheapest item that closes the gap
 *  2. a small add-on (under $15), curated picks first
 *  3. a bundle, curated (smaller) bundles first
 *  then fills any open slot in the section's order (related, add-ons, best sellers).
 * Add puts one unit in the cart and refreshes the drawer, or the cart page sections.
 */
(() => {
  if (customElements.get('dad-cart-upsell')) return;

  const SMALL_ADDON_CENTS = 1500;

  const current = (item) =>
    item.querySelector('.dad-upsell__select')?.selectedOptions[0] || item.querySelector('.dad-upsell__variant');

  const showPrice = (item) => {
    const v = current(item);
    if (!v) return;
    item.querySelector('.dad-upsell__now').textContent = v.dataset.priceText;
    const compare = item.querySelector('.dad-upsell__compare');
    compare.textContent = v.dataset.compareText || '';
    compare.hidden = !v.dataset.compareText;
  };

  const priceOf = (item) => parseInt(current(item)?.dataset.price || '0', 10);

  class DadCartUpsell extends HTMLElement {
    connectedCallback() {
      this.load();
      if (this.dataset.context === 'page' && typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        this.unsub = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
          if (event?.source !== 'dad-upsell') this.refreshAnchor();
        });
      }
    }

    disconnectedCallback() {
      if (this.unsub) this.unsub();
    }

    async refreshAnchor() {
      try {
        const cart = await (await fetch(`${window.routes.cart_url}.js`)).json();
        const lines = cart.items.filter((i) => !Object.keys(i.properties || {}).some((k) => k.startsWith('_dad_free_gift')));
        if (!lines.length) {
          this.hidden = true;
          return;
        }
        lines.sort((a, b) => b.original_price - a.original_price);
        this.dataset.productId = lines[0].product_id;
        this.load();
      } catch (e) {
        /* keep what is shown */
      }
    }

    async load() {
      const id = this.dataset.productId;
      if (!id) return;
      let doc;
      try {
        const url = `${this.dataset.url}?product_id=${id}&limit=10&intent=related&section_id=dad-cart-upsell`;
        const res = await fetch(url);
        if (!res.ok) return;
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      } catch (e) {
        return;
      }
      const data = doc.querySelector('.dad-upsell__data');
      if (!data) return;
      const pool = [...data.querySelectorAll('.dad-upsell__item')];
      const picks = this.choose(pool, parseInt(data.dataset.gap || '0', 10), parseInt(this.dataset.count || '3', 10));
      if (!picks.length) {
        this.hidden = true;
        return;
      }

      const gap = parseInt(data.dataset.gap || '0', 10);
      const heading =
        gap > 0 && data.dataset.shipHeading
          ? data.dataset.shipHeading.replace('[amount]', data.dataset.gapText)
          : data.dataset.heading;

      this.innerHTML = '';
      const h = document.createElement('p');
      h.className = 'dad-upsell__heading';
      h.textContent = heading;
      const list = document.createElement('ul');
      list.className = 'dad-upsell__list list-unstyled';
      list.setAttribute('role', 'list');
      picks.forEach((item) => {
        const li = document.createElement('li');
        li.appendChild(item);
        list.appendChild(li);
        showPrice(item);
        item.querySelector('.dad-upsell__select')?.addEventListener('change', () => showPrice(item));
        item.querySelector('.dad-upsell__add').addEventListener('click', (e) => this.add(item, e.currentTarget));
      });
      this.append(h, list);
      this.hidden = false;
    }

    choose(pool, gap, count) {
      const chosen = [];
      const take = (item) => item && !chosen.includes(item) && chosen.length < count && chosen.push(item);

      if (gap > 0) {
        const closers = pool.filter((i) => priceOf(i) >= gap).sort((a, b) => priceOf(a) - priceOf(b));
        take(closers[0]);
      }
      // Curated picks (theme settings) win these two slots over related products.
      const small = (i) => !chosen.includes(i) && priceOf(i) > 0 && priceOf(i) <= SMALL_ADDON_CENTS;
      const bundle = (i) => !chosen.includes(i) && i.dataset.type === 'Bundles';
      const curated = (i) => i.dataset.source === 'pick';
      take(pool.find((i) => small(i) && curated(i)) || pool.find(small));
      take(pool.find((i) => bundle(i) && curated(i)) || pool.find(bundle));
      pool.forEach(take);
      return chosen;
    }

    async add(item, button) {
      const variant = current(item);
      if (!variant) return;
      button.disabled = true;
      button.classList.add('loading');
      const drawer = this.dataset.context === 'drawer' ? document.querySelector('cart-drawer') : null;
      const body = { items: [{ id: parseInt(variant.value, 10), quantity: 1 }] };
      if (drawer) {
        body.sections = drawer.getSectionsToRender().map((s) => s.id);
        body.sections_url = window.location.pathname;
      }
      try {
        const res = await fetch(`${window.routes.cart_add_url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || json.status) throw new Error(json.description || 'add failed');
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'dad-upsell', productVariantId: variant.value, cartData: json });
        }
        if (drawer) {
          drawer.renderContents(json);
        } else {
          window.location.reload();
        }
      } catch (e) {
        button.disabled = false;
        button.classList.remove('loading');
        window.location.href = item.querySelector('.dad-upsell__title').href;
      }
    }
  }

  customElements.define('dad-cart-upsell', DadCartUpsell);
})();
