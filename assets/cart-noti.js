if (!window.Eurus.loadedScript.has('cart-noti.js')) {
  window.Eurus.loadedScript.add('cart-noti.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xCartNoti', {
        enable: false,
        listItem: [],
        show: false,
        setItem(items) {
          this.listItem = [];
          if (items.items) {
            this.listItem = items.items
          } else {
            this.listItem.push(items);
          }
          this.open();
        },
        open() {
          this.show = true;
          setTimeout(() => {
            this.show = false;
          }, 5000);
        }
      })
    });
  });
}