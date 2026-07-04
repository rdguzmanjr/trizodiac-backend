function readInitialOrders() {
  const dataElement = document.getElementById('orders-data');
  const rawData = dataElement?.textContent || dataElement?.content?.textContent || '[]';

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Unable to load initial orders.', error);
    return [];
  }
}

const state = {
  orders: readInitialOrders(),
  page: 1,
  pageSize: 10,
  search: '',
  date: '',
  activeOrder: null,
  previewOrder: null,
  zoom: 1
};

const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
const tableBody = document.getElementById('orders-table-body');
const emptyOrders = document.getElementById('empty-orders');
const paginationSummary = document.getElementById('pagination-summary');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const orderModal = document.getElementById('order-modal');
const labelModal = document.getElementById('label-modal');
const orderForm = document.getElementById('order-form');
const orderError = document.getElementById('order-form-error');
const labelStage = document.getElementById('label-preview-stage');
const labelScroll = document.getElementById('label-preview-scroll');
const labelElement = document.getElementById('waybill-label');
const downloadButton = document.getElementById('download-label-button');

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getFilteredOrders() {
  const query = state.search.trim().toLowerCase();
  return state.orders.filter((order) => {
    const matchesSearch = !query || [
      order.order_number,
      order.receiver,
      order.payment,
      order.total_display,
      order.status
    ].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesDate = !state.date || order.order_date === state.date;
    return matchesSearch && matchesDate;
  });
}

function renderOrders() {
  const filtered = getFilteredOrders();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visible = filtered.slice(start, start + state.pageSize);

  tableBody.innerHTML = visible.map((order) => `
    <tr class="bg-zinc-950 transition hover:bg-white/[0.03]">
      <td class="whitespace-nowrap px-5 py-4 text-sm font-semibold text-white">${escapeHtml(order.order_number)}</td>
      <td class="whitespace-nowrap px-5 py-4 text-sm text-zinc-300">${escapeHtml(order.order_date_display)}</td>
      <td class="max-w-64 truncate px-5 py-4 text-sm text-zinc-200">${escapeHtml(order.receiver)}</td>
      <td class="whitespace-nowrap px-5 py-4 text-sm text-zinc-300">${escapeHtml(order.payment)}</td>
      <td class="whitespace-nowrap px-5 py-4 text-sm font-semibold text-zinc-100">${money(order.total)}</td>
      <td class="whitespace-nowrap px-5 py-4">
        <span class="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">${escapeHtml(order.status || 'Generated')}</span>
      </td>
      <td class="px-5 py-4">
        <div class="flex min-w-max justify-end gap-2">
          <button class="table-action" data-action="view" data-id="${order.id}" type="button">View Label</button>
          <button class="table-action" data-action="download" data-id="${order.id}" type="button">Download Label</button>
          <button class="table-action" data-action="edit" data-id="${order.id}" type="button">Edit</button>
          <button class="table-action text-red-200 hover:border-red-300/40 hover:bg-red-500/10" data-action="delete" data-id="${order.id}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  emptyOrders.classList.toggle('hidden', filtered.length > 0);
  paginationSummary.textContent = filtered.length
    ? `Showing ${start + 1}-${Math.min(start + state.pageSize, filtered.length)} of ${filtered.length} orders`
    : 'No orders to show';
  prevPageButton.disabled = state.page <= 1;
  nextPageButton.disabled = state.page >= totalPages;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  requestAnimationFrame(() => modal.classList.remove('opacity-0'));
}

function closeModal(modal) {
  modal.classList.add('opacity-0');
  window.setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 160);
}

function setFormError(message) {
  orderError.textContent = message || '';
  orderError.classList.toggle('hidden', !message);
}

function setFormValues(order) {
  document.getElementById('order-id').value = order?.id || '';
  document.getElementById('order-number').value = order?.order_number || '';
  document.getElementById('order-date-display').value = order?.order_date_display || '';
  document.getElementById('receiver').value = order?.receiver || '';
  document.getElementById('address').value = order?.address || '';
  document.getElementById('items').value = order?.items || '';
  document.getElementById('payment').value = order?.payment || '';
  document.getElementById('total').value = order?.total ?? '';
  document.getElementById('notes').value = order?.notes || '';
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

async function openNewOrder() {
  setFormError('');
  orderForm.reset();
  state.activeOrder = null;
  document.getElementById('order-modal-title').textContent = 'New Order';
  document.getElementById('generate-label-button').textContent = 'Generate Label';
  const metadata = await fetchJson('/orders/next', { method: 'GET' });
  setFormValues(metadata);
  openModal(orderModal);
}

function openEditOrder(order) {
  setFormError('');
  state.activeOrder = order;
  document.getElementById('order-modal-title').textContent = 'Edit Order';
  document.getElementById('generate-label-button').textContent = 'Update Label';
  setFormValues(order);
  openModal(orderModal);
}

function getFormPayload() {
  return {
    receiver: document.getElementById('receiver').value,
    address: document.getElementById('address').value,
    items: document.getElementById('items').value,
    payment: document.getElementById('payment').value,
    total: document.getElementById('total').value,
    notes: document.getElementById('notes').value
  };
}

async function submitOrder(event) {
  event.preventDefault();
  setFormError('');
  const button = document.getElementById('generate-label-button');
  button.disabled = true;

  try {
    const payload = getFormPayload();
    const id = document.getElementById('order-id').value;
    const data = id
      ? await fetchJson(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/orders', { method: 'POST', body: JSON.stringify(payload) });

    upsertOrder(data.order);
    closeModal(orderModal);
    renderOrders();
    showLabel(data.order);
  } catch (error) {
    setFormError(error.message);
  } finally {
    button.disabled = false;
  }
}

function upsertOrder(order) {
  const index = state.orders.findIndex((item) => item.id === order.id);
  if (index >= 0) {
    state.orders[index] = order;
  } else {
    state.orders.unshift(order);
  }
}

function findOrder(id) {
  return state.orders.find((order) => order.id === id);
}

function fillLabel(order) {
  labelElement.querySelectorAll('[data-label-field]').forEach((element) => {
    const field = element.dataset.labelField;
    if (field === 'barcode_svg') {
      element.innerHTML = order.barcode_svg || '';
      return;
    }
    if (field === 'total_display') {
      element.textContent = money(order.total);
      return;
    }
    element.textContent = order[field] || '';
  });
  document.getElementById('label-preview-meta').textContent = `${order.order_number} · ${order.receiver}`;
}

function setZoom(value) {
  state.zoom = Math.max(0.25, Math.min(2.5, value));
  labelStage.style.transform = `scale(${state.zoom})`;
}

function fitLabelToScreen() {
  const widthRatio = (labelScroll.clientWidth - 48) / labelElement.offsetWidth;
  const heightRatio = (labelScroll.clientHeight - 48) / labelElement.offsetHeight;
  setZoom(Math.min(widthRatio, heightRatio, 1));
}

function showLabel(order) {
  state.previewOrder = order;
  fillLabel(order);
  setZoom(1);
  openModal(labelModal);
  window.setTimeout(fitLabelToScreen, 80);
}

async function downloadCurrentLabel(order = state.previewOrder) {
  if (!order) {
    return;
  }

  fillLabel(order);
  const clone = labelElement.cloneNode(true);
  clone.id = 'waybill-label-export';
  clone.style.width = '741px';
  clone.style.transform = 'none';
  clone.style.position = 'fixed';
  clone.style.left = '-10000px';
  clone.style.top = '0';
  document.body.appendChild(clone);

  try {
    const canvas = await window.html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${order.order_number}.png`;
    link.click();
  } finally {
    clone.remove();
  }
}

