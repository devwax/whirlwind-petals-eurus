/**
 * Petals – Cart extras (Eurus)
 * - Gift message toggle (show/hide)
 * - Sync Catalog Source Code, Is Gift, Gift Message to cart via xCartHelper.updateCart
 */
(function () {
  if (!window.Eurus) window.Eurus = {};
  if (!window.Eurus.loadedScript) window.Eurus.loadedScript = new Set();
  if (window.Eurus.loadedScript.has('petals-cart-extras.js')) return;
  window.Eurus.loadedScript.add('petals-cart-extras.js');

  function init() {
    const container = document.querySelector('[data-petals-cart-extras]');
    if (!container) return;

    const catalogInput = document.getElementById('cart-attribute-catalog-code');
    const giftCheckbox = document.getElementById('cart-attribute-is-gift');
    const giftWrapper = document.getElementById('petals-gift-message-wrapper');
    const giftTextarea = document.getElementById('cart-attribute-gift-message');

    if (!giftCheckbox || !giftWrapper) return;

    // Gift toggle
    function toggleGiftMessage() {
      if (giftCheckbox.checked) {
        giftWrapper.classList.remove('petals-cart-gift-message-wrapper--hidden');
      } else {
        giftWrapper.classList.add('petals-cart-gift-message-wrapper--hidden');
      }
    }
    giftCheckbox.addEventListener('change', toggleGiftMessage);
    toggleGiftMessage();

    // Sync to cart (debounced)
    let debounceTimer;
    function syncToCart() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (typeof Alpine === 'undefined' || !Alpine.store || !Alpine.store('xCartHelper')) return;

        const catalogValue = catalogInput ? catalogInput.value.trim() : '';
        const isGift = giftCheckbox && giftCheckbox.checked;
        const giftMessageValue = giftTextarea ? giftTextarea.value.trim() : '';

        const attributes = {
          'Catalog Source Code': catalogValue,
          'Is Gift': isGift ? 'Yes' : ''
        };

        // Gift Message stored only in note (checkout display, packing slip); not in attributes
        const formattedNote = isGift && giftMessageValue ? giftMessageValue : '';

        Alpine.store('xCartHelper').updateCart({ attributes: attributes, note: formattedNote }, true);
      }, 200);
    }

    if (catalogInput) {
      catalogInput.addEventListener('input', syncToCart);
      catalogInput.addEventListener('change', syncToCart);
    }
    if (giftCheckbox) {
      giftCheckbox.addEventListener('change', syncToCart);
    }
    if (giftTextarea) {
      giftTextarea.addEventListener('input', syncToCart);
      giftTextarea.addEventListener('change', syncToCart);
    }

    // Sync on init so note is set from existing attribute values (e.g. after section refresh or return visit)
    syncToCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (typeof Alpine !== 'undefined' && Alpine.store && Alpine.store('xCartHelper')) {
        init();
      } else {
        document.addEventListener('alpine:init', init);
      }
    });
  } else {
    if (typeof Alpine !== 'undefined' && Alpine.store && Alpine.store('xCartHelper')) {
      init();
    } else {
      document.addEventListener('alpine:init', init);
    }
  }
})();
