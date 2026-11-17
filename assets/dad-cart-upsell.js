/*
 * Cart upsell carousel (design: https://claude.ai/artifact/CjG4vjWA7MVDn55RydFEFD).
 * snippets/dad-cart-upsell.liquid mounts it; sections/dad-cart-upsell.liquid supplies the
 * candidate cards. Order:
 *  1. if the cart is short of free shipping, the cheapest item that closes the gap
 *     (tagged "Gets you free shipping")
 *  2. a small add-on (under $15), curated picks first
 *  3. a bundle, curated (smaller) bundles first
 *  then the rest in the section's order (related, add-ons, best sellers).
 * A one-style product adds straight from the + button; one with sets/styles opens a
 * picker sheet. Adding refreshes the drawer, or reloads the cart page.
 */
(() => {
  if (customElements.get('dad-cart-upsell')) return;

  const SMALL_ADDON_CENTS = 1500;
  const TILES = ['#e9f6fd', '#fff3c2', '#fde6f0', '#eaf6e4'];

  const variantsOf = (card) => {
    try {
      return JSON.parse(card.querySelector('.dad-upsell__variants').textContent);
    } catch (e) {
      return [];
    }
  };
  const defaultOf = (vs) => vs.find((v) => v.selected) || vs[0];
  const priceOf = (card) => defaultOf(card._variants)?.price || 0;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

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
      this.closeSheet();
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
        const res = await fetch(`${this.dataset.url}?product_id=${id}&limit=10&intent=related&section_id=dad-cart-upsell`);
        if (!res.ok) return;
        doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      } catch (e) {
        return;
      }
      const data = doc.querySelector('.dad-upsell__data');
      if (!data) return;
      const pool = [...data.querySelectorAll('.dad-upsell__card')];
      pool.forEach((c) => (c._variants = variantsOf(c)));
      const gap = parseInt(data.dataset.gap || '0', 10);
      const picks = this.choose(pool.filter((c) => c._variants.length), gap, parseInt(this.dataset.count || '6', 10));
      if (!picks.length) {
        this.hidden = true;
        return;
      }
      this.render(picks, data, gap);
    }

    choose(pool, gap, count) {
      const chosen = [];
      const take = (item) => item && !chosen.includes(item) && chosen.length < count && chosen.push(item);
      const small = (i) => !chosen.includes(i) && priceOf(i) > 0 && priceOf(i) <= SMALL_ADDON_CENTS;
      const bundle = (i) => !chosen.includes(i) && i.dataset.type === 'Bundles';
      const curated = (i) => i.hasAttribute('data-curated');

      this.closer = null;
      if (gap > 0) {
        const closers = pool.filter((i) => priceOf(i) >= gap).sort((a, b) => priceOf(a) - priceOf(b));
        if (closers[0]) {
          this.closer = closers[0];
          take(closers[0]);
        }
      }
      take(pool.find((i) => small(i) && curated(i)) || pool.find(small));
      take(pool.find((i) => bundle(i) && curated(i)) || pool.find(bundle));
      pool.forEach(take);
      return chosen;
    }

    render(picks, data, gap) {
      this.innerHTML = '';

      const head = el('div', 'dad-upsell__head');
      const words = el('div', 'dad-upsell__words');
      const h = el('h3', 'dad-upsell__heading');
      h.id = `dad-upsell-h-${this.dataset.context}`;
      if (gap > 0 && data.dataset.shipHeading.includes('[amount]')) {
        const [before, after] = data.dataset.shipHeading.split('[amount]');
        h.append(before, el('span', 'dad-upsell__amount', data.dataset.gapText), after);
      } else {
        h.textContent = data.dataset.heading;
      }
      words.append(h, el('p', 'dad-upsell__sub', data.dataset.sub));
      const nav = el('div', 'dad-upsell__nav');
      const prev = el('button', 'dad-upsell__arrow');
      prev.type = 'button';
      prev.setAttribute('aria-label', 'Previous products');
      prev.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2L4 7l5 5"/></svg>';
      const next = el('button', 'dad-upsell__arrow');
      next.type = 'button';
      next.setAttribute('aria-label', 'More products');
      next.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2l5 5-5 5"/></svg>';
      nav.append(prev, next);
      head.append(words, nav);

      const track = el('ul', 'dad-upsell__track list-unstyled');
      track.setAttribute('role', 'list');
      track.setAttribute('aria-labelledby', h.id);
      picks.forEach((card, i) => {
        const li = el('li', 'dad-upsell__slide');
        card.style.setProperty('--dad-upsell-tile', TILES[i % TILES.length]);
        const v = defaultOf(card._variants);
        card.querySelector('.dad-upsell__now').textContent = v.priceText;
        const cmp = card.querySelector('.dad-upsell__compare');
        cmp.textContent = v.compareText || '';
        cmp.hidden = !v.compareText;
        const meta = card.querySelector('.dad-upsell__meta');
        if (!meta.textContent.trim()) meta.hidden = true;
        if (card === this.closer) card.querySelector('.dad-upsell__tag').hidden = false;
        const plus = card.querySelector('.dad-upsell__plus');
        plus.addEventListener('click', () =>
          card._variants.length > 1 ? this.openSheet(card, plus) : this.add(card._variants[0].id, plus)
        );
        li.appendChild(card);
        track.appendChild(li);
      });

      const dots = el('div', 'dad-upsell__dots');
      dots.setAttribute('aria-hidden', 'true');

      this.append(head, track, dots);
      this.hidden = false;

      const step = () => (track.querySelector('.dad-upsell__slide')?.offsetWidth || 150) + 12;
      prev.addEventListener('click', () => track.scrollBy({ left: -step() * 2, behavior: 'smooth' }));
      next.addEventListener('click', () => track.scrollBy({ left: step() * 2, behavior: 'smooth' }));
      const update = () => {
        const max = track.scrollWidth - track.clientWidth;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max - 2;
        nav.hidden = max <= 2;
        const pages = Math.max(1, Math.ceil(track.scrollWidth / Math.max(track.clientWidth, 1)));
        const at = max > 0 ? Math.round((track.scrollLeft / max) * (pages - 1)) : 0;
        if (dots.childElementCount !== pages) {
          dots.innerHTML = '';
          for (let p = 0; p < pages; p += 1) dots.appendChild(el('span'));
          dots.hidden = pages < 2;
        }
        [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i === at));
      };
      track.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
      requestAnimationFrame(update);
      if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
    }

    openSheet(card, opener) {
      this.closeSheet();
      const inDrawer = this.dataset.context === 'drawer';
      const host = (inDrawer && this.closest('.drawer__inner')) || document.body;
      const vs = card._variants;
      let picked = defaultOf(vs);

      const wrap = el('div', `dad-upsell-sheet${inDrawer ? ' dad-upsell-sheet--drawer' : ''}`);
      const scrim = el('div', 'dad-upsell-sheet__scrim');
      const panel = el('div', 'dad-upsell-sheet__panel');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', 'dad-upsell-sheet-h');

      const top = el('div', 'dad-upsell-sheet__top');
      const tile = el('div', 'dad-upsell-sheet__tile');
      tile.style.background = card.style.getPropertyValue('--dad-upsell-tile') || '#e9f6fd';
      const img = card.querySelector('img');
      if (img) tile.appendChild(img.cloneNode());
      const info = el('div', 'dad-upsell-sheet__info');
      const title = el('h3', 'dad-upsell-sheet__title', card.dataset.title);
      title.id = 'dad-upsell-sheet-h';
      const price = el('p', 'dad-upsell-sheet__price');
      info.append(title, price);
      if (card === this.closer) info.appendChild(el('p', 'dad-upsell-sheet__ship', 'Gets you free shipping'));
      const close = el('button', 'dad-upsell-sheet__close');
      close.type = 'button';
      close.setAttribute('aria-label', 'Close');
      close.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16"/></svg>';
      top.append(tile, info, close);

      const group = el('fieldset', 'dad-upsell-sheet__choices');
      const noun = (card.querySelector('.dad-upsell__meta').textContent.trim().split(' ')[1] || 'styles').replace(/s$/, '');
      group.appendChild(el('legend', '', `Pick a ${noun}`));
      const chips = el('div', 'dad-upsell-sheet__chips');
      const add = el('button', 'dad-upsell-sheet__add');
      add.type = 'button';
      const paint = () => {
        price.innerHTML = '';
        if (picked.compareText) price.appendChild(el('s', '', picked.compareText));
        price.appendChild(el('strong', '', picked.priceText));
        add.textContent = `Add to cart · ${picked.priceText}`;
        [...chips.children].forEach((c) => c.setAttribute('aria-pressed', String(c._v === picked)));
      };
      vs.forEach((v) => {
        const chip = el('button', 'dad-upsell-sheet__chip', v.title.replace(/ – /g, ' · '));
        chip.type = 'button';
        chip._v = v;
        chip.addEventListener('click', () => {
          picked = v;
          paint();
        });
        chips.appendChild(chip);
      });
      group.appendChild(chips);
      panel.append(top, group, add);
      wrap.append(scrim, panel);
      host.appendChild(wrap);
      paint();

      const shut = () => {
        this.closeSheet();
        opener.focus();
      };
      scrim.addEventListener('click', shut);
      close.addEventListener('click', shut);
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          shut();
        }
      });
      add.addEventListener('click', () => this.add(picked.id, add, true));
      this.sheet = wrap;
      requestAnimationFrame(() => {
        wrap.classList.add('is-open');
        (chips.querySelector('[aria-pressed="true"]') || add).focus();
      });
    }

    closeSheet() {
      if (this.sheet) this.sheet.remove();
      this.sheet = null;
    }

    async add(variantId, button, fromSheet) {
      button.disabled = true;
      button.classList.add('is-loading');
      const drawer = this.dataset.context === 'drawer' ? document.querySelector('cart-drawer') : null;
      const body = { items: [{ id: Number(variantId), quantity: 1 }] };
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
        button.classList.remove('is-loading');
        button.classList.add('is-added');
        if (fromSheet) button.textContent = 'Added';
        else button.innerHTML = '<svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7"/></svg>';
        await new Promise((r) => setTimeout(r, 600));
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, { source: 'dad-upsell', productVariantId: variantId, cartData: json });
        }
        this.closeSheet();
        if (drawer) drawer.renderContents(json);
        else window.location.reload();
      } catch (e) {
        button.disabled = false;
        button.classList.remove('is-loading');
        if (fromSheet) button.textContent = 'Could not add, try again';
      }
    }
  }

  customElements.define('dad-cart-upsell', DadCartUpsell);
})();
