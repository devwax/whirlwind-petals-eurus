if (!window.Eurus.loadedScript.has('video-shopping.js')) {
  window.Eurus.loadedScript.add('video-shopping.js');
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xVideoShopping', (sectionId) => ({
        showSlideListItemInVideoCard: false,
        showSlideProductInPopup: false,
        showSlideProductInVideoCard: false,
        showPopup: false,
        productSelectedId: '',
        positionBottomGroupAnnouncementAndHeader: 0,
        isMobile: false,
        init() {
          document.addEventListener(`eurus:${sectionId}:shoppable-video-popup-close`, () => {
            this.showSlideProductInVideoCard = false;
            this.showSlideListItemInVideoCard = false
          });
        },
        openProductInPopup(productId) {
          this.showSlideProductInPopup = true
          this.productSelectedId = productId;
        },
        openProductInSlide(productId) {
          this.showSlideProductInVideoCard = true
          this.productSelectedId = productId
        },
        closeProductInSlide() {
          this.isOpenProductInPopupMobile = false
          this.showSlideProductInVideoCard = false
          setTimeout(() => {
            this.productSelectedId = ''
          }, 500)
        },
        closeProductInPopup() {
          this.showSlideProductInPopup = false
          setTimeout(() => {
            this.productSelectedId = ''
          }, 500)
        },
        openPopup() {
          this.showPopup = true
          Alpine.store('xPopup').openVideoShopping = true
          const announcement = document.getElementById("x-announcement")
          const header = document.getElementById("sticky-header")
          if (announcement) {
            if (announcement.dataset.isSticky == 'true') {
              if (header && header.offsetHeight + header.getBoundingClientRect().top > announcement.offsetHeight) {
                this.positionBottomGroupAnnouncementAndHeader = header ? header.offsetHeight + header.getBoundingClientRect().top : 0;
              }
              else {
                this.positionBottomGroupAnnouncementAndHeader = announcement.offsetHeight;
              }
            }
            else {
              this.positionBottomGroupAnnouncementAndHeader = header ? header.offsetHeight + header.getBoundingClientRect().top : announcement.offsetHeight + announcement.getBoundingClientRect().top
            }
          }
          else {
            this.positionBottomGroupAnnouncementAndHeader = header ? header.offsetHeight + header.getBoundingClientRect().top : 0
          }
          if ((!header || header?.getBoundingClientRect().bottom < 0) && (!announcement || announcement?.getBoundingClientRect().bottom < 0)) {
            this.positionBottomGroupAnnouncementAndHeader = 0;
          }
        },
        closePopup() {
          this.showPopup = false
          setTimeout(() => {
            Alpine.store('xPopup').openVideoShopping = false
          }, 500)
          this.closeProductInPopup()
        }
      }))
    })
  })
}