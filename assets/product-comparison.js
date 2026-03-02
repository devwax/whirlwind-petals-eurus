if (!window.Eurus.loadedScript.has('product-comparison.js')) {
  window.Eurus.loadedScript.add('product-comparison.js');
  
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xProductComparisonPopup', {
        loadTablet(el, url) {
          if(url) {
            fetch(url)
              .then(response => response.text())
              .then(text => {
                const html = document.createElement('div');
                html.innerHTML = text;
                const recommendations = html.querySelector('.product-comparison-table');
                if (recommendations && recommendations.innerHTML.trim().length) {
                  requestAnimationFrame(() => {
                    el.innerHTML = recommendations.innerHTML;
                    el.querySelectorAll('.content-tablet').forEach((item) => {
                      if (el.querySelector('.'+item.dataset.selectHtml)) {
                        el.querySelector('.'+item.dataset.selectHtml).innerHTML += item.innerHTML;
                      }
                    });
                  });
                }
              }).catch(e => {console.error(e);});
          } else {
            el.querySelectorAll('.content-tablet').forEach((item) => {
              if (el.querySelector('.'+item.dataset.selectHtml)) {
                el.querySelector('.'+item.dataset.selectHtml).innerHTML += item.innerHTML;
              }
            });
          }
        },
        loadMobile(el, url) {
          if (url) {
            fetch(url)
              .then(response => response.text())
              .then(text => {
                const html = document.createElement('div');
                html.innerHTML = text;
                const recommendationsMobile = html.querySelector('#product-comparison-table-mobile');
                if (recommendationsMobile && recommendationsMobile.innerHTML.trim().length) {
                  requestAnimationFrame(() => {
                    el.innerHTML = recommendationsMobile.innerHTML;
                  });
                }
              })
              .catch(e => {
                console.error(e);
              });
          }
        }
      });
      Alpine.data('xProductComparison', () => ({
        show: 1,
        openTabs: [],
        setOpenTab(tab) {
          if (this.openTabs.includes(tab)) {
            this.openTabs = this.openTabs.filter(t => t !== tab);
        } else {
            this.openTabs.push(tab);
        }
        },
        checkOpenTab(tab) {
          return this.openTabs.includes(tab);
        }
      }));
    })
  });
}