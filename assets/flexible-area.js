if (!window.Eurus.loadedScript.has('flexible-area.js')) {
    window.Eurus.loadedScript.add('flexible-area.js');
  
    requestAnimationFrame(() => {
      document.addEventListener('alpine:init', () => {
        Alpine.data('xFlexibleArea', () => ({
          initArea(el) {
            this.adjustFlexWidths(el);

            let resizeTimer;
            window.addEventListener('resize', () => {
              clearTimeout(resizeTimer);
              resizeTimer = setTimeout(() => {
                this.adjustFlexWidths(el);
              }, 50);
            });
          },

          adjustFlexWidths(container) {
            const isMobile = window.innerWidth <= 767;

            const items = Array.from(container.children).map(el => {
              const itemBlock = el.querySelector('.item-block');
              const itemWidth = parseFloat(isMobile ? itemBlock.dataset.widthMobile : itemBlock.dataset.width) || 1;
              return { el, itemWidth };
            });

            const style = getComputedStyle(container);
            const gap = parseFloat(style.columnGap || style.gap || 0);
            const containerWidth = container.getBoundingClientRect().width;

            let currentRow = [];
            let currentTotal = 0;

            items.forEach(({ el, itemWidth }) => {
              if (currentRow.length && currentTotal + itemWidth > 100) {
                this.applyRowWidths(currentRow, gap, containerWidth);
                currentRow = [{ el, itemWidth }];
                currentTotal = itemWidth;
              } else {
                currentRow.push({ el, itemWidth });
                currentTotal += itemWidth;
              }
            });

            // Last row
            this.applyRowWidths(currentRow, gap, containerWidth);
          },

          applyRowWidths(row, gap, containerWidth) {
            if (!row.length) return;

            const totalGap = gap * (row.length - 1);
            const usableWidth = 100 - (totalGap / containerWidth) * 100;

            row.forEach(({ el, itemWidth }) => {
              el.style.flex = `0 0 ${usableWidth * (itemWidth / 100)}%`;
            });
          }
        }));
      });
    });
  }