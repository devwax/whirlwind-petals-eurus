if (!window.Eurus.loadedScript.has('mobile-dock.js')) {
  window.Eurus.loadedScript.add('mobile-dock.js');
  
  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data('xMobileDock', () => ({
        showDock: false,
        init() {
          const root = document.documentElement;
          setTimeout(() => {
            const containerMobileDock = document.getElementById("mobile-dock-container");
            const heightMobileDock = containerMobileDock ? containerMobileDock.offsetHeight : 0;
            const value = heightMobileDock + "px";

            root.style.setProperty('--height-mobile-dock', value);
            document.body.style.marginBottom = value;
          }, 0);
          
          const header = document.getElementById('x-header-container')
          const updateDock = () => {
            if (header) {
              this.showDock = (header.getBoundingClientRect().bottom <= 0);
            } else {
              this.showDock = true;
            }
          }
          window.addEventListener('scroll', () => {
            updateDock()
          }, { passive: true });

          const search = document.getElementById('FormSearchMobileDock');
          if (search) {
            const announcement = document.getElementById('x-announcement');
            const updateSearchPosition = () => {
              const isSticky = announcement?.getAttribute('data-is-sticky') === 'true';
              if (isSticky) {
                document.documentElement.style.setProperty('--announcement-height', `${announcement?.offsetHeight}px`);
                search.style.top = 'var(--announcement-height)';
              } else {
                search.style.top = '0';
              }
            };
            updateSearchPosition();
          }
        }
      }));
    });
  });
}
