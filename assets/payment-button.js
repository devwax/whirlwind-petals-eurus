if (!window.Eurus.loadedScript.has('payment-button.js')) {
  window.Eurus.loadedScript.add('payment-button.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xShopifyPaymentBtn', {
        load(e) {
          if (Shopify && Shopify.PaymentButton) {
            Shopify.PaymentButton.init();
          }
        },
      });
    });
  });
}