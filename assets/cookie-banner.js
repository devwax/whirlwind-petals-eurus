requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.data('xCookieBanner', (delay) => ({
      show: false,
      init() {
        setTimeout(() => {
          window.Shopify.loadFeatures([
            {
              name: 'consent-tracking-api',
              version: '0.1',
            }
          ],
          (error) => {
            if (error) {    
              throw error;
            }

            const userCanBeTracked = window.Shopify.customerPrivacy.userCanBeTracked();
            const userTrackingConsent = window.Shopify.customerPrivacy.getTrackingConsent();

            if(!userCanBeTracked && userTrackingConsent === 'no_interaction') {
              requestAnimationFrame(() => {
                this.show = true;
              });
            }

            document.dispatchEvent(new CustomEvent("eurus:customer-privacy:loaded"));            
          });
        }, delay * 1000);
      },
      handleAccept() {
        if (window.Shopify.customerPrivacy) {
          window.Shopify.customerPrivacy.setTrackingConsent(true, () => {});
          requestAnimationFrame(() => {
            this.show = false;
          });
        }
      },
      handleDecline() {
        if (window.Shopify.customerPrivacy) {
          window.Shopify.customerPrivacy.setTrackingConsent(false, () => {});
          requestAnimationFrame(() => {
            this.show = false;
          });
        }
      }
    }));
  });
});