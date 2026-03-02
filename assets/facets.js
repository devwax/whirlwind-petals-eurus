document.addEventListener('alpine:init', () => {
  Alpine.data('xFiltersAndSortby', (sectionId) => ({
    t: '',
    show: false,
    showFilterAside: true,
    loading: false,
    isDesktop: false,
    listLayout: false,
    cachedResults: [],
    searchParamsPrev: window.location.search.slice(1),
    searchParamsInitial: window.location.search.slice(1),
    init() {
      if (localStorage.getItem("list-layout") == 'list') {
        this.listLayout = true;
      }
      this._initLayout();
      this._setListeners();
    },
    _initLayout() {
      let formAside = document.getElementsByClassName('form-aside')[0];
      let formDrawer = document.getElementsByClassName('form-drawer')[0];
      if (window.innerWidth > 767) {
        this.isDesktop = true;
        if (formAside) {
          formAside.setAttribute('id','FacetFiltersForm');
          if (formDrawer) formDrawer.removeAttribute('id');
        } else {
          if (formDrawer) formDrawer.setAttribute('id','FacetFiltersForm');
        }
      } else {
        this.isDesktop = false;
        if (formAside) formAside.removeAttribute('id');
        if (formDrawer) formDrawer.setAttribute('id','FacetFiltersForm');
      }
    },
    _setListeners() {
      const onHistoryChange = (event) => {
        const searchParams = event.state ? event.state.searchParams : this.searchParamsInitial;
        if (searchParams === this.searchParamsPrev) return;
        this._renderPage(searchParams, false);
      }
      window.addEventListener('popstate', onHistoryChange);

      installMediaQueryWatcher('(min-width: 768px)', this._initLayout);
    },
    toggleLayout(theBoolean) {
      this.listLayout = theBoolean;
      localStorage.setItem("list-layout", theBoolean ? "list" : "grid" );
      window.dispatchEvent(new Event('resize'));
    },
    removeFilter(url) {
      this._reloadFilter(url);
    },
    renderPagination() {
      var formData = {
        'attributes': {
          'collection-pagination': this.$el.value             
        }
      }; 
      fetch(Shopify.routes.root+'cart/update', {
        method:'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(formData)
      }).then(() => {
        this.cachedResults = [];
        const searchParams = this._createSearchParams(document.getElementById('FacetFiltersForm'));
        this._renderPage(searchParams);
      }); 
    },
    onSubmit(wait = 500) {
      clearTimeout(this.t);

      const func = () => {
        const searchParams = this._createSearchParams(document.getElementById('FacetFiltersForm'));
        this._renderPage(searchParams);
        if(this.isDesktop) document.getElementById('FormSelectFilter')?.blur();
      }
      
      this.t = setTimeout(() => {
        func();
      }, wait);
    },
    rangePrice(el) {
      const rangeInput = el.querySelectorAll(".range-input input"),
      priceInput = el.querySelectorAll(".price-input"),
      pricePreview = el.querySelectorAll(".price-preview"),
      range = el.querySelector(".slider .progress");
      let priceGap = 1;

      rangeInput.forEach((input) => {
        input.addEventListener("input", (e) => {
          e.preventDefault();
          let minVal = Number(rangeInput[0].value).toFixed(2),
            maxVal = Number(rangeInput[1].value).toFixed(2);;
          
          if (maxVal - minVal < priceGap) {
            if (e.target.className === "range-min") {
              rangeInput[0].value = maxVal - priceGap;
              priceInput[0].value = maxVal - priceGap;
            } else {
              rangeInput[1].value = minVal + priceGap;
              priceInput[1].value = maxVal + priceGap;
            }
          } else {
            priceInput[0].value = minVal;
            priceInput[1].value = maxVal;
            range.style.setProperty('--left_range', (minVal / rangeInput[0].max) * 100 + '%');
            range.style.setProperty('--right_range', 100 - (maxVal / rangeInput[1].max) * 100 + '%');
          }
          pricePreview[0].textContent = minVal;
          pricePreview[1].textContent = maxVal;
        });
      });
    },
    initRange(el) {
      const rangeInput = el.querySelectorAll(".range-input input"),
      range = el.querySelector(".slider .progress");
      
      let minVal = Number(rangeInput[0].value).toFixed(2),
      maxVal = Number(rangeInput[1].value).toFixed(2);;
      range.style.setProperty('--left_range', (minVal / rangeInput[0].max) * 100 + '%');
      range.style.setProperty('--right_range',100 - (maxVal / rangeInput[1].max) * 100 + '%');
    },
    _reloadFilter(url) {
      const searchParams = url.indexOf('?') == -1 ? '' : url.slice(url.indexOf('?') + 1);
      this._renderPage(searchParams);
    },
    _createSearchParams(form) {
      const formData = new FormData(form);
      return new URLSearchParams(formData).toString();
    },
    _updateURLHash(searchParams) {
      history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
    },
    _renderPage(searchParams, updateURLHash = true) {
      this.searchParamsPrev = searchParams;
      this.loading = true;
      
      if (this.cachedResults[searchParams]) {
        this._renderResults(this.cachedResults[searchParams]);
        return;
      }

      const url = `${window.location.pathname}?section_id=${sectionId}&${searchParams}`;
      fetch(url)
        .then(response => response.text())
        .then((responseText) => {
          const html = responseText;
          this.cachedResults[searchParams] = html;
          this._renderResults(html);
        });

      if (updateURLHash) this._updateURLHash(searchParams);
    },
    _renderResults(html) {
      this._renderFilters(html);
      this._renderProductGridContainer(html);
      this._renderProductCount(html);
      this.loading = false;
    },
    _renderFilters(html) {
      const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
      let blockFiltesDrawer = '.form-drawer';
      let blockFiltesAside = '.form-aside';
      const selectBlockFiltesDrawer = document.querySelector(blockFiltesDrawer);
      const selectBlockFiltesAside = document.querySelector(blockFiltesAside);
      let activeTag = document.getElementById("active-filter-tag")

      if (activeTag) {
        activeTag.innerHTML = parsedHTML.getElementById("active-filter-tag").innerHTML;   
      }
      if (selectBlockFiltesDrawer) {
        if (this.$el.id) {  
          const eleOpening = parsedHTML.getElementById(this.$el.id) ? parsedHTML.getElementById(this.$el.id).closest('.js-filter') : undefined;
          if (eleOpening) {
            eleOpening.setAttribute('x-data', '{open: true}');
            parsedHTML.getElementById(this.$el.id).closest('.js-filter').innerHTML = eleOpening.innerHTML;
          }
        }
        selectBlockFiltesDrawer.innerHTML = parsedHTML.querySelector(blockFiltesDrawer).innerHTML;
        this._renderAdditionalElements(parsedHTML);
      };
      if (selectBlockFiltesAside) {
        if (this.$el.id) {
          const eleOpening = parsedHTML.getElementById(this.$el.id) ? parsedHTML.getElementById(this.$el.id).closest('.js-filter') : undefined;
          if (eleOpening) {
            eleOpening.setAttribute('x-data', '{open: true}');
            parsedHTML.getElementById(this.$el.id).closest('.js-filter').innerHTML = eleOpening.innerHTML;
          }
        }
        selectBlockFiltesAside.innerHTML = parsedHTML.querySelector(blockFiltesAside).innerHTML;
        this._renderAdditionalElements(parsedHTML);
      };
      this._renderAdvancedFilters(parsedHTML);
    },
    _renderAdvancedFilters(html) {
      const destination = document.querySelectorAll(".filter-advanced");
      const source = html.querySelectorAll('.filter-advanced');

      if (source.length > 0 && destination.length > 0) {
        destination.forEach((destination, index) => {
          destination.innerHTML = source[index].innerHTML;
        })
      }
    },
    _renderProductGridContainer(html) {
      document.getElementById('ProductGridContainer').innerHTML = new DOMParser().parseFromString(html, 'text/html').getElementById('ProductGridContainer').innerHTML;
    },
    _renderProductCount(html) {
      const productCountEl = new DOMParser().parseFromString(html, 'text/html').getElementById('ProductCount');
      if (productCountEl) {
        const count = productCountEl.innerHTML;
        const container = document.getElementById('ProductCount_header');
        const containerDrawer = document.getElementById('ProductCountDrawer');
        if (container) container.innerHTML = count;
        if (containerDrawer) containerDrawer.innerHTML = count;
        container.classList.remove('loading');
      }
    },
    _renderAdditionalElements(html) {
      const container = document.getElementById('ProductPerPage');
      if (container) container.innerHTML = html.getElementById('ProductPerPage').innerHTML;
    },
    _filterFocus() {
      Alpine.store('xFocusElement').trapFocus('ProductFilter','CloseFilter');
    },
    _filterRemoveFocus() {
      const activeElement = document.getElementById('btn-filter');
      Alpine.store('xFocusElement').removeTrapFocus(activeElement);
    },
    setFilterHeaderHeight() {
      document.documentElement.style.setProperty('--height-sticky-filter',document.getElementById("FacetsWrapperDesktop").offsetHeight + "px");
    },
    setPositionOptionFilter(el) {
      elRect = el.getBoundingClientRect();
      const elPopup = el.getElementsByClassName('popup-above')[0];
      let spacingRight = window.innerWidth - elRect.left;
      let checkSpacing = spacingRight - el.innerWidth;
      if (checkSpacing >= 0) {
        elPopup.style.left = '0px';
      } else {
        elPopup.style.left = checkSpacing+ 'px';
      }
    },
    getPopupPosition(el) {
      this.$nextTick(() => {
        const elPopup = el.getElementsByClassName('popup-above')[0];
        if (elPopup) {
          const popupRect = elPopup.getBoundingClientRect();
          if( popupRect.right > window.innerWidth){
            elPopup.style.right = 0;
          }
        }
      });
    }
  }));
});