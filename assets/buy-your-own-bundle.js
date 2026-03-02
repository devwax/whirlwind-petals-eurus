if (!window.Eurus.loadedScript.has('buy-your-own-bundle.js')) {
window.Eurus.loadedScript.add('buy-your-own-bundle.js');

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data('xBuyOwnBundle', (
      sectionId,
      pageParam,
      el,
      shopCurrency,
      sectionLayout,
      sectionBlockSize,
      goal1, goal2, goal3,
      goal1Label, goal2Label, goal3Label,
      goal1DiscountType, goal2DiscountType, goal3DiscountType,
      goal1DiscountValue, goal2DiscountValue, goal3DiscountValue,
      goal1DiscountOncePerOrder, goal2DiscountOncePerOrder, goal3DiscountOncePerOrder, 
      prevMsg,
      caculateDiscountType,
      currentCurrency
    ) => ({
      sectionId: sectionId,
      pageParam: pageParam,
      currentTab: 1,
      loading: false,
      stepTitleEl: [],
      loaded: [],
      productsBundle: [],
      errorMessage: false,
      addToCartButton: "",
      openList: false,
      openBundleSum: false,
      totalPrice: Alpine.store('xHelper').formatMoney(0, shopCurrency),
      totalDiscount: 0,
      amountPrice: 0,
      currentDiscountReached: {},
      prevGoalMsg: prevMsg,
      allGoalReached: false,
      loadDiscountBar: true,
      loadPrevGoalMsg: true,
      initByob() {
        this.addToCartButton = document.getElementById(`button-atc-${sectionId}`);
        this.handleProductsBundle();
      },
      handleATBButton() {
        const maxAllowed = document.getElementById(`step-max-condition-${sectionId}-${this.currentTab}`).textContent;
        const currentStepProductsInBundle = JSON.parse(JSON.stringify(this.productsBundle)).filter(item => item.current_step == this.currentTab);
        const currentStepProducts = document.getElementById(`byop-content-${sectionId}-${this.currentTab}`);
        if (maxAllowed > 0) {
          if (currentStepProductsInBundle.length >= maxAllowed) {       
            [...currentStepProducts.getElementsByClassName('x-atb-button')].forEach((button) => {
              button.setAttribute("disabled", "");
            })
          } else {
            currentStepProductsInBundle.forEach((item)=>{
              const itemATBButton = currentStepProducts.getElementsByClassName(`card-info-${item.product_id}`)[0].getElementsByClassName('x-atb-button')[0];
              const variantId = currentStepProducts.getElementsByClassName(`card-info-${item.product_id}`)[0].querySelector('input[type="hidden"][name="id"]').value;
              if (item.isAddOnce) {
                if (item.id == variantId) {
                  itemATBButton.setAttribute("disabled", "");
                }
              }    
            })
          }
        }
      },
      handleProductsBundle() {
        document.addEventListener('eurus:product-card-update', (e) => {
          this.handleATBButton();
        });
        document.addEventListener(`eurus:byob:add-to-bundle-${sectionId}`, (event) => {
          if (this.productsBundle.length > 0) {
            if (window.innerWidth >= 768) {
              this.openList = true;
            }
            this.openBundleSum = true;
          }
        });
        this.$watch('productsBundle', () => {
          this.handleATBButton();         
          document.dispatchEvent(new CustomEvent(`eurus:product-bundle:productsList-changed-${sectionId}`, {
            detail: {
              productsBundle: this.productsBundle
            }
          }));
        });
        this.updateProgressBar();
      },
      select(index) {
        this.currentTab = index;
        this.scrollToTitle(index);
      },
      scrollToTitle(index) {
        const index0 = index - 1;
        const inline = index0 === 0 ? "start" : index0 === this.stepTitleEl.length - 1 ? "end" : "center";
        
        this.stepTitleEl[index0].scrollIntoView({ behavior: "smooth", inline: inline, container: "nearest" });
        window.requestAnimationFrame(() => {
          this.stepTitleEl[index0].closest('.x-container-byob').scrollIntoView({ behavior: "smooth", block: "center" })
        })
      },
      loadData(index) {
        const selectedPage = index - 1;
        if (!this.loaded.includes(selectedPage)) {
          this.loading = true;
          
          let url = `${window.location.pathname}?section_id=${this.sectionId}&${this.pageParam}=${index}`;
          fetch(url, {
            method: 'GET'
          }).then(
            response => response.text()
          ).then(responseText => {
            const html = (new DOMParser()).parseFromString(responseText, 'text/html');
            const contentProductsId = `byop-content-${this.sectionId}-${index}`;
            const newContentProducts = html.getElementById(contentProductsId);

            const contentPromotionId = `byop-promotion-${this.sectionId}-${index}`;
            const newContentPromotion = html.getElementById(contentPromotionId);

            const contentContainer = document.getElementById(`x-byob-content-${this.sectionId}`)
            
            const target = contentContainer.getElementsByClassName('x-block-bundle-summary')[0];
            if (target) {
              if (newContentPromotion && !document.getElementById(contentPromotionId)) {
                contentContainer.insertBefore(newContentPromotion, target);
              }
              if (newContentProducts && !document.getElementById(contentProductsId)) {
                contentContainer.insertBefore(newContentProducts, target);
              }
            } else {
              if (newContentPromotion && !document.getElementById(contentPromotionId)) {
                contentContainer.appendChild(newContentPromotion);
              }
              if (newContentProducts && !document.getElementById(contentProductsId)) {
                contentContainer.appendChild(newContentProducts);
              }
            }
            this.loaded.push(selectedPage);
            this.loading = false;
          })
        }
      },
      scrollToStepContainer(element) {
        const stepContainer = element.closest('.section-byob').getElementsByClassName('step-title-container')[0];        
        if (stepContainer) {
          stepContainer.scrollIntoView({ behavior: 'smooth', block: 'center'})
        }
      },
      _getSelectedValueId(el) {
        return el.querySelector("select option[selected][value], fieldset input:checked")?.dataset.optionValueId;
      },
      _getCurrentVariantEl(el) {
        return el.querySelector(`script[type="application/json"][data-option-value-id='${this._getSelectedValueId(el)}']`);
      },
      _getCurrentVariable(el) {
        return JSON.parse(this._getCurrentVariantEl(el)?.textContent);
      },
      async handleAddToCart(el) {
        this.loading = true;
        await Alpine.store('xCartHelper').waitForCartUpdate();
        window.updatingCart = true;

        setTimeout(() => { 
          let items = JSON.parse(JSON.stringify(this.productsBundle));
          items = items.reduce((data, product) => {
            data[product.id] ? data[product.id].quantity += product.quantity : data[product.id] = product;
            return data;
          }, {});
          
          fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body:  JSON.stringify({ "items": items, "sections":  Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id) })
          }).then((response) => {
            return response.json();
          }).then((response) => {

            document.dispatchEvent(new CustomEvent(`eurus:product-bundle:products-changed-${sectionId}`, {
              detail: {
                productsBundle: Object.values(items),
                el: el.closest(".product-bundler-wrapper")
              }
            }));

            if (response.status == '422') {
              const errorMessage = el.closest('.bundler-sticky').getElementsByClassName('cart-warning')[0];

              this.errorMessage = true;
              if (errorMessage) {
                errorMessage.textContent = response.description;
              }
              return;
            }
            this.errorMessage = false;
            Alpine.store('xCartHelper').reRenderSections(response.sections);
            if (Alpine.store('xQuickView') && Alpine.store('xQuickView').show) {
              Alpine.store('xQuickView').show = false;
            }
            Alpine.store('xPopup').close();
            if (Alpine.store('xCartNoti') && Alpine.store('xCartNoti').enable) {
              Alpine.store('xCartNoti').setItem(response); 
            } else {
              Alpine.store('xMiniCart').openCart();
              document.dispatchEvent(new CustomEvent("eurus:cart:redirect"));
            }
            Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
            document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
          })
          .catch((error) => {
            console.error('Error:', error);
          }).finally(() => {
            window.updatingCart = false;
            this.loading = false;
            this.productsBundle = [];
            this.totalDiscount = 0;
            this.amountPrice = 0;
            this.currentDiscountReached = {};
            this.updateProgressBar();
            this.updateSplide();
            this.totalPrice = Alpine.store('xHelper').formatMoney(0, shopCurrency);
            this.addToCartButton.setAttribute('disabled', 'disabled');
          })
        }, 0)
      },
      addToBundle(el, productId, productUrl, hasVariant, name_edt, isAddOnce) {
        let productsBundle = JSON.parse(JSON.stringify(this.productsBundle))
        const blockId = el.closest(".x-product-bundle-data").getElementsByClassName("step-block-id")[0].textContent;
        const productName = el.closest(".x-product-bundle-data").getElementsByClassName("product-name")[0].textContent;
        const currentStep = el.closest(".x-product-bundle-data").getElementsByClassName("current-step")[0].textContent;
        const currentVariant = hasVariant ? this._getCurrentVariable(el.closest(".x-product-bundle-data")) : JSON.parse(el.closest(".x-product-bundle-data").querySelector(`script[type='application/json'][data-id='${productId}']`).textContent);
        const price = !hasVariant && JSON.parse(el.closest(".x-product-bundle-data").getElementsByClassName("current-price")[0]?.textContent);
        const featured_image = currentVariant.featured_image ? currentVariant.featured_image.src : el.closest(".x-product-bundle-data").getElementsByClassName("featured-image")[0].textContent;
        const edtElement = el.closest(".x-product-bundle-data").getElementsByClassName(`hidden cart-edt-properties-${productId}`)[0];
        let shippingMessage = '';
        if(edtElement){
          shippingMessage = edtElement.value.replace("time_to_cut_off", Alpine.store('xEstimateDelivery').noti);
        }
        const preorderElement = el.closest(".x-product-bundle-data").getElementsByClassName('hidden preorder-edt-properties')[0];
        let preorderMessage = '';
        if(preorderElement){
          preorderMessage = preorderElement.value;
        }
        
        const properties = {
          ...(name_edt && shippingMessage && { [name_edt]: shippingMessage }),
          ...(preorderMessage && { Preorder: preorderMessage }),
        };

        let newProductsBundle = [];
        let newItem = hasVariant ? { ...currentVariant, title: currentVariant.title.replaceAll("\\",""), product_id: productId, current_step: currentStep, isAddOnce: isAddOnce, blockId: blockId, product_name: productName, productUrl: `${productUrl}?variant=${currentVariant.id}`, featured_image: featured_image, quantity: 1, "properties": properties} : { id: currentVariant.id, product_id: productId, blockId: blockId, current_step: currentStep, isAddOnce: isAddOnce, product_name: productName, productUrl: productUrl, featured_image: featured_image, quantity: 1, price: price, "properties": properties }
        
        newProductsBundle = [...productsBundle , newItem];
        this.productsBundle = newProductsBundle;
        this.errorMessage = false;
        document.dispatchEvent(new CustomEvent(`eurus:byob:add-to-bundle-${sectionId}`, {
          detail: {
            newProduct: newItem
          }
        }));
        this.updateProgressBar();
        this.updateBundleContent(newProductsBundle, blockId)      
      },
      removeBundle(el, itemId, itemStep) {
        let itemRemove = this.productsBundle.find(
          (itemBundle) => itemBundle.id === itemId && itemBundle.current_step === itemStep
        );
        let newProductsBundle = this.productsBundle.filter((item) => item != itemRemove)
        this.productsBundle = newProductsBundle;
        const blockId = el.closest(".bundler-product-list-item").getElementsByClassName("step-block-id")[0].textContent;
        this.updateProgressBar();
        this.updateBundleContent(newProductsBundle, blockId);

        document.dispatchEvent(new CustomEvent(`eurus:product-bundle:remove-item-${sectionId}`, {
          detail: {
            item: itemRemove,
            el: el
          }
        }));
      },
      updateBundleContent(productsBundle, blockId) {
        let total = productsBundle.map(item => item.price).reduce((total, item) => total + item, 0);
        if (this.currentDiscountReached) {
          let discount = 0;
          let totalDiscount = 0;
          if (!Number.isNaN(this.currentDiscountReached.discountValue)) { 
            discount = Number(this.currentDiscountReached.discountValue);

            if (this.currentDiscountReached.discountType == 'percentage' && Number.isInteger(discount) && discount > 0 && discount < 100) {
              totalDiscount = Math.ceil(total - total * discount / 100);
            }

            if (this.currentDiscountReached.discountType == 'fixed_amounts' && discount > 0) {
              discount = (Number.parseFloat(this.currentDiscountReached.discountValue)).toFixed(2);
              if (this.currentDiscountReached.discountOncePerOrder) {
                totalDiscount = total - discount * Shopify.currency.rate * 100;
              } else {
                totalDiscount = total - this.productsBundle.length * discount * Shopify.currency.rate * 100;
              }
            }

            if (totalDiscount > 0) {
              let amount = total - totalDiscount;
              this.amountPrice = Alpine.store('xHelper').formatMoney(amount, shopCurrency);
              this.totalDiscount = Alpine.store('xHelper').formatMoney(totalDiscount, shopCurrency);
            } else {
              if (discount) {
                if (this.currentDiscountReached.discountType == 'fixed_amounts' && discount > 0) {
                  if (this.currentDiscountReached.discountOncePerOrder) {
                    discount = discount * Shopify.currency.rate * 100;
                  } else {
                    discount = this.productsBundle.length * discount * Shopify.currency.rate * 100;
                  }      
                } else {
                  discount = total * discount / 100;
                }               
                this.amountPrice = Alpine.store('xHelper').formatMoney(discount, shopCurrency);
                this.totalDiscount = Alpine.store('xHelper').formatMoney(0, shopCurrency);
              } else {
                this.amountPrice = Alpine.store('xHelper').formatMoney(0, shopCurrency);
                this.totalDiscount = Alpine.store('xHelper').formatMoney(total, shopCurrency)
              }
            }
          }
        }
        let checkMinRequired = true;
        this.$nextTick(() => { 
          const itemMinRequired = el.getElementsByClassName(`step-min-condition-${sectionId}`);
          [...itemMinRequired].forEach(item => {
            if (item.textContent == 'false') {
              checkMinRequired = false
            }
          });
          if (checkMinRequired) { 
            this.addToCartButton.removeAttribute('disabled');
          } else {
            this.addToCartButton.setAttribute("disabled", "");
          }
          if (this.productsBundle.length <= 0) {
            this.addToCartButton.setAttribute("disabled", "");
          }
        })
        
        this.totalPrice = Alpine.store('xHelper').formatMoney(total, shopCurrency);
        this.updateSplide(blockId)
      },
      updateSplide(blockId) {
        let bundleContentContainer;
        if (window.innerWidth > 768) {
          if (sectionLayout != "vertical" && sectionBlockSize > 1) { 
            bundleContentContainer = document.getElementById(`bundler-product-list-slide-horizontal-${sectionId}`);
          } else {
            bundleContentContainer = document.getElementById(`bundler-product-list-slide-${sectionId}-${blockId}`);
          }
        } else {
          bundleContentContainer = document.getElementById(`bundler-product-list-slide-${sectionId}-${blockId}`);
        }
        requestAnimationFrame(() => {
          let splide = bundleContentContainer.splide;
          if (splide) {
            splide.refresh();
          }
        }); 
      },
      updateProgressBar() {
        const discountProgressBar = el.getElementsByClassName(`discount-progress-bar-${sectionId}`)[0];
        if (!discountProgressBar) return;

        const goals = [
          { id: 1, value: goal1, label: goal1Label, discountType: goal1DiscountType, discountValue: goal1DiscountValue, discountOncePerOrder: goal1DiscountOncePerOrder },
          { id: 2, value: goal2, label: goal2Label, discountType: goal2DiscountType, discountValue: goal2DiscountValue, discountOncePerOrder: goal2DiscountOncePerOrder },
          { id: 3, value: goal3, label: goal3Label, discountType: goal3DiscountType, discountValue: goal3DiscountValue, discountOncePerOrder: goal3DiscountOncePerOrder }
        ].filter(g => g.value != '' && g.label != '');
        
        let productCount = 0;
        if (caculateDiscountType == "quantity") {
          productCount = this.productsBundle.length;
        } else {
          productCount = this.productsBundle.map(item => item.price).reduce((total, item) => total + item, 0);
          productCount = Number((productCount / 100).toFixed(2));
        }

        ['progress-goal-1', 'progress-goal-2', 'progress-pre-goal-2', 'progress-pre-goal-3', 'end-progress', 'process-single-bar'].forEach(cls => {
          const elProgress = discountProgressBar.getElementsByClassName(cls)[0];
          if (elProgress) elProgress.style.setProperty('--progress', '0%');
        });

        if (goals.length === 0) {
          return;
        } else if (goals.length === 1) {
          const elProgress = discountProgressBar.getElementsByClassName('progress-single-bar')[0];
          const currentProgress = (productCount / goals[0].value)*100;
          if (elProgress) elProgress.style.setProperty('--progress', `${currentProgress}%`);

          this.prevGoalMsg = prevMsg;
          const progressValueLeft = caculateDiscountType != 'quantity' ? Number(goals[0].value - productCount).toFixed(2) : goals[0].value - productCount;
          const prevGoalReachedString = this.prevGoalMsg.replace('[x]', `${progressValueLeft} ${caculateDiscountType != 'quantity' ? currentCurrency : ''}`).replace('[goal_label]', `${goals[0].label}`);
          this.prevGoalMsg = prevGoalReachedString

          if (productCount >= goals[0].value) {
            this.allGoalReached = true;
            this.currentDiscountReached = goals[0]
          } else {
            this.allGoalReached = false
            this.currentDiscountReached = {}
          }
        } else {
          for (let i = 0; i < goals.length; i++) {
            const currentGoal = goals[i];
            const nextGoal = goals[i + 1];

            const goalClass = `progress-goal-${currentGoal.id}`;
            const preNextGoalClass = `progress-pre-goal-${nextGoal?.id}`;
            const goalProgressEl = discountProgressBar.getElementsByClassName(goalClass)[0];
            const preNextProgressEl = nextGoal
              ? discountProgressBar.getElementsByClassName(preNextGoalClass)[0]
              : discountProgressBar.getElementsByClassName('end-progress')[0];
            
            if (productCount < goals[0].value) {
              this.currentDiscountReached = {}
            }

            if (productCount < currentGoal.value) {
              const progress = (productCount / currentGoal.value) * 100;
              goalProgressEl?.style.setProperty('--progress', `${progress}%`);

              this.prevGoalMsg = prevMsg;
              const progressValueLeft = caculateDiscountType != 'quantity' ? Number(currentGoal.value - productCount).toFixed(2) : currentGoal.value - productCount;
              const prevGoalReachedString = this.prevGoalMsg.replace('[x]', `${progressValueLeft} ${caculateDiscountType != 'quantity' ? currentCurrency : ''}`).replace('[goal_label]', `${currentGoal.label}`);
              this.prevGoalMsg = prevGoalReachedString
              this.allGoalReached = false

              break;
            }

            goalProgressEl?.style.setProperty('--progress', '100%');
            this.currentDiscountReached = currentGoal;

            if (nextGoal && productCount < nextGoal.value) {
              const progress = ((productCount - currentGoal.value) / (nextGoal.value - currentGoal.value)) * 100;
              preNextProgressEl?.style.setProperty('--progress', `${progress}%`);

              this.prevGoalMsg = prevMsg;
              const progressValueLeft = caculateDiscountType != 'quantity' ? Number((nextGoal.value - currentGoal.value) - (productCount - currentGoal.value)).toFixed(2) : (nextGoal.value - currentGoal.value) - (productCount - currentGoal.value)
              const prevGoalReachedString = this.prevGoalMsg.replace('[x]', `${progressValueLeft} ${caculateDiscountType != 'quantity' ? currentCurrency : ''}`).replace('[goal_label]', `${nextGoal.label}`);
              this.prevGoalMsg = prevGoalReachedString
              this.allGoalReached = false

              break;
            }

            if (nextGoal && productCount >= nextGoal.value) {
              preNextProgressEl?.style.setProperty('--progress', '100%');
              this.currentDiscountReached = nextGoal;
              continue;
            }

            if (!nextGoal && productCount >= currentGoal.value) {
              preNextProgressEl?.style.setProperty('--progress', '100%');
              this.currentDiscountReached = goals[goals.length - 1];
              this.allGoalReached = true
            }
          }
        }
        this.loadDiscountBar = false;
        this.loadPrevGoalMsg = false
      }
    }));
  });
});
}