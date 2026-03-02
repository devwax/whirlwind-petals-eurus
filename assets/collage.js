if (!window.Eurus.loadedScript.has('collage.js')) {
    window.Eurus.loadedScript.add('collage.js');
  
    requestAnimationFrame(() => {
      document.addEventListener('alpine:init', () => {
        Alpine.data('xCollage', (sectionId, pageParam, container) => ({
          sectionId: sectionId,
          pageParam: pageParam,
          loading: true,
          load(index) {
            this.loading = true;
            let url = `${window.location.pathname}?section_id=${this.sectionId}&${this.pageParam}=${index}`;
            fetch(url, {
              method: 'GET'
            }).then(
              response => response.text()
            ).then(responseText => {
              const html = (new DOMParser()).parseFromString(responseText, 'text/html');
              const contentId = `collage-${this.sectionId}`;
              const newContent = html.getElementById(contentId);
              if (newContent && !document.getElementById(contentId)) {
                container.appendChild(newContent);
              }
              this.loading = false;
            })
          }
        }));
      });
    });
  }