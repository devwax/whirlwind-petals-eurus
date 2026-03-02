if (!window.Eurus.loadedScript.has('gift-card-recipient.js')) {
  window.Eurus.loadedScript.add('gift-card-recipient.js');

  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xGiftCardRecipent', (sectionId, message_email_required, message_email_invalid, message_send_on, error_message_wrapper) => ({
        showForm: false,
        recipient_control: 'if_present',
        validateEmail: { 'show': true, 'message': ''},
        validateDate: { 'show': false, 'message': ''},
        disabled: true,
        init() {
          this.$refs.timezone_offset.value = new Date().getTimezoneOffset().toString();
        },
        onChange() {
          if ( this.$refs.recipient_checkbox.checked) {
            this.showForm = true;
            this.recipient_control = 'on';
            this.$el.closest('.button-product').querySelector('.add_to_cart_button').setAttribute('disabled', 'disabled') 
          } else {
            this.showForm = false;
            this.recipient_control = 'if_present';
            const atcButton = this.$el.closest('.button-product').querySelector('.add_to_cart_button');
            if (atcButton && atcButton.dataset.available == "true") {
              this.$el.closest('.button-product').querySelector('.add_to_cart_button').removeAttribute('disabled');
            } 
          }
          this.setForm();
        },
        onChangeInput() {
          if (this.$el.type == 'email') {
            var validRegex = /^[0-9a-z]+(?:\.[0-9a-z]+)*@[a-z0-9]{2,}(?:\.[a-z]{2,})+$/;
            if (this.$el.value === '') {
              this.validateEmail = { 'show': true, 'message': message_email_required };
            } else if (!this.$el.value.match(validRegex)) {
              this.validateEmail = { 'show': true, 'message': message_email_invalid };
            } else {
              this.validateEmail = { 'show': false, 'message': '' };
            }
          }

          if (this.$el.type == 'date') {
            if (new Date() > new Date(this.$el.value) || new Date(this.$el.value) > new Date(Date.now() + 90*24*60*60*1000)) {
              this.validateDate = { 'show': true, 'message': message_send_on };
            } else {
              this.validateDate = { 'show': false, 'message': '' };
            }
          }

          const atcButton = this.$el.closest('.button-product').querySelector('.add_to_cart_button');
          if (this.validateDate.show || this.validateEmail.show) {
            this.$el.closest('.recipient-form').dataset.disabled = "true";
            atcButton.setAttribute('disabled', 'disabled');
          } else {
            this.$el.closest('.recipient-form').dataset.disabled = "false";
            if (atcButton && atcButton.dataset.available == "true") {
              atcButton.removeAttribute('disabled');
            } else {
              atcButton.setAttribute('disabled', 'disabled');
            }
          }
        },
        setForm() {
          document.getElementById(`recipient-form-${ sectionId }`).querySelectorAll('.recipient_input').forEach((input) => {
            input.value = '';
          })
          this.$refs.recipient_error_message.classList.add('hidden');
          
          this.validateDate = { 'show': false, 'message': '' };
          this.validateEmail = { 'show': true, 'message': '' };
          if (this.$el.closest('.recipient-form')) {
            this.$el.closest('.recipient-form').dataset.disabled = "true";
          }
        },
        handleShowResult() {
          Object.entries(error_message_wrapper).forEach(([key, value]) => {
            if (key == 'email') {
              this.validateEmail = { 'show': true, 'message': value[0] };
            }
            if (key == 'send_on') {
              this.validateDate = { 'show': true, 'message': value[0] };
            }
          });
        }
      }))
    });
  });
}