async function deleteOrder(id) {
  const order = findOrder(id);
  if (!order) {
    return;
  }

  if (!window.confirm(`Delete ${order.order_number}? This cannot be undone.`)) {
    return;
  }

  await fetchJson(`/orders/${id}`, { method: 'DELETE' });
  state.orders = state.orders.filter((item) => item.id !== id);
  renderOrders();
}

document.getElementById('new-order-button').addEventListener('click', () => {
  openNewOrder().catch((error) => window.alert(error.message));
});

document.getElementById('order-search').addEventListener('input', (event) => {
  state.search = event.target.value;
  state.page = 1;
  renderOrders();
});

document.getElementById('order-date-filter').addEventListener('input', (event) => {
  state.date = event.target.value;
  state.page = 1;
  renderOrders();
});

document.getElementById('clear-filters').addEventListener('click', () => {
  document.getElementById('order-search').value = '';
  document.getElementById('order-date-filter').value = '';
  state.search = '';
  state.date = '';
  state.page = 1;
  renderOrders();
});

prevPageButton.addEventListener('click', () => {
  state.page -= 1;
  renderOrders();
});

nextPageButton.addEventListener('click', () => {
  state.page += 1;
  renderOrders();
});

tableBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) {
    return;
  }
  const order = findOrder(button.dataset.id);
  if (!order && button.dataset.action !== 'delete') {
    return;
  }

  if (button.dataset.action === 'view') {
    showLabel(order);
  } else if (button.dataset.action === 'download') {
    downloadCurrentLabel(order);
  } else if (button.dataset.action === 'edit') {
    openEditOrder(order);
  } else if (button.dataset.action === 'delete') {
    deleteOrder(button.dataset.id).catch((error) => window.alert(error.message));
  }
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.closeModal)));
});

document.querySelectorAll('[data-zoom]').forEach((button) => {
  button.addEventListener('click', () => {
    const action = button.dataset.zoom;
    if (action === 'in') setZoom(state.zoom + 0.15);
    if (action === 'out') setZoom(state.zoom - 0.15);
    if (action === 'fit') fitLabelToScreen();
    if (action === 'reset') setZoom(1);
  });
});

orderForm.addEventListener('submit', submitOrder);
downloadButton.addEventListener('click', () => downloadCurrentLabel());

renderOrders();
