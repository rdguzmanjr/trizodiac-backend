const bwipjs = require('bwip-js');
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

function validatePayload(payload) {
  const required = ['receiver', 'address', 'items', 'payment', 'total'];
  const missing = required.filter((field) => !String(payload[field] || '').trim());

  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }

  const total = Number(payload.total);
  if (!Number.isFinite(total) || total < 0) {
    const error = new Error('Total must be a valid non-negative number.');
    error.status = 400;
    throw error;
  }

  return {
    receiver: String(payload.receiver).trim(),
    address: String(payload.address).trim(),
    items: String(payload.items).trim(),
    payment: String(payload.payment).trim(),
    total,
    notes: String(payload.notes || '').trim()
  };
}

function barcodeSvg(value) {
  return bwipjs.toSVG({
    bcid: 'code128',
    text: value,
    scale: 3,
    height: 18,
    includetext: false,
    backgroundcolor: 'FFFFFF',
    paddingwidth: 0,
    paddingheight: 0
  });
}

function decorateOrder(order) {
  if (!order) {
    return null;
  }

  return {
    ...order,
    total_display: Number(order.total).toFixed(2),
    order_date_display: formatOrderDate(order.order_date),
    barcode_svg: barcodeSvg(order.barcode_value || order.order_number)
  };
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
    barcode_value: orderNumber,
    barcode_svg: barcodeSvg(orderNumber)
  };
}

async function createOrder(payload, userId) {
  const orderData = validatePayload(payload);
  const { data, error } = await supabase
    .rpc('create_order', {
      p_order_date: getTodayIsoDate(),
      p_receiver: orderData.receiver,
      p_address: orderData.address,
      p_items: orderData.items,
      p_payment: orderData.payment,
      p_total: orderData.total,
      p_notes: orderData.notes,
      p_created_by: userId
    })
    .single();

  if (error) {
    throw error;
  }

  return decorateOrder(data);
}

async function updateOrder(id, payload) {
  const orderData = validatePayload(payload);
  const { data, error } = await supabase
    .from('orders')
    .update(orderData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return decorateOrder(data);
}

async function deleteOrder(id) {
  const { error } = await supabase.from('orders').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

module.exports = {
  listOrders,
  getNextMetadata,
  createOrder,
  updateOrder,
  deleteOrder,
  decorateOrder
};
