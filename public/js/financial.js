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
  records: readJsonScript('financial-data'),
  search: ''
};

const elements = {
  tableBody: document.getElementById('financial-table-body'),
  empty: document.getElementById('empty-financial'),
  total: document.getElementById('financial-total'),
  search: document.getElementById('financial-search'),
  clearSearch: document.getElementById('clear-financial-search'),
  modal: document.getElementById('financial-modal'),
  form: document.getElementById('financial-form'),
  id: document.getElementById('financial-id'),
  price: document.getElementById('financial-price'),
  date: document.getElementById('financial-date'),
  description: document.getElementById('financial-description'),
  addedBy: document.getElementById('financial-added-by'),
  title: document.getElementById('financial-modal-title'),
  save: document.getElementById('save-financial-button'),
  error: document.getElementById('financial-form-error')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function currency(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function setError(message) {
  elements.error.textContent = message || '';
  elements.error.classList.toggle('hidden', !message);
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

function upsertRecord(record) {
  const index = state.records.findIndex((current) => current.id === record.id);

  if (index >= 0) {
    state.records[index] = record;
  } else {
    state.records.unshift(record);
  }

  state.records.sort((a, b) => {
    const dateCompare = String(b.record_date || '').localeCompare(String(a.record_date || ''));
    return dateCompare || String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function getFilteredRecords() {
  const query = state.search.trim().toLowerCase();

  if (!query) {
    return state.records;
  }

  return state.records.filter((record) => [
    record.price,
    record.price_display,
    record.description,
    record.record_date,
    record.record_date_display,
    record.added_by_name
  ].some((value) => String(value || '').toLowerCase().includes(query)));
}

function renderTotal() {
  const total = state.records.reduce((sum, record) => sum + Number(record.price || 0), 0);
  elements.total.textContent = currency(total);
}

function renderRecords() {
  const records = getFilteredRecords();
  elements.tableBody.innerHTML = records.map((record) => `
    <tr class="transition hover:bg-white/[0.03]">
      <td class="whitespace-nowrap px-5 py-4 text-sm font-semibold text-white">${currency(record.price)}</td>
      <td class="max-w-xl px-5 py-4 text-sm text-zinc-300">${escapeHtml(record.description)}</td>
      <td class="whitespace-nowrap px-5 py-4 text-sm text-zinc-300">${escapeHtml(record.record_date_display || record.record_date)}</td>
      <td class="whitespace-nowrap px-5 py-4 text-sm text-zinc-300">${escapeHtml(record.added_by_name)}</td>
      <td class="px-5 py-4 text-right">
        <div class="flex min-w-max justify-end gap-2">
          <button class="rounded-md border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/10" data-action="edit" data-id="${escapeHtml(record.id)}" type="button">Edit</button>
          <button class="rounded-md border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10" data-action="delete" data-id="${escapeHtml(record.id)}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
  elements.empty.classList.toggle('hidden', records.length > 0);
  renderTotal();
}

function openModal() {
  elements.modal.classList.remove('hidden');
  elements.modal.classList.add('flex');
  requestAnimationFrame(() => elements.modal.classList.remove('opacity-0'));
}

function closeModal() {
  elements.modal.classList.add('opacity-0');
  setTimeout(() => {
    elements.modal.classList.add('hidden');
    elements.modal.classList.remove('flex');
  }, 200);
}

function resetForm() {
  elements.form.reset();
  elements.id.value = '';
  elements.addedBy.value = elements.addedBy.dataset.currentAdmin || 'Admin';
  elements.title.textContent = 'New Financial Record';
  elements.save.textContent = 'Save Record';
  setError('');
}

function openNewRecord() {
  resetForm();
  openModal();
}

function openEditRecord(id) {
  const record = state.records.find((item) => item.id === id);

  if (!record) {
    return;
  }

  resetForm();
  elements.id.value = record.id;
  elements.price.value = Number(record.price || 0).toFixed(2);
  elements.date.value = record.record_date;
  elements.description.value = record.description || '';
  elements.addedBy.value = record.added_by_name || '';
  elements.title.textContent = 'Edit Financial Record';
  elements.save.textContent = 'Update Record';
  openModal();
}

async function saveRecord(event) {
  event.preventDefault();
  setError('');
  elements.save.disabled = true;

  const id = elements.id.value;
  const payload = {
    price: elements.price.value,
    description: elements.description.value,
    record_date: elements.date.value
  };

  try {
    const data = id
      ? await fetchJson(`/financial/records/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/financial/records', { method: 'POST', body: JSON.stringify(payload) });

    upsertRecord(data.record);
    renderRecords();
    closeModal();
  } catch (error) {
    setError(error.message);
  } finally {
    elements.save.disabled = false;
  }
}

async function deleteRecord(id) {
  const record = state.records.find((item) => item.id === id);

  if (!record || !window.confirm(`Delete financial record "${record.description}"?`)) {
    return;
  }

  await fetchJson(`/financial/records/${id}`, { method: 'DELETE' });
  state.records = state.records.filter((item) => item.id !== id);
  renderRecords();
}

document.getElementById('new-financial-button').addEventListener('click', openNewRecord);
document.querySelectorAll('[data-close-financial-modal]').forEach((button) => {
  button.addEventListener('click', closeModal);
});
elements.modal.addEventListener('click', (event) => {
  if (event.target === elements.modal) {
    closeModal();
  }
});
elements.form.addEventListener('submit', saveRecord);
elements.search.addEventListener('input', () => {
  state.search = elements.search.value;
  renderRecords();
});
elements.clearSearch.addEventListener('click', () => {
  elements.search.value = '';
  state.search = '';
  renderRecords();
});
elements.tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'edit') {
    openEditRecord(button.dataset.id);
  }

  if (button.dataset.action === 'delete') {
    deleteRecord(button.dataset.id).catch((error) => window.alert(error.message));
  }
});

renderRecords();
