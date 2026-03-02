if (!window.Eurus.loadedScript.has('recently-viewed.js')) {
  window.Eurus.loadedScript.add('recently-viewed.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xProductRecently', {
        show: false,
        productsToShow: 0,
        productsToShowMax: 10,
        init() {
          if (document.getElementById('shopify-section-recently-viewed')) {
            this.productsToShow = document.getElementById('shopify-section-recently-viewed').getAttribute("x-products-to-show");
          }
        },
        showProductRecently() {
          if (localStorage.getItem("recently-viewed")?.length) {
            this.show = true;
          } else {
            this.show = false;
          }
        },
        setProduct(productViewed) {
          let productList = [];
          if (localStorage.getItem("recently-viewed")?.length) {
            productList = JSON.parse(localStorage.getItem("recently-viewed")); 
            productList = [...productList.filter(p => p !== productViewed)].filter((p, i) => i<this.productsToShowMax);
            this.show = true;
            let newData = [productViewed, ...productList];
            localStorage.setItem('recently-viewed', JSON.stringify(newData))
          } else {
            this.show = false;
            localStorage.setItem('recently-viewed', JSON.stringify([productViewed]));
          }
        },
        getProductRecently(sectionId, productId) {
          let products = [];
          if (localStorage.getItem("recently-viewed")?.length) {
            products = JSON.parse(localStorage.getItem("recently-viewed"));
            products = productId ? [...products.filter(p => p !== productId)] : products;
            products = products.slice(0,this.productsToShow);
          } else {
            return;
          }
          const el = document.getElementById("shopify-section-recently-viewed");
          let query = products.map(value => "id:" + value).join(' OR ');
          var search_url = `${Shopify.routes.root}search?section_id=${ sectionId }&type=product&q=${query}`;
          fetch(search_url).then((response) => {
            if (!response.ok) {
              var error = new Error(response.status);
              console.log(error)
              throw error;
            }
    
            return response.text();
          })
          .then((text) => {
            const resultsMarkup = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-recently-viewed').innerHTML;
            el.innerHTML = resultsMarkup;
          })
          .catch((error) => {
            throw error;
          });
        },
        clearStory() {
          var result = confirm('Are you sure you want to clear your recently viewed products?');
          if (result === true) {
            localStorage.removeItem("recently-viewed");
            this.show = false;
          }
        }
      })
    })
  });
}