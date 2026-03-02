if (!window.Eurus.loadedScript.has('product-cart.js')) {
  window.Eurus.loadedScript.add('product-cart.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xProductCart', (
        wrappringVariantId,
        engravingVariantId,
      ) => ({
        loading: false,
        errorMessage: false,
        mainHasError: false,
        buttonSubmit: "",
        error_message_wrapper: {},
        stopAction: false,
        insuranceVariantId: '',
        loadInsurance(id) {
          if (this.insuranceVariantId == '') {
            this.insuranceVariantId = id;
          }
        },
        scrollToAtcBtn(btnId) {
          const originalAtcBtn = document.querySelector(`#${btnId}`);
          originalAtcBtn.scrollIntoView({
            behavior: "smooth",
            block: 'center',
            inline: 'center'
          })
        },
        async addToCart(e, required, quickView, sticky) {
          this.loading = true;         
          e.preventDefault();

          setTimeout(async () => {
            if (required) {
              var productInfo = this.$el.closest('.product-info');
              if(sticky){
                productInfo = document.querySelector('.product-info');
              }
              if (productInfo) {
                var propertiesInput = productInfo.querySelectorAll(`.customization-picker`);
                this.stopAction = false;
                let scrollStatus = false;
                
                propertiesInput.length && propertiesInput.forEach((input) => {
                  if (input.required && input.value.trim() == '' || input.classList.contains("validate-checkbox")) {
                    input.classList.add("required-picker");
                    this.stopAction = true;
                    if(!scrollStatus){
                      input.parentElement.querySelector('.text-required').scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                      scrollStatus = true;
                    }    
                  } else {
                    input.classList.remove("required-picker");
                  }                
                });              
              }
              if (this.stopAction) {
                setTimeout (() => {
                  this.loading = false;
                }, 500);
                return true;
              }
            }
            await Alpine.store('xCartHelper').waitForCartUpdate();
            window.updatingCart = true;

            if (this.$refs.engraving_text && engravingVariantId) {
              if (this.$refs.engraving_text.value.trim()) {
                if (!this.$refs.engraving_text.hasAttribute('name')) this.$refs.engraving_text.setAttribute('name', this.$refs.text_area_name.value);
              } else {
                if (this.$refs.engraving_text.hasAttribute('name')) this.$refs.engraving_text.removeAttribute('name');
              }
            }

            var productForm = this.$el.closest('.product-info') || this.$el.closest('form');
            let formData = new FormData(this.$refs.product_form);
            const productId = formData.get('product-id');
            var edt_element = productForm ? productForm.querySelector(`.hidden.cart-edt-properties-${productId}`) : null;
            if (edt_element) {
              edt_element.value = edt_element.value.replace("time_to_cut_off", Alpine.store('xEstimateDelivery').noti)
            }
            formData = new FormData(this.$refs.product_form);

            formData.append(
              'sections',
              Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id)
            );
            formData.append('sections_url', window.location.pathname);
            const newFormData = new FormData();
            for (let [key, value] of formData.entries()) {
              if (value !== '') {
                newFormData.append(key, value);
              }
            }

            const match = document.cookie.match('(^|;)\\s*' + 'eurus_insurance' + '\\s*=\\s*([^;]+)');
            const linkedProductList = newFormData.getAll('properties[_linked_product_id][]');

            if (
              (this.$refs.gift_wrapping_checkbox && this.$refs.gift_wrapping_checkbox.checked && wrappringVariantId) || 
              (this.$refs.engraving_text && engravingVariantId && this.$refs.engraving_text.value.trim()) || 
              (this.insuranceVariantId && !localStorage.getItem('insuranceRemoved') && (!match || match[1].trim() === '')) || 
              (linkedProductList.length > 0)
            ) {
              const variantId = formData.get('id');
              const productTitle = productForm ? productForm.querySelector(`.product-variant-title-${formData.get('product-id')}-${variantId}`)?.textContent : null
              let additionalOptionData = [];
              if (this.$refs.gift_wrapping_checkbox && this.$refs.gift_wrapping_checkbox.checked && wrappringVariantId) {
                additionalOptionData.push(
                  {
                    id: wrappringVariantId,
                    quantity: 1,
                    parent_id: variantId,
                    properties: {
                      "For": productTitle
                    }
                  }
                );
              }
              if (linkedProductList.length > 0) {
                linkedProductList.forEach(val => {
                  additionalOptionData.push(
                    {
                      id: val,
                      quantity: 1,
                      parent_id: variantId,
                      properties: {
                        "For": productTitle
                      }
                    }
                  );
                });
              }
              if (this.$refs.engraving_text && engravingVariantId && this.$refs.engraving_text.value.trim()) {
                additionalOptionData.push(
                  {
                    id: engravingVariantId,
                    quantity: 1,
                    parent_id: variantId,
                    properties: {
                      "For": productTitle
                    }
                  }
                );
              }
              if (this.insuranceVariantId && !localStorage.getItem('insuranceRemoved') && (!match || match[1].trim() === '')) {
                additionalOptionData.push(
                  {
                    id: this.insuranceVariantId,
                    quantity: 1
                  }
                );
              }
              if (additionalOptionData.length !== 0) {
                additionalOptionData.forEach((item, index) => {
                  const base = `items[${index}]`;

                  newFormData.append(`${base}[id]`, item.id);
                  newFormData.append(`${base}[quantity]`, item.quantity);

                  if (item.parent_id) {
                    newFormData.append(`${base}[parent_id]`, item.parent_id);
                  }

                  if (item.properties) {
                    Object.entries(item.properties).forEach(([key, value]) => {
                      newFormData.append(`${base}[properties][${key}]`, value);
                    })
                  }
                })
              }
            }

            let resProductId;
            let productUrl;

            await fetch(`${Eurus.cart_add_url}`, {
              method:'POST',
              headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
              body: newFormData
            }).then(reponse => {
              return reponse.json();
            }).then(async (response) => {
              if (response.status == '422') {
                if (typeof response.errors == 'object') {
                  this.error_message_wrapper = response.errors;
                  document.querySelector('.recipient-error-message').classList.remove('hidden');
                } else {
                  this.errorMessage = true;
                  setTimeout(() => {
                    this.errorMessage = false;
                  }, 3000);
                  if(this.$refs.error_message){
                    this.$refs.error_message.textContent = response.description;
                  }
                  if(this.$refs.error_message_mobile){
                    this.$refs.error_message_mobile.textContent = response.description;
                  }
                }
                if (Alpine.store('xMiniCart')) {
                  Alpine.store('xMiniCart').reLoad();
                  document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
                }
              } else {  
                resProductId = response.product_id;
                productUrl = response.url.split("?")[0];

                if (Alpine.store('xCartNoti') && Alpine.store('xCartNoti').enable) {
                  Alpine.store('xCartNoti').setItem(response); 
                }
                document.querySelector('.recipient-error-message') ? document.querySelector('.recipient-error-message').classList.add('hidden') : '';
                this.error_message_wrapper = {};
      
                if (Alpine.store('xQuickView') && Alpine.store('xQuickView').show) {
                  Alpine.store('xQuickView').show = false;
                }
                Alpine.store('xPopup').close();
                document.dispatchEvent(new CustomEvent("eurus:video-popup:close-popup"));
                if((quickView && Alpine.store('xQuickView').buttonQuickView && Alpine.store('xQuickView').buttonQuickView.dataset.addAsBundle) || (!quickView && this.$refs.product_form && this.$refs.product_form.querySelector('[data-add-as-bundle="true"]'))) {
                  document.dispatchEvent(new CustomEvent("eurus:cart:add-as-bundle"));
                } else {
                  Alpine.store('xCartHelper').reRenderSections(response.sections);
                  if (!Alpine.store('xCartNoti') || !Alpine.store('xCartNoti').enable) {
                    Alpine.store('xMiniCart').openCart();
                  }               
                  Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
                  if (Alpine.store('xQuickView')) {
                    Alpine.store('xQuickView').openPopupMobile = false;
                  }
                  this.$el.closest('.choose-options')?.getElementsByClassName('js-close-button')[0].click();
                  this.$el.closest('.js-product-container')?.getElementsByClassName('js-close-button')[0].click();
                  document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
                  document.dispatchEvent(new CustomEvent("eurus:cart:redirect"));
                }
              }
            }).catch((error) => {
              console.error('Error:', error);
            }).finally(() => {
              window.updatingCart = false;
              document.dispatchEvent(new CustomEvent(`eurus:product-card:clear:${resProductId}`));
              this.loading = false;
              if ((quickView && Alpine.store('xQuickView').buttonQuickView && !Alpine.store('xQuickView').buttonQuickView.dataset.addAsBundle) || (!quickView && this.$refs.product_form && !this.$refs.product_form.querySelector('[data-add-as-bundle="true"]'))) {
                if(this.$refs.gift_wrapping_checkbox) this.$refs.gift_wrapping_checkbox.checked = false;
              }
              document.cookie = `eurus_insurance=${this.insuranceVariantId}; path=/`;  
            })
          }, 0)
        }
      }))
    });
  });
}
