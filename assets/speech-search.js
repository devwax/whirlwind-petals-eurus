if (!window.Eurus.loadedScript.has('speech-search.js')) {
  window.Eurus.loadedScript.add('speech-search.js');

  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.data('xSpeechSearch', (el) => ({
        recognition: null,
        isListening: false,
        searchInput: null,
        searchBtn: null,
        show: false,
        initSpeechSearch() {
          const userAgent = window.navigator.userAgent.toLowerCase();
          if ('webkitSpeechRecognition' in window
            && userAgent.indexOf('chrome') > -1 && !!window.chrome
            && userAgent.indexOf('edg/') === -1) {
            this.show = true;
            this.recognition = new window.webkitSpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            const form = el.closest('form');
            this.searchInput = form.querySelector('.input-search');
            this.searchBtn = form.querySelector('.btn-search');
            this.bindEvents();
          } else {
            this.show = false;
          }
        },

        bindEvents() {
          this.recognition.addEventListener(
            'result',
            (evt) => {
              if (evt.results) {
                const term = evt.results[0][0].transcript;
                this.searchInput.value = term;
                this.searchInput.dispatchEvent(new Event('keyup'));
                el.blur();
                this.searchBtn.focus();
              }
            }
          );
  
          this.recognition.addEventListener('audiostart', () => {
            this.isListening = true;
            el.classList.add('search__speech-listening');
          });
  
          this.recognition.addEventListener('audioend', () => {
            this.isListening = false;
            el.classList.remove('search__speech-listening');
          });
  
          el.addEventListener('click', (e)=> this.toggleListen(e));
        },
  
        toggleListen(evt) {
          evt.preventDefault();
          if (this.isListening) {
            this.recognition.stop();
          } else {
            this.recognition.start();
          }
        }
      }))
    });
  });
} 