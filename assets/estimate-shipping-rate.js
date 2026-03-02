
if (!window.Eurus.loadedScript.has('estimate-shipping-rate.js')) {
  window.Eurus.loadedScript.add('estimate-shipping-rate.js');
  
  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data("xEstimateShipping", (el, single, multiple, noRates) => ({
        countryEl: el.querySelector('.country-select'),
        provinceEl: el.querySelector('.province-select'),
        provinceContainer: el.querySelector('.province-container'),
        zip: el.querySelector('.zip-input'),
        rates: el.querySelector('.rates'),
        errors: el.querySelector('.errors'),
        loadingShipping: false,
        rates_heading: '',
        rates_text: '',
        errors_message: '',
        cachedData: [],
        cachedResponse:[],
        load() {
          this.setSelectedOption(this.countryEl, this.countryEl.dataset.default);
    
          if (this.provinceEl.dataset.default && this.provinceEl.options.length > 0) {
            this.setSelectedOption(this.provinceEl, this.provinceEl.dataset.default);
          }
    
          this.handleCountryChange();
          this.countryEl.addEventListener('change', this.handleCountryChange.bind(this));
        },
        
        handleCountryChange() {
          const selectedOption = this.countryEl.options[this.countryEl.selectedIndex];
          const provinces = JSON.parse(selectedOption.dataset.provinces);
    
          Array.from(this.provinceEl.options).forEach((option) => option.remove());
    
          if (provinces && provinces.length === 0) {
            this.provinceContainer.hidden = true;
          } else {
            provinces.forEach((province) => {
              const option = document.createElement('option');
              [option.value, option.innerHTML] = province;
              this.provinceEl.appendChild(option);
            });
    
            this.provinceContainer.hidden = false;
          }
        },

        setSelectedOption(selector, value) {
          Array.from(selector.options).forEach((option, index) => {
            if (option.value === value || option.innerHTML === value) {
              selector.selectedIndex = index;
            }
          });
        },

        async submit(e) {
          
          e?.preventDefault();
    
          this.errors.classList.add('hidden');
          this.rates.classList.add('hidden');
          
          const params = `shipping_address[zip]=${this.zip.value}&shipping_address[country]=${this.countryEl.value}&shipping_address[province]=${this.provinceEl.value}`;
    
          if (this.cachedData[params]) {
            if ( this.cachedResponse[params]) {
              this.showRates(this.cachedData[params]);
            } else {
              this.showErrors(this.cachedData[params]);
            }
            return true;
          }

          this.loadingShipping = true;
          try {
            const response = await fetch(`${Shopify.routes.root}cart/shipping_rates.json?${params}`);
            const data = await response.json();
    
            if (response.ok) {
              this.showRates(data);
            } else {
              this.showErrors(data);
            }
            this.cachedResponse[params] = response.ok;
            this.cachedData[params] = data;
          } catch (error) {
            console.log(error); 
          } finally {
            this.loadingShipping= false;
          }
        },
    
        showRates(data) {
          const headingEl = this.rates.querySelector('.rates-heading');
    
          if (data.shipping_rates && data.shipping_rates.length) {
            this.rates_heading = data.shipping_rates.length === 1 ? single : multiple;
            let rates = '';
            
            data.shipping_rates.forEach((rate) => {
              const formattedRate = rate.price + rate.currency;
              rates += `<li class="pt-2">${rate.name}: ${formattedRate}</li>`;
            });
    
            headingEl.classList.remove('hidden');
            this.rates_text = `<ul class="list-disc pl-4">${rates}</ul>`;
          } else {
            headingEl.classList.add('hidden');
            this.rates_text = `<p class="no-rate">${noRates}</p>`;
          }
    
          this.rates.classList.remove('hidden');
        },
    
        showErrors(data) {
          let errors = '';
          Object.keys(data).forEach((key) => {
            errors += `<li>${data[key]}</li>`;
          });
    
          this.errors_message = `<ul>${errors}</ul>`;
          this.errors.classList.remove('hidden');
        }
      }));
      Alpine.store('xPopupShipping', {
        open: false
      });
    });
  });
}