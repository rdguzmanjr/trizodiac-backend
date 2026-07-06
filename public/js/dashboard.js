function readJsonScript(id) {
  const dataElement = document.getElementById(id);
  const rawData = dataElement?.textContent || dataElement?.content?.textContent || '[]';

  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`Unable to load ${id}.`, error);
    return [];
  }
}

const state = {
  orders: readJsonScript('orders-data'),
  customers: readJsonScript('customers-data'),
  inventoryItems: readJsonScript('inventory-items-data'),
  selectedInventoryItems: [],
  draftSelectedItemIds: new Set(),
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
const itemsModal = document.getElementById('items-modal');
const labelModal = document.getElementById('label-modal');
const orderForm = document.getElementById('order-form');
const orderError = document.getElementById('order-form-error');
const labelStage = document.getElementById('label-preview-stage');
const labelScroll = document.getElementById('label-preview-scroll');
const labelImage = document.getElementById('label-preview-image');
const downloadButton = document.getElementById('download-label-button');
const customerIdInput = document.getElementById('customer-id');
const receiverInput = document.getElementById('receiver');
const contactInput = document.getElementById('contact');
const addressInput = document.getElementById('address');
const customerOptions = document.getElementById('customer-options');
const itemsInput = document.getElementById('items');
const selectedItemsList = document.getElementById('selected-items-list');
const itemSearch = document.getElementById('item-search');
const inventoryItemList = document.getElementById('inventory-item-list');
const emptyInventoryItems = document.getElementById('empty-inventory-items');

function money(value) {
  const number = Number(value || 0);
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priceValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function uniqueById(items) {
  const map = new Map();
  items.forEach((item) => {
    if (item?.id) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
}

function itemLabel(item) {
  return [
    item.code_number,
    item.bundle_name,
    item.type_name,
    item.product_specification,
    item.size_inches,
    item.length_inches
  ].filter(Boolean).join(' | ');
}

function orderItemLabel(item) {
  return [
    item.code_number,
    item.product_specification
  ].filter(Boolean).join(' | ');
}

function selectedItemText() {
  return state.selectedInventoryItems.map(orderItemLabel).join(' , ');
}

function getItemPriceGiven(item) {
  if (item.price_given !== null && item.price_given !== undefined && item.price_given !== '') {
    return item.price_given;
  }

  return item.price || '';
}

function calculateOrderTotal() {
  return state.selectedInventoryItems.reduce((sum, item) => sum + priceValue(getItemPriceGiven(item)), 0);
}

function updateOrderTotal() {
  document.getElementById('total').value = calculateOrderTotal().toFixed(2);
}

function upsertCustomer(customer) {
  if (!customer?.id) {
    return;
  }

  const index = state.customers.findIndex((item) => item.id === customer.id);
  if (index >= 0) {
    state.customers[index] = customer;
  } else {
    state.customers.push(customer);
  }

  state.customers.sort((a, b) => a.name.localeCompare(b.name));
}

function syncItemsField() {
  const text = selectedItemText();
  itemsInput.value = text;

  if (!state.selectedInventoryItems.length) {
    selectedItemsList.innerHTML = '<span class="text-zinc-500">No items selected.</span>';
    updateOrderTotal();
    return;
  }

  selectedItemsList.innerHTML = `
    <ul class="space-y-2">
      ${state.selectedInventoryItems.map((item) => `
        <li class="grid gap-3 rounded border border-white/10 bg-zinc-900/70 px-3 py-3 md:grid-cols-[1fr_180px] md:items-center">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-white">${escapeHtml(item.code_number)}</div>
            <div class="mt-1 text-xs text-zinc-400">${escapeHtml(itemLabel(item))}</div>
          </div>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Price Given</span>
            <input class="min-h-10 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-emerald-300" type="number" min="0" step="0.01" value="${escapeHtml(getItemPriceGiven(item))}" data-price-given-item="${escapeHtml(item.id)}" required />
          </label>
        </li>
      `).join('')}
    </ul>
  `;
  updateOrderTotal();
}

function getFilteredOrders() {
  const query = state.search.trim().toLowerCase();
  return state.orders.filter((order) => {
    const matchesSearch = !query || [
      order.order_number,
      order.receiver,
      order.contact,
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

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  requestAnimationFrame(() => modal.classList.remove('opacity-0'));
}

function closeModal(modal) {
  if (modal === orderModal) {
    hideCustomerOptions();
  }

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

function hideCustomerOptions() {
  customerOptions.classList.add('hidden');
  receiverInput.setAttribute('aria-expanded', 'false');
}

function showCustomerOptions() {
  const query = receiverInput.value.trim().toLowerCase();
  const matches = state.customers
    .filter((customer) => !query || [
      customer.name,
      customer.contact,
      customer.shipping_address
    ].some((value) => String(value || '').toLowerCase().includes(query)))
    .slice(0, 12);

  customerOptions.innerHTML = matches.length
    ? matches.map((customer) => `
      <button class="w-full rounded px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10 focus:bg-white/10 focus:outline-none" type="button" data-customer-id="${escapeHtml(customer.id)}">
        <span class="block font-semibold">${escapeHtml(customer.name)}</span>
        <span class="mt-1 block truncate text-xs text-zinc-400">${escapeHtml(customer.contact)} · ${escapeHtml(customer.shipping_address)}</span>
      </button>
    `).join('')
    : '<div class="px-3 py-2 text-sm text-zinc-400">No matching customer. Save to create it.</div>';

  customerOptions.classList.remove('hidden');
  receiverInput.setAttribute('aria-expanded', 'true');
}

function selectCustomer(id) {
  const customer = state.customers.find((item) => item.id === id);
  if (!customer) {
    return;
  }

  customerIdInput.value = customer.id;
  receiverInput.value = customer.name;
  contactInput.value = customer.contact;
  addressInput.value = customer.shipping_address;
  hideCustomerOptions();
}

function setFormValues(order) {
  document.getElementById('order-id').value = order?.id || '';
  document.getElementById('order-number').value = order?.order_number || '';
  document.getElementById('order-date-display').value = order?.order_date_display || '';
  customerIdInput.value = order?.customer_id || '';
  receiverInput.value = order?.receiver || '';
  contactInput.value = order?.contact || '';
  addressInput.value = order?.address || '';
  itemsInput.value = order?.items || '';
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

async function refreshAvailableInventoryItems() {
  const data = await fetchJson('/orders/inventory/available', { method: 'GET' });
  state.inventoryItems = data.inventoryItems || [];
}

async function openNewOrder() {
  setFormError('');
  orderForm.reset();
  state.activeOrder = null;
  state.selectedInventoryItems = [];
  syncItemsField();
  customerIdInput.value = '';
  document.getElementById('order-modal-title').textContent = 'New Order';
  document.getElementById('generate-label-button').textContent = 'Generate Label';
  const [metadata] = await Promise.all([
    fetchJson('/orders/next', { method: 'GET' }),
    refreshAvailableInventoryItems()
  ]);
  setFormValues(metadata);
  syncItemsField();
  openModal(orderModal);
}

async function openEditOrder(order) {
  setFormError('');
  state.activeOrder = order;
  document.getElementById('order-modal-title').textContent = 'Edit Order';
  document.getElementById('generate-label-button').textContent = 'Update Label';
  setFormValues(order);

  const [orderItems] = await Promise.all([
    fetchJson(`/orders/${order.id}/inventory-items`, { method: 'GET' }),
    refreshAvailableInventoryItems()
  ]);
  state.selectedInventoryItems = orderItems.inventoryItems || [];
  syncItemsField();
  openModal(orderModal);
}

function getInventoryItemPrices() {
  return Object.fromEntries(state.selectedInventoryItems.map((item) => [item.id, String(getItemPriceGiven(item))]));
}

function getFormPayload() {
  return {
    customer_id: customerIdInput.value,
    receiver: receiverInput.value,
    contact: contactInput.value,
    address: addressInput.value,
    items: itemsInput.value,
    inventory_item_ids: state.selectedInventoryItems.map((item) => item.id),
    inventory_item_prices: getInventoryItemPrices(),
    payment: document.getElementById('payment').value,
    total: calculateOrderTotal().toFixed(2),
    notes: document.getElementById('notes').value
  };
}

async function submitOrder(event) {
  event.preventDefault();
  setFormError('');
  const button = document.getElementById('generate-label-button');
  button.disabled = true;

  try {
    syncItemsField();
    const payload = getFormPayload();
    const id = document.getElementById('order-id').value;
    const data = id
      ? await fetchJson(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await fetchJson('/orders', { method: 'POST', body: JSON.stringify(payload) });

    upsertCustomer(data.customer);
    state.inventoryItems = data.inventoryItems || state.inventoryItems;
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

function selectableInventoryItems() {
  return uniqueById([...state.selectedInventoryItems, ...state.inventoryItems]);
}

function renderInventoryItemPicker() {
  const query = itemSearch.value.trim().toLowerCase();
  const selectedIds = state.draftSelectedItemIds;
  const items = selectableInventoryItems().filter((item) => {
    if (!query) {
      return true;
    }

    return [
      item.code_number,
      item.bundle_name,
      item.type_name,
      item.product_specification,
      item.size_inches,
      item.length_inches,
      item.price
    ].some((value) => String(value || '').toLowerCase().includes(query));
  });

  inventoryItemList.innerHTML = items.map((item) => {
    const checked = selectedIds.has(item.id) ? 'checked' : '';
    const isSelectedCurrent = state.selectedInventoryItems.some((selected) => selected.id === item.id);
    const statusText = isSelectedCurrent ? 'Selected on this order' : 'Available';
    return `
      <label class="block rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm transition hover:border-emerald-300/50">
        <div class="flex items-start gap-3">
          <input class="mt-1 h-4 w-4 accent-emerald-400" type="checkbox" value="${escapeHtml(item.id)}" ${checked} data-inventory-item />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-semibold text-white">${escapeHtml(item.code_number)}</span>
              <span class="rounded-full border border-emerald-300/30 px-2 py-0.5 text-xs font-semibold text-emerald-200">${escapeHtml(statusText)}</span>
            </div>
            <p class="mt-2 text-zinc-300">${escapeHtml(itemLabel(item))}</p>
            <p class="mt-1 text-xs text-zinc-500">${escapeHtml(item.price)}</p>
          </div>
        </div>
      </label>
    `;
  }).join('');

  emptyInventoryItems.classList.toggle('hidden', items.length > 0);
}

function openItemsModal() {
  state.draftSelectedItemIds = new Set(state.selectedInventoryItems.map((item) => item.id));
  itemSearch.value = '';
  renderInventoryItemPicker();
  openModal(itemsModal);
}

function confirmItemSelection() {
  const allItems = selectableInventoryItems();
  const previousItems = new Map(state.selectedInventoryItems.map((item) => [item.id, item]));
  state.selectedInventoryItems = allItems
    .filter((item) => state.draftSelectedItemIds.has(item.id))
    .map((item) => ({
      ...item,
      price_given: getItemPriceGiven(previousItems.get(item.id) || item)
    }));
  syncItemsField();
  closeModal(itemsModal);
}

function labelImageUrl(order, options = {}) {
  const version = encodeURIComponent(order.updated_at || order.created_at || order.order_number);
  const params = new URLSearchParams({ v: version });

  if (options.download) {
    params.set('download', '1');
  }

  return `/orders/${encodeURIComponent(order.id)}/label.png?${params.toString()}`;
}

function setZoom(value) {
  state.zoom = Math.max(0.25, Math.min(2.5, value));
  labelStage.style.transform = `scale(${state.zoom})`;
}

function fitLabelToScreen() {
  const widthRatio = (labelScroll.clientWidth - 48) / labelImage.offsetWidth;
  const heightRatio = (labelScroll.clientHeight - 48) / labelImage.offsetHeight;
  setZoom(Math.min(widthRatio, heightRatio, 1));
}

function showLabel(order) {
  state.previewOrder = order;
  document.getElementById('label-preview-meta').textContent = `${order.order_number} · ${order.receiver}`;
  labelImage.alt = `${order.order_number} shipping label`;
  labelImage.onload = fitLabelToScreen;
  labelImage.src = labelImageUrl(order);
  setZoom(1);
  openModal(labelModal);
  if (labelImage.complete && labelImage.naturalWidth) {
    window.setTimeout(fitLabelToScreen, 80);
  }
}

function downloadCurrentLabel(order = state.previewOrder) {
  if (!order) {
    return;
  }

  const link = document.createElement('a');
  link.href = labelImageUrl(order, { download: true });
  link.download = `${order.order_number}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function deleteOrder(id) {
  const order = findOrder(id);
  if (!order) {
    return;
  }

  if (!window.confirm(`Delete ${order.order_number}? This cannot be undone.`)) {
    return;
  }

  const data = await fetchJson(`/orders/${id}`, { method: 'DELETE' });
  state.inventoryItems = data.inventoryItems || state.inventoryItems;
  state.orders = state.orders.filter((item) => item.id !== id);
  renderOrders();
}

document.getElementById('new-order-button').addEventListener('click', () => {
  openNewOrder().catch((error) => window.alert(error.message));
});

receiverInput.addEventListener('focus', showCustomerOptions);
receiverInput.addEventListener('input', () => {
  customerIdInput.value = '';
  showCustomerOptions();
});

customerOptions.addEventListener('click', (event) => {
  const option = event.target.closest('[data-customer-id]');
  if (option) {
    selectCustomer(option.dataset.customerId);
  }
});

document.getElementById('select-items-button').addEventListener('click', openItemsModal);
document.getElementById('confirm-items-button').addEventListener('click', confirmItemSelection);
selectedItemsList.addEventListener('input', (event) => {
  if (!event.target.matches('[data-price-given-item]')) {
    return;
  }

  const item = state.selectedInventoryItems.find((selected) => selected.id === event.target.dataset.priceGivenItem);
  if (item) {
    item.price_given = event.target.value;
    updateOrderTotal();
  }
});
itemSearch.addEventListener('input', renderInventoryItemPicker);
inventoryItemList.addEventListener('change', (event) => {
  if (!event.target.matches('[data-inventory-item]')) {
    return;
  }

  if (event.target.checked) {
    state.draftSelectedItemIds.add(event.target.value);
  } else {
    state.draftSelectedItemIds.delete(event.target.value);
  }
});

document.addEventListener('click', (event) => {
  if (!receiverInput.contains(event.target) && !customerOptions.contains(event.target)) {
    hideCustomerOptions();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideCustomerOptions();
  }
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
    openEditOrder(order).catch((error) => window.alert(error.message));
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

syncItemsField();
renderOrders();
