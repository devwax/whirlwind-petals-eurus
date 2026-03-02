if (!window.Eurus.loadedScript.has('featured-blog.js')) {
  window.Eurus.loadedScript.add('featured-blog.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xFeaturedBlog', (sectionId, container) => ({
        sectionId: sectionId,
        loading: true,
        show_more: true,
        loadData() {      
          let url = `${window.location.pathname}?section_id=${this.sectionId}`;
          fetch(url, {
            method: 'GET'
          }).then(
            response => response.text()
          ).then(responseText => {
            this.loading = false;
          })
        }
      }));
    });
  });
}