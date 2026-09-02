/*
  dad-variant-gallery

  Drives the per-variant PDP gallery rendered by snippets/dad-variant-media-gallery.liquid.
  - Thumbnail / arrow navigation within the active variant's images.
  - On Dawn's `variantChange` pub/sub event, swaps [data-vg-content] using the
    section HTML Dawn already fetched (event.data.html) for the new variant.
  - Lightbox: the zoom button, or an image slide itself, opens the active slide
    full-screen in <dad-vg-lightbox>. The shell lives outside [data-vg-content]
    so it survives variant swaps; content is cloned from the active slide at
    open time — images swap to the 2400px rendition on the slide's
    data-vg-full, videos get a fresh <video> built from the slide's
    deferred-media <template>. Arrow keys / buttons step through the same
    slide list and keep the gallery in sync.

  Relies on the global `subscribe` and `PUB_SUB_EVENTS` from assets/pubsub.js,
  and `trapFocus` / `removeTrapFocus` / `pauseAllMedia` from assets/global.js.
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

      get lightbox() {
        // The lightbox re-parents itself to <body> on connect (see below), so
        // it registers here rather than being found by querySelector.
        return this.lightboxEl || this.querySelector('dad-vg-lightbox');
      }

      bind() {
        this.slides = Array.from(this.querySelectorAll('[data-vg-slide]'));
        this.thumbs = Array.from(this.querySelectorAll('[data-vg-thumb]'));
        this.zoomButton = this.querySelector('[data-vg-zoom]');
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

        if (this.zoomButton) {
          this.zoomButton.addEventListener('click', () => this.openLightbox(this.zoomButton));
        }
        // Image slides open on click too; video slides keep the poster click
        // for inline play, which is what Dawn's deferred-media does.
        this.slides.forEach((slide) => {
          const img = slide.querySelector(':scope > img');
          if (img) img.addEventListener('click', () => this.openLightbox(this.zoomButton || img));
        });
        this.updateZoomLabel();
      }

      openLightbox(opener) {
        if (this.lightbox) this.lightbox.open(opener);
      }

      updateZoomLabel() {
        if (!this.zoomButton || !this.zoomButton.dataset.label) return;
        this.zoomButton.setAttribute('aria-label', this.zoomButton.dataset.label.replace('%d', this.index + 1));
      }

      select(i) {
        if (!this.slides.length) return;
        this.index = (i + this.slides.length) % this.slides.length;

        this.slides.forEach((slide, idx) => {
          slide.classList.toggle('is-active', idx === this.index);
          if (idx !== this.index) slide.querySelectorAll('video').forEach((video) => video.pause());
        });
        this.thumbs.forEach((thumb, idx) => {
          const active = idx === this.index;
          thumb.classList.toggle('is-active', active);
          if (active) {
            thumb.setAttribute('aria-current', 'true');
          } else {
            thumb.removeAttribute('aria-current');
          }
        });
        this.updateZoomLabel();
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

        if (this.lightbox) this.lightbox.close();
        this.content.innerHTML = incoming.innerHTML;
        this.bind();
        this.select(0);
      }
    }
  );
}

if (!customElements.get('dad-vg-lightbox')) {
  customElements.define(
    'dad-vg-lightbox',
    class DadVgLightbox extends HTMLElement {
      constructor() {
        super();
        this.onKeydown = this.onKeydown.bind(this);
      }

      connectedCallback() {
        // Runs twice: once in place, once after the move below. Bind once.
        if (this.moved) return;
        this.moved = true;

        this.gallery = this.closest('dad-variant-gallery');
        if (this.gallery) this.gallery.lightboxEl = this;
        // On desktop the gallery column is position: sticky with its own
        // z-index, which is a stacking context — a fixed overlay inside it
        // paints beneath the sticky header no matter its z-index. Dawn's
        // ModalDialog escapes the same trap by re-parenting to <body>.
        document.body.appendChild(this);

        this.dialog = this.querySelector('[role="dialog"]');
        this.stage = this.querySelector('[data-vg-lb-stage]');
        this.arrows = Array.from(this.querySelectorAll('[data-vg-lb-prev], [data-vg-lb-next]'));

        this.querySelector('[data-vg-lb-close]').addEventListener('click', () => this.close());
        this.querySelector('[data-vg-lb-prev]').addEventListener('click', () => this.step(-1));
        this.querySelector('[data-vg-lb-next]').addEventListener('click', () => this.step(1));
        // Backdrop click closes; clicks on the media (or its controls) don't.
        this.addEventListener('click', (event) => {
          if (event.target === this || event.target === this.dialog || event.target === this.stage) this.close();
        });
      }

      open(opener) {
        if (!this.gallery) return;
        this.openedBy = opener;
        this.render();
        this.hidden = false;
        document.body.classList.add('overflow-hidden');
        document.addEventListener('keydown', this.onKeydown);
        if (typeof trapFocus === 'function') trapFocus(this, this.dialog);
      }

      close() {
        if (this.hidden) return;
        this.hidden = true;
        // Dropping the clone is what stops a playing video.
        this.stage.replaceChildren();
        document.body.classList.remove('overflow-hidden');
        document.removeEventListener('keydown', this.onKeydown);
        if (typeof removeTrapFocus === 'function') removeTrapFocus(this.openedBy);
      }

      step(direction) {
        this.gallery.select(this.gallery.index + direction);
        this.render();
      }

      onKeydown(event) {
        if (event.key === 'Escape') this.close();
        else if (event.key === 'ArrowLeft') this.step(-1);
        else if (event.key === 'ArrowRight') this.step(1);
      }

      render() {
        const slide = this.gallery.slides[this.gallery.index];
        if (!slide) return;
        if (typeof pauseAllMedia === 'function') pauseAllMedia();

        let media;
        const template = slide.querySelector('template');
        if (template) {
          media = template.content.firstElementChild.cloneNode(true);
        } else {
          const img = slide.querySelector('img');
          if (!img) return;
          media = img.cloneNode(false);
          ['srcset', 'sizes', 'loading', 'width', 'height', 'class'].forEach((attr) => media.removeAttribute(attr));
          if (slide.dataset.vgFull) media.src = slide.dataset.vgFull;
        }
        media.classList.add('dad-vg-lightbox__media');
        this.stage.replaceChildren(media);

        const multi = this.gallery.slides.length > 1;
        this.arrows.forEach((arrow) => (arrow.hidden = !multi));

        if (media.tagName === 'VIDEO') media.play().catch(() => {});
      }
    }
  );
}
