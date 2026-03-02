if (!window.Eurus.loadedScript.has('customize-picker.js')) {
  window.Eurus.loadedScript.add('customize-picker.js');
  requestAnimationFrame(() => {
    document.addEventListener('alpine:init', () => {
      Alpine.data('xCustomizePicker', () => ({
        dataCheckbox: [],
        dataCheckboxTitle: [],
        disableInput: true,
        radioChecked: '',
        radioCheckedTitle: '',
        validation(el) {
          if (el.value == "") {
            el.classList.add("required-picker");
          }
          else {
            el.classList.remove("required-picker");
          }
          this.validateErrorBtn(el);
        },
        validateErrorBtn(el) {
          let hasRequiredInput = false;
          let allInputsHaveValue = true;
          var productInfo = el.closest('.product-info');
          var paymentBtn = productInfo.querySelector(".payment-button--clone");
          var propertiesInput = productInfo.querySelectorAll(".customization-picker");
          for (const input of propertiesInput) {
            if (input.required) {
              hasRequiredInput = true;
              if (input.value == ''){
                allInputsHaveValue = false
                break
              }
            }
          }
          if (hasRequiredInput) {
            if (allInputsHaveValue){
              paymentBtn?.classList.add('hidden');
            } else {
              paymentBtn?.classList.remove('hidden');
            }           
          }
          else {
            paymentBtn?.classList.add('hidden');
          }
        },
        setValueBlank(el) {
          if (el.value == '') {
            this.disableInput = true;
          } else {
            this.disableInput = false;
          }
        },
        validateErrorAddAsBundle(el) {
          var productInfo = el.closest('.product-info');
          var propertiesInput = productInfo.querySelectorAll(".customization-picker");
          var optionValid = true;
          propertiesInput.length && propertiesInput.forEach((input) => {
            if (input.required && input.value == '' || input.classList.contains("validate-checkbox")) {
              input.classList.add("required-picker");
              if (optionValid) optionValid = false;
            }
          });
          return optionValid;
        },
        validateError(el) {
          var productInfo = el.closest('.product-info');
          var propertiesInput = productInfo.querySelectorAll(".customization-picker");
          let scrollStatus = false;
          var optionValid = true;
          propertiesInput.length && propertiesInput.forEach((input) => {
            if (input.required && input.value.trim() == '' || input.classList.contains("validate-checkbox")) {
              input.classList.add("required-picker");
              if(!scrollStatus){
                input.parentElement.querySelector('.text-required').scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
                scrollStatus = true;
              }              
            } else {
              input.classList.remove("required-picker")
            }   
          });
          
          return optionValid;
        },
        validateCheckBox(el, minLimit, maxLimit) {
          var groupCheckbox = el.closest(".customize-checkbox");
          const checkedInputs = groupCheckbox.querySelectorAll('input[type=checkbox]:checked');
          if (checkedInputs.length >= minLimit ) {
            el.classList.remove('required-picker', 'validate-checkbox');
          } else {
            el.classList.add('required-picker', 'validate-checkbox');
          }

          if (maxLimit > 0 && maxLimit >= minLimit) {
            const disableInput = checkedInputs.length >= maxLimit;
            const uncheckedInputs = groupCheckbox.querySelectorAll('input[type=checkbox]:not(:checked)');
            uncheckedInputs.forEach((uncheckedInput) => {
              uncheckedInput.disabled = disableInput;
            });
          }
          if (minLimit > 0) {
            this.validateErrorBtn(el);
          }
        },
        setDragAndDrop(el) {
          const inputElement = el.querySelector('.drop-zone__input');
          const dropZoneWrapElm = inputElement.closest('.drop-zone-wrap');
          const dropZoneElement = dropZoneWrapElm.querySelector('.drop-zone');
      
          dropZoneElement.addEventListener('click', (e) => {
            inputElement.click();
          });
      
          inputElement.addEventListener('change', (e) => {
            if (inputElement.files.length) {
              const dropZone = inputElement.closest('.drop-zone-wrap');
              const file = inputElement.files[0];
              const filesize = ((file.size/1024)/1024).toFixed(4);
      
              dropZone.classList.remove('drop-zone-wrap--error');
              inputElement.classList.remove('required-picker');
              if (filesize > 5) {
                inputElement.value = '';
                dropZone.classList.add('drop-zone-wrap--error');
                setTimeout(()=> {
                  dropZone.classList.remove('drop-zone-wrap--error');
                },3000);
                return;
              }
              this.preview(dropZoneWrapElm, file);
            }
          });
      
          dropZoneElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneElement.classList.add('drop-zone--over');
          });
      
          ["dragleave", "dragend"].forEach((type) => {
            dropZoneElement.addEventListener(type, (e) => {
              dropZoneElement.classList.remove('drop-zone--over');
            });
          });
      
          dropZoneElement.addEventListener('drop', (e) => {
            e.preventDefault();
      
            if (e.dataTransfer.files.length) {
              inputElement.files = e.dataTransfer.files;
              this.preview(dropZoneWrapElm, e.dataTransfer.files[0]);
            }
      
            dropZoneElement.classList.remove('drop-zone--over');
          });
        },
        preview(dropZoneWrapElm, file) {
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            let thumbnailElement = dropZoneWrapElm.querySelector('.drop-zone__thumb');
            let preview = dropZoneWrapElm.querySelector('.dd-thumbnail');
            let previewIcon = preview.querySelector('.icon-file');
            let fileInfo = dropZoneWrapElm.querySelector('.dd-file-info');
      
            dropZoneWrapElm.classList.add('drop-zone-wrap--inactive');
            const spanFileName = fileInfo.querySelector('.dd-file-info__title');
            const fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            spanFileName.textContent = fileName;
            const spanFileType = fileInfo.querySelector('.dd-file-info__type');
            spanFileType.textContent = `${this.formatFileType(file)} • ${this.calculateSize(file)}`;
      
            preview.removeAttribute('style');
            previewIcon.classList.add('hidden');
      
            if ( /\.(jpe?g|png|gif|webp)$/i.test(file.name) ) {
              preview.setAttribute('style',`background-image:url("${reader.result}");`);
            } else {
              previewIcon.classList.remove('hidden');
            }
      
            thumbnailElement.setAttribute('data-ts-file', file.name);
          }, false);
          
          reader.readAsDataURL(file);
        },
        removeFile(evt, el) {
          evt.preventDefault();
          const dropZoneWrapElm = el.closest('.drop-zone-wrap');
          const inputElm = dropZoneWrapElm.querySelector('.drop-zone__input');
          
          inputElm.value = '';
          dropZoneWrapElm.classList.remove('drop-zone-wrap--inactive');
          this.disableInput = true;
        },
        formatFileType(file) {
          const type = file.type;
          const splitType = type.split('/');
          const subtype = splitType[1];
          let formattedType = subtype;
          let handleSubtype = subtype.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '').replace(/^-/, '');
          const applicationType = {
            'pdf': subtype.toUpperCase(),
            'vnd-ms-excel': 'Excel',
            'vnd-openxmlformats-officedocument-spreadsheetml-sheet': 'Excel',
            'vnd-ms-powerpoint': 'PowerPoint',
            'vnd-openxmlformats-officedocument-presentationml-presentation': 'PowerPoint',
            'x-msvideo': 'AVI',
            'html': 'HTML',
            'msword': 'Word',
            'vnd-openxmlformats-officedocument-wordprocessingml-document': 'Word',
            'csv': 'CSV',
            'mpeg': 'MP3 Audio',
            'webm': 'WEBM Audio',
            'mp4-video': 'MP4 Video',
            'mpeg-video': 'MPEG Video',
            'webm-video': 'WEBM Video',
            'vnd-rar': 'RAR archive',
            'rtf': 'RTF',
            'plain': 'Text',
            'wav': 'WAV',
            'vnd-adobe-photoshop': 'Adobe Photoshop',
            'postscript': 'Adobe Illustrator'
          };
      
          if (type.startsWith('image/')) {
            if (applicationType[handleSubtype]) {
              formattedType = applicationType[handleSubtype];
            } else {
              formattedType = splitType[1].toUpperCase();
              formattedType = `${formattedType} Image`;
            }
          } else if (type.startsWith('video/')) {
            const handleVideoSubtype = `${handleSubtype}-video`
            if (applicationType[handleVideoSubtype]) formattedType = applicationType[handleVideoSubtype];
          } else {
            if (applicationType[handleSubtype]) formattedType = applicationType[handleSubtype];
          }
      
          return formattedType;
        },
        calculateSize(file) {
          let numberOfBytes = file.size;
          if (numberOfBytes === 0) return 0;
      
          const units = [
            "B",
            "KB",
            "MB",
            "GB",
            "TB",
            "PB",
            "EB",
            "ZB",
            "YB"
          ];
      
          const exponent = Math.min(
            Math.floor(Math.log(numberOfBytes) / Math.log(1024)),
            units.length - 1,
          );
          const approx = numberOfBytes / 1024 ** exponent;
          const output =
            exponent === 0
              ? `${numberOfBytes} bytes`
              : `${approx.toFixed(2)} ${units[exponent]}`;
      
          return output;
        }
      }));
    });
  });
}
