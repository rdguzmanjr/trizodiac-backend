const { supabase } = require('../config/supabase');

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Manila';

function getParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function getTodayIsoDate() {
  const parts = getParts();
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatOrderDate(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  })
    .format(date)
    .replace(',', '')
    .replace(/ /g, '-')
    .toUpperCase();
}

function formatOrderNumber(dateValue, sequence) {
  return `TZ-${String(dateValue).replace(/-/g, '')}-${String(sequence).padStart(3, '0')}`;
}

function normalizeUuidArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
}

function validatePayload(payload, options = {}) {
  const selectedInventoryIds = normalizeUuidArray(payload.inventory_item_ids);
  const required = ['receiver', 'contact', 'address', 'items', 'payment', 'total'];
  const missing = required.filter((field) => !normalizeText(payload[field]));

  if (missing.length) {
    throw createHttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }

  if (options.requireInventoryItems && !selectedInventoryIds.length) {
    throw createHttpError(400, 'Select at least one available inventory item.');
  }

  const total = Number(payload.total);
  if (!Number.isFinite(total) || total < 0) {
    throw createHttpError(400, 'Total must be a valid non-negative number.');
  }

  return {
    customer_id: normalizeText(payload.customer_id) || null,
    receiver: normalizeText(payload.receiver),
    contact: normalizeText(payload.contact),
    address: normalizeText(payload.address),
    items: normalizeText(payload.items),
    inventory_item_ids: selectedInventoryIds,
    payment: normalizeText(payload.payment),
    total,
    notes: normalizeText(payload.notes)
  };
}

function validateCustomerPayload(payload) {
  const values = {
    name: normalizeText(payload.name),
    contact: normalizeText(payload.contact),
    shipping_address: normalizeText(payload.shipping_address)
  };
  const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) {
    throw createHttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }

  return values;
}

function decorateOrder(order) {
  if (!order) {
    return null;
  }

  return {
    ...order,
    inventory_item_ids: order.inventory_item_ids || [],
    total_display: Number(order.total).toFixed(2),
    order_date_display: formatOrderDate(order.order_date)
  };
}

function decorateInventoryItem(row) {
  const bundle = row.bundle || {};
  const type = row.type || {};
  const spec = row.spec || {};

  return {
    id: row.id,
    bundle_name: bundle.bundle_name || row.bundle_name,
    type_name: type.type_name || row.type_name,
    code_number: row.code_number,
    product_specification: spec.product_specification || row.product_specification,
    size_inches: row.size_inches,
    length_inches: row.length_inches,
    price: type.price || row.price,
    status: row.status || 'Available'
  };
}

function inventoryItemSelect() {
  return `
    id,
    bundle_name,
    type_name,
    code_number,
    product_specification,
    size_inches,
    length_inches,
    price,
    status,
    bundle:inventory_bundles(id, bundle_name),
    type:inventory_types(id, type_name, price),
    spec:product_specifications(id, product_specification)
  `;
}

async function listOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    throw error;
  }

  return (data || []).map(decorateOrder);
}

async function getOrder(id) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError(404, 'Order not found.');
  }

  return decorateOrder(data);
}

async function listCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, contact, shipping_address')
    .order('name', { ascending: true })
    .limit(2000);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listAvailableInventoryItems() {
  const { data, error } = await supabase
    .from('inventory_entries')
    .select(inventoryItemSelect())
    .eq('status', 'Available')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    throw error;
  }

  return (data || []).map(decorateInventoryItem);
}

