/**
 * ContainerPicker — Custom element for the Picklist POC
 * -------------------------------------------------------
 * Manages a 3-state container selector on product pages:
 *   State 1 – Pre-selection : trigger shows "Choose Option"
 *   State 2 – Open          : dropdown list is visible
 *   State 3 – Selected      : trigger shows selected container + "Change" button
 *
 * Cart behavior:
 *   Uses Shopify nested cart lines (parent_id) so the container is grouped
 *   with the main product in cart, checkout, and order. Shopify renders the
 *   relationship automatically; child is removed if parent is removed.
 *
 *   Main product: added first with "Selected Container" property for fulfillment.
 *   Container: added second with parent_id referencing the main product variant,
 *   plus _is_container: 'true' for cart display labeling.
 *
 * Eurus integration:
 *   Uses Alpine.store('xCartHelper') for section re-rendering and
 *   Alpine.store('xMiniCart').openCart() for cart drawer.
 */

class ContainerPicker extends HTMLElement {
  constructor() {
    super();

    // ── Element refs ──────────────────────────────────────────────────
    this.trigger = this.querySelector('.container-picker__trigger');
    this.dropdown = this.querySelector('.container-picker__dropdown');
    this.triggerPlaceholder = this.querySelector('.container-picker__trigger-placeholder');
    this.triggerSelection = this.querySelector('.container-picker__trigger-selection');
    this.triggerSelectionName = this.querySelector('.container-picker__trigger-selection-name');
    this.triggerSelectionPrice = this.querySelector('.container-picker__trigger-selection-price');
    this.errorEl = this.querySelector('.container-picker__error');
    this.availabilityHint = this.querySelector('.container-picker__availability-hint');
    this.changeBtn = this.querySelector('.container-picker__change-btn');
    this.items = this.querySelectorAll('.container-picker__item');

    // ── State ─────────────────────────────────────────────────────────
    this.selected = null; // { variantId, productHandle, productTitle, priceFormatted, available }

    this._boundCloseOnOutsideClick = this._closeOnOutsideClick.bind(this);
  }

