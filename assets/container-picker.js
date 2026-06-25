document.addEventListener('alpine:init', () => {
  Alpine.store('xPopupContainerDetail', {
    open: false,
    title: '',
    price: '',
    imageUrl: '',
    imageAlt: '',
    productUrl: '',
    pickerId: '',
    variantId: '',
    available: false,
    show({ title, price, imageUrl, imageAlt, productUrl, pickerId, variantId, available }) {
      this.title = title || '';
      this.price = price || '';
      this.imageUrl = imageUrl || '';
      this.imageAlt = imageAlt || title || '';
      this.productUrl = productUrl || '';
      this.pickerId = pickerId || '';
      this.variantId = variantId || '';
      this.available = available !== 'false' && available !== false;
      this.open = true;
      Alpine.store('xPopup').open = true;
    },
    close() {
      this.open = false;
      Alpine.store('xPopup').close();
    },
    select() {
      const { pickerId, variantId } = this;
      this.close();
      Alpine.store('xModal')?.removeFocus?.();
      if (!pickerId || !variantId) return;

      const picker = document.getElementById(pickerId);
      if (picker && typeof picker.selectVariant === 'function') {
        picker.selectVariant(variantId);
      }
    },
  });
});

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
    this.triggerSelectionImage = this.querySelector('.container-picker__trigger-selection-image');
    this.triggerSelectionImageEl = this.querySelector('.container-picker__trigger-selection-image-el');
    this.triggerSelectionName = this.querySelector('.container-picker__trigger-selection-name');
    this.triggerSelectionPrice = this.querySelector('.container-picker__trigger-selection-price');
    this.errorEl = this.querySelector('.container-picker__error');
    this.availabilityHint = this.querySelector('.container-picker__availability-hint');
    this.changeBtn = this.querySelector('.container-picker__change-btn');
    this.items = this.querySelectorAll('.container-picker__item');

    // ── State ─────────────────────────────────────────────────────────
    this.selected = null; // { variantId, productHandle, productTitle, priceFormatted, price, available, imageUrl, imageAlt }

    this._boundCloseOnOutsideClick = this._closeOnOutsideClick.bind(this);
  }

  connectedCallback() {
    this._resetTriggerDisplay();
    this._bindTrigger();
    this._bindItems();
    this._bindDetailLinks();
    this._bindChangeBtn();
    if (this.dataset.mode !== 'change') {
      this._interceptProductForm();
      this._bindQuantityChange();
    }
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

  selectVariant(variantId) {
    this.items = this.querySelectorAll('.container-picker__item');
    const item = this.querySelector(`.container-picker__item[data-variant-id="${variantId}"]`);
    if (item) this._selectItem(item);
  }

  /**
   * Swap the nested container line in cart (change mode only).
   * Removes the old container child, adds the new one, and updates the parent property.
   */
  async swapContainerInCart(context) {
    if (!this.hasSelection) {
      throw new Error('Please select a container option.');
    }

    const {
      parentLineKey,
      containerLineKey,
      parentVariantId,
      quantity = 1,
      currentContainerVariantId,
    } = context;

    if (String(this.selected.variantId) === String(currentContainerVariantId)) {
      return;
    }

    const root = window.Shopify?.routes?.root || '/';
    const sections = typeof Alpine !== 'undefined' && Alpine.store('xCartHelper')?.getSectionsToRender
      ? Alpine.store('xCartHelper').getSectionsToRender().map((s) => s.id)
      : [];
    const sectionsPayload = sections.length > 0
      ? { sections, sections_url: window.location.pathname }
      : {};

    const containerTitle = this.selected.productTitle;
    const containerPriceFormatted = this.selected.priceFormatted;

    window.updatingCart = true;

    try {
      const removeResponse = await fetch(`${root}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: containerLineKey,
          quantity: 0,
          ...sectionsPayload,
        }),
      });

      const removeState = await removeResponse.json().catch(() => ({}));
      if (!removeResponse.ok || removeState.status === 422) {
        throw new Error(removeState.description || removeState.message || 'Failed to remove current container');
      }

      const addResponse = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: parseInt(this.selected.variantId, 10),
              quantity: parseInt(quantity, 10) || 1,
              parent_line_key: parentLineKey,
              properties: {
                _is_container: 'true',
                _parent_variant_id: String(parentVariantId),
              },
            },
          ],
          ...sectionsPayload,
        }),
      });

      const addState = await addResponse.json().catch(() => ({}));
      if (!addResponse.ok || addState.status === 422) {
        throw new Error(addState.description || addState.message || 'Failed to add new container');
      }

      const parentItem = addState.items?.find((item) => item.key === parentLineKey);
      const existingProperties = parentItem?.properties || {};
      const updatedProperties = {
        ...existingProperties,
        'Selected Container': `${containerTitle} (${containerPriceFormatted})`,
      };

      const updateResponse = await fetch(`${root}cart/change.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parentLineKey,
          quantity: parseInt(quantity, 10) || 1,
          properties: updatedProperties,
          ...sectionsPayload,
        }),
      });

      const updateState = await updateResponse.json().catch(() => ({}));
      if (!updateResponse.ok || updateState.status === 422) {
        throw new Error(updateState.description || updateState.message || 'Failed to update container selection');
      }

      if (typeof Alpine !== 'undefined' && Alpine.store('xCartHelper')?.reRenderSections && updateState.sections) {
        Alpine.store('xCartHelper').reRenderSections(updateState.sections);
      }

      const bubble = document.querySelector('#cart-icon-bubble span');
      if (typeof Alpine !== 'undefined' && Alpine.store('xCartHelper') && bubble) {
        Alpine.store('xCartHelper').currentItemCount = parseInt(bubble.innerHTML || '0', 10);
      }
    } finally {
      window.updatingCart = false;
    }
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

  _bindDetailLinks() {
    this.querySelectorAll('.container-picker__item-detail-link').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._openDetailPopup(btn.closest('.container-picker__item'));
      });
    });
  }

  _openDetailPopup(item) {
    if (!item || typeof Alpine === 'undefined') return;

    const { productTitle, priceFormatted, detailImageUrl, imageUrl, imageAlt, productUrl, variantId, available } = item.dataset;
    const store = Alpine.store('xPopupContainerDetail');
    if (!store) return;

    store.show({
      title: productTitle,
      price: priceFormatted,
      imageUrl: detailImageUrl || imageUrl || '',
      imageAlt: imageAlt || productTitle,
      productUrl: productUrl || '',
      pickerId: this.id,
      variantId,
      available,
    });

    requestAnimationFrame(() => {
      Alpine.store('xModal')?.focus?.('PopupContainerDetail', 'CloseContainerDetail');
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
   * The container-picker block is rendered outside the <form> in Eurus's block
   * system, so we locate the form via data-product-form-id rather than DOM
   * containment. Eurus uses @click on the Add to Cart button (not form submit),
   * so we intercept the button click with capture: true to run before Alpine.
   */
  _interceptProductForm() {
    const formId = this.dataset.productFormId;
    if (!formId) return;

    const attach = () => {
      const form = document.getElementById(formId);
      if (!form) return;

      form.addEventListener('submit', (e) => this._onFormSubmit(e, form), { capture: true });

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

      const mainItemProperties = {
        'Selected Container': `${containerTitle} (${containerPriceFormatted})`,
      };
      const backorderPropertyKey = 'Backorder';
      const backorderMessage = form.querySelector(`input[name="properties[${backorderPropertyKey}]"]`)?.value;
      if (backorderMessage) {
        mainItemProperties[backorderPropertyKey] = backorderMessage;
      }

      const body = {
        items: [
          {
            id: parseInt(mainVariantId, 10),
            quantity: parseInt(form.querySelector('[name="quantity"]')?.value || '1', 10),
            properties: mainItemProperties,
          },
          {
            id: parseInt(this.selected.variantId, 10),
            quantity: parseInt(form.querySelector('[name="quantity"]')?.value || '1', 10),
            parent_id: parseInt(mainVariantId, 10),
            properties: {
              _is_container: 'true',
              _parent_variant_id: mainVariantId,
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

    const { variantId, productHandle, productTitle, priceFormatted, price, available, imageUrl, imageAlt } = item.dataset;

    this.selected = {
      variantId,
      productHandle,
      productTitle,
      priceFormatted,
      price: parseInt(price || '0', 10),
      available,
      imageUrl: imageUrl || '',
      imageAlt: imageAlt || productTitle,
    };

    // Update aria-selected on all items
    this.items.forEach((i) => i.setAttribute('aria-selected', i === item ? 'true' : 'false'));

    // Update collapsed trigger UI (State 3)
    this.triggerSelectionName.textContent = productTitle;
    this.triggerSelectionPrice.textContent = priceFormatted;
    this._updateTriggerSelectionImage(imageUrl, imageAlt || productTitle);
    this.triggerPlaceholder.hidden = true;
    this.triggerSelection.hidden = false;

    // Show "Change Selection" button
    if (this.changeBtn) this.changeBtn.hidden = false;

    this._clearError();
    this._closeDropdown();

    if (this.availabilityHint) this.availabilityHint.hidden = true;

    this._updateAddToCartPrice();

    // Let other components know (e.g. for price display updates)
    this.dispatchEvent(
      new CustomEvent('container-picker:selected', {
        bubbles: true,
        detail: { variantId, productTitle, priceFormatted, productHandle, price: this.selected.price },
      })
    );
  }

  /**
   * Listens for quantity and variant changes so we can re-apply the combined
   * price (product + container) when the user changes quantity or variant.
   */
  _bindQuantityChange() {
    const sectionId = this.dataset.sectionId;
    if (!sectionId) return;
    const reapply = () => { if (this.hasSelection) this._updateAddToCartPrice(); };
    document.addEventListener(`eurus:product:quantity-changed-${sectionId}`, reapply);
    document.addEventListener(`eurus:product-page-variant-select:updated:${sectionId}`, () => {
      setTimeout(reapply, 50);
    });
  }

  /**
   * Updates the Add to Cart button's displayed price to show combined total:
   * (product price × quantity) + container price.
   */
  _updateAddToCartPrice() {
    if (!this.hasSelection) return;

    const productId = this.dataset.productId;
    const sectionId = this.dataset.sectionId;
    const moneyFormat = this.dataset.moneyFormat;
    if (!productId || !sectionId || !moneyFormat) return;

    const productTemplate = document.getElementById(`x-product-template-${productId}-${sectionId}`);
    if (!productTemplate) return;

    const targetPriceEl = productTemplate.querySelector('.add_to_cart_button .main-product-price .target-price');
    const qtyInput = productTemplate.querySelector(`#Quantity-atc-${sectionId}`) || productTemplate.querySelector('[name="quantity"]');
    const priceEls = productTemplate.querySelectorAll('.add_to_cart_button .main-product-price .price, .add_to_cart_button .main-product-price .price-sale');
    if (!targetPriceEl || !priceEls.length) return;

    const productPrice = parseInt(targetPriceEl.textContent || '0', 10);
    const qty = parseInt(qtyInput?.value || '1', 10);
    const containerPrice = this.selected.price || 0;
    const totalCents = productPrice * qty + containerPrice;

    let formatted;
    if (typeof Alpine !== 'undefined' && Alpine.store('xHelper')?.formatMoney) {
      formatted = Alpine.store('xHelper').formatMoney(totalCents, moneyFormat);
    } else {
      formatted = `$${(totalCents / 100).toFixed(2)}`;
    }

    priceEls.forEach((el) => { el.innerHTML = formatted; });
  }

  // ── UI helpers ─────────────────────────────────────────────────────

  _updateTriggerSelectionImage(imageUrl, imageAlt) {
    if (!this.triggerSelectionImage || !this.triggerSelectionImageEl) return;

    if (imageUrl) {
      this.triggerSelectionImageEl.src = imageUrl;
      this.triggerSelectionImageEl.alt = imageAlt || '';
      this.triggerSelectionImage.hidden = false;
      return;
    }

    this.triggerSelectionImageEl.removeAttribute('src');
    this.triggerSelectionImageEl.alt = '';
    this.triggerSelectionImage.hidden = true;
  }

  _resetTriggerDisplay() {
    if (this.triggerPlaceholder) this.triggerPlaceholder.hidden = false;
    if (this.triggerSelection) this.triggerSelection.hidden = true;
    this._updateTriggerSelectionImage('', '');
    if (this.triggerSelectionName) this.triggerSelectionName.textContent = '';
    if (this.triggerSelectionPrice) this.triggerSelectionPrice.textContent = '';
    if (this.changeBtn) this.changeBtn.hidden = true;
  }

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
