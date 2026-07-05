function readJsonScript(id) {
  const dataElement = document.getElementById(id);
  const rawData = dataElement?.textContent || '[]';

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Unable to load ${id}.`, error);
    return [];
  }
}

const state = {
  entries: readJsonScript('inventory-data'),
  bundles: readJsonScript('bundle-data'),
  types: readJsonScript('type-data'),
  productSpecifications: readJsonScript('product-specification-data'),
  search: '',
  activeEntry: null,
  openCombobox: null
};

const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const tableBody = document.getElementById('inventory-table-body');
const emptyInventory = document.getElementById('empty-inventory');
const inventoryModal = document.getElementById('inventory-modal');
const inventoryForm = document.getElementById('inventory-form');
const inventoryError = document.getElementById('inventory-form-error');
const bundleIdInput = document.getElementById('bundle-id');
const bundleNameInput = document.getElementById('bundle-name');
const bundleOptions = document.getElementById('bundle-options');
const typeIdInput = document.getElementById('type-id');
const typeNameInput = document.getElementById('type-name');
const typeOptions = document.getElementById('type-options');
const productSpecificationIdInput = document.getElementById('product-specification-id');
const productSpecificationInput = document.getElementById('product-specification');
const productSpecificationOptions = document.getElementById('product-specification-options');
const priceInput = document.getElementById('price');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function codeClass(codeNumber) {
  const code = String(codeNumber || '').trim().toLowerCase();

  if (code.startsWith('type')) {
    return 'bg-yellow-300 font-semibold';
  }

  return 'bg-orange-400/90';
}

function getFilteredEntries() {
  const query = state.search.trim().toLowerCase();
  if (!query) {
    return state.entries;
  }

  return state.entries.filter((entry) => [
    entry.bundle_name,
    entry.type_name,
    entry.code_number,
    entry.product_specification,
    entry.size_inches,
    entry.length_inches,
    entry.price
  ].some((value) => String(value || '').toLowerCase().includes(query)));
}

function renderInventory() {
  const entries = getFilteredEntries();
  tableBody.innerHTML = entries.map((entry) => `
    <tr class="hover:bg-zinc-100">
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(entry.bundle_name)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(entry.type_name)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm ${codeClass(entry.code_number)}">${escapeHtml(entry.code_number)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(entry.product_specification)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm whitespace-nowrap">${escapeHtml(entry.size_inches)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm whitespace-nowrap">${escapeHtml(entry.length_inches)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm whitespace-nowrap">${escapeHtml(entry.price)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-right text-sm">
        <div class="flex min-w-max justify-end gap-2">
          <button class="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200" data-action="edit" data-id="${entry.id}" type="button">Edit</button>
          <button class="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" data-action="delete" data-id="${entry.id}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  emptyInventory.classList.toggle('hidden', entries.length > 0);
}

function openModal() {
  inventoryModal.classList.remove('hidden');
  inventoryModal.classList.add('flex');
  requestAnimationFrame(() => inventoryModal.classList.remove('opacity-0'));
}

function closeModal() {
  hideComboboxes();
  inventoryModal.classList.add('opacity-0');
  window.setTimeout(() => {
    inventoryModal.classList.add('hidden');
    inventoryModal.classList.remove('flex');
  }, 160);
}

function setFormError(message) {
  inventoryError.textContent = message || '';
  inventoryError.classList.toggle('hidden', !message);
}

function optionButton(label, meta, type, id) {
  const subtitle = meta ? `<span class="text-xs text-zinc-400">${escapeHtml(meta)}</span>` : '';

  return `
    <button class="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus:bg-white/10 focus:outline-none" type="button" data-combobox-type="${type}" data-option-id="${escapeHtml(id)}">
      <span class="truncate">${escapeHtml(label)}</span>
      ${subtitle}
    </button>
  `;
}

function noMatch(text) {
  return `<div class="px-3 py-2 text-sm text-zinc-400">${escapeHtml(text)}</div>`;
}

function hideComboboxes() {
  state.openCombobox = null;
  bundleOptions.classList.add('hidden');
  typeOptions.classList.add('hidden');
  productSpecificationOptions.classList.add('hidden');
  bundleNameInput.setAttribute('aria-expanded', 'false');
  typeNameInput.setAttribute('aria-expanded', 'false');
  productSpecificationInput.setAttribute('aria-expanded', 'false');
}

function showBundleOptions() {
  const query = bundleNameInput.value.trim().toLowerCase();
  const matches = state.bundles
    .filter((bundle) => !query || bundle.bundle_name.toLowerCase().includes(query))
    .slice(0, 12);

  bundleOptions.innerHTML = matches.length
    ? matches.map((bundle) => optionButton(bundle.bundle_name, '', 'bundle', bundle.id)).join('')
    : noMatch('No matching bundle. Save to create it.');

  typeOptions.classList.add('hidden');
  typeNameInput.setAttribute('aria-expanded', 'false');
  productSpecificationOptions.classList.add('hidden');
  productSpecificationInput.setAttribute('aria-expanded', 'false');
  bundleOptions.classList.remove('hidden');
  bundleNameInput.setAttribute('aria-expanded', 'true');
  state.openCombobox = 'bundle';
}

function showTypeOptions() {
  const query = typeNameInput.value.trim().toLowerCase();
  const matches = state.types
    .filter((type) => !query || type.type_name.toLowerCase().includes(query))
    .slice(0, 12);

  typeOptions.innerHTML = matches.length
    ? matches.map((type) => optionButton(type.type_name, type.price, 'type', type.id)).join('')
    : noMatch('No matching type. Create it on Manage Lists first.');

  bundleOptions.classList.add('hidden');
  bundleNameInput.setAttribute('aria-expanded', 'false');
  productSpecificationOptions.classList.add('hidden');
  productSpecificationInput.setAttribute('aria-expanded', 'false');
  typeOptions.classList.remove('hidden');
  typeNameInput.setAttribute('aria-expanded', 'true');
  state.openCombobox = 'type';
}

function showProductSpecificationOptions() {
  const query = productSpecificationInput.value.trim().toLowerCase();
  const matches = state.productSpecifications
    .filter((spec) => !query || spec.product_specification.toLowerCase().includes(query))
    .slice(0, 12);

  productSpecificationOptions.innerHTML = matches.length
    ? matches.map((spec) => optionButton(spec.product_specification, '', 'product-specification', spec.id)).join('')
    : noMatch('No matching product specification. Save to create it.');

  bundleOptions.classList.add('hidden');
  bundleNameInput.setAttribute('aria-expanded', 'false');
  typeOptions.classList.add('hidden');
  typeNameInput.setAttribute('aria-expanded', 'false');
  productSpecificationOptions.classList.remove('hidden');
  productSpecificationInput.setAttribute('aria-expanded', 'true');
  state.openCombobox = 'product-specification';
}

function selectBundle(id) {
  const bundle = state.bundles.find((item) => item.id === id);
  if (!bundle) {
    return;
  }

  bundleIdInput.value = bundle.id;
  bundleNameInput.value = bundle.bundle_name;
  hideComboboxes();
}

function selectType(id) {
  const type = state.types.find((item) => item.id === id);
  if (!type) {
    return;
  }

  typeIdInput.value = type.id;
  typeNameInput.value = type.type_name;
  priceInput.value = type.price;
  hideComboboxes();
}

function selectProductSpecification(id) {
  const spec = state.productSpecifications.find((item) => item.id === id);
  if (!spec) {
    return;
  }

  productSpecificationIdInput.value = spec.id;
  productSpecificationInput.value = spec.product_specification;
  hideComboboxes();
}

function upsertBundleOption(entry) {
  const bundle = {
    id: entry.bundle_id,
    bundle_name: entry.bundle_name
  };
  const index = state.bundles.findIndex((item) => item.id === bundle.id);

  if (!bundle.id) {
    return;
  }

  if (index >= 0) {
    state.bundles[index] = bundle;
  } else {
    state.bundles.push(bundle);
  }

  state.bundles.sort((a, b) => a.bundle_name.localeCompare(b.bundle_name));
}

function upsertTypeOption(entry) {
  const type = {
    id: entry.type_id,
    type_name: entry.type_name,
    price: entry.price
  };
  const index = state.types.findIndex((item) => item.id === type.id);

  if (!type.id) {
    return;
  }

  if (index >= 0) {
    state.types[index] = type;
  } else {
    state.types.push(type);
  }

  state.types.sort((a, b) => a.type_name.localeCompare(b.type_name));
}

function upsertProductSpecificationOption(entry) {
  const spec = {
    id: entry.product_specification_id,
    product_specification: entry.product_specification
  };
  const index = state.productSpecifications.findIndex((item) => item.id === spec.id);

  if (!spec.id) {
    return;
  }

  if (index >= 0) {
    state.productSpecifications[index] = spec;
  } else {
    state.productSpecifications.push(spec);
  }

  state.productSpecifications.sort((a, b) => a.product_specification.localeCompare(b.product_specification));
}

function setFormValues(entry) {
  document.getElementById('inventory-id').value = entry?.id || '';
  bundleIdInput.value = entry?.bundle_id || '';
  bundleNameInput.value = entry?.bundle_name || '';
  typeIdInput.value = entry?.type_id || '';
  typeNameInput.value = entry?.type_name || '';
  document.getElementById('code-number').value = entry?.code_number || '';
  productSpecificationIdInput.value = entry?.product_specification_id || '';
  productSpecificationInput.value = entry?.product_specification || '';
  document.getElementById('size-inches').value = entry?.size_inches || '';
  document.getElementById('length-inches').value = entry?.length_inches || '';
  priceInput.value = entry?.price || '';
}

function getFormPayload() {
  return {
    bundle_id: bundleIdInput.value,
    bundle_name: bundleNameInput.value,
    type_id: typeIdInput.value,
    type_name: typeNameInput.value,
    code_number: document.getElementById('code-number').value,
    product_specification_id: productSpecificationIdInput.value,
    product_specification: productSpecificationInput.value,
    size_inches: document.getElementById('size-inches').value,
    length_inches: document.getElementById('length-inches').value
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = 'Request failed.';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch (error) {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function findEntry(id) {
  return state.entries.find((entry) => entry.id === id);
}

function upsertEntry(entry) {
  const index = state.entries.findIndex((item) => item.id === entry.id);
  if (index >= 0) {
    state.entries[index] = entry;
  } else {
    state.entries.unshift(entry);
  }

  upsertBundleOption(entry);
  upsertTypeOption(entry);
  upsertProductSpecificationOption(entry);
}

function openNewEntry() {
  setFormError('');
  hideComboboxes();
  state.activeEntry = null;
  inventoryForm.reset();
  bundleIdInput.value = '';
  typeIdInput.value = '';
  productSpecificationIdInput.value = '';
  document.getElementById('inventory-modal-title').textContent = 'New Inventory Entry';
  document.getElementById('save-inventory-button').textContent = 'Save Entry';
  openModal();
}

function openEditEntry(entry) {
  setFormError('');
  hideComboboxes();
  state.activeEntry = entry;
  document.getElementById('inventory-modal-title').textContent = 'Edit Inventory Entry';
  document.getElementById('save-inventory-button').textContent = 'Update Entry';
  setFormValues(entry);
  openModal();
}

async function submitEntry(event) {
  event.preventDefault();
  setFormError('');
  const button = document.getElementById('save-inventory-button');
  button.disabled = true;

  try {
    const payload = getFormPayload();
    const id = document.getElementById('inventory-id').value;
    const data = id
      ? await fetchJson(`/inventory/entries/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/inventory/entries', { method: 'POST', body: JSON.stringify(payload) });

    upsertEntry(data.entry);
    closeModal();
    renderInventory();
  } catch (error) {
    setFormError(error.message);
  } finally {
    button.disabled = false;
  }
}

async function deleteEntry(id) {
  const entry = findEntry(id);
  if (!entry) {
    return;
  }

  if (!window.confirm(`Delete ${entry.code_number} from inventory? This cannot be undone.`)) {
    return;
  }

  await fetchJson(`/inventory/entries/${id}`, { method: 'DELETE' });
  state.entries = state.entries.filter((item) => item.id !== id);
  renderInventory();
}

document.getElementById('new-inventory-button').addEventListener('click', openNewEntry);
document.getElementById('inventory-search').addEventListener('input', (event) => {
  state.search = event.target.value;
  renderInventory();
});
document.getElementById('clear-inventory-search').addEventListener('click', () => {
  document.getElementById('inventory-search').value = '';
  state.search = '';
  renderInventory();
});

document.querySelectorAll('[data-close-inventory-modal]').forEach((button) => {
  button.addEventListener('click', closeModal);
});

bundleNameInput.addEventListener('focus', showBundleOptions);
bundleNameInput.addEventListener('input', () => {
  bundleIdInput.value = '';
  showBundleOptions();
});

typeNameInput.addEventListener('focus', showTypeOptions);
typeNameInput.addEventListener('input', () => {
  typeIdInput.value = '';
  priceInput.value = '';
  showTypeOptions();
});

productSpecificationInput.addEventListener('focus', showProductSpecificationOptions);
productSpecificationInput.addEventListener('input', () => {
  productSpecificationIdInput.value = '';
  showProductSpecificationOptions();
});

bundleOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[data-option-id]');
  if (option?.dataset.comboboxType === 'bundle') {
    selectBundle(option.dataset.optionId);
  }
});

typeOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[data-option-id]');
  if (option?.dataset.comboboxType === 'type') {
    selectType(option.dataset.optionId);
  }
});

productSpecificationOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[data-option-id]');
  if (option?.dataset.comboboxType === 'product-specification') {
    selectProductSpecification(option.dataset.optionId);
  }
});

document.addEventListener('click', (event) => {
  if (
    !bundleNameInput.contains(event.target)
    && !bundleOptions.contains(event.target)
    && !typeNameInput.contains(event.target)
    && !typeOptions.contains(event.target)
    && !productSpecificationInput.contains(event.target)
    && !productSpecificationOptions.contains(event.target)
  ) {
    hideComboboxes();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideComboboxes();
  }
});

tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'edit') {
    const entry = findEntry(button.dataset.id);
    if (entry) {
      openEditEntry(entry);
    }
  } else if (button.dataset.action === 'delete') {
    deleteEntry(button.dataset.id).catch((error) => window.alert(error.message));
  }
});

inventoryForm.addEventListener('submit', submitEntry);
renderInventory();
