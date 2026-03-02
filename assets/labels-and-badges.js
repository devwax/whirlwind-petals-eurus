requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xBadges', {
      loadingEl: new Set(),
      fixedPositionTemplate: `<div
        class="x-badge-{label-id} x-badge-container pointer-events-none{container-img-class} ltr"
        {preview-show-condition}
      >
        {content}
      </div>`,
      customPositionTemplate: `<div
        class="x-badge-{label-id} x-badge-container min-w-fit max-w-full max-h-full pointer-events-none{container-css-class} ltr"
        x-data="{
          contentHeight: 1,
          rePosition() {
            this.$nextTick(() => {
              this.contentHeight = this.$refs.content ? this.$refs.content.offsetHeight : contentHeight;
            });
          }
        }"
        x-intersect.once="rePosition();
          if (Shopify.designMode) {
            window.addEventListener('resize', () => {
              if ($store.xBadges.lastWindowWidth != window.innerWidth) {
                rePosition();
              }
            });
          } else {
            installMediaQueryWatcher('(min-width: 768px)', (matches) => rePosition());
          }"
        {preview-show-condition}
        :style="'{css-position} min-height: ' + contentHeight + 'px'"
      >
        {content}
      </div>`,
      productDetailTemplate: `
      {teleport-template-open}
        <div
          class="x-badge-{label-id} x-badge-container min-w-fit max-w-full max-h-full bottom-0 pointer-events-none{container-css-class}{container-img-class}"
          style="{css-position}"
          x-data="{
            contentHeight: 1,
            rePosition() {
              this.$nextTick(() => {
                this.contentHeight = this.$refs.content ? this.$refs.content.offsetHeight : contentHeight;
              });
            }
          }"
          x-intersect.once="rePosition();
            if (Shopify.designMode) {
              window.addEventListener('resize', () => {
                if ($store.xBadges.lastWindowWidth != window.innerWidth) {
                  rePosition();
                }
              });
            } else {
              installMediaQueryWatcher('(min-width: 768px)', (matches) => rePosition());
            }"
        >
          {content}
        </div>
      {teleport-template-close}
      `,
      outSideImageTemplate: `<div class="hidden" 
        x-data="{
          setPosition() {
            const element = $el.closest('.card-product').getElementsByClassName('{queryEL}');
            for (let i = 0; i < element.length; i++) {
              element[i].innerHTML += $el.innerHTML;
            }
          }
        }"
        x-init="setPosition()">
        <div
          class="x-badge-{label-id} x-badge-container min-w-fit max-w-full max-h-full bottom-0 pointer-events-none{container-img-class}"
          {preview-show-condition}
        >
          {content}
        </div>
      </div>`,
      previewActiveBlock: window.xBadgesPreviewActiveBlock,
      init() {
        if (Shopify.designMode) {
          document.addEventListener('shopify:block:select', (event) => {
            if (!event.target.classList.contains('x-badges-block-preview')) return;

            let blockId = event.target.getAttribute('block-id');
            this.previewActiveBlock = blockId;
            window.xBadgesPreviewActiveBlock = blockId;
            document.dispatchEvent(new CustomEvent("eurus:badges:block-select"));
          });
        }
      },
      load(el, callback = () => {}, container = null, productCard = false, isByob = false) {
        if (this.loadingEl.has(el)) return;
        this.loadingEl.add(el);
        if (container) el.container = container;

        const sliderEl = el.closest('[x-data-slider]');
        if (sliderEl) {
          if (!sliderEl.classList.contains('is-initialized')) {
            if (isByob) {
              this.doLoad(el, productCard, callback);
            }
            const sectionId = el.closest('[x-data-slider]').getAttribute('x-data-slider');
            document.addEventListener(`eurus:${sectionId}:splide-ready`, () => {
              this.doLoad(el, productCard, callback);
            });
          } else {
            this.doLoad(el, productCard, callback);
          }
        } else {
          this.doLoad(el, productCard, callback);
        }
        this.loadingEl.delete(el);
      },
      doLoad(el, productCard, callback = () => {}) {
        this.initAllLabels(el, productCard);

        if (Shopify.designMode) {
          let productData = xParseJSON(el.getAttribute('x-labels-data'));
          document.addEventListener('shopify:section:load', () => {
            if (productData && !productData.isXBadgesPreview) {
              this.initAllLabels(el, productCard);
            }
          });
        }

        callback(el);
      },
      initAllLabels(el, productCard) {
          let productDatas = xParseJSON(el.getAttribute('x-labels-data'));
          let allLabels = document.getElementsByClassName('x-badges-block-data');

          if (!productDatas) return;

          if (Shopify.designMode || productCard) {
            const cardProduct = el.closest('.card-product');
            if (cardProduct) {
              let currentLabels = cardProduct.getElementsByClassName('x-badge-container');
              while (currentLabels?.length > 0) {
                currentLabels[0].remove();
              }
            }
          }

          if (productCard) {
            requestAnimationFrame(() => {
              let variantId = null;
              const variantEl = el.closest('.card-product')?.querySelector(".current-variant");

              if (variantEl) {
                const currentVariant = JSON.parse(el.closest('.card-product')?.querySelector(".current-variant")?.textContent);
                variantId = (typeof currentVariant === 'object') ? currentVariant.id : currentVariant;
              }
              
              if (variantId) {
                productDatas.forEach(productData => {
                  if (productData.variant_id === Number(variantId)) {
                    for (let i = 0;i < allLabels.length;i++) {
                      let label = xParseJSON(allLabels[i].getAttribute('x-badges-block-data'));
                      if (!label.enable && !productData.isXBadgesPreview) return;
                      
                      label.settings.icon = allLabels[i].getAttribute('x-badges-icon');
                      this.appendLabel(el, label, productData);
                    }  
                  }
                });    
              } else {
                for (let i = 0;i < allLabels.length;i++) {
                  let label = xParseJSON(allLabels[i].getAttribute('x-badges-block-data'));
                  if (!label.enable && !productDatas[0].isXBadgesPreview) return;
                  
                  label.settings.icon = allLabels[i].getAttribute('x-badges-icon');
                  this.appendLabel(el, label, productDatas[0]);
                }  
              }
            });
          } else {
            for (let i = 0;i < allLabels.length;i++) {
              let label = xParseJSON(allLabels[i].getAttribute('x-badges-block-data'));
              if (!label.enable && !productDatas.isXBadgesPreview) return;
              
              label.settings.icon = allLabels[i].getAttribute('x-badges-icon');
              this.appendLabel(el, label, productDatas);
            }  

            el.removeAttribute('x-labels-data');
          }
      },
      appendLabel(el, label, productData) {
        if (productData.container == 'product-info') {
          el.innerHTML += this.processTemplate(el, label, productData);
          return;
        }

        if (label.settings.position == 'custom') {
          let container = el.querySelector(`.custom-label-container`);
          if (!container) {
            container = document.createElement("div");
            let HTMLClass = `custom-label-container pointer-events-none`;
            container.setAttribute('class', HTMLClass);
            el.appendChild(container);
          }
          container.innerHTML += this.processTemplate(el, label, productData);
          return;
        }

        let container = el.querySelector(`.${label.settings.position}-container`);
        if (!container) {
          container = this.createFixedPositionContainer(label.settings.position);
          el.appendChild(container);
        }

        container.innerHTML += this.processTemplate(el, label, productData);
      },
      createFixedPositionContainer(position) {
        let HTMLClass = `${position}-container label-container flex absolute gap-1 space-y-1`;
        HTMLClass += position.includes('top') ? ' top-3 flex-col' : ' bottom-3 flex-col';
        HTMLClass += position.includes('left') ? ' items-start left-3' : ' items-end right-3';

        container = document.createElement("div");
        container.setAttribute('class', HTMLClass);

        return container;
      },
      processContent(el, label, productData) {
        let content = false;
        const canShow = this.canShow(label, productData);

        if (label.settings.image && canShow) {
          /** image label */
          let imageHeight, imageWidth;
          if (productData.container == 'product-info') {
            imageHeight = 126;
            imageWidth = Math.round(imageHeight * label.settings.image_aspect_ratio);
          } else {
            imageWidth = label.settings.size_mobile > label.settings.size ? label.settings.size_mobile * 15 : label.settings.size * 15;
            imageHeight = imageWidth / label.settings.image_aspect_ratio;
          }
          let image;
          if (label.settings.image.src) {
            image = label.settings.image.src.includes('burst.shopifycdn.com') ? label.settings.image.src : 
            label.settings.image.src + `&width=` + (imageWidth * 3);
          } else {
            image = label.settings.image.includes('burst.shopifycdn.com') ? label.settings.image : 
            label.settings.image + `&width=` + (imageWidth * 3);
          }
          if (productData.container == "card") {
            var imageDirection = label.settings.position.includes('left') ? "justify-start" : "justify-end";
            var styleImage = 'width: var(--width-image-label); height: var(--height-image-label)';
          } else {
            var imageDirection = productData.make_content_center ? "justify-center" : "justify-start";
            var styleImage = '';
          }
          content = `<div x-ref="content" class='x-badge-content w-fit flex ${imageDirection}{css-opacity}'>
            <img 
              loading="lazy"
              width="` + imageWidth + `"
              height="` + imageHeight + `"
              alt="` + (label.settings.image_alt.length > 0 ? label.settings.image_alt : productData.title) + `"
              src="` + image + `"
              style="${styleImage}"
            />
          </div>`;
        } else if (label.settings.content && canShow) {
          /** text label */
          let qty = (productData.inventory_management.length < 1 || productData.qty < 0) ? '' : productData.qty;
          let saleAmount = productData.sale_amount.includes('-') ? '' : productData.sale_amount;
          let countDown = label.settings.schedule_enabled ? '<span x-intersect.once="$nextTick(() => { if (typeof rePosition !== `undefined`) {rePosition()} });" class="x-badge-countdown-' + label.id + ' label-countdown empty:hidden"></span>' : '';
          let sale = Math.round((productData.compare_at_price - productData.price) * 100 / productData.compare_at_price);
          sale = sale == 100 ? 99 : sale;
          sale = sale > 0 ? sale + '%' : '';

          content = label.settings.content.replace(/{sale}/gi, sale)
                      .replace(/{sale_amount}/gi, saleAmount)
                      .replace(/{qty}/gi, qty)
                      .replace(/{price}/gi, productData.price_with_currency)
                      .replace(/{count_down}/gi, countDown);

          if (productData.metafield_label) {
            Object.entries(productData.metafield_label).forEach(([key, value]) => {
              content = content.replace(`{${key}}`, value);
            });
          }
          const sizeClass = productData.container == 'product-info' ? '' : ` pt-1 pb-1 pl-2 pr-2`;
          const inlineStyle = productData.container == 'product-info' ? '' : `style="font-size: var(--font-size-scale);"`;
          const inlineStyleIcon = productData.container == 'product-info' ? '' : `style="height: var(--font-size-scale); width: var(--font-size-scale); min-width: var(--font-size-scale);"`;
          content = content.length > 0
            ? `<div
                x-ref="content"
                class='x-badge-content ltr x-badge-text select-none inline-flex justify-center${sizeClass} items-center{css-opacity}{css-type} gap-2'
                ${inlineStyle}
              ><span class="icon-label empty:hidden" ${inlineStyleIcon}>${label.settings.icon}</span><span class="leading-normal w-fit p-break-words">${content}</span></div>` : false;

          if (countDown.length > 0 && label.settings.schedule_enabled) {
            Alpine.store('xHelper').countdown(label.settings, function(canShow, seconds, minutes, hours, days) {
              let container;
              if (productData.container === "card") {
                container = el.container ? el.container : el;
                if (label.settings.position == "below-image" || label.settings.position == "bottom-card") {
                  container = el.closest('.card-product')
                }
              } else {
                if (label.settings.position == "next-price") {
                  container = document.querySelector(productData.teleport_dest_price);
                } else if (label.settings.position == "below-image" || label.settings.position == "bottom-card") {
                  container = el.container ? el.container : el;
                } else {
                  container = document.querySelector(productData.teleport_dest_image);
                }
              }

              const countdownElements = container?.getElementsByClassName('x-badge-countdown-' + label.id);
              if (!canShow) {
                for (let i = 0;i < countdownElements?.length;i++) {
                  countdownElements[i].innerHTML = '';
                }
                return;
              }
              days = days > 0 ? days + "D&nbsp;&nbsp;&nbsp;" : "";
              hours = hours == 0 && days.length == 0 ? "" : hours + " : ";
              const timeLeft = days + hours + minutes + " : " + seconds;
              for (let i = 0;i < countdownElements?.length;i++) {
                countdownElements[i].innerHTML = timeLeft;
              }
            });
          }
        }
        return content;
      },
      processTemplate(el, label, productData) {
        let template = '';
        let teleportTemplateOpen = '';
        let teleportTemplateClose = '';
        if (content = this.processContent(el, label, productData)) {
          const cssOpacity = " opacity-" + label.settings.opacity;
          let cssPosition = ''
          let containerCssClass = ''

          if (productData.container == "product-info" && label.settings.position == "custom" && productData.position_adapt) {
            cssPosition = "left: " + label.settings.horizontal_position + "%;" + " transform: translate(-" + label.settings.horizontal_position+"%, -" + label.settings.vertical_position+"%);" + " top: " + (label.settings.vertical_position) + "%;";
          } else {
            cssPosition = productData.container == "card" ? "left: " + label.settings.horizontal_position + "%;" + " transform: translate(-"+ label.settings.horizontal_position+"%, -"+ label.settings.vertical_position+"%);"
            + " top: " + (label.settings.vertical_position) + "%;"
            : "";
          }
          let cssType = '';
          if (label.settings.type == 'round') cssType = ' rounded-md';
          if (label.settings.type == 'rounded-full') cssType = ' rounded-full';

          if (productData.container === "card") {
            containerCssClass = " absolute w-max";
          } else if (productData.position_adapt) {
            containerCssClass = (label.settings.position === "custom") ? " absolute w-max h-fit product-info-custom-label" : " w-fit h-fit product-info-custom-label";
          }

          if (productData.container == "product-info" && productData.position_adapt) {
            if (productData.teleport_dest_price || productData.teleport_dest_image) {
              teleportTemplateClose = "</template>"
            }
            if (label.settings.position == "next-price") {
              if (productData.teleport_dest_price) {
                teleportTemplateOpen = `<template x-teleport="${productData.teleport_dest_price}">`;
              }
            } else if (label.settings.position == "custom") {
              if (productData.teleport_dest_image) {
                teleportTemplateOpen = `<template x-teleport="${productData.teleport_dest_image}">`
              }
            } else if (label.settings.position == "below-image" || label.settings.position == "bottom-card") {
              teleportTemplateOpen = "";
              teleportTemplateClose = "";
            } else {
              const imageContainer = document.querySelector(productData.teleport_dest_image);
              let container = imageContainer.querySelector(`.${label.settings.position}-container`);
              if (!container) {
                container = this.createFixedPositionContainer(label.settings.position);
                imageContainer.appendChild(container);
              }
              if (productData.teleport_dest_image) {
                teleportTemplateOpen = `<template x-teleport="${productData.teleport_dest_image} .${label.settings.position}-container">`
              }
            }
          }

          containerCssClass += label.settings.horizontal_position > 50 ? " text-end" : " text-start";
          const previewShowCondition = productData.isXBadgesPreview ? `x-show="$store.xBadges.previewActiveBlock == '{label-id}'"` : '';
          let imgClass;
          if (productData.container == "product-info" && (label.settings.position == "below-image" || label.settings.position == "bottom-card" || !productData.position_adapt)) {
            let imageContainerAlignment = productData.make_content_center ? 'flex justify-center' : ''
            imgClass = label.settings.image ? ` label-img ${imageContainerAlignment}` : '';
          } else {
            imgClass = label.settings.image ? ' label-img' : '';
          }

          template = this.getLableTemplate(productData.container, label.settings.position);
          template = template.replace('{preview-show-condition}', previewShowCondition)
            .replace('{content}', content)
            .replace('{css-opacity}', cssOpacity)
            .replace('{css-position}', cssPosition)
            .replace('{css-type}', cssType)
            .replace('{container-css-class}', containerCssClass)
            .replace('{container-img-class}', imgClass)
            .replace('{teleport-template-open}', teleportTemplateOpen)
            .replace('{teleport-template-close}', teleportTemplateClose)
            .replace(/{label-id}/gi, label.id);
        }
        return template;
      },
      getLableTemplate(container, position) {
        if (container == 'product-info') {
          return this.productDetailTemplate;
        } else if (position == 'custom') {
          return this.customPositionTemplate;
        } else if (position == 'below-image' || position == 'bottom-card' || position == 'next-price') {
          return this.outSideImageTemplate.replace('{queryEL}', position);
        }

        return this.fixedPositionTemplate;
      },
      canShow(label, productData) {
        if (productData.isXBadgesPreview) {
          return true;
        }

        if (productData.container == 'card' && !label.settings.show_on_product_card) {
          return false;
        }

        if (productData.container == 'product-info' && !label.settings.show_on_product_page) {
          return false;
        }

        if (label.type == "sale-label" && productData.compare_at_price > productData.price) {
          return true;
        }

        if (label.type == "sold-out-label" && !productData.available) {
          return true;
        }
        if (label.type == "preorder-label" ) {
          if (productData.can_show_preorder && productData.available) {
            return true;
          } else {
            return false;
          }
        }
        if (label.type == "new-label" ) {
          if (label.settings.day_since == 'creation_date' && label.settings.number_show < productData.diff_day_create) {
            return false;
          } else if (label.settings.day_since == 'activation_date' && label.settings.number_show < productData.diff_day_publish) {
            return false;
          }
        }

        if (label.settings.schedule_enabled) {
          let endDate = new Date(
            label.settings.end_year,
            label.settings.end_month - 1,
            label.settings.end_day,
            label.settings.end_hour,
            label.settings.end_minute
          );
          label.endTime = endDate.getTime()
            + (-1 * label.settings.timezone * 60 - endDate.getTimezoneOffset()) * 60 * 1000;
  
          let startDate = new Date(
            label.settings.start_year,
            label.settings.start_month - 1,
            label.settings.start_day,
            label.settings.start_hour,
            label.settings.start_minute
          );
          label.startTime = startDate.getTime()
            + (-1 * label.settings.timezone * 60 - startDate.getTimezoneOffset()) * 60 * 1000;

          let now = new Date().getTime();
          if (label.endTime < now) {
            return false;
          }

          if (label.startTime > now) {
            return false;
          }
        }
        
        if (label.settings.applied_products.includes(productData.product_id)) {
          return true;
        }

        for(let i=0;i<label.settings.applied_collections.length;i++) {
          if (productData.collections.includes(label.settings.applied_collections[i])) {
            return true;
          }
        }

        if (label.type != "sale-label"
          && label.type != "sold-out-label"
          && label.settings.applied_products.length == 0
          && label.settings.applied_collections.length == 0) {
          return true;
        }

        return false;
      }
    });
  });
});
