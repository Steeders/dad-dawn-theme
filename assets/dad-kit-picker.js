/*
  dad-kit-picker: one radio per variant ("kit") on top of Dawn's own option
  picker, which stays in the DOM but hidden (snippets/dad-kit-picker.liquid).

  Choosing a kit copies that variant's option values into the stock
  <variant-selects> inputs and dispatches one bubbling `change` from the last
  input it touched. Dawn's VariantSelects turns that into its normal
  optionValueSelectionChange flow (price, media, gallery, URL, variant id,
  buy button). Nothing here talks to the cart.

  Two Dawn refresh paths exist:
  - update: the section is re-rendered and variantChange is published; this
    element survives, so it only syncs which radio is checked.
  - swap (single-option dad swatches carry data-product-url): product-info is
    replaced wholesale and this element is re-created from server HTML, so it
    restores keyboard focus to the kit the shopper just chose.
*/
if (!customElements.get('dad-kit-picker')) {
  let refocus = null;

  customElements.define(
    'dad-kit-picker',
    class DadKitPicker extends HTMLElement {
      connectedCallback() {
        this.section = this.dataset.section;
        if (!this.bound) {
          this.bound = true;
          this.addEventListener('change', this.onChange.bind(this));
        }
        if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          this.unsubscribe = subscribe(PUB_SUB_EVENTS.variantChange, this.onVariantChange.bind(this));
        }
        if (refocus && refocus.section === this.section) {
          const input = this.radioFor(refocus.variantId);
          refocus = null;
          if (input) requestAnimationFrame(() => input.focus({ preventScroll: true }));
        }
      }

      disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
      }

      radioFor(variantId) {
        return Array.from(this.querySelectorAll('input[type="radio"]')).find(
          (input) => input.value === String(variantId)
        );
      }

      get variantSelects() {
        return document.getElementById(`variant-selects-${this.section}`);
      }

      onChange(event) {
        const input = event.target;
        if (!input || input.type !== 'radio' || !input.checked) return;
        event.stopPropagation();

        let options;
        try {
          options = JSON.parse(input.dataset.options);
        } catch (e) {
          return;
        }
        const selects = this.variantSelects;
        if (!selects || !Array.isArray(options)) return;

        // One group per product option, in option order: a fieldset of radios
        // (pills, swatches, dad image swatches) or a <select> (dropdown).
        const groups = Array.from(selects.querySelectorAll('fieldset, select'));
        let last = null;

        groups.forEach((group, index) => {
          const value = options[index];
          if (value === undefined || value === null) return;

          if (group.tagName === 'SELECT') {
            const option = Array.from(group.options).find((o) => o.value === value);
            if (!option || group.value === value) return;
            // VariantSelects reads `option[selected]` (the attribute), not .value.
            Array.from(group.options).forEach((o) => o.removeAttribute('selected'));
            option.setAttribute('selected', 'selected');
            group.value = value;
            last = group;
          } else {
            const radio = Array.from(group.querySelectorAll('input[type="radio"]')).find((r) => r.value === value);
            if (!radio || radio.checked) return;
            radio.checked = true;
            last = radio;
          }
        });

        if (!last) return;
        refocus = { section: this.section, variantId: input.value };
        last.dispatchEvent(new Event('change', { bubbles: true }));
      }

      onVariantChange(event) {
        const data = event && event.data;
        if (!data || data.sectionId !== this.section) return;
        refocus = null;
        if (!data.variant) return;
        const input = this.radioFor(data.variant.id);
        if (input && !input.checked) input.checked = true;
      }
    }
  );
}
