if (!window.Eurus.loadedScript.has('product-sibling.js')) {
  window.Eurus.loadedScript.add('product-sibling.js');

  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data("xProductSibling", (sectionId, isProductPage, redirect) => ({
        cachedResults: [],
        updateProductInfo(url) {
          if (redirect) {
            window.location.href = url;
            return
          }
          const link = isProductPage?`${url}`:`${url}?section_id=${sectionId}`;
      
          if (this.cachedResults[link]) {
            const html = this.cachedResults[link];
            this._handleSwapProduct(html);
          } else {
            fetch(link)
            .then((response) => response.text())
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, 'text/html');
              this._updateTitle(html);
              this._handleSwapProduct(html);
              this._updateFbtContainer(html)
              this.cachedResults[link] = html;
            })
          }
          this._updateURL(url);
        },
        changeSelectOption(event) {
          const input = event.target.selectedOptions[0];
          const targetUrl = input.dataset.productUrl;
          this.updateProductInfo(targetUrl);
        },
        _updateURL(url) {
          if (!isProductPage) return;
          window.history.replaceState({}, '', `${url}`);
        },
        _updateTitle(html) {
          if (!isProductPage) return;
          document.querySelector('head title').textContent = html.querySelector('.product-title').textContent;
          const destination = document.querySelector('#breadcrumbs--' + sectionId);
          const source = html.querySelector('#breadcrumbs--' + sectionId);
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        _updateFbtContainer(html) {
          if (!isProductPage) return;
          const destination = document.querySelector('#popup-fbt-' + sectionId);
          const source = html.querySelector('#popup-fbt-' + sectionId);
          if (source && destination) destination.outerHTML = source.outerHTML;
        },
        _handleSwapProduct(html) {
          const destination = isProductPage ? document.querySelector('.main-product'):document.querySelector('.x-product-' + sectionId);
          const source = isProductPage ? html.querySelector('.main-product') : html.querySelector('.x-product-' + sectionId);
          if (source && destination) destination.innerHTML = source.innerHTML;
        }
      }));
    });
  });
}