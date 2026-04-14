const installMediaQueryWatcher = (mediaQuery, changedCallback) => {
  const mq = window.matchMedia(mediaQuery);
  mq.addEventListener('change', e => changedCallback(e.matches));
  changedCallback(mq.matches);
};

const deferScriptLoad = (name, src, onload, requestVisualChange = false) => {
  window.Eurus.loadedScript.add(name);
  
  (events => {
    const loadScript = () => {
      events.forEach(type => window.removeEventListener(type, loadScript));
      clearTimeout(autoloadScript);

      const initScript = () => {
        const script = document.createElement('script');
        script.setAttribute('src', src);
        script.setAttribute('defer', '');
        script.onload = () => {
          document.dispatchEvent(new CustomEvent(name + ' loaded'));
          onload();
        };

        document.head.appendChild(script);
      }

      if (requestVisualChange) {
        if (window.requestIdleCallback) {
          requestIdleCallback(initScript);
        } else {
          requestAnimationFrame(initScript);
        }
      } else {
        initScript();
      }
    };

    let autoloadScript;
    if (Shopify.designMode) {
      loadScript();
    } else {
      const wait = window.innerWidth > 767 ? 2000 : 5000;
      events.forEach(type => window.addEventListener(type, loadScript, {once: true, passive: true}));
      autoloadScript = setTimeout(() => {
        loadScript();
      }, wait);
    }
  })(['touchstart', 'mouseover', 'wheel', 'scroll', 'keydown']);
}

const getSectionInnerHTML = (html, selector = '.shopify-section') => {
  return new DOMParser()
    .parseFromString(html, 'text/html')
    .querySelector(selector).innerHTML;
}

const xParseJSON = (jsonString) => {
  jsonString = String.raw`${jsonString}`;
  jsonString = jsonString.replaceAll("\\","\\\\").replaceAll('\\"', '\"');
  return JSON.parse(jsonString);
}

