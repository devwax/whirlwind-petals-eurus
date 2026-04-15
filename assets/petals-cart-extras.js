/**
 * Petals – Cart extras (Eurus)
 * - Gift message toggle (show/hide) on /cart
 * - Sync Catalog Source Code, Is Gift, Gift Message to cart via xCartHelper.updateCart
 * - Cart drawer gift panel: window.petalsDrawerToggleGift / petalsDrawerSaveGift (cart-drawer.liquid)
 */
(function () {
  if (!window.Eurus) window.Eurus = {};
  if (!window.Eurus.loadedScript) window.Eurus.loadedScript = new Set();

  /**
   * Cart drawer gift UI — must work even when Alpine.data() registered late.
   * Called from cart-drawer.liquid via @click (Alpine evaluates on window).
   */
  window.petalsDrawerToggleGift = function () {
    var A = window.Alpine;
    if (!A || !A.store) return;
    var ta = document.getElementById('x-cart-drawer-gift-message');
    var cb = document.getElementById('petals-drawer-gift-checkbox');
    var noteEl = document.getElementById('petals-drawer-note-state');
    var giftEl = document.getElementById('petals-drawer-is-gift-state');
    if (ta && noteEl) ta.value = noteEl.value;
    if (cb && giftEl) cb.checked = giftEl.value === 'Yes';
    var wrap = document.getElementById('petals-drawer-gift-msg-wrap');
    if (wrap && cb) wrap.classList.toggle('hidden', !cb.checked);
    var store = A.store('xCartHelper');
    if (!store) return;
    store.openField = store.openField === 'note' ? false : 'note';
  };

  window.petalsDrawerSaveGift = function () {
    var A = window.Alpine;
    if (!A || !A.store) return;
    var ta = document.getElementById('x-cart-drawer-gift-message');
    var cb = document.getElementById('petals-drawer-gift-checkbox');
    var cat = document.getElementById('petals-cart-drawer-catalog-code');
    var isGift = cb && cb.checked;
    var raw = ta ? String(ta.value).trim() : '';
    var noteVal = isGift && raw ? raw : '';
    var catalogVal = cat ? cat.value.trim() : '';
    var store = A.store('xCartHelper');
    store.openField = false;
    store.updateCart(
      {
        attributes: {
          'Catalog Source Code': catalogVal,
          'Is Gift': isGift ? 'Yes' : ''
        },
        note: noteVal
      },
      true
    );
    var hidGift = document.getElementById('petals-drawer-is-gift-state');
    var hidNote = document.getElementById('petals-drawer-note-state');
    if (hidGift) hidGift.value = isGift ? 'Yes' : '';
    if (hidNote) hidNote.value = noteVal;
  };

  if (!window.Eurus.petalsDrawerCartNoteListenerAdded) {
    window.Eurus.petalsDrawerCartNoteListenerAdded = true;
    document.addEventListener(
      'eurus:cart-drawer:order-note:update',
      function (e) {
        if (!e.detail) return;
        var noteEl = document.getElementById('petals-drawer-note-state');
        var giftEl = document.getElementById('petals-drawer-is-gift-state');
        var ta = document.getElementById('x-cart-drawer-gift-message');
        var cb = document.getElementById('petals-drawer-gift-checkbox');
        if (noteEl && e.detail.message !== undefined) noteEl.value = e.detail.message || '';
        if (giftEl && e.detail.attributes && e.detail.attributes['Is Gift'] !== undefined) {
          giftEl.value = e.detail.attributes['Is Gift'] || '';
        }
        if (ta && e.detail.message !== undefined) ta.value = e.detail.message || '';
        if (cb && e.detail.attributes && e.detail.attributes['Is Gift'] !== undefined) {
          cb.checked = e.detail.attributes['Is Gift'] === 'Yes';
          var wrap = document.getElementById('petals-drawer-gift-msg-wrap');
          if (wrap) wrap.classList.toggle('hidden', !cb.checked);
        }
      },
      false
    );
  }

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
