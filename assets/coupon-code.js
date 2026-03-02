if (!window.Eurus.loadedScript.has('coupon-code.js')) {
  window.Eurus.loadedScript.add('coupon-code.js');
  
  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data("xCouponCodeList", (sectionId) => ({
        loading: true,
        load() {
          this.loading = true;
          let url = `${window.location.pathname}?section_id=${sectionId}`;
          fetch(url, {
            method: 'GET'
          }).then(
            response => response.text()
          ).then(responseText => {
            const html = (new DOMParser()).parseFromString(responseText, 'text/html');
            const contentId = `x-promo-code-list-${sectionId}`;
            const newContent = html.getElementById(contentId);
            if (newContent && !document.getElementById(contentId)) {
              container.appendChild(newContent);
            }
            this.loading = false;
          })
        }
      }));
      
      Alpine.data("xCouponCode", (freeShippingCodes) => ({
        copySuccess: false,
        loading: false,
        disableCoupon: false,
        disableComing: false,
        discountCode: "",
        errorMessage: false,
        appliedDiscountCode: false,
        load(discountCode) {
          this.setAppliedButton(discountCode)
          document.addEventListener(`eurus:cart:discount-code:change`, (e) => {
            this.setAppliedButton(discountCode)
          })
        },
        copyCode() {
          if (this.copySuccess) return;

          const discountCode = this.$refs.code_value.textContent.trim();
          navigator.clipboard.writeText(discountCode).then(
            () => {
              this.copySuccess = true;
              const copyEvent = new Event('copy');
              document.dispatchEvent(copyEvent);
              
              setTimeout(() => {
                this.copySuccess = false;
              }, 5000);
            },
            () => {
              alert('Copy fail');
            }
          );
        },
        applyCouponCode(discountCode, isCart=false) {
          Alpine.store('xCouponCodeDetail').discountFaild = false;
          Alpine.store('xCouponCodeDetail').discountApplied = false;
          Alpine.store('xCouponCodeDetail').discountCorrect = false;
          Alpine.store('xCouponCodeDetail').getDiscountCode();
          let appliedDiscountCodes = JSON.parse(JSON.stringify(Alpine.store('xCouponCodeDetail').appliedDiscountCodes));
          const appliedDiscount = document.querySelectorAll(".discount-title:not(.hidden)");
          let checkedDiscount = false;
          if (appliedDiscount.length > 0) {
            appliedDiscount.forEach((discount) => {
              if (discount.innerText.toLowerCase() == discountCode.toLowerCase()) checkedDiscount = true;
            });
          }
          if (freeShippingCodes) {
            if (freeShippingCodes.includes(this.discountCode)) {
              Alpine.store('xCouponCodeDetail').freeShippingApplied = true;
              setTimeout(() => {
                Alpine.store('xCouponCodeDetail').freeShippingApplied = false;
              }, 5000);
              return;
            }
          }

          if (checkedDiscount) {
            Alpine.store('xCouponCodeDetail').discountApplied = true;
            document.querySelector("#x-cart-discount-field").value = '';
            this.discountCode = '';
            setTimeout(() => {
              Alpine.store('xCouponCodeDetail').discountApplied = false;
            }, 3000);
            return true;
          }
          if (discountCode) {
            let discountCodes = appliedDiscountCodes.length > 0 ? [...new Set([...appliedDiscountCodes, discountCode])].join(",") : discountCode;
            this.loading = true;
            fetch('/cart/update.js', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                "discount": discountCodes,
                "sections":  Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id)
              }),
            }).then(response=>{
              return response.json();
            }).then((response) => {
              if (response.status != '422') {
                Alpine.store('xCartHelper').reRenderSections(response.sections);
                Alpine.store('xCouponCodeDetail').appliedDiscountCodes = []
                response.discount_codes.forEach(code => {
                  if (code.applicable) {
                    Alpine.store('xCouponCodeDetail').appliedDiscountCodes.push(code.code);
                    if (code.code === discountCode) {
                      checkedDiscount = true;
                    }
                  }
                })
                document.cookie = `eurus_discount_code=${Alpine.store('xCouponCodeDetail').appliedDiscountCodes}; path=/`;
                if (checkedDiscount) {
                  Alpine.store('xCouponCodeDetail').discountCorrect = true;
                } else {
                  Alpine.store('xCouponCodeDetail').discountFaild = true;
                }
                Alpine.store('xCouponCodeDetail').appliedDiscountCodes.push(discountCode);
                Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
                document.dispatchEvent(new CustomEvent(`eurus:cart:discount-code:change`));
                if (isCart == false) {
                  this.setAppliedButton(discountCode)
                  if (Alpine.store('xCartHelper').currentItemCount == 0) {
                    const elementError = this.$el.closest('.promo-code-item').querySelector('.error-message');
                    this.errorMessage = true;
                    elementError.classList.remove('hidden', 'opacity-0');
                    elementError.classList.add('block', 'opacity-100');

                    setTimeout(function() {
                      elementError.classList.remove('block', 'opacity-100');
                      elementError.classList.add('hidden', 'opacity-0');
                    }, 3000);
                  } else {
                    this.errorMessage = false;
                    Alpine.store('xMiniCart').openCart();
                  }
                }
              }
            }).finally(() => {
              this.loading = false;
              Alpine.store('xCouponCodeDetail').removedDiscountCode = '';
              setTimeout(() => {
                Alpine.store('xCouponCodeDetail').discountFaild = false;
              }, 5000);
              setTimeout(() => {
                Alpine.store('xCouponCodeDetail').discountCorrect = false;
              }, 3000);
            });
          }
        },
        handleScheduleCoupon(el) {
          let settings = xParseJSON(el.getAttribute('x-countdown-data'));
          let timeSettings = Alpine.store('xHelper').handleTime(settings);
          if (timeSettings.distance < 0 && settings.set_end_date) {
            this.disableCoupon = true;
          } else if ( timeSettings.startTime > timeSettings.now) {
            this.disableCoupon = true;
            this.disableComing = true;
          }
        },
        onChange() {
          this.discountCode = this.$el.value;
        },
        applyDiscountToCart() {
          this.applyCouponCode(this.discountCode, true);
        },
        undoRemoveDiscount() {
          this.applyCouponCode(Alpine.store('xCouponCodeDetail').removedDiscountCode, true);
        },
        setAppliedButton(discountCode) {
          let appliedDiscountCodes = JSON.parse(JSON.stringify(Alpine.store('xCouponCodeDetail').appliedDiscountCodes))
          if (discountCode && appliedDiscountCodes.indexOf(discountCode) != -1) {
            this.appliedDiscountCode = true;
          } else {
            this.appliedDiscountCode = false;
          }
        }
      }));

      Alpine.store('xCouponCodeDetail', {
        show: false,
        promoCodeDetail: {},
        sectionID: "",
        discountCodeApplied: "",
        appliedDiscountCodes: [],
        removedDiscountCode: '',
        cachedResults: [],
        loading: false,
        cartEmpty: true,
        discountFaild: false,
        discountApplied: false,
        freeShippingApplied: false,
        discountCorrect: false,
        handleCouponSelect(shopUrl) {
          var _this = this;
          const promoCodeDetail = JSON.parse(JSON.stringify(this.promoCodeDetail));
  
          document.addEventListener('shopify:section:select', function(event) {
            if (event.target.classList.contains('section-promo-code') == false) {
              if (window.Alpine) {
                _this.close();
              } else {
                document.addEventListener('alpine:initialized', () => {
                  _this.close();
                });
              }
            }
          })

          if(promoCodeDetail && promoCodeDetail.blockID && promoCodeDetail.sectionID) {
            this.promoCodeDetail = xParseJSON(document.getElementById('x-data-promocode-' + promoCodeDetail.blockID).getAttribute('x-data-promocode'));
            let contentContainer = document.getElementById('PromoCodeContent-' + this.promoCodeDetail.sectionID);
            if (this.cachedResults[this.promoCodeDetail.blockID]) {
              contentContainer.innerHTML = this.cachedResults[this.promoCodeDetail.blockID];
              return true;
            }
            if (this.promoCodeDetail.page != '') {
              let url = `${shopUrl}/pages/${this.promoCodeDetail.page}`;
              fetch(url, {
                method: 'GET'
              }).then(
                response => response.text()
              ).then(responseText => {
                const html = (new DOMParser()).parseFromString(responseText, 'text/html');
                contentContainer.innerHTML = html.querySelector(".page__container .page__body").innerHTML;
              })
            } else if (this.promoCodeDetail.details != '') {
              contentContainer.innerHTML = this.promoCodeDetail.details;
              contentContainer.innerHTML = contentContainer.textContent;
            }
          }
        },
        load(el, blockID, shopUrl) {
          this.promoCodeDetail = xParseJSON(el.closest('#x-data-promocode-' + blockID).getAttribute('x-data-promocode'));
          let contentContainer = document.getElementById('PromoCodeContent-' + this.promoCodeDetail.sectionID);
          this.sectionID = this.promoCodeDetail.sectionID;
          if (this.cachedResults[blockID]) {
            contentContainer.innerHTML = this.cachedResults[blockID];
            return true;
          }
          if (this.promoCodeDetail.page != '') {
            this.loading = true;
            let url = `${shopUrl}/pages/${this.promoCodeDetail.page}`;
            fetch(url, {
              method: 'GET'
            }).then(
              response => response.text()
            ).then(responseText => {
              const html = (new DOMParser()).parseFromString(responseText, 'text/html');
              const content = html.querySelector(".page__container .page__body").innerHTML;
              contentContainer.innerHTML = content;
              this.cachedResults[blockID] = content;
            }).finally(() => {
              this.loading = false;
            })
          } else if (this.promoCodeDetail.details != '') {
            contentContainer.innerHTML = this.promoCodeDetail.details;
            contentContainer.innerHTML = contentContainer.textContent;
          }
        },
        showPromoCodeDetail() {
          this.show = true;
          Alpine.store('xPopup').open = true;
        },
        close() {
          this.show = false;
          Alpine.store('xPopup').close();
        },
        removeDiscountCode(el, isCart=false) {
          Alpine.store('xCouponCodeDetail').discountFaild = false;
          Alpine.store('xCouponCodeDetail').discountApplied = false;
          Alpine.store('xCouponCodeDetail').discountCorrect = false;
          
          this.getDiscountCode();

          const discountCode = el.closest('li.x-discount').querySelector('.discount-title:not(.hidden)').textContent.toLowerCase();

          let discountIndex = this.appliedDiscountCodes.findIndex(code => code.toLowerCase() === discountCode);
          if (discountIndex !== -1) {
            this.appliedDiscountCodes.splice(discountIndex, 1);
          } 

          this.loading = true;
          fetch('/cart/update.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              "discount": this.appliedDiscountCodes.join(','),
              "sections":  Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id)
            }),
          }).then(response=>{
            return response.json();
          }).then((response) => {
            if (response.status != '422') {
              Alpine.store('xCartHelper').reRenderSections(response.sections);
              this.appliedDiscountCodes = []
              response.discount_codes.forEach(code => {
                if (code.applicable) this.appliedDiscountCodes.push(code.code);
              })
              document.cookie = `eurus_discount_code=${this.appliedDiscountCodes}; path=/`;
              Alpine.store('xCartHelper').currentItemCount = parseInt(document.querySelector('#cart-icon-bubble span').innerHTML);
              document.dispatchEvent(new CustomEvent(`eurus:cart:discount-code:change`));
              if (isCart == false) {
                this.setAppliedButton(discountCode)
                if (Alpine.store('xCartHelper').currentItemCount == 0) {
                  const elementError = this.$el.closest('.promo-code-item').querySelector('.error-message');
                  this.errorMessage = true;
                  elementError.classList.remove('hidden', 'opacity-0');
                  elementError.classList.add('block', 'opacity-100');

                  setTimeout(function() {
                    elementError.classList.remove('block', 'opacity-100');
                    elementError.classList.add('hidden', 'opacity-0');
                  }, 3000);
                } else {
                  this.errorMessage = false;
                  Alpine.store('xMiniCart').openCart();
                }
              }
            }
          }).finally(() => {
            this.loading = false;
            this.removedDiscountCode = discountCode;
            setTimeout(() => {
              Alpine.store('xCouponCodeDetail').discountFaild = false;
            }, 5000);
            setTimeout(() => {
              Alpine.store('xCouponCodeDetail').discountCorrect = false;
            }, 3000);
          });
        },
        clearRemovedDiscount() {
          this.removedDiscountCode = '';
        },
        getDiscountCode() {
          let cookieValue = document.cookie.match('(^|;)\\s*' + 'eurus_discount_code' + '\\s*=\\s*([^;]+)');
          let appliedDiscountCodes = cookieValue ? cookieValue.pop() : '';
          if (appliedDiscountCodes) {
            this.appliedDiscountCodes = appliedDiscountCodes.split(",");
          }
        }
      });
    });
  });
}