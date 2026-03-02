if (!window.Eurus.loadedScript.has('tab-attention.js')) {
  window.Eurus.loadedScript.add('tab-attention.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xTabAttention', ({ message1, message2, delay }) => ({
        messages: (() => {
          if (message1 && !message2) return [message1];
          if (!message1 && message2) return [message2];
          return [message1, message2];
        })(),
        messageIndex: 0,
        intervalId: null,
        pageTitle: document.title,
        init() {
          document.title = this.pageTitle;
          if (this.messages.length === 0) {
            return;
          }
          window.addEventListener('focus', this.handleStopTabAttention.bind(this));
          window.addEventListener('blur', this.handleStartTabAttention.bind(this));
        },
        
        handleStartTabAttention() {
          if (this.intervalId) return;
          this.intervalId = setInterval(() => {
            document.title = this.messages[this.messageIndex];
            this.messageIndex = (this.messageIndex + 1) % this.messages.length;
          }, delay * 1000);
        },

        handleStopTabAttention() {
          if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
          }
          document.title = this.pageTitle;
        },
      }));
    });
  });
}