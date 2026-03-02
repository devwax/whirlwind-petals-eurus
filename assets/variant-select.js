if (!window.Eurus.loadedScript.has('variant-select.js')) {
  window.Eurus.loadedScript.add('variant-select.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xVariantSelect', (
        element,
        sectionId,
        isProductPage,
        unavailableText,
        productUrl,
        optionNum,
        cloneSectionId = element.closest('.data-id-section-card') ? element.closest('.data-id-section-card').id : ''
      ) => ({
        loadingEls: '',
        currentVariant: {},
        cachedResults: [],
        handleSectionId: sectionId,
        mediaGallerySource: [],
        optionConnects: [],
        mediaOption: "",
        handleSticky: '',
        initfirstMedia: false,
        init() {
          Array.from(element.querySelectorAll('input')).forEach(input => {
            input.addEventListener('change', (e) => {
              setTimeout(() => { 
                this.updateVariantSelector(e.target.id, e.target.dataset.productUrl);
              }, 0);
            })
          });
          Array.from(element.querySelectorAll('select')).forEach(select => {
            select.addEventListener('change', (e) => {
              setTimeout(() => {
                Array.from(e.target.options).forEach(option => { option.removeAttribute('selected') });
                e.target.options[e.target.selectedIndex].setAttribute('selected', 'selected');
                this.updateVariantSelector(e.target.id, e.target.options[e.target.selectedIndex].dataset.productUrl);
              }, 0)
            })
          });
        },
        _dispatchVariantSelected(html) {
          document.dispatchEvent(new CustomEvent(`eurus:product-page-variant-select:updated:${sectionId}`, {
            detail: { html: html }
          }));
        },
        _dispatchUpdateVariant(html="") {
          document.dispatchEvent(new CustomEvent(`eurus:product-card-variant-select:updated:${sectionId}`, {
            detail: {
              currentVariant: this.currentVariant,
              html: html
            }
          }));
        },
        _renderDestination(html, selector) {
          const destination = document.getElementById(selector + sectionId);
          const source = html.getElementById(selector + sectionId);
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        _goToSelectedVariantMedia() {
          let splideEl = document.getElementById("x-product-" + sectionId);
          let slideVariant = ""
          let index = ""
          let activeEL = ""
          if (this.currentVariant !== undefined && this.currentVariant?.featured_media !== undefined) {
            slideVariant = document.getElementsByClassName(this.currentVariant.featured_media.id + '-' + sectionId);
            index = parseInt(slideVariant[0]?.getAttribute('index'));
            activeEL = document.getElementById('postion-image-' + sectionId + '-' + this.currentVariant.featured_media.id);
          } else {
            slideVariant = splideEl.querySelector(".featured-image");
            index = parseInt(slideVariant?.getAttribute('index'));
            activeEL = document.querySelector(`#stacked-${sectionId} .featured-image`);
          }
          
          if (splideEl) {
            if (splideEl.splide && slideVariant) {
              splideEl.splide.go(index)
            } else {
              document.addEventListener(`eurus:media-gallery-ready:${sectionId}`, () => {
                if (splideEl.splide)
                  splideEl.splide.go(index);
              });
            }
          }

          return activeEL;
        },
        _updateMedia(html) {
          let mediaWithVariantSelected = document.getElementById("product-media-" + sectionId) && document.getElementById("product-media-" + sectionId).dataset.mediaWithVariantSelected;
          
          if (!mediaWithVariantSelected) {
            let activeEL = this._goToSelectedVariantMedia();
            if (!activeEL) return;

            if (html && !mediaWithVariantSelected) {
              let mediaGalleryDestination = html.getElementById(`stacked-${ sectionId }`);
              let mediaGallerySource = document.getElementById(`stacked-${ sectionId }`);

              if (mediaGallerySource && mediaGalleryDestination) {
                let firstChildSource = mediaGallerySource.querySelectorAll('div[data-media-id]')[0];
                let firstChildDestination = mediaGalleryDestination.querySelectorAll('div[data-media-id]')[0];
                if (firstChildDestination.dataset.mediaId != firstChildSource.dataset.mediaId && firstChildSource.dataset.index != 1) {
                  let sourceIndex = parseInt(firstChildSource.dataset.index);  
                  let positionOld = mediaGallerySource.querySelector(`div[data-media-id]:nth-of-type(${sourceIndex + 1})`);
                  mediaGallerySource.insertBefore(firstChildSource, positionOld);
                }

                mediaGallerySource.prepend(activeEL);
              }
            }
          }
          if (mediaWithVariantSelected) {
            this.updateMultiMediaWithVariant();
          }
        },
        _validateOption() {
          const mediaWithOption = document.querySelector(`#shopify-section-${sectionId} [data-media-option]`);
          if (mediaWithOption)
            this.mediaOption = mediaWithOption.dataset.mediaOption.split('_');
        },
        updateMultiMediaWithVariant() {
          this._validateOption();
          if (!this.currentVariant) {
            if (this.initfirstMedia) {
              let productMedia = document.querySelectorAll( `#ProductModal-${ sectionId } [data-media-option], #shopify-section-${ sectionId } [data-media-option]`);
              Array.from(productMedia).reverse().forEach(function(newMedia, position) {
                newMedia.classList.add('media_active');
                if (newMedia.classList.contains('media-slide')) {
                  newMedia.classList.add('splide__slide');
                }
              });
            }
            return;
          }
          const variantInputs = this.mediaOption.map(option =>
            document.querySelector(`#shopify-section-${sectionId} [data-option-name="${option}"]`)
          ).filter(el => el !== null);
          if (variantInputs.length === 0) {
            let variantMedias = ""
            if (!this.currentVariant?.featured_media?.id) {
              variantMedias = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-option].featured-image, #shopify-section-${ sectionId } [data-media-option].featured-image`); 
            } else {
              variantMedias = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-option="${sectionId}-${this.currentVariant?.featured_media?.id}"], #shopify-section-${ sectionId } [data-media-option="${sectionId}-${this.currentVariant?.featured_media?.id}"]`);
            }
            let mediaActive = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-option=""], #shopify-section-${ sectionId } [data-media-option=""]`);
            let productMedias = document.querySelectorAll( `#ProductModal-${ sectionId } [data-media-option], #shopify-section-${ sectionId } [data-media-option]`);
            const newMedias = Array.prototype.concat.call( ...mediaActive, ...variantMedias)
            this._setActiveMedia(productMedias, newMedias, variantMedias);

            let splideEl = document.getElementById(`x-product-${ sectionId }`);
            if (splideEl.splide) {
              splideEl.splide.refresh();
              splideEl.splide.go(0);
            }
            let splideZoomEl = document.getElementById(`media-gallery-${ sectionId }`);
            if (splideZoomEl.splide) {
              splideZoomEl.splide.refresh();
            }
          } else {
            let optionConnects = [];
            variantInputs.forEach((variantInput) => {
              const variantOptionIndex = variantInput && variantInput.dataset.optionIndex;
              const optionValue = this._handleText(this.currentVariant?.options[variantOptionIndex]);
              if (this.mediaOption.includes(variantInput.dataset.optionName)) {
                optionConnects.push(variantInput.dataset.optionName + '-' + optionValue);
              }
              this.optionIndex = variantOptionIndex;
            });
            const mediaActive = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-type=""], #shopify-section-${ sectionId } [data-media-type=""]`);
            
            let variantMedias = [];
            let allVariantMedias = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-type]:not([data-media-type=""]), #shopify-section-${ sectionId } [data-media-type]:not([data-media-type=""])`);
            allVariantMedias.forEach((variantMedia) => {
              let data = variantMedia.getAttribute('data-media-type');
              let dataSet = new Set(data.split('_'));
              if (optionConnects.filter(option => dataSet.has(option)).length === dataSet.size) variantMedias.push(variantMedia);
            });

            let showFeatured = false;
            if (!variantMedias.length) {
              if (!this.currentVariant?.featured_media?.id) {
                variantMedias = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-option].featured-image, #shopify-section-${ sectionId } [data-media-option].featured-image`); 
                showFeatured = true;
              } else {
                variantMedias = document.querySelectorAll(`#ProductModal-${ sectionId } [data-media-id="${sectionId}-${this.currentVariant?.featured_media?.id}"], #shopify-section-${ sectionId } [data-media-id="${sectionId}-${this.currentVariant?.featured_media?.id}"]`);
              }
            }
            if (!variantMedias.length) {
              document.querySelectorAll( `#ProductModal-${ sectionId } [data-media-type], #shopify-section-${ sectionId } [data-media-type]`).forEach(function(media){
                media.classList.add('media_active');
                media.classList.add('splide__slide');
              });
              let splideEl = document.getElementById(`x-product-${ sectionId }`);
              if (splideEl.splide) {
                splideEl.splide.refresh();
                splideEl.splide.go(0);
              }
              let splideZoomEl = document.getElementById(`media-gallery-${ sectionId }`);
              if (splideZoomEl.splide) {
                splideZoomEl.splide.refresh();
              }
              return;
            }
            
            const newMedias = Array.prototype.concat.call(...variantMedias , ...mediaActive);
            let productMedias = document.querySelectorAll( `#shopify-section-${ sectionId } [data-media-type], #ProductModal-${ sectionId } [data-media-type]`);
            
            this._setActiveMedia(productMedias, newMedias);
            
            if (this.optionConnect != optionConnects) {
              this.optionConnect = optionConnects;
            }
            
            let splideEl = document.getElementById(`x-product-${ sectionId }`);
            if (splideEl.splide) {
              splideEl.splide.refresh();
              splideEl.splide.go(0);
            }
            let splideZoomEl = document.getElementById(`media-gallery-${ sectionId }`);
            if(splideZoomEl && splideZoomEl.splide){
              splideZoomEl.splide.refresh();
            }
            
            if (showFeatured) {
              this._goToFirstSlide();
            }  
          }
        },
        _setActiveMedia(productMedias, newMedias, activeMedia) {
          productMedias.forEach(function(media){
            media.classList.remove('media_active');
            media.classList.remove('splide__slide');
            media.classList.remove('x-thumbnail');
          });
          Array.from(newMedias).reverse().forEach(function(newMedia, position) {
            newMedia.classList.add('media_active');
            if (newMedia.classList.contains('media-thumbnail')) {
              newMedia.classList.add('x-thumbnail');
            }
            if (newMedia.classList.contains('media-slide')) {
              newMedia.classList.add('splide__slide');
            }
            let parent = newMedia.parentElement;
            if (activeMedia) {
              if (parent.firstChild != newMedia && Array.from(activeMedia).includes(newMedia)) {
                parent.prepend(newMedia);
              }
            } else {
              if (parent.firstChild != newMedia) {
                parent.prepend(newMedia);
              }
            }
          });

          if (activeMedia) {
            let parent = activeMedia.parentElement;
            parent && parent.prepend(activeMedia);
          }
        },
        _handleText(someString) {
          if (someString) {
            return someString.toString().replace('ı', 'i').replace('ß', 'ss').normalize('NFC').replace('-', ' ').toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, "-");
          }
        },
        _goToFirstSlide() {
          if (this.currentVariant && !this.currentVariant.featured_image) {
            let splideEl = document.getElementById("x-product-" + sectionId);
            if (splideEl) {
              if (splideEl.splide && this.currentVariant && this.currentVariant.featured_image != null) {
                splideEl.splide.go(0);
              }
            }

            let activeEL = document.querySelector(`#stacked-${sectionId} .featured-image`);
            let stackedEL = document.getElementById('stacked-' + sectionId);
            if(stackedEL && activeEL) stackedEL.prepend(activeEL);
          }
        },
        _updateProductForms() {
          const productForms = document.querySelectorAll(`#product-form-${sectionId}, #product-form-installment-${sectionId}, #product-form-sticky-${sectionId}`);
          productForms.forEach((productForm) => {
            const input = productForm.querySelector('input[name="id"]');
            if (input) {
              input.value = this.currentVariant?.id;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        },
        _renderPriceProduct(html) {
          const destination = document.getElementById('price-' + sectionId);
          let source = html.getElementById('price-' + sectionId);
          if (!this.currentVariant) {
            destination?.classList.add('hidden');
            return;
          } else {
            destination?.classList.remove('hidden');
          }
          if(!source) {
            source = html.querySelector('.price');
            if (source && destination) destination.innerHTML = source.outerHTML;
          } else {
            if (source && destination) destination.innerHTML = source.innerHTML;
          }
        },
        _renderBuyButtons(html) {
          const productForms = document.querySelectorAll(`#product-form-${sectionId}, #product-form-installment-${sectionId}, #product-form-sticky-${sectionId}`);
          
          productForms.forEach((productForm) => {
            const atcSource = html.querySelector(`#${productForm.getAttribute("id")} .add_to_cart_button`);
            const atcDestination = productForm.querySelector('.add_to_cart_button');
            if (!atcDestination) return;

            if (atcSource && atcDestination) atcDestination.innerHTML = atcSource.innerHTML;
    
            if (this.currentVariant?.available) {
              /// Enable add to cart button
              atcDestination.dataset.available = "true";
              if (html.getElementById('form-gift-card-' + sectionId)) {
                if (document.getElementById('Recipient-checkbox-' + sectionId).checked && document.getElementById('recipient-form-' + sectionId).dataset.disabled == "true") {
                  atcDestination.setAttribute('disabled', 'disabled') 
                } else {
                  atcDestination.removeAttribute('disabled');
                }
              } else {
                atcDestination.removeAttribute('disabled');
              }
            } else {
              atcDestination.dataset.available = "false";
              atcDestination.setAttribute('disabled', 'disabled');
            }

            const cloneProductForms = document.querySelectorAll(`#product-form-${cloneSectionId}, #product-form-installment-${cloneSectionId}, #product-form-sticky-${cloneSectionId}`);
            cloneProductForms.forEach((cloneProductForm) => {
              if (cloneProductForm.getAttribute("id").includes(productForm.getAttribute("id"))){
                const atcCloneDestination = cloneProductForm.querySelector('.add_to_cart_button');
                if (!atcCloneDestination) return;

                if (atcSource && atcCloneDestination) atcCloneDestination.innerHTML = atcSource.innerHTML;
        
                if (this.currentVariant?.available) {
                  /// Enable add to cart button
                  atcCloneDestination.dataset.available = "true";
                  if (html.getElementById('form-gift-card-' + sectionId)) {
                    if (document.getElementById('Recipient-checkbox-' + sectionId).checked && document.getElementById('recipient-form-' + sectionId).dataset.disabled == "true") {
                      atcCloneDestination.setAttribute('disabled', 'disabled') 
                    } else {
                      atcCloneDestination.removeAttribute('disabled');
                    }
                  } else {
                    atcCloneDestination.removeAttribute('disabled');
                  }
                } else {
                  atcCloneDestination.dataset.available = "false";
                  atcCloneDestination.setAttribute('disabled', 'disabled');
                }
              }
            })

          });
          const paymentButtonDestination = document.getElementById('x-payment-button-' + sectionId);
          const paymentButtonSource = html.getElementById('x-payment-button-' + sectionId);
          if (paymentButtonSource && paymentButtonDestination) {
            if (paymentButtonSource.classList.contains('hidden')) {
              paymentButtonDestination.classList.add('hidden');
            } else {
              paymentButtonDestination.classList.remove('hidden');
            }
          }
        },
        _setMessagePreOrder(html) {
          const msg = document.querySelector(`.pre-order-${sectionId}`);
          if (!msg) return;
          msg.classList.add('hidden');
          const msg_pre = html.getElementById(`pre-order-${sectionId}`);
          if (msg_pre) {
            msg.classList.remove('hidden');
            msg.innerHTML = msg_pre.innerHTML;
          }
        },
        _setEstimateDelivery(html) {
          const est = document.getElementById(`x-estimate-delivery-container-${sectionId}`);
          if (!est) return;
          const est_res = html.getElementById(`x-estimate-delivery-container-${sectionId}`);
          if (est_res.classList.contains('disable-estimate')) {
            est.classList.add('hidden');
          } else {
            est.classList.remove('hidden');
            est.innerHTML = est_res.innerHTML;
          }

          const estimateDeliveryCart = document.querySelectorAll(`.cart-edt-${sectionId}`);
          const estimateDeliveryCartUpdate = html.querySelectorAll(`.cart-edt-${sectionId}`);
          if (estimateDeliveryCart.length > 0 && estimateDeliveryCartUpdate.length > 0) {
            estimateDeliveryCart.forEach((item, index) => {
              if(estimateDeliveryCartUpdate[index] != undefined && estimateDeliveryCartUpdate[index].innerHTML != undefined ){
                item.innerHTML = estimateDeliveryCartUpdate[index].innerHTML;
              }
            })
          }
        },
        _setMetafieldInfo(html, query) {
          const content_arr = document.querySelectorAll(`${query}-${sectionId}`);
          const content_res_arr = html.querySelectorAll(`${query}-${sectionId}`);
          if (content_arr.length > 0 && content_res_arr.length > 0) {
            content_arr.forEach((toc, index) => {
              toc.innerHTML = content_res_arr[index].innerHTML;
            })
          }
        },
        _setBackInStockAlert(html) {
          const destination = document.getElementById(`back_in_stock_alert-${sectionId}`);
          const source = html.getElementById(`back_in_stock_alert-${sectionId}`);
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        _setPickupPreOrder(html) {
          const pickup = document.getElementById(`pickup-pre-order-${sectionId}`);
          if (!pickup) return;
          const pickup_res = html.getElementById(`pickup-pre-order-${sectionId}`);
          if (pickup_res.classList.contains('disable-pickup')) {
            pickup.classList.add('hidden');
          } else {
            pickup.classList.remove('hidden');
          }
        },
        _setUnavailable() {
          const selectors = ['price-sticky-', 'block-inventory-', 'x-badges-', 'pickup-', 'sku-', 'back_in_stock_alert-'];
          for (let selector of selectors) {
            const element = document.getElementById(selector + sectionId);
            if (element) element.classList.add('hidden');
          }
          
          const msg_pre = document.querySelector(`.pre-order-${sectionId}`);
          if (msg_pre) msg_pre.classList.add('hidden');
          const quantity = document.getElementById('x-quantity-' + sectionId);
          if (quantity) quantity.classList.add('unavailable');

          this._setBuyButtonUnavailable();
        },
        _setAvailable() {
          const selectors = ['block-inventory-', 'x-badges-', 'pickup-', 'sku-', 'back_in_stock_alert-'];
          for (let selector of selectors) {
            const element = document.getElementById(selector + sectionId);
            if (element) element.classList.remove('hidden');
          }
          const quantity = document.getElementById('x-quantity-' + sectionId);
          if (quantity) quantity.classList.remove('unavailable');
        },
        _setBuyButtonUnavailable() {
          const productForms = document.querySelectorAll(`#product-form-${sectionId},  #product-form-sticky-${sectionId}`);
          productForms.forEach((productForm) => {
            const addButton = productForm.querySelector('.add_to_cart_button');
            if (!addButton) return;
            addButton.setAttribute('disabled', 'disabled');
            const addButtonText = addButton.querySelector('.x-atc-text');
            if (addButtonText) addButtonText.textContent = unavailableText;
          });
        },
        initEventSticky() {
          document.addEventListener(`eurus:product-page-variant-select-sticky:updated:${sectionId}`, (e) => {
            this.handleSticky = e.detail.variantElSticky;
            this.updateVariantSelector(-1, e.detail.targetUrl);
          });
        },
        _getCurrentVariant(html) {
          this.currentVariant = JSON.parse(html.querySelector(`.variant-selects-main script[type="application/json"][data-selected-variant]`).textContent);
        },
        updateVariantSelector(inputId, target) {
          let updateFullpage = false;
          let callback = () => {};
          
          const targetUrl = target || element.dataset.url;
          if (element.dataset.url !== targetUrl) {
            if (isProductPage) {
              updateFullpage = true;
            }
            callback = (html) => {
              this._getCurrentVariant(html);
              this._setAvailable();
              this._updateURL(targetUrl);
              this._handleSwapProduct(sectionId, html, updateFullpage);
              this._handleSwapQuickAdd(html);
              this._renderCardBundle(html);
              this._renderCardFBT(html);
              this._dispatchUpdateVariant(html);
              this._dispatchVariantSelected(html);
            };
          } else {
            callback = (html) => {
              this._getCurrentVariant(html);
              this._setAvailable();
              this._updateURL(targetUrl);
              this._updateProductForms();
              this._handleUpdateProductInfo(html);
              this._updateOptionValues(html);
              this._updateMedia(html);
              this._handleAvailable(html);
              this._dispatchUpdateVariant(html);
              this._dispatchVariantSelected(html);
            }
          }
          this._renderProductInfo(targetUrl, callback, updateFullpage, inputId);
        },
        _renderProductInfo(url, callback, updateFullpage, inputId) {
          let link = "";
          const selectedOptionValues = this._getSelectedOptionValues();
          if (selectedOptionValues.length < optionNum) {
            return;
          }
          let params = `option_values=${selectedOptionValues.join(',')}`;
          link = updateFullpage?`${url}?${params}`:`${url}?section_id=${this.handleSectionId}&${params}`;
          Alpine.store('xHelper').cancelRequest('eurus:product_info_request');
          if (this.cachedResults[link]) {
            const html = this.cachedResults[link];
            callback(html);
          } else {
            window.requestAnimationFrame(() => {
              this.loadingEls = inputId;
            });
            const controller = new AbortController();
            Alpine.store('xHelper').requestControllers.set('eurus:product_info_request', controller);
            fetch(link, { signal: controller.signal })
              .then((response) => response.text())
              .then((responseText) => {
                const html = new DOMParser().parseFromString(responseText, 'text/html');
                callback(html);
                this.cachedResults[link] = html;
              })
              .catch(err => {
                if (err.name !== 'AbortError') {
                  console.error(err);
                }
              })
              .finally(() => {
                this.loadingEls = '';
              });
          }
          this.handleSticky = '';
        },
        _handleUpdateProductInfo(html) {
          this._renderCardBundle(html);
          this._renderCardFBT(html);
          this._renderPriceProduct(html);
          const selectors = ['product-variant-title-', 'x-block-product-score-', 'block-button-', 'product-description-block-', 'block-inventory-', 'block-available-quantity-', 'quantity-selector-', 'volume-', 'sku-', 'x-badges-', 'preorder-', 'cart-edt-'];
          for (let selector of selectors) {
            this._renderDestination(html, selector);
          }
          this._renderBuyButtons(html);
          this._setMessagePreOrder(html);
          this._setEstimateDelivery(html);
          
          const mtfSelectors = ['.properties_re_render', '.table_info_details', '.block-text', '.text-icon', '.collapsible-content', '.nutrition-bar-content', '.horizontab', '.featured-icon'];
          for (let selector of mtfSelectors) {
            this._setMetafieldInfo(html, selector);
          }
          this._setPickupPreOrder(html);
          this._setBackInStockAlert(html);
          Alpine.store('xUpdateVariantQuanity').render(html, this.handleSectionId);
          this._dispatchUpdateVariant(html);
          this._dispatchVariantSelected(html);
          this._updateOptionValues(html);
          Alpine.store('xPickupAvailable').updatePickUp(sectionId, this.currentVariant?.id);
        },
        initFirstAvailableVariant(el) {
          this.currentVariant = JSON.parse(el.querySelector(`script[type="application/json"][data-selected-variant]`).textContent);
          document.addEventListener('eurus:cart:items-changed', () => {
            this.cachedResults = [];
            Alpine.store('xUpdateVariantQuanity').updateQuantity(sectionId, productUrl, this.currentVariant?.id);
          });
        },
        _handleAvailable(html) {
          const selectedVariant = html.querySelector('.variant-selects-main [data-selected-variant]')?.innerHTML;
          if (selectedVariant == 'null') {
            this._setUnavailable();
          }
        },
        _updateOptionValues(html) {
          const variantSelects = html.querySelector('.variant-selects-main');
          if (variantSelects) {
            element.innerHTML = variantSelects.innerHTML;
            const inputs = element.querySelectorAll('input');
            Array.from(inputs).forEach(input => {
              if (input.dataset.valueSelected === 'true') input.checked = true;
              input.addEventListener('change', (e) => {
                setTimeout(() => { 
                  this.updateVariantSelector(e.target.id, e.target.dataset.productUrl);
                }, 0);
              });
            });
            Array.from(element.querySelectorAll('select')).forEach(select => {
              select.addEventListener('change', (e) => {
                setTimeout(() => {
                  Array.from(e.target.options).forEach(option => { option.removeAttribute('selected') });
                  e.target.options[e.target.selectedIndex].setAttribute('selected', 'selected');
                  this.updateVariantSelector(e.target.id, e.target.options[e.target.selectedIndex].dataset.productUrl);
                }, 0)
              });
            });
          }
        },
        _getVariantData(inputId) {
          return JSON.parse(this._getVariantDataElement(inputId).textContent);
        },
        _getVariantDataElement(inputId) {
          return element.querySelector(`script[type="application/json"][data-resource="${inputId}"]`);
        },
        _updateURL(url) {
          if (!isProductPage) return;
          window.history.replaceState({}, '', `${url}${this.currentVariant?.id ? `?variant=${this.currentVariant?.id}` : ''}`);
        },
        _getSelectedOptionValues() {
          if (this.handleSticky == '') {
            return Array.from(element.querySelectorAll('select option[selected], fieldset input:checked')).map(
              (e) => e.dataset.optionValueId
            ).filter(id => id !== undefined);
          } else {
            return Array.from(this.handleSticky.querySelectorAll('select option[selected]')).map(
              (e) => e.dataset.optionValueId
            ).filter(id => id !== undefined);
          }
        },
        _renderCardBundle(html) {
          const destination = element.closest(".x-product-bundle-data");
          const card = html.getElementById('card-product-bundle-'+ this.handleSectionId);
          if (card) {
            const source = card.querySelector(".x-product-bundle-data");
            if (source && destination) destination.innerHTML = source.innerHTML;
          }
        },
        _renderCardFBT(html) {
          const destination = element.closest(".card-product-fbt");
          const source = html.querySelector('.card-product-fbt-clone .card-product-fbt');
          
          if (source && destination) destination.innerHTML = source.innerHTML;
        },
        _handleSwapProduct(sectionId, html, updateFullpage) {
          if (updateFullpage) {
            document.querySelector('head title').innerHTML = html.querySelector('head title').innerHTML;
            const destination = document.querySelector('main');
            const source = html.querySelector('main');
            if (source && destination) destination.innerHTML = source.innerHTML;
          } else {
            const destination = document.querySelector('.x-product-' + sectionId);
            const source = html.querySelector('.x-product-' + sectionId);
            if (source && destination) destination.innerHTML = source.innerHTML;
          }
        },
        _handleSwapQuickAdd(html) {
          const destination = element.closest(".choose-options-content");
          const source = html.querySelector('.choose-options-content');
          if (source && destination) destination.innerHTML = source.innerHTML;
        }
      }))
    });
  });

  
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xPickupAvailable', {
        cachedResults: [],
        updatePickUp(id, variantId) {
          const container = document.getElementsByClassName('pick-up-'+ id)[0];
          if (!container) return;

          const link = window.Shopify.routes.root + `variants/${variantId}/?section_id=pickup-availability`;
          Alpine.store('xHelper').cancelRequest('eurus:pickup_availability_request');
          if (this.cachedResults[link]) {
            container.innerHTML = this.cachedResults[link].innerHTML;
          } else {
            const controller = new AbortController();
            Alpine.store('xHelper').requestControllers.set('eurus:pickup_availability_request', controller);
            fetch(link, { signal: controller.signal })
            .then(response => response.text())
            .then(text => {
              const pickupAvailabilityHTML = new DOMParser()
                .parseFromString(text, 'text/html')
                .querySelector('.shopify-section');  
              this.cachedResults[link] = pickupAvailabilityHTML;
              container.innerHTML = pickupAvailabilityHTML.innerHTML;
            })
            .catch(e => {
              console.error(e);
            }); 
          }
        }
      });
    });
  });
  
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xUpdateVariantQuanity', {
        cachedResults: [],
        updateQuantity(sectionId, productUrl, currentVariant) {
          const quantity = document.getElementById('x-quantity-' + sectionId);
          const pricingPB = document.getElementById('x-pricing-progress-bar-' + sectionId);
          if (!quantity && !pricingPB) return;
          const url = currentVariant ? `${productUrl}?variant=${currentVariant}&section_id=${sectionId}` : `${productUrl}?section_id=${sectionId}`;
          Alpine.store('xHelper').cancelRequest('eurus:variant_quantity_request');
          if (this.cachedResults[url]) {
            this.render(this.cachedResults[url], sectionId);
          } else {
            const controller = new AbortController();
            Alpine.store('xHelper').requestControllers.set('eurus:variant_quantity_request', controller);
            fetch(url, { signal: controller.signal })
              .then((response) => response.text())
              .then((responseText) => {
                let html = new DOMParser().parseFromString(responseText, 'text/html');
                this.cachedResults[url] = html;
                this.render(html, sectionId);
              });
          }
        },
        render(html, sectionId) {
          const destination = document.getElementById('x-quantity-' + sectionId);
          const source = html.getElementById('x-quantity-'+ sectionId);
          if (source && destination) destination.innerHTML = source.innerHTML;

          const destinationPricingPB = document.getElementById('x-pricing-progress-bar-' + sectionId);
          const sourcePricingPB = html.getElementById('x-pricing-progress-bar-' + sectionId);
          if (sourcePricingPB && destinationPricingPB) destinationPricingPB.innerHTML = sourcePricingPB.innerHTML;     
        }
      });
    });
  });
}