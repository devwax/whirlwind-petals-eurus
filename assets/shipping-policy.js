if (!window.Eurus.loadedScript.has('shipping-policy.js')) {
  window.Eurus.loadedScript.add('shipping-policy.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xShippingPolicy', (url) => ({
        show: false,
        htmlInner: '',
        loadShipping() {
          this.show = true;
          Alpine.store('xPopup').open = true;
          fetch(url)
            .then(response => response.text())
            .then(data => {
              const parser = new DOMParser();
              const text = parser.parseFromString(data, 'text/html');
              this.htmlInner = text.querySelector('.shopify-policy__container').innerHTML;
            })
        },
        shippingFocus() {
          Alpine.store('xFocusElement').trapFocus('ShippingPolicyPopup','CloseShopping');
        },
        shippingRemoveFocus() {
          const activeElement = document.getElementById('LoadShoppingPolicy');
          Alpine.store('xFocusElement').removeTrapFocus(activeElement);
        }
      }))
    })
  });
}