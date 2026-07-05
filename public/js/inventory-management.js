function readJsonScript(id) {
  const element = document.getElementById(id);
  const rawData = element?.textContent || '[]';

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Unable to load ${id}.`, error);
    return [];
  }
}

const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const state = {
  bundles: readJsonScript('bundle-data'),
  types: readJsonScript('type-data'),
  productSpecifications: readJsonScript('product-specification-data')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setError(id, message) {
  const element = document.getElementById(id);
  element.textContent = message || '';
  element.classList.toggle('hidden', !message);
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

function upsertItem(collection, item) {
  const index = collection.findIndex((current) => current.id === item.id);

  if (index >= 0) {
    collection[index] = item;
  } else {
    collection.unshift(item);
  }
}

function sortBy(collection, key) {
  collection.sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')));
}

function rowActions(kind, id) {
  return `
    <div class="flex min-w-max justify-end gap-2">
      <button class="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200" data-kind="${kind}" data-action="edit" data-id="${escapeHtml(id)}" type="button">Edit</button>
      <button class="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" data-kind="${kind}" data-action="delete" data-id="${escapeHtml(id)}" type="button">Delete</button>
    </div>
  `;
}

function renderTypes() {
  const body = document.getElementById('type-table-body');
  body.innerHTML = state.types.map((type) => `
    <tr class="hover:bg-zinc-100">
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(type.type_name)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(type.price)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-right text-sm">${rowActions('type', type.id)}</td>
    </tr>
  `).join('');
  document.getElementById('empty-types').classList.toggle('hidden', state.types.length > 0);
}

function renderBundles() {
  const body = document.getElementById('bundle-table-body');
  body.innerHTML = state.bundles.map((bundle) => `
    <tr class="hover:bg-zinc-100">
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(bundle.bundle_name)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-right text-sm">${rowActions('bundle', bundle.id)}</td>
    </tr>
  `).join('');
  document.getElementById('empty-bundles').classList.toggle('hidden', state.bundles.length > 0);
}

function renderProductSpecifications() {
  const body = document.getElementById('product-specification-table-body');
  body.innerHTML = state.productSpecifications.map((spec) => `
    <tr class="hover:bg-zinc-100">
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(spec.product_specification)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-right text-sm">${rowActions('product-specification', spec.id)}</td>
    </tr>
  `).join('');
  document.getElementById('empty-product-specifications').classList.toggle('hidden', state.productSpecifications.length > 0);
}

function resetTypeForm() {
  document.getElementById('type-form').reset();
  document.getElementById('type-id').value = '';
  document.getElementById('save-type-button').textContent = 'Save Type';
  document.getElementById('cancel-type-button').classList.add('hidden');
  setError('type-error', '');
}

function resetBundleForm() {
  document.getElementById('bundle-form').reset();
  document.getElementById('bundle-id').value = '';
  document.getElementById('save-bundle-button').textContent = 'Save Bundle';
  document.getElementById('cancel-bundle-button').classList.add('hidden');
  setError('bundle-error', '');
}

function resetProductSpecificationForm() {
  document.getElementById('product-specification-form').reset();
  document.getElementById('product-specification-id').value = '';
  document.getElementById('save-product-specification-button').textContent = 'Save Spec';
  document.getElementById('cancel-product-specification-button').classList.add('hidden');
  setError('product-specification-error', '');
}

function editType(id) {
  const type = state.types.find((item) => item.id === id);
  if (!type) {
    return;
  }

  document.getElementById('type-id').value = type.id;
  document.getElementById('type-name').value = type.type_name;
  document.getElementById('type-price').value = type.price;
  document.getElementById('save-type-button').textContent = 'Update Type';
  document.getElementById('cancel-type-button').classList.remove('hidden');
  setError('type-error', '');
}

function editBundle(id) {
  const bundle = state.bundles.find((item) => item.id === id);
  if (!bundle) {
    return;
  }

  document.getElementById('bundle-id').value = bundle.id;
  document.getElementById('bundle-name').value = bundle.bundle_name;
  document.getElementById('save-bundle-button').textContent = 'Update Bundle';
  document.getElementById('cancel-bundle-button').classList.remove('hidden');
  setError('bundle-error', '');
}

function editProductSpecification(id) {
  const spec = state.productSpecifications.find((item) => item.id === id);
  if (!spec) {
    return;
  }

  document.getElementById('product-specification-id').value = spec.id;
  document.getElementById('product-specification').value = spec.product_specification;
  document.getElementById('save-product-specification-button').textContent = 'Update Spec';
  document.getElementById('cancel-product-specification-button').classList.remove('hidden');
  setError('product-specification-error', '');
}

async function saveType(event) {
  event.preventDefault();
  setError('type-error', '');
  const id = document.getElementById('type-id').value;
  const payload = {
    type_name: document.getElementById('type-name').value,
    price: document.getElementById('type-price').value
  };

  try {
    const data = id
      ? await fetchJson(`/inventory/types/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/inventory/types', { method: 'POST', body: JSON.stringify(payload) });

    upsertItem(state.types, data.type);
    sortBy(state.types, 'type_name');
    resetTypeForm();
    renderTypes();
  } catch (error) {
    setError('type-error', error.message);
  }
}

