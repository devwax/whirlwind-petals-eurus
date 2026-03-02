if (!window.Eurus.loadedScript.has('image-comparison.js')) {
  window.Eurus.loadedScript.add('image-comparison.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xImageComparison', (sectionId, layout) => ({
        load(e) {
          if (layout == "horizontal") {
            this.$refs.image.style.setProperty('--compare_' + sectionId, e.target.value + '%');
          } else {
            this.$refs.image.style.setProperty('--compare_vertical_' + sectionId, 100 - e.target.value + '%');
          }
        },
        resizeWindow(el) {
          addEventListener("resize", () => {
            this.setMinMaxInput(el, layout);
          });
        },
        disableScroll(el) {
          let isfocus = true;
          window.addEventListener('wheel', () => {
            if (isfocus) {
              el.blur();
              isfocus = false;
            }
          });
        },
        setMinMaxInput(el) {
          el.min = 0;
          el.max = 100;
        },
        animateValue(el) {
          const targetValue = parseFloat(el.value);
          let currentHorizontalValue = 100;
          let currentVerticalValue = 0; 
          const totalDuration = 1000;
          let startTime = null; 
        
          const easeInOutSlowEnd = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        
          const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsedTime = timestamp - startTime;
            const progress = Math.min(elapsedTime / totalDuration, 1);
        
            const easedProgress = easeInOutSlowEnd(progress);
        
            if (layout === "horizontal") {
              currentHorizontalValue = 100 + (targetValue - 100) * easedProgress; 
              el.value = currentHorizontalValue.toFixed(2);
              this.$refs.image.style.setProperty('--compare_' + sectionId, currentHorizontalValue + '%');
        
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                el.value = targetValue; 
                this.$refs.image.style.setProperty('--compare_' + sectionId, targetValue + '%');
              }
            } else {
              currentVerticalValue = 0 + (targetValue - 0) * easedProgress; 
              el.value = currentVerticalValue.toFixed(2);
              this.$refs.image.style.setProperty('--compare_vertical_' + sectionId, currentVerticalValue + '%');
        
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                el.value = targetValue;
                this.$refs.image.style.setProperty('--compare_vertical_' + sectionId, targetValue + '%');
              }
            }
          };
        
          requestAnimationFrame(step);
        }        
      }));
    });
  });
}