async function listInventoryItemsByIds(ids) {
  const uniqueIds = normalizeUuidArray(ids);
  if (!uniqueIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from('inventory_entries')
    .select(inventoryItemSelect())
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return (data || []).map(decorateInventoryItem);
}

async function getNextMetadata() {
  const orderDate = getTodayIsoDate();
  const { data, error } = await supabase
    .from('order_counters')
    .select('last_sequence')
    .eq('counter_date', orderDate)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const nextSequence = (data ? data.last_sequence : 0) + 1;
  const orderNumber = formatOrderNumber(orderDate, nextSequence);

  return {
    order_number: orderNumber,
    order_date: orderDate,
    order_date_display: formatOrderDate(orderDate),
    barcode_value: orderNumber
  };
}

async function createOrder(payload, userId) {
  const orderData = validatePayload(payload, { requireInventoryItems: true });
  const { data, error } = await supabase
    .rpc('create_order', {
      p_order_date: getTodayIsoDate(),
      p_receiver: orderData.receiver,
      p_contact: orderData.contact,
      p_address: orderData.address,
      p_items: orderData.items,
      p_inventory_item_ids: orderData.inventory_item_ids,
      p_payment: orderData.payment,
      p_total: orderData.total,
      p_notes: orderData.notes,
      p_customer_id: orderData.customer_id,
      p_created_by: userId
    })
    .single();

  if (error) {
    throw error;
  }

  return decorateOrder(data);
}

async function updateInventoryStatuses(ids, status, currentStatus) {
  const uniqueIds = normalizeUuidArray(ids);
  if (!uniqueIds.length) {
    return 0;
  }

  let query = supabase.from('inventory_entries').update({ status }).in('id', uniqueIds);
  if (currentStatus) {
    query = query.eq('status', currentStatus);
  }

  const { data, error } = await query.select('id');

  if (error) {
    throw error;
  }

  return (data || []).length;
}

async function updateOrder(id, payload) {
  const existingOrder = await getOrder(id);
  const orderData = validatePayload(payload, { requireInventoryItems: true });
  const previousIds = normalizeUuidArray(existingOrder.inventory_item_ids);
  const nextIds = orderData.inventory_item_ids;
  const removedIds = previousIds.filter((itemId) => !nextIds.includes(itemId));
  const addedIds = nextIds.filter((itemId) => !previousIds.includes(itemId));

  if (removedIds.length) {
    await updateInventoryStatuses(removedIds, 'Available', 'Sold');
  }

  if (addedIds.length) {
    const soldCount = await updateInventoryStatuses(addedIds, 'Sold', 'Available');
    if (soldCount !== addedIds.length) {
      if (removedIds.length) {
        await updateInventoryStatuses(removedIds, 'Sold', 'Available');
      }
      throw createHttpError(409, 'One or more selected inventory items are no longer available.');
    }
  }

  const { data, error } = await supabase
    .from('orders')
    .update(orderData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (addedIds.length) {
      await updateInventoryStatuses(addedIds, 'Available', 'Sold');
    }
    if (removedIds.length) {
      await updateInventoryStatuses(removedIds, 'Sold', 'Available');
    }
    throw error;
  }

  return decorateOrder(data);
}

async function deleteOrder(id) {
  const order = await getOrder(id);
  if (order.inventory_item_ids.length) {
    await updateInventoryStatuses(order.inventory_item_ids, 'Available', 'Sold');
  }

  const { error } = await supabase.from('orders').delete().eq('id', id);

  if (error) {
    if (order.inventory_item_ids.length) {
      await updateInventoryStatuses(order.inventory_item_ids, 'Sold', 'Available');
    }
    throw error;
  }
}

async function createCustomer(payload) {
  const customerData = validateCustomerPayload(payload);
  const { data, error } = await supabase
    .from('customers')
    .insert(customerData)
    .select('id, name, contact, shipping_address')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateCustomer(id, payload) {
  const customerData = validateCustomerPayload(payload);
  const { data, error } = await supabase
    .from('customers')
    .update(customerData)
    .eq('id', id)
    .select('id, name, contact, shipping_address')
    .single();

  if (error) {
    throw error;
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      receiver: data.name,
      contact: data.contact,
      address: data.shipping_address
    })
    .eq('customer_id', data.id);

  if (orderUpdateError) {
    throw orderUpdateError;
  }

  return data;
}

async function deleteCustomer(id) {
  const { error } = await supabase.from('customers').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

module.exports = {
  listOrders,
  getOrder,
  listCustomers,
  listAvailableInventoryItems,
  listInventoryItemsByIds,
  getNextMetadata,
  createOrder,
  updateOrder,
  deleteOrder,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  decorateOrder
};
