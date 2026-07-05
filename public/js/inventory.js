function readInitialEntries() {
  const dataElement = document.getElementById('inventory-data');
  const rawData = dataElement?.textContent || '[]';

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Unable to load initial inventory entries.', error);
    return [];
  }
}

const state = {
  entries: readInitialEntries(),
  search: '',
  activeEntry: null
};

const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const tableBody = document.getElementById('inventory-table-body');
const emptyInventory = document.getElementById('empty-inventory');
const inventoryModal = document.getElementById('inventory-modal');
const inventoryForm = document.getElementById('inventory-form');
const inventoryError = document.getElementById('inventory-form-error');

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

function setFormValues(entry) {
  document.getElementById('inventory-id').value = entry?.id || '';
  document.getElementById('bundle-name').value = entry?.bundle_name || '';
  document.getElementById('code-number').value = entry?.code_number || '';
  document.getElementById('product-specification').value = entry?.product_specification || '';
  document.getElementById('size-inches').value = entry?.size_inches || '';
  document.getElementById('length-inches').value = entry?.length_inches || '';
  document.getElementById('price').value = entry?.price || '';
}

function getFormPayload() {
  return {
    bundle_name: document.getElementById('bundle-name').value,
    code_number: document.getElementById('code-number').value,
    product_specification: document.getElementById('product-specification').value,
    size_inches: document.getElementById('size-inches').value,
    length_inches: document.getElementById('length-inches').value,
    price: document.getElementById('price').value
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
}

function openNewEntry() {
  setFormError('');
  state.activeEntry = null;
  inventoryForm.reset();
  document.getElementById('inventory-modal-title').textContent = 'New Inventory Entry';
  document.getElementById('save-inventory-button').textContent = 'Save Entry';
  openModal();
}

function openEditEntry(entry) {
  setFormError('');
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
