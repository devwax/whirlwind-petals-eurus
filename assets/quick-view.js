requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xQuickView', {
      sectionId: window.xQuickView.sectionId,
      enabled: window.xQuickView.enabled,
      buttonLabel: window.xQuickView.buttonLabel,
      show_atc_button: window.xQuickView.show_atc_button,
      btn_atc_bottom: window.xQuickView.atc_btn_bottom,
      atc_btn_image_desktop: window.xQuickView.atc_btn_image_desktop,
      show: false,
      loading: false,
      currentVariant: '',
      cachedResults: [],
      cachedfetch: [],
      loadingUrls: [],
      loadedChooseOptions: [],
      loadedChooseOptionsID: [],
      selected: false,
      loadingChooseOption: false,
      isMiniCart: false,
      buttonQuickView: "",
      addListener() {
        document.addEventListener('eurus:cart:items-changed', () => {
          this.cachedResults = [];
        });
      },
      showBtn(enable, showATCButton, textBtn) {
        this.enabled = enable;
        this.buttonLabel = textBtn;
        this.show_atc_button = showATCButton;
      },
      load(url, el, optionId) {
        this.loading = true;

        requestAnimationFrame(() => {
          setTimeout(() => { 
            if (this.buttonQuickView == '') {
              this.buttonQuickView = el;
            }
            let variant = document.getElementById('current-variant-' + optionId)?.innerText;
            let productUrl = variant?`${url}?variant=${variant}&section_id=${this.sectionId}`:`${url}?section_id=${this.sectionId}`;
            productUrl = productUrl.replace(/\s+/g, '');
            
            if (this.cachedResults[productUrl]) {
              document.getElementById('quickview-product-content').innerHTML = this.cachedResults[productUrl];
              this.loading = false;
              return true;
            }
            
            if (this.cachedfetch[productUrl]) {
              return true;
            }

            this.cachedfetch[productUrl] = true;
            fetch(productUrl)
              .then(reponse => {
                return reponse.text();
              })
              .then((response) => {
                const parser = new DOMParser();
                const content = parser.parseFromString(response,'text/html').getElementById("quickview-product-content").innerHTML;
                document.getElementById('quickview-product-content').innerHTML = content;
                this.cachedResults[productUrl] = content;
              })
              .finally(() => {
                this.loading = false;
                this.cachedfetch[productUrl] = false;
              })

            return true;
          }, 0)
        });
      },
      async loadChooseOptions(url, el, optionId, index) {
        setTimeout(async () => { 
          let getVariant = document.getElementById('current-variant-' + optionId)?.innerText;
          let urlProduct = `${url}?section_id=choose-option&page=${index}`;
          
          let destinationElm = document.getElementById('choose-options-' + optionId)?.querySelector('.choose-options');
          let destinationElmMobile = document.getElementById('choose-options-mobile');
          let loadingEl = document.getElementById('choose-options-' + optionId)?.querySelector('.icon-loading');
          
          if (this.loadedChooseOptions[urlProduct]) {
            if (window.innerWidth > 767) {
              if (!el.closest('.card-product').querySelector('#choose-options-' + optionId)?.querySelector('.choose-options-content')) {
                destinationElm && (destinationElm.innerHTML = this.loadedChooseOptions[urlProduct]);
                destinationElmMobile && (destinationElmMobile.innerHTML = '');  
              }
              if (destinationElm) {
                if (destinationElm.querySelector(".add_to_cart_button")) {
                  destinationElm.querySelector(".add_to_cart_button").style.display="block";
                }
                if (destinationElm.querySelector(".label-btn-quickview")) {
                  destinationElm.querySelector(".label-btn-quickview").style.display="none";
                }
              }
            } else {
              if (!el.closest('.card-product').querySelector('#choose-options-mobile')) {
                destinationElmMobile && (destinationElmMobile.innerHTML = this.loadedChooseOptions[urlProduct]);
                destinationElm && (destinationElm.innerHTML = '');
              }
              if (destinationElmMobile) {
                if (destinationElmMobile.querySelector(".add_to_cart_button")) {
                  destinationElmMobile.querySelector(".add_to_cart_button").style.display="block";
                }
                if (destinationElmMobile.querySelector(".label-btn-quickview")) {
                  destinationElmMobile.querySelector(".label-btn-quickview").style.display="none";
                }
              }
            }
            return true;
          }
          
          try {
            if (loadingEl) {
              loadingEl.classList.remove('hidden');
            }
            this.loadingChooseOption = true;
            if (!this.loadingUrls.includes(urlProduct)) {
              this.loadingUrls.push(urlProduct);
              await fetch(urlProduct).then((response) => response.text()).then((content) => {
                const parser = new DOMParser();
                const parsedContent = parser.parseFromString(content, 'text/html').getElementById("choose-options-content").innerHTML;
                
                if (parsedContent) {
                  if (window.innerWidth > 767) {
                    destinationElmMobile && (destinationElmMobile.innerHTML = '');
                    destinationElm && (destinationElm.innerHTML = parsedContent);
                  } else {
                    destinationElmMobile && (destinationElmMobile.innerHTML = parsedContent);
                    destinationElm && (destinationElm.innerHTML = '');
                  }
                  this.loadedChooseOptions[urlProduct] = parsedContent;
                }
                if (loadingEl) {
                  loadingEl.classList.add('hidden');
                }  
              }).finally(() => {
                const index = this.loadingUrls.indexOf(urlProduct);
                if (index !== -1) this.loadingUrls.splice(index, 1);  
                if (window.innerWidth > 767) {
                  if (destinationElm) {
                    if (destinationElm.querySelector(".add_to_cart_button")) {
                      destinationElm.querySelector(".add_to_cart_button").style.display="block";
                    }
                    if (destinationElm.querySelector(".label-btn-quickview")) {
                      destinationElm.querySelector(".label-btn-quickview").style.display="none";
                    }
                  }
                } else {
                  if (destinationElmMobile) {
                    if (destinationElmMobile.querySelector(".add_to_cart_button")) {
                      destinationElmMobile.querySelector(".add_to_cart_button").style.display="block";
                    }
                    if (destinationElmMobile.querySelector(".label-btn-quickview")) {
                      destinationElmMobile.querySelector(".label-btn-quickview").style.display="none";
                    }
                  }
                }      
              });
            }
            this.loadingChooseOption = false;
          } catch (error) {
            console.log(error);
          }
        }, 0)
      },
      open(isMiniCart = false) {
        this.show = true;
        this.isMiniCart = isMiniCart;
        Alpine.store('xPopup').open = true;
      },
      close() {
        this.show = false;
        this.buttonQuickView = '';
        if(!Alpine.store('xMiniCart').open) {
          Alpine.store('xPopup').close();
        }
      },
      focusQuickView(quickView, btnClose) {
        if ( !this.selected ) { 
          Alpine.store('xFocusElement').trapFocus(quickView, btnClose);
        }
      },
      removeFocusQuickView() {
        if ( !this.selected ) { 
          const elementActive = document.getElementById("button_quickview");
          Alpine.store('xFocusElement').removeTrapFocus(elementActive);
        }
      },
      closePopupMobile() {
        this.openPopupMobile = false;
      },
      showChooseOption(id, el) {
        this.openPopupMobile = true;
        const product = el.closest(".card-product");
        const addToCartBtn = product.querySelector('.choose-options')?.querySelector('.add_to_cart_button');
        const iconAddToCartBtn = product.querySelector('.choose-options')?.querySelector('.label-btn-quickview')
        const addToCartBtnMobile = document.querySelector('.choose-options-mobile')?.querySelector('.add_to_cart_button');
        const iconAddToCartBtnMobile = document.querySelector('.choose-options-mobile')?.querySelector('.label-btn-quickview')

        if(addToCartBtn && iconAddToCartBtn && window.innerWidth > 767){
          addToCartBtn.style.display="block"
          iconAddToCartBtn.style.display="none"
        }else if(addToCartBtnMobile && iconAddToCartBtnMobile){
          addToCartBtnMobile.style.display="block"     
          iconAddToCartBtnMobile.style.display="none"
        }       
      },
      clickInsideQuickView(evt, $el) {
        if(this.isMiniCart) {
          evt.stopPropagation();
          this.show = false;
          Alpine.store('xPopup').close();
        }
      },
      clickInsideContentQuickView(evt) {
        evt.stopPropagation();
      }
    });
  });
});