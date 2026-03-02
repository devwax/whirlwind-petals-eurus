if (!window.Eurus.loadedScript.has('testimonials-with-card.js')) {
  window.Eurus.loadedScript.add('testimonials-with-card.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xCardTestimonials', () => ({
        fadeInOut(element, isLeaving) {
          if (isLeaving) {
            cancelAnimationFrame(element.fadeRAF);
            return;
          }
            
          this.updateOpacity(element);
        },

        updateOpacity(element) {
          const parent = element.closest('.scroll-container');
          const rect = element.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
    
          const visibleHeight = Math.max(
            0,
            Math.min(rect.bottom, parentRect.bottom) - Math.max(rect.top, parentRect.top)
          );
    
          const visibility = visibleHeight / rect.height;
    
          element.style.opacity = visibility.toFixed(2);
    
          element.fadeRAF = requestAnimationFrame(() => (this.updateOpacity(element)));
        }
      }));
    });
  });
}