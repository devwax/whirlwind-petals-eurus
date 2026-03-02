if (!window.Eurus.loadedScript.has('locales-form.js')) {
  window.Eurus.loadedScript.add('locales-form.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xLocalizationForm', () => ({ 
        openCountry: false,
        loading: false,
        cachedResults: false,
        submit(value, input) {
          this.$el.closest("#localization_form").querySelector('#'+input).value = value;
          this.$el.closest("#localization_form").submit();
        },
        loadCountry(el) {
          if (this.cachedResults) {
            this.openCountry = true;
            return true
          }
          let countrySelector = el.closest(".country-selector");
          let optionEL = countrySelector.querySelector(".country-options");

          this.loading = true;
          fetch(window.Shopify.routes.root + '?section_id=country-selector')
          .then(reponse => {
            return reponse.text();
          })
          .then((response) => {
            const parser = new DOMParser();
            const content = parser.parseFromString(response,'text/html').getElementById("list-country").innerHTML;
            optionEL.innerHTML = content;
            this.cachedResults = true;
            this.openCountry = true;
          })
          .finally(() => {
            this.loading = false;
          })
        },
      }))
    });
  });
}