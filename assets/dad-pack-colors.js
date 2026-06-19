/*
  dad-pack-colors — renders the selected variant's pack colors as dots + names
  and re-renders on Dawn's variantChange pub/sub event. Color data for all
  variants is embedded as JSON by snippets/dad-pack-colors.liquid.
  Relies on the global `subscribe` and `PUB_SUB_EVENTS` from assets/pubsub.js.
*/
if (!customElements.get('dad-pack-colors')) {
  customElements.define(
    'dad-pack-colors',
    class DadPackColors extends HTMLElement {
      connectedCallback() {
        try {
          this.map = JSON.parse(this.querySelector('.dad-pack-colors__data').textContent);
        } catch (e) {
          this.map = {};
        }
        this.list = this.querySelector('.dad-pack-colors__list');
        this.onVariantChange = this.onVariantChange.bind(this);
        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          this.unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, this.onVariantChange);
        }
      }

      disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
      }

      onVariantChange(event) {
        var variant = event && event.data && event.data.variant;
        if (variant) this.render(variant.id);
      }

      render(variantId) {
        var cols = this.map[variantId];
        if (!cols || !cols.length) {
          this.hidden = true;
          return;
        }
        this.hidden = false;
        this.list.innerHTML = cols
          .map(function () {
            return '<li class="dad-pc__item"><span class="dad-pc__dot"></span><span class="dad-pc__name"></span></li>';
          })
          .join('');
        var dots = this.list.querySelectorAll('.dad-pc__dot');
        var names = this.list.querySelectorAll('.dad-pc__name');
        cols.forEach(function (c, i) {
          if (dots[i]) dots[i].style.background = c.h;
          if (names[i]) names[i].textContent = c.n;
        });
      }
    }
  );
}
