/**
 * Petals – Cart extras (Eurus)
 * - Gift message toggle (show/hide) on /cart
 * - Sync Catalog Source Code, Is Gift, Gift Message to cart via xCartHelper.updateCart
 * - Cart drawer catalog field + Alpine component petalsDrawerGiftModal (cart-drawer.liquid)
 */
(function () {
  if (!window.Eurus) window.Eurus = {};
  if (!window.Eurus.loadedScript) window.Eurus.loadedScript = new Set();

  if (!window.Eurus.petalsCartExtrasAlpineRegistered) {
    window.Eurus.petalsCartExtrasAlpineRegistered = true;
    document.addEventListener('alpine:init', function () {
      if (typeof Alpine === 'undefined' || !Alpine.data) return;
      Alpine.data('petalsDrawerGiftModal', function () {
        return {
          cart_note: '',
          is_gift: false,
          init: function () {
            var self = this;
            this.pullFromCartState();
            document.addEventListener('eurus:cart-drawer:order-note:update', function () {
              self.pullFromCartState();
            });
          },
          pullFromCartState: function () {
            var noteEl = document.getElementById('petals-drawer-note-state');
            var giftEl = document.getElementById('petals-drawer-is-gift-state');
            this.cart_note = noteEl ? noteEl.value : '';
            this.is_gift = giftEl ? giftEl.value === 'Yes' : false;
          },
          toggleGiftModal: function () {
            this.pullFromCartState();
            var store = Alpine.store('xCartHelper');
            store.openField = store.openField === 'note' ? false : 'note';
          },
          saveGift: function () {
            var catalogEl = document.getElementById('petals-cart-drawer-catalog-code');
            var catalogVal = catalogEl ? catalogEl.value.trim() : '';
            var rawNote = this.cart_note != null ? String(this.cart_note) : '';
            var noteVal = this.is_gift && rawNote.trim() ? rawNote.trim() : '';
            var store = Alpine.store('xCartHelper');
            store.openField = false;
            store.updateCart(
              {
                attributes: {
                  'Catalog Source Code': catalogVal,
                  'Is Gift': this.is_gift ? 'Yes' : ''
                },
                note: noteVal
              },
              true
            );
            var hidGift = document.getElementById('petals-drawer-is-gift-state');
            var hidNote = document.getElementById('petals-drawer-note-state');
            if (hidGift) hidGift.value = this.is_gift ? 'Yes' : '';
            if (hidNote) hidNote.value = noteVal;
          }
        };
      });
    });
  }

  document.addEventListener(
    'eurus:cart-drawer:order-note:update',
    function (e) {
      if (!e.detail) return;
      var noteEl = document.getElementById('petals-drawer-note-state');
      var giftEl = document.getElementById('petals-drawer-is-gift-state');
      if (noteEl && e.detail.message !== undefined) noteEl.value = e.detail.message || '';
      if (giftEl && e.detail.attributes && e.detail.attributes['Is Gift'] !== undefined) {
        giftEl.value = e.detail.attributes['Is Gift'] || '';
      }
    },
    false
  );

  if (window.Eurus.loadedScript.has('petals-cart-extras.js')) return;
  window.Eurus.loadedScript.add('petals-cart-extras.js');

  var petalsInitialCartSyncDone = false;

  function getDrawerSyncState(catalogInput) {
    var hidGift = document.getElementById('petals-drawer-is-gift-state');
    var hidNote = document.getElementById('petals-drawer-note-state');
    return {
      catalog: catalogInput ? catalogInput.value.trim() : '',
      isGift: hidGift ? hidGift.value === 'Yes' : false,
      note: hidNote ? hidNote.value.trim() : ''
    };
  }

  function getMainSyncState(catalogInput, giftCheckbox, giftTextarea) {
    return {
      catalog: catalogInput ? catalogInput.value.trim() : '',
      isGift: giftCheckbox && giftCheckbox.checked,
      note: giftTextarea ? giftTextarea.value.trim() : ''
    };
  }

  function initContainer(container) {
    var isDrawer = container.getAttribute('data-petals-cart-context') === 'drawer';
    var catalogInput = container.querySelector('[data-petals-field="catalog"]');
    var giftCheckbox = container.querySelector('[data-petals-field="is-gift"]');
    var giftTextarea = container.querySelector('[data-petals-field="gift-message"]');
    var giftWrapper = container.querySelector('#petals-gift-message-wrapper');

    if (!isDrawer) {
      if (!giftCheckbox || !giftWrapper) return;
    } else {
      if (!catalogInput) return;
    }

    if (!isDrawer) {
      function toggleGiftMessage() {
        if (giftCheckbox.checked) {
          giftWrapper.classList.remove('petals-cart-gift-message-wrapper--hidden');
        } else {
          giftWrapper.classList.add('petals-cart-gift-message-wrapper--hidden');
        }
      }
      giftCheckbox.addEventListener('change', toggleGiftMessage);
      toggleGiftMessage();
    }

    var debounceTimer;
    function syncToCart() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        if (typeof Alpine === 'undefined' || !Alpine.store || !Alpine.store('xCartHelper')) return;

        var state = isDrawer
          ? getDrawerSyncState(catalogInput)
          : getMainSyncState(catalogInput, giftCheckbox, giftTextarea);

        var attributes = {
          'Catalog Source Code': state.catalog,
          'Is Gift': state.isGift ? 'Yes' : ''
        };

        var formattedNote = state.isGift && state.note ? state.note : '';

        Alpine.store('xCartHelper').updateCart({ attributes: attributes, note: formattedNote }, true);
      }, 200);
    }

    if (catalogInput) {
      catalogInput.addEventListener('input', syncToCart);
      catalogInput.addEventListener('change', syncToCart);
    }
    if (!isDrawer) {
      if (giftCheckbox) giftCheckbox.addEventListener('change', syncToCart);
      if (giftTextarea) {
        giftTextarea.addEventListener('input', syncToCart);
        giftTextarea.addEventListener('change', syncToCart);
      }
    }

    if (!petalsInitialCartSyncDone) {
      petalsInitialCartSyncDone = true;
      syncToCart();
    }
  }

  function init() {
    document.querySelectorAll('[data-petals-cart-extras]').forEach(function (el) {
      initContainer(el);
    });
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
