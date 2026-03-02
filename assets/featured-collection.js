if (!window.Eurus.loadedScript.has('featured-collection.js')) {
  window.Eurus.loadedScript.add('featured-collection.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xFeaturedCollection', (sectionId, pageParam, container) => ({
        sectionId: sectionId,
        pageParam: pageParam,
        currentTab: 1,
        loading: true,
        loaded: [],
        select(index) {
          this.currentTab = index;
        },
        loadData(index) {
          const selectedPage = index - 1;
          if (!this.loaded.includes(selectedPage)) {
            this.loading = true;
            
            let url = `${window.location.pathname}?section_id=${this.sectionId}&${this.pageParam}=${index}`;
            fetch(url, {
              method: 'GET'
            }).then(
              response => response.text()
            ).then(responseText => {
              const html = (new DOMParser()).parseFromString(responseText, 'text/html');
              const contentId = `x-fc-${this.sectionId}-${index}`;
              const newContent = html.getElementById(contentId);
              if (newContent && !document.getElementById(contentId)) {
                container.appendChild(newContent);
                this.loaded.push(selectedPage);
              }
              this.loading = false;
            })
          }
        },
        scrollIntoView(element) {
          const scrollableContainer = element.closest('.overflow-x-auto'); 
          const elementPosition = element.offsetLeft;

          scrollableContainer.scroll({
            left: elementPosition,
            behavior: 'smooth'
          });
        }
      }));
    });
  });
}