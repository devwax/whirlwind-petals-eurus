if (!window.Eurus.loadedScript.has('sticky-atc.js')) {
  window.Eurus.loadedScript.add('sticky-atc.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xStickyATC', (sectionId, is_combined) => ({
        openDetailOnMobile: false,
        currentAvailableOptions: [],
        options: [],
        init() {
          document.addEventListener(`eurus:product-page-variant-select:updated:${sectionId}`, (e) => {
            this.renderVariant(e.detail.html);
            this.renderProductPrice(e.detail.html);
            this.renderMedia(e.detail.html);
          });
        },
        renderProductPrice(html) {
          const destinations = document.querySelectorAll(`.price-sticky-${sectionId}`);
          destinations.forEach((destination) => {
            const source = html.getElementById('price-sticky-' + sectionId);
            if (source && destination) destination.innerHTML = source.innerHTML;
          })
        },
        renderMedia(html) {
          const destination = document.getElementById('product-image-sticky-' + sectionId);
          const source = html.getElementById('product-image-sticky-' + sectionId);
  
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        renderVariant(html) {
          const destination = document.getElementById('variant-update-sticky-' + sectionId);
          const source = html.getElementById('variant-update-sticky-' + sectionId);
  
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        changeOptionSticky(event) {
          Array.from(event.target.options).forEach((option) => {
            option.removeAttribute('selected');
            if (option.selected) option.setAttribute('selected', '');
          });
          const input = event.target.selectedOptions[0];
          const targetUrl = input.dataset.productUrl;
          const variantEl = document.getElementById('variant-update-sticky-' + sectionId);
          document.dispatchEvent(new CustomEvent(`eurus:product-page-variant-select-sticky:updated:${sectionId}`, {
            detail: {
              targetUrl: targetUrl,
              variantElSticky: variantEl
            }
          }));
        }
      }))
    })
  })
}