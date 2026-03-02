if (!window.Eurus.loadedScript.has('quick-order-list.js')) {
    window.Eurus.loadedScript.add('quick-order-list.js');

requestAnimationFrame(()=>{
  document.addEventListener("alpine:init", ()=>{
    Alpine.store('xQuickOrderList', {
      currentPage: 1,
      sectionId: '',
      productUrl: '',
      allListLoading: false,
      loading: false,
      cachedResults: [],
      init() {
        document.addEventListener(`eurus:quick-order-list:item:change`, ()=>{
          this.allListLoading = true;
          document.getElementById(`remove-all-loading`).classList.remove('hidden');
        });
        document.addEventListener(`eurus:cart:items-changed`, () => {
          this.reloadPage();
        })
      },
      initPagination(sectionId, productUrl) {
        this.sectionId = sectionId;
        this.productUrl = productUrl;
      },
      renderPage(html) {
        const src = html.getElementById('x-quick-order-list-container');
        const des = document.getElementById('x-quick-order-list-container');

        if (src && des) {
          des.innerHTML = src.innerHTML;
        }
      },
      reloadPage() {
        this.cachedResults = [];
        this.loadPage(this.currentPage, true, false);
      },
      loadPage(pageParam, reload = false, scroll = true) {
        this.loading = true
        let link = `${this.productUrl.split('?')[0]}?page=${Number(pageParam)}&section_id=${this.sectionId}`;
        Alpine.store('xHelper').cancelRequest('eurus:quick_order_list_request');
        if (this.cachedResults[link] && !reload) {
          const html = this.cachedResults[link];
          this.currentPage = Number(pageParam);
          if (scroll) {
            document.getElementById('x-quick-order-list-container').parentElement.scrollIntoView({ behavior: "smooth" });
          }
          this.loading = false;
          this.renderPage(html);
        } else {
          const controller = new AbortController();
          Alpine.store('xHelper').requestControllers.set('eurus:quick_order_list_request', controller);
          fetch(link, { signal: controller.signal })
            .then((response) => response.text())
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, 'text/html');
              this.renderPage(html);
              this.cachedResults[link] = html;
            }).catch(err => {
              if (err.name !== 'AbortError') {  
                console.error(err);
              }
            })
            .finally(() => {
              this.currentPage = Number(pageParam);
              if (scroll) {
                document.getElementById('x-quick-order-list-container').parentElement.scrollIntoView({ behavior: "smooth" });
              }
              this.loading = false;
            })
        }
      },
      async clearCart(listOfLineInCart){
        this.allListLoading = true;

        requestAnimationFrame(() => {
          setTimeout(() => {
            const updates = listOfLineInCart.reduce((acc, item) => {
              acc[item] = 0; 
              return acc;
            }, {});
            document.getElementById(`remove-all-loading`).classList.remove('hidden');
            let updateData = {
              'updates': updates,
              'sections': Alpine.store('xCartHelper').getSectionsToRender().map(s => s.id),
              'sections_url': window.location.pathname
            };
            fetch(`${Shopify.routes.root}cart/update.js`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updateData)
            }).then(response=>{
              return response.json();
            }).then(response=>{
              Alpine.store('xCartHelper').reRenderSections(response.sections);
              this.allListLoading = false
            }).finally(() => {
              Alpine.store('xQuickOrderList').reloadPage();
            })
          }, 0)
        });
      },
    });

    Alpine.data('xQuickOrderListItem', (variant, quantity)=>({
      loading: false,
      loadingMobile: false,
      async addToCart(e, variantId) {
        e.preventDefault();

        this.loading = true;
        this.loadingMobile = true;
        Alpine.store('xQuickOrderList').allListLoading = true;
        document.getElementById(`loading-${variantId}`).classList.remove('hidden');
        document.getElementById(`loading-mobile-${variantId}`).classList.remove('hidden');

        var productForm = this.$el.closest('.product-info') || this.$el.closest('form');
        let formData = new FormData(this.$refs.product_form);
        var edt_element = productForm ? productForm.querySelector(`.hidden.cart-edt-properties-${formData.get('product-id')}`) : null;
        if (edt_element) {
          edt_element.value = edt_element.value.replace("time_to_cut_off", Alpine.store('xEstimateDelivery').noti)
        }
        formData = new FormData(this.$refs.product_form);
        formData.append(
          'sections',
          Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id)
        );
        formData.append('sections_url', window.location.pathname);
        await fetch(`${Eurus.cart_add_url}`, {
          method:'POST',
          headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
          body: formData
        }).then(reponse => {
          return reponse.json();
        }).then(async (response) => {
          if (response.status == '422') {
            if (Alpine.store('xMiniCart')) {
              Alpine.store('xMiniCart').reLoad();
            }
          } else {
            Alpine.store('xPopup').close();
            Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
            Alpine.store('xCartHelper').reRenderSections(response.sections);
            document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
          }
        }).catch((error) => {
          console.error('Error:', error);
        }).finally(() => {
          Alpine.store('xQuickOrderList').reloadPage();
          this.loading = false;
          this.loadingMobile = false;
          Alpine.store('xQuickOrderList').allListLoading = false;
        }) 
      },
      updateQtyInCart(variantId, qty){
        this.loading = true;
        this.loadingMobile = true;

        let updateData = {
          'id': `${variantId}`,
          'quantity': `${qty}`,
          'sections': Alpine.store('xCartHelper').getSectionsToRender().map(s => s.id),
          'sections_url': window.location.pathname
        };

        document.getElementById(`loading-${variantId}`).classList.remove('hidden');
        document.getElementById(`loading-mobile-${variantId}`).classList.remove('hidden');

        fetch(`${Shopify.routes.root}cart/change.js`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }).then(response=>{
          return response.json();
        }).then(response=>{
          requestAnimationFrame(() => {
            setTimeout(() => {
              if (response.status == '422') {
                this._addErrorMessage(variantId, response.message);

                this.loading = false;
                this.loadingMobile = false;
                document.getElementById(`loading-${variantId}`).classList.add('hidden');
                document.getElementById(`loading-mobile-${variantId}`).classList.add('hidden');

                const input = document.getElementById(`quick-order-list-quantity-${ variant.id }`);
                input.value = quantity
                const inputMobile = document.getElementById(`quick-order-list-quantity-mobile-${ variant.id }`);
                inputMobile.value = quantity
              } else {
                Alpine.store('xPopup').close();
                Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
                Alpine.store('xCartHelper').reRenderSections(response.sections);
                document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
              }
            }, 0)
          });
        })
        .finally(() => {
          Alpine.store('xQuickOrderList').reloadPage();
        });
      },
      onChangeQuantity(e, inCart, el){
        const input = document.getElementById(`quick-order-list-quantity-${ variant.id }`);
        const inputMobile = document.getElementById(`quick-order-list-quantity-mobile-${ variant.id }`);
        input.value = el.value;
        inputMobile.value = el.value;
        if(inCart){
          this.updateQtyInCart(variant.id, el.value)
        }else{
          this.addToCart(e, variant.id)
        }  
      },
      removeItem(id){
        this.updateQtyInCart(id, 0);
        document.dispatchEvent(new CustomEvent(`eurus:quick-order-list:item:change`));
      },
      _addErrorMessage(id, message) {
        const lineItemError = document.getElementById(`LineItemError-${id}`);
        const lineItemErrorMobile = document.getElementById(`LineItemErrorMobile-${id}`);
        if (!lineItemError) return;
        if (!lineItemErrorMobile) return;
        lineItemError.classList.remove('hidden');
        lineItemError
          .getElementsByClassName('cart-item__error-text')[0]
          .innerHTML = message;
        lineItemErrorMobile.classList.remove('hidden');
        lineItemErrorMobile
          .getElementsByClassName('cart-item__error-text')[0]
          .innerHTML = message;
        
      },
      minus(e, inCart) {
        const input = document.getElementById(`quick-order-list-quantity-${ variant.id }`);
        const inputMobile = document.getElementById(`quick-order-list-quantity-mobile-${ variant.id }`);
        if(parseInt(input.value) <= 0 && parseInt(inputMobile.value) <= 0){
          input.value = 0,
          inputMobile.value = 0
        }else{
          input.value = parseInt(input.value) - 1,
          inputMobile.value = parseInt(inputMobile.value) - 1
          if(inCart){
            this.updateQtyInCart(variant.id, input.value || inputMobile.value)
          }else{
            this.addToCart(e, variant.id)
          }        
        }
      },
      plus(e, inCart) {
        const input = document.getElementById(`quick-order-list-quantity-${ variant.id }`);
        const inputMobile = document.getElementById(`quick-order-list-quantity-mobile-${ variant.id }`);
        input.value = parseInt(input.value) + 1,
        inputMobile.value = parseInt(inputMobile.value) + 1
        if(inCart){
          this.updateQtyInCart(variant.id, input.value || inputMobile.value)
        }else{
          this.addToCart(e, variant.id)
        }
      },
      handleKeydown(evt, el) {
        if (evt.key !== 'Enter') return;
        evt.preventDefault();
        el.blur();
        el.focus();
      },
      invalid(el) {
        number = parseFloat(el.value);
        if (!Number.isInteger(number) || number < 1) {
          el.value = 0;
        }
      },
    }))
  });
});
}