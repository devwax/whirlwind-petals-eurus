// Petals variant-backorder-message v2026-06-24.3
// If you see this version in DevTools → Sources, the latest JS is loaded (not a stale cache).

if (!window.Eurus) window.Eurus = {};
if (!window.Eurus.loadedScript) window.Eurus.loadedScript = new Set();

if (!window.Eurus.loadedScript.has('variant-backorder-message.js')) {
  window.Eurus.loadedScript.add('variant-backorder-message.js');

  console.info('[Petals] variant-backorder-message v2026-06-24.3 loaded');

  const PROPERTY_NAME = 'properties[Backorder Message]';
  const SCRIPT_VERSION = '2026-06-24.3';

  function getConfigElements() {
    return document.querySelectorAll('[data-variant-backorder-config]');
  }

  function getSectionRoot(sectionId, configEl) {
    return (
      configEl?.closest('[id^="shopify-section-"]') ||
      document.getElementById(`shopify-section-${sectionId}`)
    );
  }

  function getVariantPicker(sectionId, configEl) {
    return getSectionRoot(sectionId, configEl)?.querySelector('.variant-selects-main') || null;
  }

  function getSelectedOptionValues(pickerEl) {
    if (!pickerEl) return [];

    const values = [];

    pickerEl.querySelectorAll('fieldset input[type="radio"]:checked').forEach((input) => {
      values.push(input.value);
    });

    pickerEl.querySelectorAll('select').forEach((select) => {
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption && !selectedOption.id?.includes('-blank')) {
        values.push(selectedOption.value);
      }
    });

    return values;
  }

  function isFullySelected(pickerEl, optionCount) {
    if (!pickerEl || optionCount <= 0) return false;

    let selectedCount = pickerEl.querySelectorAll('fieldset input[type="radio"]:checked').length;

    pickerEl.querySelectorAll('select').forEach((select) => {
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption && !selectedOption.id?.includes('-blank')) {
        selectedCount += 1;
      }
    });

    return selectedCount >= optionCount;
  }

  function getCurrentVariantFromScript(sectionId) {
    const scriptEl = document.querySelector(
      `#variant-update-${sectionId} script[data-selected-variant]`
    );
    if (!scriptEl) return null;

    try {
      const variant = JSON.parse(scriptEl.textContent);
      return variant?.id ? variant : null;
    } catch {
      return null;
    }
  }

  function findVariantById(variants, id) {
    if (!id) return null;
    return variants.find((variant) => String(variant.id) === String(id)) || null;
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

    if (!messageEl || !dataEl) return;
    if (hasOnlyDefaultVariant) return;

    const variants = JSON.parse(dataEl.textContent);

    function resolveMatchedVariant() {
      const pickerEl = getVariantPicker(sectionId, configEl);

      if (!isFullySelected(pickerEl, optionCount)) {
        return null;
      }

      const selectedOptions = getSelectedOptionValues(pickerEl);
      const matchedByOptions = findMatchingVariant(variants, selectedOptions);
      if (matchedByOptions) {
        return matchedByOptions;
      }

      const variantFromScript = getCurrentVariantFromScript(sectionId);
      let matched = findVariantById(variants, variantFromScript?.id);

      if (!matched) {
        const form = getForm(formId);
        matched = findVariantById(variants, form?.querySelector('input[name="id"]')?.value);
      }

      return matched;
    }

    function updateMessage() {
      const form = getForm(formId);
      const matchedVariant = resolveMatchedVariant();

      if (!matchedVariant) {
        setMessageState(messageEl, placeholderText, true);
        removePropertyInput(form);
        return;
      }

      const metafield = matchedVariant.metafield;

      if (metafield !== null && metafield !== undefined && metafield !== '') {
        setMessageState(messageEl, metafield, false);
        setPropertyInput(form, metafield);
      } else {
        setMessageState(messageEl, '', false);
        removePropertyInput(form);
      }
    }

    function scheduleUpdateMessage() {
      updateMessage();
      requestAnimationFrame(updateMessage);
      setTimeout(updateMessage, 0);
      setTimeout(updateMessage, 100);
    }

    const sectionRoot = getSectionRoot(sectionId, configEl);

    sectionRoot?.addEventListener('change', (event) => {
      if (event.target.matches('[data-option-value-id]')) {
        scheduleUpdateMessage();
      }
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (target.name !== 'id') return;
      if (target.id !== `update-variant-${sectionId}` && !target.closest(`#${formId}`)) return;
      scheduleUpdateMessage();
    });

    document.addEventListener(`eurus:product-page-variant-select:updated:${sectionId}`, () => {
      scheduleUpdateMessage();
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

  window.PetalsBackorderMessage = {
    version: SCRIPT_VERSION,
    init: initAll,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
}
