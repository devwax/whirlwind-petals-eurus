if (!window.Eurus.loadedScript.has('discount-progress-bar.js')) {
  window.Eurus.loadedScript.add('discount-progress-bar.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xDiscountBar', (goals) => ({
        index: [0],
        passedGoal: 0,
        aheadGoal: -1,
        lastGoal: 0,
        setOrder() {
          const sortedGoals = goals.toSorted((a, b) => a - b);
          this.lastGoal = sortedGoals[sortedGoals.length - 1];
          const indexMap = new Map();
          for (let j = 0; j < sortedGoals.length; j++) {
            indexMap.set(sortedGoals[j], j + 1);
          }

          for (let i = 0; i < goals.length; i++) {
            const idx = indexMap.get(goals[i]);
            if (idx !== undefined) this.index.push(idx);
          }
        },
        setGoal(qty) {
          this.passedGoal = 0;
          this.aheadGoal = -1;
          
          const sortedGoals = goals.toSorted((a, b) => a - b);
          
          for (let i = 0; i < sortedGoals.length; i++) {
            if (qty < sortedGoals[i]) {
              this.aheadGoal = sortedGoals[i];
              break;
            }
            this.passedGoal = sortedGoals[i];
          }
        },
        calculateWidth(el, qty, goal, index, rtl_check = false) {
          if (this.passedGoal === this.lastGoal) {
            el.classList.add('passed-goal');
            el.parentElement.classList.add('full');
            return;
          }
          const parentRect = el.parentElement.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();

          let elPost;
          let barWidth;

          if (rtl_check) {
            elPost = window.innerWidth - ((elRect.right - elRect.left) / 2 + elRect.left);
            barWidth = elPost - (window.innerWidth - parentRect.right);
          } else {
            elPost = (elRect.right - elRect.left) / 2 + elRect.left;
            barWidth = elPost - parentRect.left;
          }

          el.style.setProperty('--before-width', `${barWidth}px`);

          if (qty >= goal) {
            el.style.setProperty('--after-width', `${barWidth}px`);
            el.classList.add('passed-goal');
          } else {
            this.$nextTick(() => {
              this.calculatePartialWidth(el, qty, goal, index);
            });
          }
        },
        calculatePartialWidth(el, qty, goal, index) {
          if (goal !== this.aheadGoal) return;

          const prevGoal = el.parentElement.getElementsByClassName(`bar-item-${index - 1}`)[0];
          let prevAfterWidth = prevGoal ? parseFloat(prevGoal.style.getPropertyValue('--after-width')) || 0 : 0;

          const elRect = el.getBoundingClientRect();
          const beforeWidth = parseFloat(el.style.getPropertyValue('--before-width')) || 0;
          const afterWidth = prevAfterWidth + ((qty - this.passedGoal) / (goal - this.passedGoal)) * (beforeWidth - prevAfterWidth);

          el.classList.add('partial');
          el.style.setProperty('--after-width', `${afterWidth}px`);
          el.style.setProperty('--after-left', `${-(beforeWidth - elRect.width / 2 - afterWidth)}px`);
        },
        updateProgressBar(sectionId, productUrl, currentVariant) {
          const progressBar = document.getElementById('discount-progress-bar-' + sectionId);
          if (!progressBar) return;
          const url = currentVariant ? `${productUrl}?variant=${currentVariant}&section_id=${sectionId}` :
                        `${productUrl}?section_id=${sectionId}`;
          fetch(url)
            .then((response) => response.text())
            .then((responseText) => {
              let html = new DOMParser().parseFromString(responseText, 'text/html');
              this.render(html, sectionId);
            });
        },
        render(html, sectionId) {
          const destination = document.getElementById('discount-progress-bar-' + sectionId);
          const source = html.getElementById('discount-progress-bar-'+ sectionId);
          if (source && destination) destination.innerHTML = source.innerHTML;
        }
      }));
    });
  });
}