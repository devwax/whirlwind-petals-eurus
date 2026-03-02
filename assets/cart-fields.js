if (!window.Eurus.loadedScript.has('cart-fields.js')) {
  window.Eurus.loadedScript.add('cart-fields.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xCartFields', (isCartDrawer, currentLanguage, excludeDay, holidayList, dateFormat) => ({
        customField: '',
        customFieldLabel: '',
        customFieldRequired: false,
        customFieldError: false,          
        openField: false,
        t: '',
        cartDeliveryDateField: '',
        deliveryDateFieldError: false,
        deliveryDateString: 'Select date',   
        tDeliveryDate: '',
        deliveryDateValidationError: false,
        loadData() {
          const data = xParseJSON(this.$el.getAttribute('x-cart-fields-data'));

          this.customField = localStorage.cart_custom_field ? localStorage.cart_custom_field : '';
          this.customFieldLabel = data.custom_field_label;
          this.customFieldRequired = data.custom_field_required;
          this.custom_field_pattern = new RegExp(data.custom_field_pattern);
          this.save();

          if (!isCartDrawer) {
            document.getElementById("x-cart-custom-field").addEventListener("focusout", (event) => {
              this.save();
            });
          }

          document.addEventListener('eurus:cart:validate', (e) => {
            this.customField = localStorage.cart_custom_field ? localStorage.cart_custom_field : '';
            if (this.customFieldRequired && (!this.customField || this.customField.length == 0)
              || (this.customField && !this.customField.match(this.custom_field_pattern))) {
              this.customFieldError = true;              
              Alpine.store('xCartHelper').validated = false;
              if (e.detail.isCheckOut) {
                Alpine.store('xCartHelper').openField = 'custom_field'
              }
            } else {
              this.customFieldError = false;
            }
          });
        },
        save(custom_field_value) {
          clearTimeout(this.t);

          if (custom_field_value) {
            this.customField = custom_field_value
          }
          const func = () => {
            var attributes = { attributes: {} }
            attributes.attributes[this.customFieldLabel] = this.customField;
            Alpine.store('xCartHelper').updateCart(attributes, true);
            localStorage.cart_custom_field = this.customField;
          }
          
          this.t = setTimeout(() => {
            func();
          }, 200);
        },
        loadDeliveryFieldData(required) {
          this.cartDeliveryDateField = localStorage.cart_delivery_date_field ? localStorage.cart_delivery_date_field : '';
          const deliveryDateInputEl = document.getElementById('x-cart-delivery-date-field');
          if (deliveryDateInputEl) {
            this.deliveryDateValidate(this.cartDeliveryDateField, deliveryDateInputEl);
            this.saveDeliveryDateField();
          }
          
          document.addEventListener('eurus:cart:validate', (e) => {           
            this.cartDeliveryDateField = localStorage.cart_delivery_date_field ? localStorage.cart_delivery_date_field : '';
            if (this.cartDeliveryDateField && isCartDrawer) {
              const date = new Date(this.cartDeliveryDateField);
              const dayOfTheMonth = date.getDate();
              const fullMonth = new Intl.DateTimeFormat(`${currentLanguage}`, { month: "long" }).format(date);
              if (dateFormat == 'mm-dd') {
                this.deliveryDateString = `${fullMonth} ${dayOfTheMonth < 10 ? `0${dayOfTheMonth}` : dayOfTheMonth}`;
              } else {
                this.deliveryDateString = `${dayOfTheMonth < 10 ? `0${dayOfTheMonth}` : dayOfTheMonth} ${fullMonth}`;
              }
            }
            if (required && (!this.cartDeliveryDateField || this.cartDeliveryDateField.length == 0)) {
              this.deliveryDateFieldError = true;      
              this.deliveryDateValidationError = false;       
              Alpine.store('xCartHelper').validated = false;
              if (e.detail.isCheckOut) {
                Alpine.store('xCartHelper').openField = 'delivery_date_field'
              }
            } else {
              this.deliveryDateFieldError = false;
            }
          });
        },
        _getNextValidDate(date, minDate, maxDate) {
          const holidayArray = holidayList ? holidayList.split(',').map(holiday => holiday.trim()) : [];
          let isInvalid = true;

          while (isInvalid) {
            isInvalid = false;
            // Weekend check
            if (excludeDay === 'saturday_sunday' && (date.getDay() === 6 || date.getDay() === 0)) {
              if (date.getDay() === 6) {
                date.setDate(date.getDate() + 2);
              } else {
                date.setDate(date.getDate() + 1);
              }
              this.deliveryDateValidationError = true;
              this.deliveryDateFieldError = false;
              isInvalid = true;
              continue;
            }

            if (excludeDay === 'saturday' && date.getDay() === 6) {
              date.setDate(date.getDate() + 1);
              this.deliveryDateValidationError = true;
              this.deliveryDateFieldError = false;
              isInvalid = true;
              continue;
            }

            if (excludeDay === 'sunday' && date.getDay() === 0) {
              date.setDate(date.getDate() + 1);
              this.deliveryDateValidationError = true;
              this.deliveryDateFieldError = false;
              isInvalid = true;
              continue;
            }
            // Holiday check
            if (holidayArray.length > 0) {
              const dayOfMonth = date.getDate();
              const monthName = new Intl.DateTimeFormat(currentLanguage, { month: "long" }).format(date);
              const dateString = `${monthName} ${dayOfMonth < 10 ? `0${dayOfMonth}` : dayOfMonth}`;

              if (holidayArray.includes(dateString)) {
                date.setDate(date.getDate() + 1);
                this.deliveryDateValidationError = true;
                this.deliveryDateFieldError = false;
                isInvalid = true;
                continue;
              }
            }

            // Out of range check
            if ((minDate && date < minDate) || (maxDate && date > maxDate)) {
              if (date < minDate) {
                date = new Date(minDate.getTime());
              }
              if (date > maxDate) {
                date = new Date(maxDate.getTime());
              }
              this.deliveryDateValidationError = true;
              this.deliveryDateFieldError = false;
              isInvalid = true;
              break;
            }
          }
          return date;
        },
        deliveryDateValidate(value, el) {
          if (value) {
            let date = new Date(value);
            const maxDate = new Date(el.max);
            const minDate = new Date(el.min);
            date = this._getNextValidDate(date, minDate, maxDate);
            this.cartDeliveryDateField = date.toISOString().split("T")[0];
          }
        },
        saveDeliveryDateField(delivery_date_field_value, isCartPage) {
          clearTimeout(this.tDeliveryDate);

          if (delivery_date_field_value) {
            this.cartDeliveryDateField = delivery_date_field_value
          }
          const func = () => {
            const deliveryDateInputEl = document.getElementById('x-cart-delivery-date-field');
            if (deliveryDateInputEl) {
              this.deliveryDateValidate(this.cartDeliveryDateField, deliveryDateInputEl);
            }
            if (isCartDrawer && this.cartDeliveryDateField) {
              const date = new Date(this.cartDeliveryDateField);
              const dayOfTheMonth = date.getDate();
              const fullMonth = new Intl.DateTimeFormat(`${currentLanguage}`, { month: "long" }).format(date);
              if (dateFormat == 'mm-dd') {
                this.deliveryDateString = `${fullMonth} ${dayOfTheMonth < 10 ? `0${dayOfTheMonth}` : dayOfTheMonth}`;
              } else {
                this.deliveryDateString = `${dayOfTheMonth < 10 ? `0${dayOfTheMonth}` : dayOfTheMonth} ${fullMonth}`;
              }
            }
            var attributes = { attributes: {} }
            attributes.attributes['Delivery date'] = this.cartDeliveryDateField;
            Alpine.store('xCartHelper').updateCart(attributes, true);
            localStorage.cart_delivery_date_field = this.cartDeliveryDateField;
            if (!isCartPage) {
              this.deliveryDateValidationError = false;
            }
          }
          
          this.tDeliveryDate = setTimeout(() => {
            func();
          }, 200);
        },
      }));
    })
  });
}