if (!window.Eurus.loadedScript.has('scrolling-promotion.js')) {
  window.Eurus.loadedScript.add('scrolling-promotion.js');
  
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xScrollPromotion', () => ({
        animationFrameId: null,
        window_height: window.innerHeight,
        load(el) {      
          const container = el.getElementsByClassName('scrolling-container')[0];
          const item = container.getElementsByClassName('el_animate')[0];
          const frag = document.createDocumentFragment();

          for (let i = 0; i < 5; i++) {
            const clone = item.cloneNode(true);
            frag.appendChild(clone);
          }
          container.appendChild(frag);

          let scroll = el.getElementsByClassName('el_animate');
          for (let i = 0; i < scroll.length; i++) {
            scroll[i].classList.add('animate-scroll-banner');
          }
        },

        createObserver(el, rtlCheck = false) {
          const option = {
            root: null,
            rootMargin: '300px',
            threshold: 0
          };

          const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                this.updateRotation(el, rtlCheck)
              } else {
                if (this.animationFrameId) {
                  cancelAnimationFrame(this.animationFrameId);
                  this.animationFrameId = null;
                }
              }
            });
          }, option);

          observer.observe(el);
        },

        updateRotation(el, rtlCheck = false) {
          const update = () => {
            const element = el.firstElementChild;
            if (!element) return;

            const element_rect = element.getBoundingClientRect();
            const element_height = element_rect.top + element_rect.height / 2;
            let value;
              
            if (element_height > -200 && element_height < this.window_height + 200) {
              value = Math.max(Math.min((((element_height / this.window_height) * 10) - 5), 5), -5);
              if (rtlCheck) value *= -1;
              element.style.transform = `rotate(${value}deg) translateX(-20px)`;
            }

            this.animationFrameId = window.requestAnimationFrame(update);
          }

          if (!this.animationFrameId) {
            update();
          }
        },
      }));
    })
  });
}    