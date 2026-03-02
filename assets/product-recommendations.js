if (!window.Eurus.loadedScript.has('product-recommendations.js')) {
  window.Eurus.loadedScript.add('product-recommendations.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xProductRecommendations', {
        loading: false,
        listOfUpsellProducts: [],
        el: '',
        listUpsellId: [],
        productCount: 0,
        async loadUpsell(el, url, listId, limit, maxItems) {
          this.el = el;
          this.loading = true;
          this.listOfUpsellProducts = [];
          this.productCount = 0;
          this.listUpsellId = [];         
          for (let i = 0; i < listId.length; i++) {
            if (this.productCount >= maxItems) {
              break;
            }    
            try {
              const response = await fetch(`${url}&product_id=${listId[i]}&limit=${limit}&intent=related`);
              const text = await response.text();
              const html = document.createElement('div');
              html.innerHTML = text;
              const des = document.querySelector('.cart-upsell-carousel');
              const src = html.querySelector('.cart-upsell-carousel')
              if(src && des) des.innerHTML = src.innerHTML
              const recommendations = html.querySelector('.product-recommendations');
      
              if (recommendations && recommendations.innerHTML.trim().length) {
                const newUpsellProducts = recommendations.querySelectorAll('template[x-teleport="#cart-upsell-drawer"], template[x-teleport="#cart-upsell"]');
                this.listOfUpsellProducts = [...newUpsellProducts, ...this.listOfUpsellProducts];
      
                for (let index = 0; index < this.listOfUpsellProducts.length; index++) {
                  if (this.productCount >= maxItems) {
                    break;
                  }
                  
                  const element = this.listOfUpsellProducts[index];
                  const elementId = new DOMParser().parseFromString(element.innerHTML, 'text/html').querySelector('.hover-text-link, .link-product-variant').id;
                  
                  if (!this.listUpsellId.includes(elementId)) {
                    this.listUpsellId.push(elementId);
                    el.appendChild(element);
                    this.productCount++;
                  }
                }
      
                if (recommendations.classList.contains('main-product')) {
                  el.className += ' mb-4 md:mb-6 border-y border-solid accordion empty:border-b-0';
                }
              } else if (recommendations && recommendations.classList.contains('main-product')) {
                recommendations.classList.add("hidden");
                el.innerHTML = recommendations.innerHTML;
              }
            } catch (e) {
              console.error(e);
            } finally {
              this.loading = false;
            }
          }
        },
        load(el, url) {
          this.loading = true;
          fetch(url)
            .then(response => response.text())
            .then(text => {
              const html = document.createElement('div');
              html.innerHTML = text;
              const recommendations = html.querySelector('.product-recommendations');
              if (recommendations && recommendations.innerHTML.trim().length) {
                requestAnimationFrame(() => {
                  el.innerHTML = recommendations.innerHTML;
                });
                if (recommendations.classList.contains('main-product')) {
                  el.className += ' mb-4 md:mb-6 border-y border-solid accordion empty:border-b-0';
                }
              } else if (recommendations.classList.contains('main-product')) {
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    recommendations.classList.add("hidden");
                    el.innerHTML = recommendations.innerHTML;
                  }, 0)
                });
              }
            })
            .finally(() => {
              this.loading = false;
            }) 
            .catch(e => {
              console.error(e);
            });
        }
      });      
    });
  });
}