if (!window.Eurus) window.Eurus = {};
if (!window.Eurus.loadedScript) window.Eurus.loadedScript = new Set();
if (window.Eurus.loadedScript.has('variant-backorder-message.js')) return;
window.Eurus.loadedScript.add('variant-backorder-message.js');

  const PROPERTY_NAME = 'properties[Backorder Message]';

  function getConfigElements() {
    return document.querySelectorAll('[data-variant-backorder-config]');
  }

  function getSectionEl(sectionId) {
    return document.getElementById(`shopify-section-${sectionId}`);
  }

  function getVariantPicker(sectionId) {
    return getSectionEl(sectionId)?.querySelector('.variant-selects-main') || null;
  }

  function getSelectedOptionValues(pickerEl) {
    if (!pickerEl) return [];

    const values = [];
    const inputs = pickerEl.querySelectorAll('[data-option-value-id]');
    const grouped = {};

    inputs.forEach((input) => {
      const name = input.getAttribute('name');
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(input);
    });

    Object.keys(grouped)
      .sort()
      .forEach((name) => {
        const group = grouped[name];
        const select = group.find((input) => input.tagName === 'SELECT');

        if (select) {
          const selectedOption = select.options[select.selectedIndex];
          if (selectedOption && !selectedOption.id?.includes('-blank')) {
            values.push(selectedOption.value);
          }
          return;
        }

        const checked = group.find((input) => input.type === 'radio' && input.checked);
        if (checked) {
          values.push(checked.value);
        }
      });

    return values;
  }

  function isFullySelected(pickerEl, optionCount) {
    if (!pickerEl || optionCount <= 0) return false;
    return getSelectedOptionValues(pickerEl).length >= optionCount;
  }

  function findMatchingVariant(variants, selectedOptions) {
    return variants.find((variant) => {
      if (!variant.options || variant.options.length !== selectedOptions.length) {
        return false;
      }

      return variant.options.every((option, index) => option === selectedOptions[index]);
    });
  }

  function getForm(formId) {
    return document.getElementById(formId);
  }

  function getPropertyInput(form) {
    return form?.querySelector(`input[name="${PROPERTY_NAME}"]`) || null;
  }

  function setPropertyInput(form, value) {
    if (!form || !value) return;

    let input = getPropertyInput(form);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = PROPERTY_NAME;
      form.appendChild(input);
    }

    input.value = value;
    input.setAttribute('value', value);
  }

  function removePropertyInput(form) {
    getPropertyInput(form)?.remove();
  }

  function setMessageState(messageEl, text, isPlaceholder) {
    messageEl.textContent = text;
    messageEl.classList.toggle('variant-backorder-message--placeholder', isPlaceholder);
  }

  function initBackorderMessage(configEl) {
    const sectionId = configEl.dataset.sectionId;
    const formId = configEl.dataset.formId;
    const optionCount = parseInt(configEl.dataset.optionCount, 10) || 0;
    const placeholderText = configEl.dataset.placeholderText || '';
    const hasOnlyDefaultVariant = configEl.dataset.hasOnlyDefaultVariant === 'true';

    const messageEl = document.getElementById(`VariantMetafield-${sectionId}`);
    const dataEl = document.getElementById(`variantMetafieldData-${sectionId}`);
    const form = getForm(formId);
    const sectionEl = getSectionEl(sectionId);

    if (!messageEl || !dataEl || !form) return;

    if (hasOnlyDefaultVariant) return;

    const variants = JSON.parse(dataEl.textContent);

    function updateMessage() {
      const pickerEl = getVariantPicker(sectionId);

      if (!isFullySelected(pickerEl, optionCount)) {
        setMessageState(messageEl, placeholderText, true);
        removePropertyInput(form);
        return;
      }

      const selectedOptions = getSelectedOptionValues(pickerEl);
      const matchedVariant = findMatchingVariant(variants, selectedOptions);
      const metafield = matchedVariant?.metafield;

      if (metafield !== null && metafield !== undefined && metafield !== '') {
        setMessageState(messageEl, metafield, false);
        setPropertyInput(form, metafield);
      } else {
        setMessageState(messageEl, '', false);
        removePropertyInput(form);
      }
    }

    sectionEl?.addEventListener('change', (event) => {
      if (event.target.matches('[data-option-value-id]')) {
        updateMessage();
      }
    });

    document.addEventListener(`eurus:product-page-variant-select:updated:${sectionId}`, () => {
      updateMessage();
    });

    updateMessage();
  }

  function initAll() {
    getConfigElements().forEach((configEl) => {
      if (configEl.dataset.initialized === 'true') return;
      configEl.dataset.initialized = 'true';
      initBackorderMessage(configEl);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
