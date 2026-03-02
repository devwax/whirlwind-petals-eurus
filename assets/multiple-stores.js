requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data("xMultipleStores", () => ({
      active: 1,
      open: false,
      canScroll: false,
      atTop: true,
      atBottom: false,
      showStore: false,
      load() {
        const canScrollVertically = this.$refs.list_stores.scrollHeight > this.$refs.list_stores.closest(".multi_stores_content").clientHeight;
        if (canScrollVertically) {
          this.canScroll = true;
        }
        window.addEventListener('resize', ()=> {
          this.heightNatural();
        })
        this.heightNatural();
      },
      heightNatural() {
        if (window.matchMedia("(min-width: 768px)").matches) {
          if(this.$refs.natural_height) {
             this.$refs.natural_height.style.height = this.$refs.h_img_location.offsetHeight +'px';
          }
        } else {
          if(this.$refs.natural_height) {
            this.$refs.natural_height.style.removeProperty('height');
          }
        }
      },
      openLocation(el) {
        this.open = true;
        var popupContent = document.getElementById(el.getAttribute("data-id"));
        
        this.$refs.content_location_detail.innerHTML = popupContent.innerHTML;
        const title = this.$refs.content_location_detail.querySelector('h5.location-title');
        if (title) {
          const h4 = document.createElement('h4');

          h4.innerHTML = title.innerHTML;
          h4.className = title.className;

          title.replaceWith(h4);
        }
      },
      hideLocation() {
        requestAnimationFrame(() => {
          this.open = false;
          Alpine.store('xPopup').open = false;
        });
      },
      scrollUp() {
        this.$refs.list_stores.scrollBy({
          top: -200, 
          behavior: 'auto'
        });
        this.checkCanScrollVertical()
      },
      scrollDown() {
        this.$refs.list_stores.scrollBy({
          top: 200,
          behavior: 'auto'
        });
        this.checkCanScrollVertical()
      },
      checkCanScrollVertical() {
        if (window.innerWidth < 768) {
          this.atTop = this.$refs.list_stores.scrollTop === 0;
          this.atBottom = (this.$refs.list_stores.scrollTop + this.$refs.list_stores.closest(".multi_stores_content").clientHeight) >= (this.$refs.list_stores.scrollHeight - 2);
        }
      },
      toggleStore(noScroll = false) {
        this.showStore = !this.showStore;
        if (!this.showStore) {
          this.$refs.first_store.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (!noScroll) {
          this.canScroll = !this.canScroll;
          this.$refs.list_stores.addEventListener("animationend", this.checkCanScrollVertical());
          setTimeout(() => {
            this.$refs.list_stores.removeEventListener("animationend", this.checkCanScrollVertical());
          }, 300);
        }
      }
    }));
  });
});