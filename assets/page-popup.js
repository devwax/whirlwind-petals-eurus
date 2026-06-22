if (!window.Eurus.loadedScript.has('page-popup.js')) {
  window.Eurus.loadedScript.add('page-popup.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.store('xPagePopup', {
        open: false,
        loading: false,
        error: false,
        cachedResults: {},
        pendingFetch: {},

        openFromUrl(url) {
          if (!url) return;

          const fetchUrl = this.normalizeFetchUrl(url);
          if (!fetchUrl) return;

          this.open = true;
          this.error = false;
          Alpine.store('xPopup').open = true;

          const contentEl = document.getElementById('page-popup-content');
          if (!contentEl) return;

          if (this.cachedResults[fetchUrl]) {
            contentEl.innerHTML = this.cachedResults[fetchUrl];
            this.loading = false;
            return;
          }

          if (this.pendingFetch[fetchUrl]) return;

          this.loading = true;
          contentEl.innerHTML = '';
          this.pendingFetch[fetchUrl] = true;

          fetch(fetchUrl, { method: 'GET' })
            .then((response) => response.text())
            .then((responseText) => {
              const html = new DOMParser().parseFromString(responseText, 'text/html');
              const body = html.querySelector('.page__container .page__body');
              const content = body ? body.innerHTML : '';

              if (!content.trim()) {
                this.error = true;
                contentEl.innerHTML = '<p class="text-center">Promotion details are unavailable.</p>';
                return;
              }

              this.cachedResults[fetchUrl] = content;
              contentEl.innerHTML = content;
            })
            .catch(() => {
              this.error = true;
              contentEl.innerHTML = '<p class="text-center">Promotion details are unavailable.</p>';
            })
            .finally(() => {
              this.loading = false;
              this.pendingFetch[fetchUrl] = false;
            });
        },

        normalizeFetchUrl(url) {
          try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin !== window.location.origin) return null;
            parsed.searchParams.delete('popup');
            return parsed.pathname + parsed.search + parsed.hash;
          } catch {
            return null;
          }
        },

        isPopupLink(href) {
          if (!href) return false;
          try {
            const parsed = new URL(href, window.location.origin);
            if (parsed.origin !== window.location.origin) return false;
            const popup = parsed.searchParams.get('popup');
            return popup === '1' || popup?.toLowerCase() === 'true';
          } catch {
            return false;
          }
        },

        close() {
          this.open = false;
          this.loading = false;
          Alpine.store('xPopup').close();
        },
      });

      document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link || link.closest('.petals-promo-bar')) return;

        const href = link.getAttribute('href');
        if (!Alpine.store('xPagePopup').isPopupLink(href)) return;

        event.preventDefault();
        Alpine.store('xPagePopup').openFromUrl(href);
      });
    });
  });
}
