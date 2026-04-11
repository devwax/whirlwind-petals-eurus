/**
 * Injects Petals subcollection nav (from window.PetalsSubcollections.html) into
 * Searchanise filter UI. Selectors and timing vary by Searchanise version — we retry.
 */
(function () {
  var WRAPPER_CLASS = 'sidebar-petals-subcollections';
  var resultsHandlerBound = false;

  /**
   * Pick one prepend target (avoid duplicating when Snize nests containers).
   * Order: legacy sidebar class → modal → product filter block.
   */
  function findInjectTarget() {
    return (
      document.querySelector('.snize-filters-sidebar') ||
      document.querySelector('.snize-modal-content') ||
      document.querySelector('.snize-product-filter-container') ||
      document.querySelector('.snize-filters')
    );
  }

  function inject() {
    var cfg = window.PetalsSubcollections;
    if (!cfg || !cfg.html || String(cfg.html).trim() === '') return false;

    if (document.querySelector('[data-petals-subcollections-injected]')) return true;

    var target = findInjectTarget();
    if (!target) return false;

    var html = cfg.html;
    var wrap = document.createElement('div');
    wrap.setAttribute('data-petals-subcollections-injected', 'true');
    wrap.className = WRAPPER_CLASS + ' w-full';
    wrap.innerHTML = html;

    target.prepend(wrap);
    return true;
  }

  function bindResultsUpdated() {
    if (resultsHandlerBound) return;
    var $ =
      typeof window.Searchanise !== 'undefined' && typeof Searchanise.$ === 'function'
        ? Searchanise.$
        : typeof window.jQuery !== 'undefined'
          ? window.jQuery
          : null;
    if ($) {
      resultsHandlerBound = true;
      $(document).on('Searchanise.ResultsUpdated', function () {
        inject();
      });
    } else {
      resultsHandlerBound = true;
      document.addEventListener('Searchanise.ResultsUpdated', inject);
    }
  }

  function startRetryLoop() {
    var cfg = window.PetalsSubcollections;
    if (!cfg || !cfg.html) return;

    var attempts = 0;
    var maxAttempts = 50;
    var intervalMs = 200;

    var id = window.setInterval(function () {
      attempts++;
      if (!window.PetalsSubcollections || !window.PetalsSubcollections.html) {
        window.clearInterval(id);
        return;
      }
      if (document.querySelector('[data-petals-subcollections-injected]')) {
        window.clearInterval(id);
        return;
      }
      inject();
      if (attempts >= maxAttempts) {
        window.clearInterval(id);
      }
    }, intervalMs);
  }

  document.addEventListener('Searchanise.Loaded', function () {
    bindResultsUpdated();
    inject();
  });

  document.addEventListener('DOMContentLoaded', function () {
    bindResultsUpdated();
    inject();
    startRetryLoop();
  });

  bindResultsUpdated();
  inject();
  startRetryLoop();
})();
