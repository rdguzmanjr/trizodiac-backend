function readCustomers() {
  const element = document.getElementById('customers-data');
  const rawData = element?.textContent || '[]';

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Unable to load customers.', error);
    return [];
  }
}

const state = {
  customers: readCustomers()
};

const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const tableBody = document.getElementById('customer-table-body');
const emptyCustomers = document.getElementById('empty-customers');
const form = document.getElementById('customer-form');
const errorBox = document.getElementById('customer-error');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setError(message) {
  errorBox.textContent = message || '';
  errorBox.classList.toggle('hidden', !message);
}

function sortCustomers() {
  state.customers.sort((a, b) => a.name.localeCompare(b.name));
}

function renderCustomers() {
  tableBody.innerHTML = state.customers.map((customer) => `
    <tr class="hover:bg-zinc-100">
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(customer.name)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(customer.contact)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-sm">${escapeHtml(customer.shipping_address)}</td>
      <td class="border border-zinc-300 px-3 py-2 text-right text-sm">
        <div class="flex min-w-max justify-end gap-2">
          <button class="rounded border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-200" data-action="edit" data-id="${escapeHtml(customer.id)}" type="button">Edit</button>
          <button class="rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" data-action="delete" data-id="${escapeHtml(customer.id)}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  emptyCustomers.classList.toggle('hidden', state.customers.length > 0);
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

function resetForm() {
  form.reset();
  document.getElementById('customer-id').value = '';
  document.getElementById('save-customer-button').textContent = 'Save Customer';
  document.getElementById('cancel-customer-button').classList.add('hidden');
  setError('');
}

function editCustomer(id) {
  const customer = state.customers.find((item) => item.id === id);
  if (!customer) {
    return;
  }

  document.getElementById('customer-id').value = customer.id;
  document.getElementById('customer-name').value = customer.name;
  document.getElementById('customer-contact').value = customer.contact;
  document.getElementById('customer-shipping-address').value = customer.shipping_address;
  document.getElementById('save-customer-button').textContent = 'Update Customer';
  document.getElementById('cancel-customer-button').classList.remove('hidden');
  setError('');
}

function upsertCustomer(customer) {
  const index = state.customers.findIndex((item) => item.id === customer.id);
  if (index >= 0) {
    state.customers[index] = customer;
  } else {
    state.customers.unshift(customer);
  }
  sortCustomers();
}

async function saveCustomer(event) {
  event.preventDefault();
  setError('');

  const id = document.getElementById('customer-id').value;
  const payload = {
    name: document.getElementById('customer-name').value,
    contact: document.getElementById('customer-contact').value,
    shipping_address: document.getElementById('customer-shipping-address').value
  };

  try {
    const data = id
      ? await fetchJson(`/orders/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/orders/customers', { method: 'POST', body: JSON.stringify(payload) });

    upsertCustomer(data.customer);
    resetForm();
    renderCustomers();
  } catch (error) {
    setError(error.message);
  }
}

async function deleteCustomer(id) {
  const customer = state.customers.find((item) => item.id === id);
  if (!customer || !window.confirm(`Delete ${customer.name}? This cannot be undone.`)) {
    return;
  }

  try {
    await fetchJson(`/orders/customers/${id}`, { method: 'DELETE' });
    state.customers = state.customers.filter((item) => item.id !== id);
    resetForm();
    renderCustomers();
  } catch (error) {
    setError(error.message);
  }
}

form.addEventListener('submit', saveCustomer);
document.getElementById('cancel-customer-button').addEventListener('click', resetForm);
tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'edit') {
    editCustomer(button.dataset.id);
  } else if (button.dataset.action === 'delete') {
    deleteCustomer(button.dataset.id);
  }
});

renderCustomers();