async function saveBundle(event) {
  event.preventDefault();
  setError('bundle-error', '');
  const id = document.getElementById('bundle-id').value;
  const payload = {
    bundle_name: document.getElementById('bundle-name').value
  };

  try {
    const data = id
      ? await fetchJson(`/inventory/bundles/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/inventory/bundles', { method: 'POST', body: JSON.stringify(payload) });

    upsertItem(state.bundles, data.bundle);
    sortBy(state.bundles, 'bundle_name');
    resetBundleForm();
    renderBundles();
  } catch (error) {
    setError('bundle-error', error.message);
  }
}

async function saveProductSpecification(event) {
  event.preventDefault();
  setError('product-specification-error', '');
  const id = document.getElementById('product-specification-id').value;
  const payload = {
    product_specification: document.getElementById('product-specification').value
  };

  try {
    const data = id
      ? await fetchJson(`/inventory/product-specifications/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/inventory/product-specifications', { method: 'POST', body: JSON.stringify(payload) });

    upsertItem(state.productSpecifications, data.productSpecification);
    sortBy(state.productSpecifications, 'product_specification');
    resetProductSpecificationForm();
    renderProductSpecifications();
  } catch (error) {
    setError('product-specification-error', error.message);
  }
}

async function deleteItem(kind, id) {
  const config = {
    type: {
      label: 'type',
      endpoint: `/inventory/types/${id}`,
      collection: state.types,
      render: renderTypes,
      errorId: 'type-error',
      reset: resetTypeForm
    },
    bundle: {
      label: 'bundle',
      endpoint: `/inventory/bundles/${id}`,
      collection: state.bundles,
      render: renderBundles,
      errorId: 'bundle-error',
      reset: resetBundleForm
    },
    'product-specification': {
      label: 'product specification',
      endpoint: `/inventory/product-specifications/${id}`,
      collection: state.productSpecifications,
      render: renderProductSpecifications,
      errorId: 'product-specification-error',
      reset: resetProductSpecificationForm
    }
  }[kind];

  if (!config || !window.confirm(`Delete this ${config.label}? This cannot be undone.`)) {
    return;
  }

  setError(config.errorId, '');

  try {
    await fetchJson(config.endpoint, { method: 'DELETE' });
    const index = config.collection.findIndex((item) => item.id === id);
    if (index >= 0) {
      config.collection.splice(index, 1);
    }
    config.reset();
    config.render();
  } catch (error) {
    setError(config.errorId, error.message);
  }
}

document.getElementById('type-form').addEventListener('submit', saveType);
document.getElementById('bundle-form').addEventListener('submit', saveBundle);
document.getElementById('product-specification-form').addEventListener('submit', saveProductSpecification);
document.getElementById('cancel-type-button').addEventListener('click', resetTypeForm);
document.getElementById('cancel-bundle-button').addEventListener('click', resetBundleForm);
document.getElementById('cancel-product-specification-button').addEventListener('click', resetProductSpecificationForm);

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  const { kind, action, id } = button.dataset;
  if (action === 'edit') {
    if (kind === 'type') {
      editType(id);
    } else if (kind === 'bundle') {
      editBundle(id);
    } else if (kind === 'product-specification') {
      editProductSpecification(id);
    }
  } else if (action === 'delete') {
    deleteItem(kind, id);
  }
});

renderTypes();
renderBundles();
renderProductSpecifications();