window.addEventListener("pageshow", () => {
  document.addEventListener('alpine:init', () => {
    if (Alpine.store('xMiniCart')) {
      if (Alpine.store('xMiniCart').needReload) {
        Alpine.store('xMiniCart').reLoad();
      }
      const isCartPage = document.getElementById("main-cart-items");
      if (isCartPage && Alpine.store('xMiniCart').needReload) {
        location.reload();
      }
      Alpine.store('xMiniCart').needReload = true;
    }
  })
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xDarkMode', {
      alias: "btn-theme-mode",
      toggleThemeMode() {
        Alpine.store('xDOM').rePainting = this.alias;
        setTimeout(() => {
          if (document.documentElement.classList.contains('dark')) {
            localStorage.eurus_theme = 0;
            document.documentElement.classList.remove('dark');
          } else {
            localStorage.eurus_theme = 1;
            document.documentElement.classList.add('dark');
          }
          Alpine.store('xHeaderMenu').setTopStickyHeader();
          Alpine.store('pseudoIconTheme').updatePseudoIconInputTheme();

          Alpine.store('xDOM').rePainting = null;
        }, 200); // INP
      },
      toggleLightMode() {
        Alpine.store('xDOM').rePainting = this.alias;
        setTimeout(() => {
          localStorage.eurus_theme = 0;
          document.documentElement.classList.remove('dark');
          Alpine.store('xHeaderMenu').setTopStickyHeader();
          Alpine.store('pseudoIconTheme').updatePseudoIconInputTheme();

          Alpine.store('xDOM').rePainting = null;
        }, 200); // INP
      },
      toggleDarkMode() {
        Alpine.store('xDOM').rePainting = this.alias;
        setTimeout(() => {
          localStorage.eurus_theme = 1;
          document.documentElement.classList.add('dark');
          Alpine.store('xHeaderMenu').setTopStickyHeader();
          Alpine.store('pseudoIconTheme').updatePseudoIconInputTheme();

          Alpine.store('xDOM').rePainting = null;
        }, 200); // INP
      }
    });
    Alpine.store('pseudoIconTheme', {
      init() {
        this.updatePseudoIconInputTheme();
      },
      updatePseudoIconInputTheme() {
        const themeMode = localStorage.getItem('eurus_theme');
        document.querySelectorAll('input[type="date"], input[type="time"]').forEach(input => {
          if (themeMode === '1') {
            input.style.colorScheme = 'dark';
          } else {
            input.removeAttribute('style');
          }
        });
      }      
    });
    Alpine.store('xHelper', {
      toUpdate: [],
      requestControllers: new Map(),
      eventControllers: new Map(),
      fbtProductListDraft: [],
      cancelRequest(key) {
        const controller = this.requestControllers.get(key);
        if (controller) {
          controller.abort();
          this.requestControllers.delete(key);
        }
      },
      cancelEvent(key) {
        const controller = this.eventControllers.get(key);
        if (controller) {
          controller.abort();
          this.eventControllers.delete(key);
        }
      },
      formatMoney(amount, formatString) {
        var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
        switch(formatString.match(placeholderRegex)[1]) {
          case 'amount':
            value = this.formatWithDelimiters(amount, 2);
            break;
          case 'amount_no_decimals':
            value = this.formatWithDelimiters(amount, 0);
            break;
          case 'amount_with_comma_separator':
            value = this.formatWithDelimiters(amount, 2, '.', ',');
            break;
          case 'amount_no_decimals_with_comma_separator':
            value = this.formatWithDelimiters(amount, 0, '.', ',');
            break;
        }
        return formatString.replace(placeholderRegex, value);
      },
      defaultOption(opt, def) {
        return (typeof opt == 'undefined' ? def : opt);
      },
      formatWithDelimiters(number, precision, thousands, decimal) {
        precision = this.defaultOption(precision, 2);
        thousands = this.defaultOption(thousands, ',');
        decimal   = this.defaultOption(decimal, '.');
    
        if (isNaN(number) || number == null) { return 0; }
        number = (number/100.0).toFixed(precision);
    
        var parts   = number.split('.'),
            dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
            cents   = parts[1] ? (decimal + parts[1]) : '';
    
        return dollars + cents;
      },
      countdown(configs, callback) {
        const maxAttempt = 100;

        let endDate = new Date(
          configs.end_year,
          configs.end_month - 1,
          configs.end_day,
          configs.end_hour,
          configs.end_minute
        );
        let reset = configs.reset;
        let duration = configs.duration;
        let endTime = endDate.getTime() + (-1 * configs.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;
        
        let startTime;
        if (configs.start_year) {
          let startDate = new Date(
            configs.start_year,
            configs.start_month - 1,
            configs.start_day,
            configs.start_hour,
            configs.start_minute
          );
          startTime = startDate.getTime() + (-1 * configs.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;
          if (reset) {
            endDate = new Date(startTime + duration);
            endTime = endDate.getTime();
          }
        } else {
          if (reset) {
            startTime = endTime;
            endDate = new Date(startTime + duration);
            endTime = endDate.getTime();
          } else {
            startTime = new Date().getTime();
          }
        }

        if (new Date().getTime() < startTime) {
          callback(false, 0, 0, 0, 0);
          return;
        }

        const startInterval = () => {
          let x = setInterval(() => {
            let now = new Date().getTime();
            let distance = 0;

            distance = endTime - now;
            if (distance < 0) {
              clearInterval(x);
              if (reset) {
                let attempt = 0;
                while (distance < 0 && attempt < maxAttempt) {
                  attempt++;
                  if (attempt == 1) {
                    let elapsed = now - startTime;
                    let loopOffset = Math.floor(elapsed / duration) - 1;

                    startTime = startTime + loopOffset * duration;
                  } else {
                    startTime = endTime;
                  }
                  endDate = new Date(startTime + duration);
                  endTime = endDate.getTime();
                  distance = endTime - now;
                }
                if (attempt >= maxAttempt) {
                  callback(false, 0, 0, 0, 0);
                  return;
                }
                startInterval();
              } else {
                callback(false, 0, 0, 0, 0);
                return;
              }
            }
            if (distance > 0) {
              var days = Math.floor(distance / (1000 * 60 * 60 * 24));
              var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
              var seconds = Math.floor((distance % (1000 * 60)) / 1000);

              minutes = minutes < 10 ? '0' + minutes : '' + minutes;
              seconds = seconds < 10 ? '0' + seconds : '' + seconds;

              callback(true, seconds, minutes, hours, days);
            }
          }, 1000);
        }

        startInterval();
      },
      canShow(configs) {
        let endDate = new Date(
          configs.end_year,
          configs.end_month - 1,
          configs.end_day,
          configs.end_hour,
          configs.end_minute
        );
        const endTime = endDate.getTime() + (-1 * configs.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;
        
        let startTime;
        if (configs.start_year) {
          let startDate = new Date(
            configs.start_year,
            configs.start_month - 1,
            configs.start_day,
            configs.start_hour,
            configs.start_minute
          );
          startTime = startDate.getTime() + (-1 * configs.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;
        } else {
          startTime = new Date().getTime();
        }
        let now = new Date().getTime();
        let distance = endTime - now;
        if (distance < 0 || startTime > now) {
          return false;
        } 
        return true;
      },
      handleTime(configs) {
        let endDate = new Date(
          configs.end_year,
          configs.end_month - 1,
          configs.end_day,
          configs.end_hour,
          configs.end_minute
        );
        const endTime = endDate.getTime() + (-1 * configs.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;
        
        let startTime;
        if (configs.start_year) {
          let startDate = new Date(
            configs.start_year,
            configs.start_month - 1,
            configs.start_day,
            configs.start_hour,
            configs.start_minute
          );
          startTime = startDate.getTime() + (-1 * configs.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;
        } else {
          startTime = new Date().getTime();
        }
        let now = new Date().getTime();
        let distance = endTime - now;
        return { "startTime": startTime, "endTime": endTime, "now": now, "distance": distance};
      },
      centerElement(el) {
        let resizeTimeout;
        let currTranslate = 0;
    
        const update = () => {
          window.requestAnimationFrame(() => {
            const rect = el.getBoundingClientRect();
            const translate = rect.left + Math.abs(currTranslate) - (document.documentElement.clientWidth - rect.width) / 2;
            el.style.transform = `translateX(-${translate}px)`;
            currTranslate = translate;
          })
        };
    
        window.addEventListener('resize', () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(update, 150);
        });

        update();
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.data('xCart', () => ({
      t: '',
      loading: false,
      customFieldInitOpened: false,
      updateItemQty(itemId, line, inventory_policy, track_inventory, maxQty, willRemoveInsurance) {
        let qty = parseInt(document.getElementById(`cart-qty-${itemId}`).value);
        if (this.validateQty(qty)) {
          if (track_inventory || inventory_policy !== "continue") {
            this._postUpdateItem(itemId, line, qty, maxQty);
          } else {
            this._postUpdateItem(itemId, line, qty, qty);
          }
        }
        if (willRemoveInsurance && qty <= 0) {
          this.clearCart(itemId);
          return;
        }
      },
      minusItemQty(itemId, line, inventory_policy, track_inventory, maxQty, willRemoveInsurance) {
        let qty = parseInt(document.getElementById(`cart-qty-${itemId}`).value);
        if (this.validateQty(qty)) {
          if (qty > 0) {
            qty -= 1;
            document.getElementById(`cart-qty-${itemId}`).value = qty;
          }

          if (track_inventory || inventory_policy !== "continue") {
            this._postUpdateItem(itemId, line, qty, maxQty);
          } else {
            this._postUpdateItem(itemId, line, qty, qty);
          }
        }
        if (willRemoveInsurance && qty <= 0) {
          this.clearCart(itemId);
          return;
        }
      },
      plusItemQty(itemId, line, inventory_policy, track_inventory, maxQty) {
        let qty = parseInt(document.getElementById(`cart-qty-${itemId}`).value);
        if (this.validateQty(qty)) {
          if (qty >= 0) {
            qty += 1;
            document.getElementById(`cart-qty-${itemId}`).value = qty;
          }

          if (track_inventory || inventory_policy !== "continue") {
            this._postUpdateItem(itemId, line, qty, maxQty);
          } else {
            this._postUpdateItem(itemId, line, qty, qty);
          }
        }
      },
      removeItem(itemId, line, isShippingInsurance) {
        this._postUpdateItem(itemId, line, 0, 0, 500, isShippingInsurance);
      },
      handleKeydown(evt, el) {
        if (evt.key !== 'Enter') return;
        evt.preventDefault();
        el.blur();
        el.focus();
      },
      _postUpdateItem(itemId, line, qty, maxQty, wait = 500, isShippingInsurance) {
        if (isShippingInsurance) {
          Alpine.store('xPopupInsurance').loading = true;
        };
        clearTimeout(this.t);

        const func = async () => {
          this.loading = true;
          await Alpine.store('xCartHelper').waitForCartUpdate();
          window.updatingCart = true;

          let removeEl = document.getElementById(`remove-${itemId}`);
          if(removeEl){
            removeEl.style.display = 'none';
          }
          document.getElementById(`loading-${itemId}`)?.classList?.remove('hidden');
          let updateData = {
            'line': `${line}`,
            'quantity': `${qty}`,
            'sections': Alpine.store('xCartHelper').getSectionsToRender().map(s => s.id),
            'sections_url': window.location.pathname
          };

          let productIds = [];

          fetch(`${Shopify.routes.root}cart/change.js`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
          })
          .then(response => {
            return response.json()
          })
          .then(parsedState => {
            if (parsedState.status == '422') {
              this._addErrorMessage(itemId, parsedState.message);
              this.updateCart(line, itemId);
            } else {
              parsedState.items.forEach(item => { productIds.push(item.product_id) });
              this.updateCartUI(parsedState, itemId, line, qty);
              this._syncContainerQty(parsedState, itemId, qty);
              document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
            }
          })
          .finally(() => {
            window.updatingCart = false;
            productIds.forEach(id => { document.dispatchEvent(new CustomEvent(`eurus:product-card:clear:${id}`)); })
            if (isShippingInsurance) {
              Alpine.store('xPopupInsurance').loading = false;
            };
          });
        }

        this.t = setTimeout(() => {
          func();
        }, wait);
      },
      updateCartUI(parsedState, itemId, line, qty) {
        const items = document.querySelectorAll('.cart-item');
        if (parsedState.errors) {
          this._addErrorMessage(itemId, parsedState.errors);
          return;
        }
        Alpine.store('xCartHelper').reRenderSections(parsedState.sections);
        Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);

        const currentItemCount = Alpine.store('xCartHelper').currentItemCount
        Alpine.store('xCartHelper').currentItemCount = parsedState.item_count;
        if (currentItemCount != parsedState.item_count) {
          document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
        }

        const lineItemError = document.getElementById(`LineItemError-${itemId}`);
        if (lineItemError) {lineItemError.classList.add('hidden');}
        
        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        
        if (items.length === parsedState.items.length && updatedValue !== parseInt(qty)) {
          let message = '';
          if (typeof updatedValue === 'undefined') {
            message = window.Eurus.cart_error;
          } else {
            message = window.Eurus.cart_quantity_error_html.replace('[quantity]', updatedValue);
          }
          this._addErrorMessage(itemId, message);
        }
        let loadingEl = document.getElementById(`loading-${itemId}`);
        let removeEl = document.getElementById(`remove-${itemId}`);
        if(removeEl){
          removeEl.style.display = 'block';
        }
        if (loadingEl) {
          loadingEl.classList.add('hidden');
        }
        this.loading = false;
      },
      async _syncContainerQty(parsedState, parentKey, newQty) {
        // Deletion of parent cascades to child automatically via Shopify nested lines.
        if (newQty <= 0) return;

        const parentItem = parsedState.items.find(item => item.key === parentKey);
        if (!parentItem) return;

        const containerItem = parsedState.items.find(item => {
          const props = item.properties || {};
          return props._is_container === 'true' &&
            String(props._parent_variant_id) === String(parentItem.variant_id);
        });

        if (!containerItem || containerItem.quantity === newQty) return;

        try {
          const sections = Alpine.store('xCartHelper').getSectionsToRender().map(s => s.id);
          const response = await fetch(`${Shopify.routes.root}cart/change.js`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: containerItem.key,
              quantity: newQty,
              sections,
              sections_url: window.location.pathname
            })
          });
          if (!response.ok) return;
          const updatedState = await response.json();
          if (!updatedState.errors && updatedState.sections) {
            Alpine.store('xCartHelper').reRenderSections(updatedState.sections);
          }
        } catch (err) {
          console.error('[ContainerPicker] Container quantity sync failed:', err);
        }
      },
      updateCart(line, itemId) {
        let url = ''
        if (window.location.pathname !== '/cart'){
          url = `${window.location.pathname}?section_id=cart-drawer`
        } else {
          url = `${window.location.pathname}`
        }
        fetch(url)
        .then(reponse => {
          return reponse.text();
        })
        .then(response => {
          const parser = new DOMParser();
          const html = parser.parseFromString(response,'text/html');
          
          const rpCartFooter = html.getElementById('main-cart-footer');
          const cartFooter = document.getElementById('main-cart-footer');
          if (rpCartFooter && cartFooter) {
            cartFooter.innerHTML = rpCartFooter.innerHTML;
          }
          const rpItemInput = html.querySelector('.cart-item-qty-' + line);
          const itemInput = document.querySelector('.cart-item-qty-' + line);
          if (rpItemInput && itemInput) {
            itemInput.value = rpItemInput.value;
          }
          const rpItemTotal = html.querySelector('.cart-item-price-' + line);
          const itemTotal = document.querySelector('.cart-item-price-' + line);
          if (itemTotal && rpItemTotal) {
            itemTotal.innerHTML = rpItemTotal.innerHTML;
          }
          const rpPriceTotal = html.querySelector('.cart-drawer-price-total');
          const priceTotal = document.querySelector('.cart-drawer-price-total');
          if (rpPriceTotal && priceTotal) {
            priceTotal.innerHTML = rpPriceTotal.innerHTML;
          }
          const rpCartIcon = html.querySelector('cart-icon-bubble');
          const cartIcon = document.querySelector('cart-icon-bubble');
          if (cartIcon && rpCartIcon) {
            cartIcon.innerHTML = rpCartIcon.innerHTML;
          }
        }).finally(() => {
          let loadingEl = document.getElementById(`loading-${itemId}`);
          if (loadingEl) {
            loadingEl.classList.add('hidden');
          }
          this.loading = false;
        });
      },
      clearCart(itemId) {
        let removeEl = document.getElementById(`remove-${itemId}`);
        if(removeEl){
          removeEl.style.display = 'none';
        }
        document.getElementById(`loading-${itemId}`)?.classList?.remove('hidden');

        fetch(window.Shopify.routes.root + 'cart/clear.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body:  JSON.stringify({ "sections":  Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id) })
        }).then((response) => {
          return response.json();
        }).then((response) => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              Alpine.store('xCartHelper').reRenderSections(response.sections);
              Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
              document.dispatchEvent(new CustomEvent("eurus:cart:items-changed"));
            }, 0)
          });
        })
        .catch((error) => {
          console.error('Error:', error);
        }).finally(() => {
          document.cookie = `eurus_insurance=; path=/`;
        })
      },
      async addShippingInsurance(productId) {
        Alpine.store('xPopupInsurance').loading = true;
        Alpine.store('xPopupInsurance').openInsuranceNoti = false;
        let item = [{
          id: productId,
          quantity: 1
        }];
        await Alpine.store('xCartHelper').waitForCartUpdate();
        window.updatingCart = true;

        fetch(window.Shopify.routes.root + 'cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body:  JSON.stringify({ "items": item, "sections":  Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id) })
        }).then((response) => {
          return response.json();
        }).then((response) => {
          Alpine.store('xCartHelper').reRenderSections(response.sections);
          Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
        })
        .catch((error) => {
          console.error('Error:', error);
        }).finally(() => {
          window.updatingCart = false;
          document.cookie = `eurus_insurance=${productId}; path=/`;
          Alpine.store('xPopupInsurance').loading = false;
          Alpine.store('xPopupInsurance').openInsuranceNotification()
        })
      },
      updateEstimateShippingAll(el) {
        const cartItems = el.getElementsByClassName('cart-item');
        Array.from(cartItems).forEach((item, index) => {
          window.requestAnimationFrame(() => {
            item.dispatchEvent(new CustomEvent(`eurus:cart-item:updateEstimateShipping:${index + 1}`));
          })
        });
      },
      waitForEstimateUpdate() {
        return new Promise(resolve => {
          function check() {
            if (!window.updatingEstimate) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          }
          check();
        });
      },
      async updateEstimateShipping(el, line, qty, itemId, cutOffHour, cutOffMinute, hour, minutes, calculationType, daysText, dayText, hrText, minText, excludeDay, holidayList, currentLanguage, shippingInsuranceId, cartSize) {
        el.addEventListener(`eurus:cart-item:updateEstimateShipping:${line}`, async () => {
          if (shippingInsuranceId === itemId) return;
          const queryString = window.location.search;
          if (queryString.includes("share_cart:true") && !Alpine.store('xCartShare').shared) {
            return;
          }

          const key = el.getAttribute('x-data-update-estimate-key');
          let estimateProperty = el.getAttribute('x-data-update-estimate-property');
          let properties = JSON.parse(el.getAttribute('x-data-properties'));
          
          if (estimateProperty !== '' && estimateProperty.includes('time_to_cut_off')) {
            if (Alpine.store('xEstimateDelivery').noti == '') Alpine.store('xEstimateDelivery').countdownCutOffTime(cutOffHour, cutOffMinute, hour, minutes, calculationType, daysText, dayText, hrText, minText, excludeDay, holidayList, currentLanguage);
            estimateProperty = estimateProperty.replace('time_to_cut_off', Alpine.store('xEstimateDelivery').noti);
            properties[key] = estimateProperty;
            await this.waitForEstimateUpdate();
            window.updatingEstimate = true;
            await fetch('/cart/change.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({ 
                'line': line, 
                'quantity': qty,
                'properties': properties
              })
            })
            .finally(() => {
              window.updatingEstimate = false;
            });
          }
        });
      },
      async updateDate(date) {
        await Alpine.store('xCartHelper').waitForCartUpdate();
        var formData = {
          'attributes': {
            'datetime-updated': `${date}`           
          }
        }; 
        fetch(Shopify.routes.root+'cart/update', {
          method:'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(formData)
        })
      },
      _addErrorMessage(itemId, message) {
        const lineItemError = document.getElementById(`LineItemError-${itemId}`);
        if (!lineItemError) return;
        lineItemError.classList.remove('hidden');
        lineItemError
          .getElementsByClassName('cart-item__error-text')[0]
          .innerHTML = message;
      },
      validateQty: function(number) {
        if((parseFloat(number) != parseInt(number)) && isNaN(number)) {
          return false
        }

        return true;
      }
    }));

    Alpine.store('xCartHelper', {
      currentItemCount: 0,
      validated: true,
      openField: '',
      openDeliveryDateField: '',
      openDiscountField: '',
      updateCart: async function(data, needValidate = false) {
        await Alpine.store('xCartHelper').waitForCartUpdate();
        const formData = JSON.stringify(data);
        fetch(Shopify.routes.root + 'cart/update', {
          method:'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: formData
        }).then((response) => {
          if (needValidate) this.validateCart();
          return response.json();
        }).then((response)=>{
          document.dispatchEvent(new CustomEvent('eurus:cart-drawer:order-note:update', {
            detail: {
              message: response.note,
              attributes: response.attributes || {}
            }
          } ));
        });
      },
      cartValidationRequest() {
        this.validateCart();
        Alpine.store('xMiniCart').openCart();
      },
      validateCart: function(isCheckOut = false) {
        this.validated = true;

        document.dispatchEvent(new CustomEvent("eurus:cart:validate", {detail: {isCheckOut: isCheckOut}}));
      },
      goToCheckout(e) {
        this.validateCart(true);
        
        if (this.validated) {
          let formData = {
            'attributes': {
              'collection-pagination': null,
              'blog-pagination': null,
              'choose_option_id': null,
              'datetime-updated': null
            }
          };

          fetch(Shopify.routes.root+'cart/update', {
            method:'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(formData)
          });
        } else {
          e.preventDefault();
        }
      },
      waitForCartUpdate() {
        return new Promise(resolve => {
          function check() {
            if (!window.updatingCart && !window.updatingEstimate) {
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          }
          check();
        });
      },
      getSectionsToRender() {
        const cartItemEl = document.getElementById('main-cart-items');
        if (cartItemEl) {
          const templateId = cartItemEl.closest('.shopify-section').id
                              .replace('cart-items', '')
                              .replace('shopify-section-', '');

          return [
            {
              id: templateId + 'cart-items',
              selector: '#main-cart-items'
            },
            {
              id: templateId + 'cart-footer',
              selector: '#main-cart-footer'
            },
            {
              id: templateId + 'cart-upsell',
              selector: '#main-cart-upsell'
            },
            {
              id: "cart-icon-bubble",
              selector: '#cart-icon-bubble'
            },
            {
              id: 'mobile-cart-icon-bubble',
              selector: '#mobile-cart-icon-bubble'
            },
            {
              id: 'cart-icon-bubble-mobile-dock',
              selector: '#cart-icon-bubble-mobile-dock'
            }
          ];
        }

        return [
          {
            id: "cart-icon-bubble",
            selector: '#cart-icon-bubble'
          },
          {
            id: 'mobile-cart-icon-bubble',
            selector: '#mobile-cart-icon-bubble'
          },
          {
            id: 'cart-icon-bubble-mobile-dock',
            selector: '#cart-icon-bubble-mobile-dock'
          },
          {
            id: 'cart-drawer',
            selector: '#CartDrawer'
          }
        ];
      },
      async reRenderSections(sections) {
        let resSection = sections;
        const sectionsToRender = this.getSectionsToRender();
        if (!resSection) {
          const sectionsToRenderIds = sectionsToRender.map(s => s.id);

          if (sectionsToRender.length > 4) {
            const results = await Promise.all(
              sectionsToRenderIds.map(id =>
                fetch(`${window.location.pathname}?sections=${id}`).then(res => res.json())
              )
            );
            resSection = Object.assign({}, ...results);
          } else {
            const res = await fetch(`${window.location.pathname}?sections=${sectionsToRender}`);
            resSection = await res.json();
          }
        }
        this.getSectionsToRender().forEach((section => {
          section.selector.split(',').forEach((selector) => {
            const sectionElement = document.querySelector(selector);
            if (sectionElement) {
              if (resSection[section.id])
                sectionElement.innerHTML = getSectionInnerHTML(resSection[section.id], selector);
            }
          })
        }));
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.data('xModalSearch', (type, desktopMaximunResults, mobileMaximunResults, productTypeSelected) => ({
      open_search: '',
      t: '',
      result: ``,
      query: '',
      cachedResults: [],
      openResults: false,
      productTypeSelected: productTypeSelected,
      showSuggest: false,
      loading: false,
      open(refName) {
        this.$refs[refName]?.classList.remove("popup-hidden");
        const input_search = document.getElementById('search-in-modal');
        if (input_search) {
          setTimeout(() => {
            input_search.focus();
          }, 100);
        }
      },
      close(refName) {
        this.$refs[refName]?.classList.add("popup-hidden");
      },
      keyUp() {
        this.query = this.$el.value;
        return () => {
          clearTimeout(this.t);
          this.t = setTimeout(() => {
            if (this.query != "") {
              this.showSuggest = false;
              this.getSearchResult(this.query);
            } else {
              this.showSuggest = true;
              this.result = "";
            }
          }, 300);
        };
      },
      getSearchResult(query) {
        this.openResults = true;
        const limit = window.innerWidth > 767 ? desktopMaximunResults : mobileMaximunResults;
        let q = this.productTypeSelected != productTypeSelected ? `${this.productTypeSelected} AND ${query}` : query;

        const queryKey = q.replace(" ", "-").toLowerCase() + '_' + limit;

        if (this.cachedResults[queryKey]) {
          this.result = this.cachedResults[queryKey];
          return;
        }

        this.loading = true;
        const field = "author,body,product_type,tag,title,variants.barcode,variants.sku,variants.title,vendor"
        fetch(`${Shopify.routes.root}search/suggest?q=${encodeURIComponent(q)}&${encodeURIComponent('resources[type]')}=${encodeURIComponent(type)}&${encodeURIComponent('resources[options][fields]')}=${encodeURIComponent(field)}&${encodeURIComponent('resources[limit]')}=${encodeURIComponent(limit)}&section_id=predictive-search`)
          .then((response) => {
            return response.text();
          })
          .then((response) => {
            const parser = new DOMParser();
            const text = parser.parseFromString(response, 'text/html');
            this.result = text.querySelector("#shopify-section-predictive-search").innerHTML;
            this.cachedResults[queryKey] = this.result;
          })
          .catch((error) => {
            throw error;
          });
        this.loading = false;
      },
      setProductType(value, input) {
        this.productTypeSelected = value;
        document.getElementById(input).value = value;
        if(this.query != '') {
          this.getSearchResult(this.query);
        }
      },
      focusForm() {
        if (this.$el.value != '') {
          this.showSuggest = false;
        } else {
          this.showSuggest = true;
        }
      }
    }));
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xHeaderMenu', {
      isSticky: false,
      stickyCalulating: false,
      openHamburgerMenu: false,
      isTouch: ('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints ? true : false,
      sectionId: '',
      stickyType: 'none',
      lastScrollTop: 0,
      themeModeChanged: false,
      showLogoTransparent: true,
      offsetTop: 0,
      clickedHeader: false,
      mobileHeaderLayout: '',
      overlay: false,
      scrollDir: '',
      isTransparent: false,
      isMenuOpen: false,
      mobileDock: document.getElementsByClassName("section-mobile-dock")[0],
      hasMobileDock() {
        return document.getElementsByClassName("section-mobile-dock").length > 0;
      },
      renderAjax(el, id, element) {
        fetch(
          `${window.location.pathname}?sections=${id}`
        ).then(response => response.json())
        .then(response => {
          let html = getSectionInnerHTML(response[id], element);
          if (el?.closest('[data-breakpoint="tablet"]')) {
            html = html?.replace('id="search-in-modal"', 'id="search-in-modal-mobile"');
          }
          el.innerHTML = html;
        })
      },
      setPosition(el,level, hamburger=false) {
        let spacing = 0;
        if (!hamburger) {
          level = level - 1;
        } else {
          level = level - 0.5;
        }
        requestAnimationFrame(() => {
          const elm = el.closest(".tree-menu");
          const widthEl = elm.getElementsByClassName("toggle-menu")[0];
          const elRect = elm.getBoundingClientRect();
          var left = (elRect.left - (widthEl.offsetWidth*level)) < 0;
          var right = (elRect.right + (widthEl.offsetWidth*level)) > (window.innerWidth || document.documentElement.clientWidth);
          if (document.querySelector('body').classList.contains('rtl')) {
            if (left) {
              el.classList.add('right-0');
              widthEl.classList.add('left-0');
              elm.classList.remove('position-left');
            } else {
              el.classList.add('left-0');
              widthEl.classList.add('right-0');
              elm.classList.add('position-left');
            }
          } else { 
            if (right) {
              el.classList.add('left-0');
              widthEl.classList.add('right-0');
              elm.classList.add('position-left');
            } else {
              el.classList.add('right-0');
              widthEl.classList.add('left-0');
              elm.classList.remove('position-left');
            }
          }  
        });
      },
      resizeWindow(el,level, hamburger=false) {
        const debounce = (func, wait) => {
          let timeout;
          return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
          };
        };

        const onResize = debounce(() => {
          this.setPosition(el, level, hamburger);
        }, 100);

        addEventListener("resize", onResize);
      },
      selectItem(el, isSub = false) {
        if (this.isTransparent) {
          el.style.setProperty('--header-container-height', document.getElementById("sticky-header-content").offsetHeight + 'px')
        } else {
          el.style.setProperty('--header-container-height', document.getElementById("x-header-container").offsetHeight + 'px')
        }
        if (el.closest(".toggle-menu")) {
          el.style.setProperty('--mega-menu-height', el.offsetTop + el.clientHeight + 'px') 
        }
        this.setAnimationMenu(el, isSub);
        const itemSelector = isSub ? '.toggle-menu-sub' : '.toggle-menu';

        var items = isSub ? el.closest('.toggle-menu').querySelectorAll(itemSelector) : document.querySelectorAll(itemSelector);

        if (isSub) {
          var subMenuLinks = el.parentElement.querySelectorAll(".sub-menu-item");
          for (var i = 0; i < subMenuLinks.length; i++) {
            subMenuLinks[i].classList.remove("is-active");
          }
          el.classList.add("is-active");
        }

        for (var i = 0; i < items.length; i++) {
          if (isSub) {
            items[i].classList.remove('open');
            items[i].classList.add('toggle-menu-sub-hidden');
          } else {
            items[i].classList.add('toggle-menu-hidden');
            items[i].querySelector('.toggle-menu-sub.open')?.classList.add('toggle-menu-sub-hidden');
          }
        }

        let toggleMenu = el.querySelector(itemSelector);

        if (toggleMenu) {
          if (isSub) {
            if (el.closest('.toggle-menu').classList.contains("mega-menu-vertical")) {
              toggleMenu.classList.add('open');
            }
            toggleMenu.classList.remove('toggle-menu-sub-hidden');
          } else {
            toggleMenu.classList.remove('toggle-menu-hidden');
            el.querySelector('.toggle-menu-sub.open')?.classList.remove('toggle-menu-sub-hidden');
          }
        }
        this.toggleOverlay();
      },
      toggleOverlay() {
        let countMenu = document.querySelectorAll('.toggle-menu');
        let countMenuHidden = document.querySelectorAll('.toggle-menu-hidden');
        if (countMenu.length == countMenuHidden.length) {
          this.overlay = false;
        } else {
          this.overlay = true;
        }
      },
      hideMenu(el, isSub = false) {
        var items = isSub ? document.querySelectorAll('.toggle-menu-sub') : document.querySelectorAll('.toggle-menu');
        if (!isSub) {
          const itemClicked =  document.querySelector('.clicked');
          if (itemClicked) { itemClicked.classList.remove("clicked") }
        } else {
          var subMenuLinks = el.parentElement.querySelectorAll(".sub-menu-item");
          for (var i = 0; i < subMenuLinks.length; i++) {
            subMenuLinks[i].classList.remove("is-active");
          }
        }
        for (var i = 0; i < items.length; i++) {  
          if (isSub) {
            items[i].classList.add('toggle-menu-sub-hidden');
          } else {
            items[i].classList.add('toggle-menu-hidden');
            items[i].querySelector('.toggle-menu-sub.open')?.classList.add('toggle-menu-sub-hidden');
          }
        }
        this.toggleOverlay();
        this.isMenuOpen = false;
      },
      hideMenuHorizontal(el) {
        if (!el.querySelector(".toggle-menu-sub")) return;
        if (el.querySelector(".toggle-menu-sub").classList.contains('toggle-menu-sub-hidden')) return;
        el.querySelector('.click-sub')?.classList.remove('click-sub');
        this.hideMenu(el, true);
      },
      // start handle touch menu on the ipad
      touchItem(el, isSub = false) {
        const touchClass = isSub ? 'touched-sub' : 'touched';

        el.addEventListener("touchend", (e) => {
          if (el.classList.contains(touchClass)) {
            window.location.replace(el.getAttribute('href'));
          } else {
            e.preventDefault(); 
            var dropdown = document.querySelectorAll(`.${touchClass}`);
            for (var i = 0; i < dropdown.length; i++) { 
              dropdown[i].classList.remove(touchClass); 
            }

            el.classList.add(touchClass);
            this.selectItem(el.closest('.has-dropdown'), isSub);
          }
        });
      },
      clickItem(el, e, isSub = false, isMenu, open_new_window = false) {
        const clickClass = isSub ? 'click-sub' : 'clicked';
        e.preventDefault(); 
        if (el.classList.contains(clickClass)) {
          this.hideMenu();
        } else {
          this.isMenuOpen = true;
          var dropdown = document.querySelectorAll(`.${clickClass}`);
          for (var i = 0; i < dropdown.length; i++) { 
            dropdown[i].classList.remove(clickClass); 
          }
          el.classList.add(clickClass);
          if (!isMenu) {
            this.selectItem(el.closest('.has-dropdown'), isSub);
          }
        }
      },

      // handle sticky header
      initSticky(el, sectionId, stickyType, transparent) {
        this.isTransparent = transparent;
        this.sectionId = sectionId;
        this.stickyType = stickyType;
        this.offsetTop = el.offsetTop;
        if (this.isSticky) {
          if (document.querySelector("#sticky-header").classList.contains('on-scroll-up-animation') && document.querySelector("#sticky-header").classList.contains('header-up')) {
            this.setVariableHeightHeader(false);
          } else {
            this.setVariableHeightHeader(true);
          }
        } else {
          this.setVariableHeightHeader(false);
        }
        window.addEventListener('resize', () => {
          if(!transparent){
            el.style.height = document.getElementById("sticky-header").offsetHeight + 'px';
          }
          if (this.isSticky) {
            if (document.querySelector("#sticky-header").classList.contains('on-scroll-up-animation') && document.querySelector("#sticky-header").classList.contains('header-up')) {
              this.setVariableHeightHeader(false);
            } else {
              this.setVariableHeightHeader(true);
            }
          } else {
            this.setVariableHeightHeader(false);
          }
          this.setPositionTop();
        });
        this.setPositionTop();
        el.style.height = document.getElementById("sticky-header").offsetHeight + 'px';
      },
      setPositionTop() {
        let top_height = 0;
        let announcement_height = 0;
        let header_height = 0;
        const announcement = document.querySelector("#x-announcement");
        const header = document.querySelector("#x-header-container");
        const sectionAnnouncement = document.querySelector(".section-announcement");
        const stickyHeader = document.querySelector("#sticky-header");
        this.setTopStickyHeader();
        if (announcement && announcement.dataset.isSticky == 'true') {
          announcement_height = announcement.offsetHeight;
          header.style.setProperty('--announcement-height', announcement_height + "px");
          if (Alpine.store('xMiniCart').open) {
            sectionAnnouncement.style.zIndex = 55;
          } else {
            setTimeout(() => {
              sectionAnnouncement.style.zIndex = 61;
            }, 500);
          }
          sectionAnnouncement.style.top = "0px";
        }
        if (header.dataset.isSticky == 'true') {
          header_height = stickyHeader.offsetHeight;
        }
        if (document.querySelectorAll(".section-header ~ .section-announcement").length > 0) {
          if (this.isSticky) {
            if (stickyHeader.classList.contains('header-up')) {
              stickyHeader.style.top = "calc(-1 * (var(--top-header) + var(--announcement-height)))";
              sectionAnnouncement.style.top = "0px";
            } else {
              stickyHeader.style.top = "0px";
              sectionAnnouncement.style.top = header_height + "px";
            }
          } else {
            sectionAnnouncement.style.top = "0px";
          }
        } else if (document.querySelectorAll(".section-announcement ~ .section-header").length > 0) {
          const xAnnouncementEl = document.getElementById('x-announcement');
          if (xAnnouncementEl) xAnnouncementEl.style.zIndex = 55;
          if (this.isSticky) {
            if (stickyHeader.classList.contains('header-up')) {
              stickyHeader.style.top = "calc(-1 * (var(--top-header) + var(--announcement-height)))";
            } else {
              stickyHeader.style.top = announcement_height + "px";
            }
          }
        } else {
          if (this.isSticky) {
            if (stickyHeader.classList.contains('header-up')) {
              stickyHeader.style.top = "calc(-1 * (var(--top-header) + var(--announcement-height)))";
            } else {
              stickyHeader.style.top = announcement_height + "px";
            }
          }
        }
      },
      handleAlwaysSticky() {
        const scrollPos = window.scrollY || document.documentElement.scrollTop;
        const stickyLine = document.getElementById(this.sectionId).offsetTop;
        if (scrollPos > stickyLine && !this.mobileDockExists) this.addStickyHeader();
      },
      async handelOnScrollSticky() {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        if (scrollTop < this.offsetTop) {
          requestAnimationFrame(() => {
            document.getElementById("sticky-header").classList.remove('sticky-header');
          });
        }

        if (Math.abs(scrollTop - this.lastScrollTop) > 10) {
          if (scrollTop < this.lastScrollTop) {
            this.scrollDir = "up";
            document.getElementById('sticky-header').classList.remove('header-up', 'opacity-0');
            this.setVariableHeightHeader(true);
            await new Promise(r => setTimeout(r, 250));
          } else if (!this.themeModeChanged) {
            this.scrollDir = "down";
            document.getElementById('sticky-header').classList.add('header-up');
            this.setVariableHeightHeader(false);
            await new Promise(r => setTimeout(r, 250));
          }
          this.lastScrollTop = scrollTop;
        }
        this.themeModeChanged = false;
        this.setPositionTop();
      },
      addStickyHeader() {
        if (window.innerWidth < 768 && this.hasMobileDock()) {
          this.isSticky = false;
          requestAnimationFrame(() => {
            let stickyEl = document.getElementById("sticky-header");
            stickyEl?.classList.remove("sticky-header", 'reduce-logo-size', 'always-animation', 'on-scroll-up-animation');
            this.setVariableHeightHeader(false);
            this.setPositionTop();
          });
          return;
        }
        let isMiniCartOpen = false;
        if (Alpine.store('xMiniCart').open && this.stickyType != 'on-scroll-up') {
          isMiniCartOpen = true;
          requestAnimationFrame(() => {
            Alpine.store('xMiniCart').hideCart();
          });
        }

        requestAnimationFrame(() => {
          let stickyEl = document.getElementById("sticky-header");
          stickyEl.classList.add("sticky-header", 'reduce-logo-size');
          this.isSticky = true;
          this.showLogoTransparent = false;
        });

        requestAnimationFrame(() => {
          let stickyEl = document.getElementById("sticky-header");
          if (this.stickyType == 'on-scroll-up') {
            setTimeout(() => {
              stickyEl.classList.add('on-scroll-up-animation');
            }, 250);
          }
          if (!Alpine.store('xMiniCart').open || window.innerWidth > 768 ) {
            if (this.stickyType == 'always' || this.stickyType == 'reduce-logo-size') stickyEl.classList.add('always-animation');
          }
        });

        if (isMiniCartOpen) {
          requestAnimationFrame(() => {
            Alpine.store('xMiniCart').openCart();
          });
        }
        requestAnimationFrame(() => {
          this.setPositionTop();
        });
      },
      removeStickyHeader() {
        const scrollPos = window.scrollY || document.documentElement.scrollTop;
        const stickyLine = document.getElementById(this.sectionId)?.offsetTop;
        if (scrollPos <= stickyLine) {
          this.isSticky = false;
          if (!document.getElementById("sticky-header-content")?.classList.contains('sticky-header-active')) {
            this.showLogoTransparent = true;
          } else {
            this.showLogoTransparent = false;
          }
          if (!document.getElementById("sticky-header-content")?.classList.contains('background-header')) {
            this.clickedHeader = false;
          }
          requestAnimationFrame(() => {
            document.getElementById("sticky-header").classList
              .remove('sticky-header', 'reduce-logo-size', 'always-animation', 'on-scroll-up-animation');
            this.setVariableHeightHeader(false);
            this.setPositionTop();
          });
        }
        window.requestAnimationFrame(() => this.removeStickyHeader());
      },
      handleChangeThemeMode() {
        this.themeModeChanged = true;
        this.reCalculateHeaderHeight();
      },
      reCalculateHeaderHeight() {
        if (!this.isTransparent) {
          document.getElementById("x-header-container").style.height = document.getElementById("sticky-header").offsetHeight + 'px';
        }
      },
      setVariableHeightHeader(sticky) {
        let root = document.documentElement;
        if (sticky) {
          let height_header = document.getElementById("sticky-header") ? document.getElementById("sticky-header").offsetHeight : 0;
          if (document.querySelector("#x-announcement") && document.querySelector("#x-announcement")?.dataset.isSticky == 'true') {
            height_header = document.querySelector(".section-announcement").offsetHeight + height_header;
          }
          root.style.setProperty('--height-header', height_header + "px");
        } else {
          if (document.querySelector("#x-announcement") && document.querySelector("#x-announcement")?.dataset.isSticky == 'true') {
            root.style.setProperty('--height-header', document.querySelector(".section-announcement").offsetHeight + "px");
          } else {
            root.style.setProperty('--height-header', "0px");
          }
        }
      },
      setTopStickyHeader() {
        let root = document.documentElement;
        let top_height = document.getElementById("sticky-header-content").offsetHeight;
        root.style.setProperty('--top-header',top_height + "px");
      },
      setHeightScroll(el, index){
        let toggleMenu = el.querySelector('.toggle-menu-sub');
        if (!el.classList.contains('sub-menu-item')) {
          toggleMenu = el.closest(".sub-menu-item").querySelector('.toggle-menu-sub');
        }
         
        if (toggleMenu) {
          if (index) {
            if (index == 1 && el.parentElement.getBoundingClientRect().height < toggleMenu.getBoundingClientRect().height)
              el.parentElement.style.height = toggleMenu.getBoundingClientRect().height.toFixed(2) + 'px';
            return
          }
          el.parentElement.style.height = 'auto';
          if (el.parentElement.getBoundingClientRect().height < toggleMenu.getBoundingClientRect().height)
            el.parentElement.style.height = toggleMenu.getBoundingClientRect().height.toFixed(2) + 'px';
        }
      },
      setAnimationMenu(element, isSub) {
        let el = element;
        if (isSub) {
          el = el.closest(".toggle-menu").closest(".has-dropdown");
        }
        if (el.classList.contains("tabbed-animation-change")) {
          if (isSub == false) {
            if (el.querySelector(".toggle-menu") && el.querySelector(".toggle-menu").children[0]) {
              let subMenuHeight = el.querySelector(".toggle-menu")?.children[0].querySelector(".toggle-menu-sub")?.clientHeight;
              let initHeight = el.style.getPropertyValue('--init-menu-height');
              if (subMenuHeight > initHeight) {
                el.style.setProperty('--menu-height', subMenuHeight + 'px');
              } else {
                el.style.setProperty('--menu-height', initHeight + 'px');
              }
            }
          } else {
            let subMenuHeight = element.querySelector(".toggle-menu-sub")?.clientHeight;
            let initHeight = el.style.getPropertyValue('--init-menu-height');
            if (subMenuHeight > initHeight) {
              el.querySelector(".toggle-menu").style.setProperty('--menu-height', subMenuHeight + 'px');
            } else {
              el.querySelector(".toggle-menu").style.setProperty('--menu-height', initHeight + 'px');
            }
          }
        } else {
          if (isSub == false) {
            let menuHeight = el.style.getPropertyValue('--init-menu-height') ? el.style.getPropertyValue('--init-menu-height') : el.querySelector(".toggle-menu")?.children[0]?.clientHeight;
            el.style.setProperty('--menu-height', menuHeight + 'px');
          }
        }
      },
      initToggleMenuHeight(el) {
        let menuHeight = el.querySelector(".toggle-menu")?.children[0]?.clientHeight;
        el.style.setProperty('--init-menu-height', menuHeight);
      },
      tongleHorizontalHeight(el) {
        let height = el.querySelector(".toggle-menu-sub")?.offsetHeight;
        let menuHeight = el.style.getPropertyValue('--mega-menu-height').replace('px','');
        let initHeight = window.getComputedStyle(el).getPropertyValue('--init-menu-height');
        if (Number(height) + Number(menuHeight) > Number(initHeight)) {
          el.closest(".toggle-menu").style.setProperty('--menu-height', Number(height) + Number(menuHeight) + 10 + 'px');
        } else {
          el.closest(".toggle-menu").style.setProperty('--menu-height', Number(initHeight) + 'px');
        }
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xMobileNav', {
      show: false,
      loading: false,
      currentMenuLinks: [],
      open() {
        this.show = true;
        Alpine.store('xPopup').open = true;
      },
      close() {
        this.show = false;
        Alpine.store('xPopup').close();
      },
      setActiveLink(linkId) {
        this.currentMenuLinks.push(linkId);
      },
      removeActiveLink(linkId) {
        const index = this.currentMenuLinks.indexOf(linkId);
        if (index !== -1) {
          this.currentMenuLinks.splice(index, 1);
        }
      },
      resetMenu() {
        this.currentMenuLinks = [];
      },
      scrollTop(el = null) { 
        document.getElementById('menu-navigation').scrollTop = 0; 
        if (el) {
          el.closest('.scrollbar-body').scrollTop = 0;
        }
      }
    });

    Alpine.store('xPopup', {
      open: false,
      setWidthScrollbar() {
        const root = document.documentElement;
        const clientWidth = root.clientWidth;
        const width = Math.abs(window.innerWidth - clientWidth);
        root.style.setProperty('--width-scrollbar', width + "px");
      },
      close() {
        document.dispatchEvent(new CustomEvent("eurus:popup:close"));
        setTimeout(() => {
          this.open = false;
        }, 500);
      }
    }); 

    Alpine.store('xShowCookieBanner', {
      show: false
    });

    Alpine.store('xMiniCart', {
      open: false,
      type: '',
      loading: false,
      needReload: false,
      reLoad() {
        this.loading = true;
        const sections = Alpine.store('xCartHelper').getSectionsToRender().map(s => s.id).join(',');
        fetch(`${window.location.pathname}?sections=${sections}`)
        .then(response => response.json())
        .then(response => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              Alpine.store('xCartHelper').getSectionsToRender().forEach((section => {
                section.selector.split(',').forEach((selector) => {
                  const sectionElement = document.querySelector(selector);
                  if (sectionElement && response[section.id]) {
                    sectionElement.innerHTML = getSectionInnerHTML(response[section.id], selector);
                  }
                })
              }));
              this.loading = false;
            }, 0)
          });
        });
      },
      openCart() {
        if (window.location.pathname != '/cart') {        
          requestAnimationFrame(() => {
            if (Alpine.store('xQuickView') && Alpine.store('xQuickView').show) {
              Alpine.store('xQuickView').show = false;
            }
          });

          requestAnimationFrame(() => {
            document.getElementById('sticky-header').classList.remove('on-scroll-up-animation');

            if (window.innerWidth < 768 || this.type == "drawer") {
              setTimeout(() => {
                Alpine.store('xPopup').open = true;
              }, 50);
            }

            requestAnimationFrame(() => {
              document.getElementById('sticky-header').classList.remove('header-up');
              this.open = true;
              if (document.querySelector(".section-announcement")) {
                document.querySelector(".section-announcement").style.zIndex = 55;
              }
            });
            
            if (Alpine.store('xHeaderMenu').stickyType == 'on-scroll-up') {
              setTimeout(() => {
                requestAnimationFrame(() => {
                  document.getElementById('sticky-header').classList.add('on-scroll-up-animation');
                });
              }, 200);
            }
          });
        }
      },
      hideCart() {
        requestAnimationFrame(() => {
          this.open = false;
          Alpine.store('xPopup').close();
        });
      }
    });

    Alpine.store('xModal', {
      activeElement: "",
      focused: false,
      setActiveElement(element) {
        this.activeElement = element;
      },
      focus(container, elementFocus) {
        this.focused = true;
        Alpine.store('xFocusElement').trapFocus(container, elementFocus);
      },
      removeFocus() {
        this.focused = false;
        const openedBy = document.getElementById(this.activeElement);
        Alpine.store('xFocusElement').removeTrapFocus(openedBy);
      }
    });

    Alpine.store('xFocusElement', {
      focusableElements: ['button, [href], input, select, textarea, [tabindex]:not([tabindex^="-"])'],
      listeners: {},
      trapFocus(container, elementFocus) {
        if ( window.innerWidth < 1025 ) return;

        let c = document.getElementById(container);
        let e = document.getElementById(elementFocus);
        this.listeners = this.listeners || {};
        const elements = Array.from(c.querySelectorAll(this.focusableElements));
        var first = elements[0];
        var last = elements[elements.length - 1];
        
        this.removeTrapFocus();
        
        this.listeners.focusin = (event)=>{
          if (
            event.target !== c &&
            event.target !== last &&
            event.target !== first
          ){
            return;
          }
          document.addEventListener('keydown', this.listeners.keydown);
        };

        this.listeners.focusout = () => {
          document.removeEventListener('keydown', this.listeners.keydown);
        }

        this.listeners.keydown = (e) =>{
          if (e.code.toUpperCase() !== 'TAB') return;
  
          if (e.target === last && !e.shiftKey) {
            e.preventDefault();
            first.focus();
          }
  
          if ((e.target === first || e.target == c) && e.shiftKey) {
            e.preventDefault();
            last.focus();
          }
        }
        document.addEventListener('focusout', this.listeners.focusout);
        document.addEventListener('focusin', this.listeners.focusin);
        e.focus();
      },
      removeTrapFocus(elementToFocus = null) {
        if ( window.innerWidth < 1025 ) return;

        document.removeEventListener('focusin', ()=>{
          document.addEventListener('keydown', this.listeners.focusin);
        });
        document.removeEventListener('focusout', ()=>{
          document.removeEventListener('keydown', this.listeners.focusout);
        });
        document.removeEventListener('keydown', this.listeners.keydown);
        if (elementToFocus) elementToFocus.focus();
      }
    });

    Alpine.data('xTruncateText', () => ({
      truncateEl: "",
      truncateInnerEl: "",
      truncated: false,
      truncatable: false,
      label: "",
      expanded: false,
      load(truncateEl) {
        const truncateRect = truncateEl.getBoundingClientRect();
        truncateEl.style.setProperty("--truncate-height", `${truncateRect.height}px`);
      },
      setTruncate(element) {
        if (element.offsetHeight < element.scrollHeight || element.offsetWidth < element.scrollWidth) {
          this.truncated = true;
          this.truncatable = true;
          this.expanded = false;
        } else {
          this.truncated = false;
          this.truncatable = false
          this.expanded = true;;
        }
      },
      open(el, newLabel) {
        const truncateEl = el.closest('.truncate-container').querySelector('.truncate-text');
        this.expanded = true;
        this.label = newLabel;
        if (truncateEl.classList.contains('truncate-expanded')) {
          this.truncated = true;
        } else {
          const truncateInnerEl = truncateEl.querySelector('.truncate-inner');
          window.requestAnimationFrame(() => {
            const truncateInnerRect = truncateInnerEl.getBoundingClientRect();
            truncateEl.style.setProperty("--truncate-height-expanded", `${truncateInnerRect.height}px`);
            truncateEl.classList.add('truncate-expanded');
          });
          this.truncated = false;
        }
      },
      close(el, newLabel, isQuickview = false) {
        this.label = newLabel;
        const truncateEl = el.closest('.truncate-container').querySelector('.truncate-text');
        const isInViewport = () => {
          const rect = truncateEl.getBoundingClientRect();
          return (rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth))
        }
        this.truncated = true;
        if (!isInViewport() && !isQuickview) {
          const scrollPosition = truncateEl.getBoundingClientRect().top + window.scrollY - 500 ;
          window.scrollTo({
            top: scrollPosition,
            behavior: 'smooth'
        });
        truncateEl.style.transition = 'none'
          setTimeout(() => {
            truncateEl.style.transition = ''
          }, 1000)
        }
        truncateEl.classList.remove('truncate-expanded');
        this.expanded = false;
      }
    }));

    Alpine.store('xPopupPriceDetail', {
      open: false,
      cachedResults: [],
      show(event, productID, price, priceMax, priceMiddle, priceMin, shopUrl, pageHandle) {
        event.preventDefault()
        let content = document.getElementById("popup-price-content");
        if (this.cachedResults[productID]) {
          content.innerHTML = this.cachedResults[productID];
          this.open = true;
          return true;
        }

        let url = `${shopUrl}/pages/${pageHandle}`;
        fetch(url, {
          method: 'GET'
        }).then(
          response => response.text()
        ).then(responseText => {
          const html = (new DOMParser()).parseFromString(responseText, 'text/html');
          const textContent = html.querySelector(".page__container .page__body>div").innerHTML;
          let updatedContent = textContent.replace("{price}", `${price}`).replace("{max_price}", `${priceMax}`).replace("{middle_price}", `${priceMiddle}`).replace("{min_price}", `${priceMin}`);
          
          content.innerHTML = updatedContent;
          this.cachedResults[productID] = updatedContent;
        }).finally(() => {
          this.open = true;
        })
      },
      close() {
        this.open = false;
      }
    });
    
    Alpine.store("xEstimateDelivery", {
      day: 0,
      hour: 0,
      minute: 0,
      noti: '',
      countdownCutOffTime(cutOffHour, cutOffMinute, hrsText, minsText, calculationType, daysText, dayText, hrText, minText, excludeDay, holidayList, currentLanguage) {
        if (this.noti != '') return;
        const holidayArray = holidayList ? holidayList.split(',').map(holiday => { 
          const parts = holiday.trim().split(' ');
          const day = parts.pop().padStart(2, '0');
          
          return `${parts.join(' ')} ${day}`;
        }) : [];

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour, currentMinute);
        const cutOff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutOffHour, cutOffMinute);

        if (current >= cutOff) {
          cutOff.setDate(cutOff.getDate() + 1);
        }
        if (calculationType == 'working') {
          let isInvalid = true;

          while (isInvalid) {
            isInvalid = false;

            if (excludeDay === 'saturday_sunday' && (cutOff.getDay() === 6 || cutOff.getDay() === 0)) {
              if (cutOff.getDay() === 6) {
                cutOff.setDate(cutOff.getDate() + 2);
              } else {
                cutOff.setDate(cutOff.getDate() + 1);
              }
              isInvalid = true;
              continue;
            }

            if (excludeDay === 'saturday' && cutOff.getDay() === 6) {
              cutOff.setDate(cutOff.getDate() + 1);
              isInvalid = true;
              continue;
            }

            if (excludeDay === 'sunday' && cutOff.getDay() === 0) {
              cutOff.setDate(cutOff.getDate() + 1);
              isInvalid = true;
              continue;
            }

            if (holidayArray.length > 0) {
              const dayOfMonth = cutOff.getDate();
              const monthName = new Intl.DateTimeFormat(currentLanguage, { month: "long" }).format(cutOff);
              const dateString = `${monthName} ${dayOfMonth < 10 ? `0${dayOfMonth}` : dayOfMonth}`;

              if (holidayArray.includes(dateString)) {
                cutOff.setDate(cutOff.getDate() + 1);
                isInvalid = true;
                continue;
              }
            }
          }
        }

        const diffMs = cutOff - current;

        this.day = Math.floor(diffMs / 1000 / 60 / 60 / 24);
        this.hour = Math.floor((diffMs / 1000 / 60 / 60) % 24);
        this.minute = Math.floor((diffMs / 1000 / 60) % 60);

        this.noti = this.day > 0 ? this.day + ' ' + (this.day > 1 ? daysText : dayText) + ' ' : ''
        this.noti += this.hour > 0 ? this.hour + ' ' + (this.hour > 1 ? hrsText : hrText) + ' ' + this.minute + ' ' + (this.minute > 1 ? minsText : minText) : this.minute + ' ' + (this.minute > 1 ? minsText : minText);
        return this.noti;
      },
      calculateCutOffTime(el, cutOffHour, cutOffMinute, hrsText, minsText, calculationType, daysText, dayText, hrText, minText, excludeDay, holidayList, currentLanguage) {
        const holidayArray = holidayList ? holidayList.split(',').map(holiday => { 
          const parts = holiday.trim().split(' ');
          const day = parts.pop().padStart(2, '0');

          return `${parts.join(' ')} ${day}`;
        }) : [];

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), currentHour, currentMinute);
        const cutOff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cutOffHour, cutOffMinute);

        if (current >= cutOff) {
          cutOff.setDate(cutOff.getDate() + 1);
        }

        if (calculationType == 'working') {
          let isInvalid = true;

          while (isInvalid) {
            isInvalid = false;

            if (excludeDay === 'saturday_sunday' && (cutOff.getDay() === 6 || cutOff.getDay() === 0)) {
              if (cutOff.getDay() === 6) {
                cutOff.setDate(cutOff.getDate() + 2);
              } else {
                cutOff.setDate(cutOff.getDate() + 1);
              }
              isInvalid = true;
              continue;
            }

            if (excludeDay === 'saturday' && cutOff.getDay() === 6) {
              cutOff.setDate(cutOff.getDate() + 1);
              isInvalid = true;
              continue;
            }

            if (excludeDay === 'sunday' && cutOff.getDay() === 0) {
              cutOff.setDate(cutOff.getDate() + 1);
              isInvalid = true;
              continue;
            }

            if (holidayArray.length > 0) {
              const dayOfMonth = cutOff.getDate();
              const monthName = new Intl.DateTimeFormat(currentLanguage, { month: "long" }).format(cutOff);
              const dateString = `${monthName} ${dayOfMonth < 10 ? `0${dayOfMonth}` : dayOfMonth}`;

              if (holidayArray.includes(dateString)) {
                cutOff.setDate(cutOff.getDate() + 1);
                isInvalid = true;
                continue;
              }
            }
          }
        }

        const diffMs = cutOff - current;
        
        const day = Math.floor(diffMs / 1000 / 60 / 60 / 24);
        const hour = Math.floor((diffMs / 1000 / 60 / 60) % 24);
        const minute = Math.floor((diffMs / 1000 / 60) % 60);
        let noti = day > 0 ? day + ' ' + (day > 1 ? daysText : dayText) + ' ' : ''
        noti += hour > 0 ? hour + ' ' + (hour > 1 ? hrsText : hrText) + ' ' + minute + ' ' + (minute > 1 ? minsText : minText) : minute + ' ' + (minute > 1 ? minsText : minText);

        this.noti = noti;

        el.value = el.value.replace('time_to_cut_off', noti);
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xCartAnalytics', {
      viewCart() {
        fetch(
          '/cart.js'
        ).then(response => {
          return response.text();
        }).then(cart => {
          cart = JSON.parse(cart);
          if (cart.items.length > 0) {
            Shopify.analytics.publish('view_cart', {'cart': cart});
          }
        });
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xCustomerEvent', {
      fire(eventName, el, data) {
        if (Shopify.designMode) return;
        
        const formatedData = data ? data : xParseJSON(el.getAttribute('x-customer-event-data'));
        Shopify.analytics.publish(eventName, formatedData);
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xSplide', {
      load(el, configs) {
        const initSlider = () => {
          const id = el.getAttribute("id");
          if(configs.classes != undefined) {
            if (!configs.classes.arrow) configs.classes.arrow = "arrow w-8 h-8 p-2 absolute z-10 top-1/2 -translate-y-1/2 hidden md:flex items-center justify-center";
            if (!configs.classes.next) configs.classes.next = "right-0";
            if (!configs.classes.prev) configs.classes.prev = "-rotate-180";
          }
          let splide = new Splide("#" + id, configs);
          if (configs.thumbs) {
            let thumbsRoot = document.getElementById(configs.thumbs);
            let thumbs = thumbsRoot.getElementsByClassName('x-thumbnail');
            let current;
            let _this = this;

            for (let i = 0; i < thumbs.length; i++) {
              if (thumbs[i] == current) {
                thumbs[i].classList.remove('opacity-30');
              } else {
                thumbs[i].classList.add('opacity-30');
              }
              thumbs[i].addEventListener('click', function () {
                _this.moveThumbnail(i, thumbs[i], thumbsRoot, configs.thumbs_direction, configs.direction);
                splide.go(i);
              });
            }

            splide.on('refresh', function () {
              for (let i = 0; i < thumbs.length; i++) {
                thumbs[i].removeEventListener('click', function () {
                  _this.moveThumbnail(i, thumbs[i], thumbsRoot, configs.thumbs_direction, configs.direction);
                  splide.go(i);
                });
              }

              let thumbsRoot = document.getElementById(configs.thumbs);
              let thumbsNew = thumbsRoot.getElementsByClassName('x-thumbnail');

              for (let i = 0; i < thumbsNew.length; i++) {
                if (i == 0) {
                  thumbsNew[i].classList.remove('opacity-30');
                } else {
                  thumbsNew[i].classList.add('opacity-30');
                }
                
                thumbsNew[i].addEventListener('click', function () {
                  _this.moveThumbnail(i, thumbsNew[i], thumbsRoot, configs.thumbs_direction, configs.direction);
                  splide.go(i);
                });
              }
            })
            splide.on('mounted move', function () {
              let thumbnail = thumbs[splide.index];
              if (thumbnail) {
                if (current) {
                  current.classList.add('opacity-30');
                }
                thumbnail.classList.remove('opacity-30');
                current = thumbnail;
                _this.moveThumbnail(splide.index, thumbnail, thumbsRoot, configs.thumbs_direction, configs.direction);
              }
            });
          }

          if (configs.hotspot) {
            let hotspotRoot = document.getElementById(configs.hotspot);
            let hotspots = hotspotRoot.getElementsByClassName('x-hotspot');
            let current;

            if (configs.disableHoverOnTouch && (('ontouchstart' in window) || window.DocumentTouch && window.document instanceof DocumentTouch || window.navigator.maxTouchPoints || window.navigator.msMaxTouchPoints)) {
              for (let i = 0; i < hotspots.length; i++) {
                hotspots[i].addEventListener('click', function () {
                  splide.go(i);
                });
              }
            } else {
              for (let i = 0; i < hotspots.length; i++) {
                hotspots[i].addEventListener('mouseover', function () {
                  splide.go(i);
                });
                hotspots[i].addEventListener('focus', function () {
                  splide.go(i);
                });
              }             
            }
            splide.on('mounted move', function () {
              let hotspot = hotspots[splide.index];
              
              if (hotspot) {
                if (current) {
                  current.classList.remove('active-hotspot');
                }
                hotspot.classList.add('active-hotspot');
                current = hotspot;
              }
            });
          }
          if (configs.cardHover) {
            let cardImage = document.getElementById(configs.cardHover);
            if (window.innerWidth > 1024) {
              cardImage.addEventListener('mousemove', function (e) {
                let left = e.offsetX;
                let width = cardImage.getBoundingClientRect().width;
                let spacing = left / width;
                let index = Math.floor(spacing * configs.maxSlide);
                splide.go(index);
              });
              cardImage.addEventListener('mouseleave', function (e) {
                splide.go(0);
              });
            }
          }
          if (configs.progressBar) {
            var bar = splide.root.querySelector( '.splide-progress-bar' );
            splide.on( 'mounted move', function () {
              var end  = configs.progressBar;
              if (configs.progressBarHeader) {
                end  = splide.Components.Slides.getLength();
              }
              var rate = 100 * (splide.index / end);
              if (bar) {
                var widthBar =  window.getComputedStyle(bar).getPropertyValue('width').replace("px", '');
                var widthProgressBar = window.getComputedStyle(bar.closest('.splide-progress')).getPropertyValue('width').replace("px", '');
                var percentBar = 100 * (Number(widthBar) /  Number(widthProgressBar));
                var rateBar = rate + percentBar;
                var maxRate = 100 - percentBar;
                if(rateBar > 100 ) {
                  rate = maxRate;
                }
                if(document.querySelector('body').classList.contains('rtl')) {
                  bar.style.marginRight = rate + '%';
                }else {
                  bar.style.marginLeft = rate + '%';
                }  
              }
            });
          }
          if(el.classList.contains('card-product-img')) {
            splide.on('resized', function() { 
              var height = splide.root.querySelector('.splide__track').offsetHeight;
              splide.Components.Slides.get().forEach((item) => {
                item.slide.style.height = height+"px";
              });
            }) 
          }

          if (configs.events) {
            configs.events.forEach((e) => {
              splide.on(e.event, e.callback);
            });
          }

          
          el.splide = splide;
          splide.mount();
          if (configs.videoProduct) {
            const move = splide.Components.Move;
            move.translate(move.toPosition(0));  
          }

          if (configs.playOnHover && window.innerWidth > 1024) {
            splide.Components.Autoplay.pause();
            el.onmouseover = function() {
              splide.Components.Autoplay.play();
            };
            el.onmouseout = function() {
              splide.Components.Autoplay.pause();
            };
          }
        }

        if (!window.Eurus.loadedScript.has('slider')) {
          deferScriptLoad('slider', window.Eurus.sliderScript, initSlider, true);
        } else if (window.Splide){
          initSlider();
        } else {
          document.addEventListener('slider loaded', () => {
            initSlider();
          });
        }
      },
      togglePlayPause(el) {
        if (!el || !el.splide || !el.splide.Components.Autoplay) return;
      
        const splide = el.splide;
        const autoplay = splide.Components.Autoplay;
      
        if (autoplay.isPaused()) {
          autoplay.play();
        } else {
          splide.go(0);
          autoplay.pause();
        }
      },
      moveThumbnail(index, thumbnail, thumbsRoot, direction) {
        if (thumbnail) {
          if (direction == 'vertical') {
            setTimeout(() => {
              thumbsRoot.scrollTop = (index + 1) * thumbnail.offsetHeight - thumbsRoot.offsetHeight * 0.5 + thumbnail.offsetHeight * 0.5 + index * 6;
            },50);
          } else {
            thumbsRoot.scrollLeft = (index - 2) * thumbnail.offsetWidth;
          }
        }
      }
    });
  });
});

requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.data('xParallax', () => ({
      debounce(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            var later = function() {
              timeout = null;
              func.apply(context, args);
            };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
      },
      load(disable) {
        if (disable) return;

        if ("IntersectionObserver" in window && 'IntersectionObserverEntry' in window) {
          const observerOptions = {
            root: null,
            rootMargin: '0px 0px',
            threshold: 0
          };

          var observer = new IntersectionObserver(handleIntersect, observerOptions);
          var el;
          function handleIntersect(entries) {
            entries.forEach(function(entry) {
              if (entry.isIntersecting) {
                el = entry.target;
                window.addEventListener('scroll', parallax, {passive: true, capture: false});
              } else {
                window.removeEventListener('scroll', parallax, {passive: true, capture: false});
              }
            });
          }

          observer.observe(this.$el);
          
          var parallax = this.debounce(function() {
            var rect = el.getBoundingClientRect();
            var speed = (window.innerHeight / el.parentElement.offsetHeight) * 20;
            var shiftDistance = (rect.top - window.innerHeight) / speed;
            var maxShiftDistance = el.parentElement.offsetHeight / 11;
            
            if (shiftDistance < -maxShiftDistance || shiftDistance > maxShiftDistance) {
              shiftDistance = -maxShiftDistance;
            }
            
            el.style.transform = 'translate3d(0, '+ shiftDistance +'px, 0)';
          }, 10);
        }
      }
    }));
  });
});

requestAnimationFrame(() => {
  // Optimize INP
  document.addEventListener('alpine:init', () => {
    Alpine.store('xDOM', {
      rePainting: null, // String: alias element re-painting.
    })
  })
})
