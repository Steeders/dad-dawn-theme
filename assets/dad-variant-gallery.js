/*
  dad-variant-gallery

  Drives the per-variant PDP gallery rendered by snippets/dad-variant-media-gallery.liquid.
  - Thumbnail / arrow navigation within the active variant's images.
  - On Dawn's `variantChange` pub/sub event, swaps [data-vg-content] using the
    section HTML Dawn already fetched (event.data.html) for the new variant.

  Relies on the global `subscribe` and `PUB_SUB_EVENTS` from assets/pubsub.js.
*/
if (!customElements.get('dad-variant-gallery')) {
  customElements.define(
    'dad-variant-gallery',
    class DadVariantGallery extends HTMLElement {
      constructor() {
        super();
        this.sectionId = this.dataset.sectionId;
        this.onVariantChange = this.onVariantChange.bind(this);
      }

      connectedCallback() {
        this.bind();
        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          this.unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, this.onVariantChange);
        }
      }

      disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
      }

      get content() {
        return this.querySelector('[data-vg-content]');
      }

      bind() {
        this.slides = Array.from(this.querySelectorAll('[data-vg-slide]'));
        this.thumbs = Array.from(this.querySelectorAll('[data-vg-thumb]'));
        this.index = 0;

        this.thumbs.forEach((thumb) => {
          thumb.addEventListener('click', () => this.select(parseInt(thumb.dataset.vgThumb, 10)));
        });
        this.querySelectorAll('[data-vg-prev]').forEach((btn) =>
          btn.addEventListener('click', () => this.select(this.index - 1))
        );
        this.querySelectorAll('[data-vg-next]').forEach((btn) =>
          btn.addEventListener('click', () => this.select(this.index + 1))
        );
      }

      select(i) {
        if (!this.slides.length) return;
        this.index = (i + this.slides.length) % this.slides.length;

        this.slides.forEach((slide, idx) => slide.classList.toggle('is-active', idx === this.index));
        this.thumbs.forEach((thumb, idx) => {
          const active = idx === this.index;
          thumb.classList.toggle('is-active', active);
          if (active) {
            thumb.setAttribute('aria-current', 'true');
          } else {
            thumb.removeAttribute('aria-current');
          }
        });
      }

      onVariantChange(event) {
        const data = event && event.data;
        if (!data || String(data.sectionId) !== String(this.sectionId)) return;

        const incoming =
          data.html &&
          data.html.querySelector(
            `dad-variant-gallery[data-section-id="${this.sectionId}"] [data-vg-content]`
          );
        if (!incoming || !this.content) return;

        this.content.innerHTML = incoming.innerHTML;
        this.bind();
        this.select(0);
      }
    }
  );
}
