requestAnimationFrame(() => {
  document.addEventListener('alpine:init', () => {
    Alpine.store('xStoreSelector', {
      enabled: false,
      currentSelected: '',
      appiledAll: false,
      appliedProducts: [],
      appiledCollections: [],
      opened: '',
      selectedStore: localStorage.getItem('selectedStore') || '',
      show: false,

      initStoreSelector(enabled, appiledAll, appliedProducts, appiledCollections) {
        this.enabled = enabled;
        this.currentSelected = this.selectedStore;
        this.appiledAll = appiledAll;
        this.appliedProducts = appliedProducts;
        this.appiledCollections = appiledCollections;
      },
      close() {
        this.show = false;
      },
      open() {
        this.show = true;
        if (this.selectedStore !== '') {
          this.currentSelected = this.selectedStore;
        }
      },
      setStoreFirst(store, sectionId) {
        if (this.currentSelected === '') {
          this.currentSelected = store;
          this.setSelectedStore(sectionId);
        }
      },
      setStore(store) {
        this.currentSelected = store;
      },
      getStore() {
        if (this.selectedStore !== '') {
          return this.selectedStore.match(/^(.*)-(\d+)$/)[1];
        }
      },
      getStoreText() {
        if (this.selectedStore !== '') {
          const parser = new DOMParser();
          const decodedString = parser.parseFromString(this.selectedStore.match(/^(.*)-(\d+)$/)[1], 'text/html').body.textContent || "";
          return decodedString;  
        }
      },
      checkSelection(storeList) {
        if (this.selectedStore !== '') {
          let inSelection = false;
          storeList.forEach(store => {
            if (store === this.selectedStore) inSelection = true;
          });
          if (!inSelection) {
            this.selectedStore = storeList[0];
          }
        }
      },
      checkAvailability(storeAvailabilities) {
        let store = this.getStore();
        if (storeAvailabilities) {
          return storeAvailabilities[store];
        }
      },
      setSelectedStore(sectionId) {
        if (this.currentSelected) {
          this.selectedStore = this.currentSelected;
          localStorage.setItem('selectedStore', this.selectedStore);
          document.querySelector('#store-selector-name-' + sectionId).innerHTML = this.getStore();
          this.close();
        }
      },
      canShow(productId, collectionIds) {
        if (this.appiledAll) {
          if (this.appliedProducts.length === 0 && this.appiledCollections.length === 0) {
            return true;
          } else {
            if (this.appliedProducts.includes(Number(productId))) {
              return true;
            }
            for (let i = 0; i < collectionIds.length; i++) {
              if (this.appiledCollections.includes(Number(collectionIds[i]))) return true;
            }
          }
        }
        return false;
      },
      canShowProductPage(productId, collectionIds) {
        if (this.appliedProducts.length === 0 && this.appiledCollections.length === 0) {
          return true;
        } else {
          if (this.appliedProducts.includes(Number(productId))) {
            return true;
          }
          for (let i = 0; i < collectionIds.length; i++) {
            if (this.appiledCollections.includes(Number(collectionIds[i]))) return true;
          }
        }
      }
    });
  });
});