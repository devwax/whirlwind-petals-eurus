if (!window.Eurus.loadedScript.has('cart-countdown-timer.js')) {
  window.Eurus.loadedScript.add('cart-countdown-timer.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xCartCountdownTimer', (messageTemplate, minutes, expireAction) => ({
        timeLeft: null,
        timestamp: null,
        interval: null,
        formattedMessage: '',
        message: messageTemplate,
        countdownTime: minutes * 60,
        action: expireAction,
        loadingClearCart: false,
        errorMessage: false,
        clearSuccess: false,
        minutesText: '',
        initCountdown(minutesText) {
          this.minutesText = minutesText;
          const savedState = this.loadState();
          if (this.timeLeft === null || savedState.timeLeft === 0) {
            this.sync(this.countdownTime);
          }
          this.handleCountdown();
          this.clearInterval();
          this.startCountdown();
        },

        sync(countdownTime) {
          const savedState = this.loadState();
          if (savedState && savedState.timeLeft > 0) {
            const elapsed = Math.floor((Date.now() - savedState.timestamp) / 1000);
            this.timeLeft = Math.max(0, savedState.timeLeft - elapsed);
          } else {
            this.timeLeft = countdownTime;
          }
          this.timestamp = Date.now();
          this.saveState();
        },

        reset(countdownTime) {
          this.timeLeft = countdownTime;
          this.timestamp = Date.now();
          this.saveState();
        },

        clearInterval() {
          if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
          }
        },

        clearLocalStorage() {
          localStorage.removeItem('cartCountdown');
        },

        saveState() {
          localStorage.setItem('cartCountdown', JSON.stringify({
            timeLeft: this.timeLeft,
            timestamp: this.timestamp,
          }));
        },

        loadState() {
          const savedState = localStorage.getItem('cartCountdown');
          return savedState ? JSON.parse(savedState) : null;
        },

        startCountdown() {
          this.interval = setInterval(() => {
            if (this.timeLeft > 0) {
              this.timeLeft--;
              this.handleCountdown();
            } else {
              this.clearInterval();
              this.handleExpireAction();
            }
          }, 1000);
        },

        handleCountdown() {
          const minutes = Math.floor(this.timeLeft / 60);
          const seconds = this.timeLeft % 60;
          const formattedTime = `<span class=\"font-bold\">${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${this.minutesText}!</span>`;
          this.formattedMessage = this.message.replace('{timer}', formattedTime);
        },

        clearCart() {
          this.loadingClearCart = true;
          this.errorMessage = false;
          fetch(window.Shopify.routes.root + 'cart/clear.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ "sections": Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id) })
          })
            .then((response) => response.json())
            .then((response) => {
              this.clearSuccess = true;
              Alpine.store('xCartHelper').reRenderSections(response.sections);
              Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
              document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
            })
            .catch((error) => {
              console.error('Error:', error);
            }).finally(() => {
              this.loadingClearCart = false;
            });
        },

        handleExpireAction() {
          switch (this.action) {
            case 'repeat_countdown':
              this.reset(this.countdownTime);
              this.clearInterval();
              this.startCountdown();
              break;
            case 'hide_message':
              if (document.getElementById('x-cart-countdown-timer')) {
                document.getElementById('x-cart-countdown-timer').style.display = 'none';
                this.clearLocalStorage();
              }
              break;
            case 'clear_cart':
              this.clearCart();
              break;
            default:
              console.error('Unknown action:', this.action);
          }
        },
      }));
    });
  });
}
