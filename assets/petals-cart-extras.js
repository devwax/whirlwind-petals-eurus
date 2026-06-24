/**
 * Petals – Cart extras (Eurus)
 * - Gift message toggle (show/hide) on /cart
 * - Sync Catalog Source Code, Is Gift, Gift Message to cart via xCartHelper.updateCart
 * - Cart drawer gift panel: window.petalsDrawerToggleGift / petalsDrawerSaveGift (cart-drawer.liquid)
 */
(function () {
  if (!window.Eurus) window.Eurus = {};
  if (!window.Eurus.loadedScript) window.Eurus.loadedScript = new Set();

  var GIFT_MAX_LINES = 6;
  var GIFT_MAX_CHARS_PER_LINE = 25;

  function getCursorLineInfo(textarea) {
    var value = textarea.value || '';
    var pos = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : value.length;
    var textBefore = value.slice(0, pos);
    var lineIndex = textBefore.split('\n').length;
    var lines = value ? value.split('\n') : [];
    var currentLine = lines[lineIndex - 1] || '';

    return {
      lineIndex: lineIndex,
      currentLine: currentLine,
      lines: lines,
      lineCount: lines.length
    };
  }

  function findStatusContainer(textarea) {
    if (textarea.id) {
      var byId = document.getElementById(textarea.id + '-status');
      if (byId) return byId;
    }

    var next = textarea.nextElementSibling;
    if (next && next.matches('[data-petals-gift-message-status]')) return next;

    if (textarea.parentElement) {
      return textarea.parentElement.querySelector('[data-petals-gift-message-status]');
    }

    return null;
  }

  function enforceGiftMessageLimit(textarea) {
    var lines = textarea.value.split('\n');
    var changed = false;

    if (lines.length > GIFT_MAX_LINES) {
      lines = lines.slice(0, GIFT_MAX_LINES);
      changed = true;
    }

    lines = lines.map(function (line) {
      if (line.length > GIFT_MAX_CHARS_PER_LINE) {
        changed = true;
        return line.slice(0, GIFT_MAX_CHARS_PER_LINE);
      }
      return line;
    });

    if (changed) {
      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      textarea.value = lines.join('\n');
      var maxPos = textarea.value.length;
      textarea.selectionStart = Math.min(start, maxPos);
      textarea.selectionEnd = Math.min(end, maxPos);
    }
  }

  function showGiftMessageWarning(textarea, statusContainer, message) {
    if (!statusContainer) return;
    var warningEl = statusContainer.querySelector('.petals-gift-message-status__warning');
    if (!warningEl) return;

    warningEl.textContent = message;
    warningEl.hidden = false;
    warningEl.dataset.locked = 'true';
    textarea.classList.add('petals-gift-message-textarea--blocked');

    clearTimeout(warningEl._petalsTimeout);
    warningEl._petalsTimeout = setTimeout(function () {
      delete warningEl.dataset.locked;
      textarea.classList.remove('petals-gift-message-textarea--blocked');
      updateGiftMessageStatus(textarea, statusContainer);
    }, 2500);
  }

  function updateGiftMessageStatus(textarea, statusContainer) {
    if (!statusContainer) return;

    var countsEl = statusContainer.querySelector('.petals-gift-message-status__counts');
    var warningEl = statusContainer.querySelector('.petals-gift-message-status__warning');
    var info = getCursorLineInfo(textarea);
    var lineCount = info.lineCount;
    var atLineLimit = info.currentLine.length >= GIFT_MAX_CHARS_PER_LINE;
    var atLinesLimit = lineCount >= GIFT_MAX_LINES;

    if (countsEl) {
      if (!textarea.value) {
        countsEl.textContent = '0 / ' + GIFT_MAX_LINES + ' lines';
      } else {
        countsEl.textContent =
          'Line ' +
          info.lineIndex +
          ': ' +
          info.currentLine.length +
          ' / ' +
          GIFT_MAX_CHARS_PER_LINE +
          ' characters · ' +
          lineCount +
          ' / ' +
          GIFT_MAX_LINES +
          ' lines';
      }
    }

    textarea.classList.toggle('petals-gift-message-textarea--at-line-limit', atLineLimit);
    textarea.classList.toggle('petals-gift-message-textarea--at-lines-limit', atLinesLimit);

    if (warningEl && !warningEl.dataset.locked) {
      if (atLineLimit) {
        warningEl.textContent = 'Maximum ' + GIFT_MAX_CHARS_PER_LINE + ' characters per line.';
        warningEl.hidden = false;
      } else if (atLinesLimit) {
        warningEl.textContent = 'Maximum ' + GIFT_MAX_LINES + ' lines.';
        warningEl.hidden = false;
      } else {
        warningEl.textContent = '';
        warningEl.hidden = true;
      }
    }
  }

  function initGiftMessageTextarea(textarea, statusContainer) {
    if (!textarea || textarea.dataset.petalsGiftMessageInit === 'true') return;
    textarea.dataset.petalsGiftMessageInit = 'true';

    if (!statusContainer) statusContainer = findStatusContainer(textarea);
    if (statusContainer && !statusContainer.id && textarea.id) {
      statusContainer.id = textarea.id + '-status';
    }
    if (statusContainer && textarea.id) {
      textarea.setAttribute('aria-describedby', statusContainer.id);
    }

    enforceGiftMessageLimit(textarea);
    updateGiftMessageStatus(textarea, statusContainer);

    textarea.addEventListener('input', function () {
      var before = textarea.value;
      enforceGiftMessageLimit(textarea);

      if (before !== textarea.value) {
        showGiftMessageWarning(
          textarea,
          statusContainer,
          'Maximum ' + GIFT_MAX_CHARS_PER_LINE + ' characters per line.'
        );
      }

      updateGiftMessageStatus(textarea, statusContainer);
    });

    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var lines = textarea.value.split('\n');
        if (lines.length >= GIFT_MAX_LINES) {
          e.preventDefault();
          showGiftMessageWarning(textarea, statusContainer, 'Maximum ' + GIFT_MAX_LINES + ' lines.');
          updateGiftMessageStatus(textarea, statusContainer);
        }
      }
    });

    textarea.addEventListener('keyup', function () {
      updateGiftMessageStatus(textarea, statusContainer);
    });

    textarea.addEventListener('click', function () {
      updateGiftMessageStatus(textarea, statusContainer);
    });
  }

  function initAllGiftMessageTextareas() {
    var seen = new Set();

    ['#cart-attribute-gift-message', '#x-cart-drawer-gift-message', '[data-petals-gift-message]'].forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (textarea) {
        if (seen.has(textarea)) return;
        seen.add(textarea);
        initGiftMessageTextarea(textarea, findStatusContainer(textarea));
      });
    });
  }

  window.PetalsGiftMessage = {
    MAX_LINES: GIFT_MAX_LINES,
    MAX_CHARS_PER_LINE: GIFT_MAX_CHARS_PER_LINE,
    enforceLimit: enforceGiftMessageLimit,
    getCursorLineInfo: getCursorLineInfo,
    updateStatus: updateGiftMessageStatus,
    initTextarea: initGiftMessageTextarea,
    initAll: initAllGiftMessageTextareas
  };

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
    if (ta) {
      var status = findStatusContainer(ta);
      initGiftMessageTextarea(ta, status);
      updateGiftMessageStatus(ta, status);
    }
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
    if (ta) enforceGiftMessageLimit(ta);
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
        if (ta && e.detail.message !== undefined) {
          ta.value = e.detail.message || '';
          var status = findStatusContainer(ta);
          updateGiftMessageStatus(ta, status);
        }
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
    initAllGiftMessageTextareas();
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