  connectedCallback() {
    this._bindTrigger();
    this._bindItems();
    this._bindChangeBtn();
    this._interceptProductForm();
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._boundCloseOnOutsideClick);
  }

  // ── Public helpers ─────────────────────────────────────────────────

  get isOpen() {
    return !this.dropdown.hidden;
  }

  get hasSelection() {
    return this.selected !== null;
  }

  // ── Event binding ──────────────────────────────────────────────────

  _bindTrigger() {
    this.trigger.addEventListener('click', () => this._toggleDropdown());
  }

  _bindItems() {
    this.items.forEach((item) => {
      const selectBtn = item.querySelector('.container-picker__item-select-btn');
      if (!selectBtn) return;

      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._selectItem(item);
      });

      // Allow keyboard activation on the SELECT button
      selectBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._selectItem(item);
        }
      });

      // Clicking anywhere on the row (except the detail link) also selects
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('container-picker__item-detail-link')) return;
        if (e.target.closest('.container-picker__item-select-btn')) return;
        this._selectItem(item);
      });
    });
  }

  _bindChangeBtn() {
    if (!this.changeBtn) return;
    this.changeBtn.addEventListener('click', () => {
      this._openDropdown();
      // Scroll the currently selected item into view
      const selectedItem = this.querySelector('.container-picker__item[aria-selected="true"]');
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /**
   * Intercepts the parent product form so we can:
   *   1. Validate that a container has been chosen.
   *   2. Use the Cart AJAX API to add both the main product and the container
   *      as linked line items instead of just the main product.
   *
   * Eurus uses @click on the Add to Cart button (not form submit), so we must
   * intercept the button click with capture: true to run before Alpine's addToCart.
   */
  _interceptProductForm() {
    const formId = this.dataset.productFormId;
    if (!formId) return;

    const attach = () => {
      const form = document.getElementById(formId);
      if (!form) return;

      // Submit listener: fallback for Enter key, etc.
      form.addEventListener('submit', (e) => this._onFormSubmit(e, form), { capture: true });

      // Click listener: primary — Eurus uses @click on the button, not form submit.
      const submitBtns = form.querySelectorAll('button[name="add"]');
      submitBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => this._onAddToCartClick(e, form), { capture: true });
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attach);
    } else {
      attach();
    }
  }

  _onAddToCartClick(e, form) {
    // Only handle when we have a container picker (this element is in the form).
    if (!form.contains(this)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    this._onFormSubmit(e, form);
  }

  async _onFormSubmit(e, form) {
    // Container is required — block submission if nothing is selected.
    if (!this.hasSelection) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this._showError('Please select a container option before adding to cart.');
      this._openDropdown();
      return;
    }

    // We have a selection → take over the entire cart-add flow.
    e.preventDefault();
    e.stopImmediatePropagation();

    this._clearError();

    const mainVariantId = form.querySelector('[name="id"]')?.value;
    if (!mainVariantId) return;

    const mainProductTitle = this.dataset.productTitle || 'Product';
    const containerTitle = this.selected.productTitle;
    const containerPriceFormatted = this.selected.priceFormatted;

    const submitBtn = form.querySelector('[type="submit"]');
    this._setLoading(submitBtn, true);

    try {
      if (typeof Alpine !== 'undefined' && Alpine.store('xCartHelper')?.waitForCartUpdate) {
        await Alpine.store('xCartHelper').waitForCartUpdate();
      }
      window.updatingCart = true;

      const sections = typeof Alpine !== 'undefined' && Alpine.store('xCartHelper')?.getSectionsToRender
        ? Alpine.store('xCartHelper').getSectionsToRender().map((s) => s.id)
        : [];

      const body = {
        items: [
          {
            id: parseInt(mainVariantId, 10),
            quantity: parseInt(form.querySelector('[name="quantity"]')?.value || '1', 10),
            properties: {
              'Selected Container': `${containerTitle} (${containerPriceFormatted})`,
            },
          },
          {
            id: parseInt(this.selected.variantId, 10),
            quantity: 1,
            parent_id: parseInt(mainVariantId, 10),
            properties: {
              _is_container: 'true',
            },
          },
        ],
      };
      if (sections.length > 0) {
        body.sections = sections;
        body.sections_url = window.location.pathname;
      }

      const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.description || `Cart error ${response.status}`);
      }

      const data = await response.json();

      // Eurus: re-render cart sections and open cart drawer
      if (typeof Alpine !== 'undefined' && Alpine.store('xCartHelper')) {
        if (data.sections && Alpine.store('xCartHelper').reRenderSections) {
          Alpine.store('xCartHelper').reRenderSections(data.sections);
        }
        if (typeof document.querySelector('#cart-icon-bubble span')?.innerHTML !== 'undefined') {
          Alpine.store('xCartHelper').currentItemCount = parseInt(
            document.querySelector('#cart-icon-bubble span')?.innerHTML || '0',
            10
          );
        }
      }
      if (typeof Alpine !== 'undefined' && Alpine.store('xMiniCart')?.openCart) {
        Alpine.store('xMiniCart').openCart();
      }

      document.dispatchEvent(new CustomEvent('eurus:cart:items-changed', { bubbles: true }));
      document.dispatchEvent(new CustomEvent('eurus:cart:redirect', { bubbles: true }));
    } catch (err) {
      console.error('[ContainerPicker] Cart add failed:', err);
      this._showError(err.message || 'Sorry, something went wrong. Please try again.');
    } finally {
      window.updatingCart = false;
      this._setLoading(submitBtn, false);
    }
  }

  // ── Dropdown state management ──────────────────────────────────────

  _toggleDropdown() {
    this.isOpen ? this._closeDropdown() : this._openDropdown();
  }

  _openDropdown() {
    this.dropdown.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', this._boundCloseOnOutsideClick);
  }

  _closeDropdown() {
    this.dropdown.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', this._boundCloseOnOutsideClick);
  }

  _closeOnOutsideClick(e) {
    if (!this.contains(e.target)) {
      this._closeDropdown();
    }
  }

  // ── Selection ──────────────────────────────────────────────────────

  _selectItem(item) {
    if (item.dataset.available === 'false') return; // Don't allow selecting unavailable containers

    const { variantId, productHandle, productTitle, priceFormatted, available } = item.dataset;

    this.selected = { variantId, productHandle, productTitle, priceFormatted, available };

    // Update aria-selected on all items
    this.items.forEach((i) => i.setAttribute('aria-selected', i === item ? 'true' : 'false'));

    // Update collapsed trigger UI (State 3)
    this.triggerSelectionName.textContent = productTitle;
    this.triggerSelectionPrice.textContent = priceFormatted;
    this.triggerPlaceholder.hidden = true;
    this.triggerSelection.hidden = false;

    // Show "Change Selection" button
    if (this.changeBtn) this.changeBtn.hidden = false;

    this._clearError();
    this._closeDropdown();

    if (this.availabilityHint) this.availabilityHint.hidden = true;

    // Let other components know (e.g. for price display updates)
    this.dispatchEvent(
      new CustomEvent('container-picker:selected', {
        bubbles: true,
        detail: { variantId, productTitle, priceFormatted, productHandle },
      })
    );
  }

  // ── UI helpers ─────────────────────────────────────────────────────

  _showError(message) {
    if (!this.errorEl) return;
    this.errorEl.textContent = message;
    this.errorEl.hidden = false;
  }

  _clearError() {
    if (!this.errorEl) return;
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }

  _setLoading(btn, isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }
}

customElements.define('container-picker', ContainerPicker);
