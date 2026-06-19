document.addEventListener('alpine:init', () => {
  Alpine.store('xPopupCartContainerChange', {
    open: false,
    loading: false,
    pickerReady: false,
    error: '',
    title: '',
    context: null,

    async show(context) {
      this.context = context;
      this.title = context.parentTitle
        ? `Change container for ${context.parentTitle}`
        : 'Change container';
      this.error = '';
      this.loading = true;
      this.pickerReady = false;
      this.open = true;
      Alpine.store('xPopup').open = true;

      requestAnimationFrame(() => {
        Alpine.store('xModal')?.focus?.('PopupCartContainerChange', 'CloseCartContainerChange');
      });

      try {
        await this._loadPicker(context);
      } catch (err) {
        console.error('[CartContainerChange] Failed to load picker:', err);
        this.error = err.message || 'Unable to load container options. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    close() {
      this.open = false;
      this.loading = false;
      this.pickerReady = false;
      this.error = '';
      this.context = null;
      const host = document.getElementById('CartContainerChangePickerHost');
      if (host) host.innerHTML = '';
      Alpine.store('xPopup').close();
    },

    _getPicker() {
      const host = document.getElementById('CartContainerChangePickerHost');
      return host?.querySelector('container-picker') || null;
    },

    async _loadPicker(context) {
      const host = document.getElementById('CartContainerChangePickerHost');
      if (!host) throw new Error('Picker container not found');

      host.innerHTML = '';

      const root = window.Shopify?.routes?.root || '/';
      const url = `${root}products/${encodeURIComponent(context.parentProductHandle)}?section_id=cart-container-picker`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load container options (${response.status})`);

      const html = await response.text();
      host.innerHTML = html;

      const picker = host.querySelector('container-picker');
      if (!picker) throw new Error('No container options available for this product');

      if (context.currentContainerVariantId) {
        picker.selectVariant(String(context.currentContainerVariantId));
      }

      this.pickerReady = true;
    },

    async confirm() {
      const picker = this._getPicker();
      if (!picker) {
        this.error = 'Container picker is not ready. Please try again.';
        return;
      }

      if (!picker.hasSelection) {
        this.error = 'Please select a container option.';
        picker._showError?.('Please select a container option.');
        picker._openDropdown?.();
        return;
      }

      if (
        this.context?.currentContainerVariantId &&
        String(picker.selected.variantId) === String(this.context.currentContainerVariantId)
      ) {
        this.close();
        Alpine.store('xModal')?.removeFocus?.();
        return;
      }

      this.loading = true;
      this.error = '';

      try {
        if (typeof Alpine !== 'undefined' && Alpine.store('xCartHelper')?.waitForCartUpdate) {
          await Alpine.store('xCartHelper').waitForCartUpdate();
        }

        await picker.swapContainerInCart(this.context);
        document.dispatchEvent(new CustomEvent('eurus:cart:items-changed', { bubbles: true }));
        Alpine.store('xModal')?.removeFocus?.();
        this.close();
      } catch (err) {
        console.error('[CartContainerChange] Swap failed:', err);
        this.error = err.message || 'Sorry, something went wrong. Please try again.';
      } finally {
        this.loading = false;
      }
    },
  });
});

function readChangeButtonContext(button) {
  return {
    parentLineKey: button.dataset.parentLineKey,
    containerLineKey: button.dataset.containerLineKey,
    parentVariantId: button.dataset.parentVariantId,
    parentProductHandle: button.dataset.parentProductHandle,
    currentContainerVariantId: button.dataset.currentContainerVariantId,
    quantity: parseInt(button.dataset.quantity || '1', 10),
    parentTitle: button.dataset.parentTitle || '',
  };
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('.cart-item__container-change-btn');
  if (!button || typeof Alpine === 'undefined') return;

  event.preventDefault();

  const context = readChangeButtonContext(button);
  if (!context.parentLineKey || !context.containerLineKey || !context.parentProductHandle) {
    console.error('[CartContainerChange] Missing cart context on change button');
    return;
  }

  Alpine.store('xPopupCartContainerChange').show(context);
});
