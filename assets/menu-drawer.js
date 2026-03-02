if (!window.Eurus.loadedScript.has('menu-drawer.js')) {
window.Eurus.loadedScript.add('menu-drawer.js');

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.store('xMenuDrawer', {
      show: false,
      loading: false,
      currentMenuLinks: [],
      open() {
        this.show = true;
        Alpine.store('xPopup').open = true;
      },
      close() {
        this.show = false;
        Alpine.store('xPopup').close();
      },
      setActiveLink(linkId) {
        this.currentMenuLinks.push(linkId);
      },
      removeActiveLink(linkId) {
        const index = this.currentMenuLinks.indexOf(linkId);
        if (index !== -1) {
          this.currentMenuLinks.splice(index, 1);
        }
      },
      resetMenu() {
        this.currentMenuLinks = [];
      },
      scrollTop(el = null) { 
        document.getElementById('menu-navigation').scrollTop = 0; 
        if (el) {
          el.closest('.scrollbar-body').scrollTop = 0;
        }
      }
    });
  });
});
}