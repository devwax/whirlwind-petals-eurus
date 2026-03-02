requestAnimationFrame(() => {
  window.Eurus.bind = function(fn, scope) {
    return function() {
      return fn.apply(scope, arguments);
    }
  };

  window.Eurus.setSelectorByValue = function(selector, value) {
    for (var i = 0, count = selector.options.length; i < count; i++) {
      var option = selector.options[i];
      if (value == option.value || value == option.innerHTML) {
        selector.selectedIndex = i;
        return i;
      }
    }
  };

  window.Eurus.addListener = function(target, eventName, callback) {
    target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
  };
  
  window.Eurus.postLink = function(path, options) {
    options = options || {};
    var method = options['method'] || 'post';
    var params = options['parameters'] || {};
  
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
  
    for(var key in params) {
      var hiddenField = document.createElement("input");
      hiddenField.setAttribute("type", "hidden");
      hiddenField.setAttribute("name", key);
      hiddenField.setAttribute("value", params[key]);
      form.appendChild(hiddenField);
    }
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  window.Eurus.CountryProvinceSelector = function(country_domid, province_domid, options) {
    this.countryEl         = document.getElementById(country_domid);
    this.provinceEl        = document.getElementById(province_domid);
    this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);
  
    window.Eurus.addListener(this.countryEl, 'change', window.Eurus.bind(this.countryHandler,this));
  
    this.initCountry();
    this.initProvince();
  };
  
  window.Eurus.CountryProvinceSelector.prototype = {
    initCountry: function() {
      var value = this.countryEl.getAttribute('data-default');
      window.Eurus.setSelectorByValue(this.countryEl, value);
      this.countryHandler();
    },
  
    initProvince: function() {
      var value = this.provinceEl.getAttribute('data-default');
      if (value && this.provinceEl.options.length > 0) {
        window.Eurus.setSelectorByValue(this.provinceEl, value);
      }
    },
  
    countryHandler: function(e) {
      var opt       = this.countryEl.options[this.countryEl.selectedIndex];
      var raw       = opt.getAttribute('data-provinces');
      var provinces = xParseJSON(raw);
  
      this.clearOptions(this.provinceEl);
      if (provinces && provinces.length == 0) {
        this.provinceContainer.style.display = 'none';
      } else {
        for (var i = 0; i < provinces.length; i++) {
          var opt = document.createElement('option');
          opt.value = provinces[i][0];
          opt.innerHTML = provinces[i][1];
          this.provinceEl.appendChild(opt);
        }
  
        this.provinceContainer.style.display = "";
      }
    },
  
    clearOptions: function(selector) {
      while (selector.firstChild) {
        selector.removeChild(selector.firstChild);
      }
    },
  
    setOptions: function(selector, values) {
      for (var i = 0; i < values.length; i++) {
        var opt = document.createElement('option');
        opt.value = values[i];
        opt.innerHTML = values[i];
        selector.appendChild(opt);
      }
    }
  };

  document.addEventListener('alpine:init', () => {
    Alpine.data('xCustomerAddresses', () => ({
      activeAddEditFormIds: [],
      init() {
        this._setupCountries();
      },
      handleAddEdit(addressId) {
        if (!this.activeAddEditFormIds.includes(addressId))
          this.activeAddEditFormIds.push(addressId);
      },
      handleCancel(addressId) {
        let index = this.activeAddEditFormIds.indexOf(addressId);
        if (index !== -1) {
          this.activeAddEditFormIds.splice(index, 1);
        }
      },
      handleDelete() {
        if (confirm(this.$el.getAttribute('data-confirm-message'))) {
          window.Eurus.postLink(this.$el.dataset.target, {
            parameters: { _method: 'delete' },
          });
        }
      },
      _setupCountries() {
        if (window.Eurus && window.Eurus.CountryProvinceSelector) {
          new window.Eurus.CountryProvinceSelector('AddressCountryNew', 'AddressProvinceNew', {
            hideElement: 'AddressProvinceContainerNew'
          });
          this.$el.querySelectorAll('[data-address-country-select]').forEach((select) => {
            const formId = select.dataset.formId;
            new window.Eurus.CountryProvinceSelector(`AddressCountry_${formId}`, `AddressProvince_${formId}`, {
              hideElement: `AddressProvinceContainer_${formId}`
            });
          });
        }
      }
    }));
  })
});
