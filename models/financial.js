const { supabase } = require('../config/supabase');

function normalizeText(value) {
  return String(value || '').trim();
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function formatRecordDate(dateValue) {
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

function validatePayload(payload) {
  const priceText = normalizeText(payload.price);
  const price = Number(priceText);
  const description = normalizeText(payload.description);
  const recordDate = normalizeText(payload.record_date);

  if (!priceText || !Number.isFinite(price) || price < 0) {
    throw createHttpError(400, 'Price must be a valid non-negative number.');
  }

  if (!description) {
    throw createHttpError(400, 'Description is required.');
  }

  if (!recordDate || !isIsoDate(recordDate)) {
    throw createHttpError(400, 'Date is required.');
  }

  return {
    price,
    description,
    record_date: recordDate
  };
}

function getAdminName(user) {
  return normalizeText(user?.name) || normalizeText(user?.email) || 'Admin';
}

function decorateRecord(row) {
  return {
    id: row.id,
    price: Number(row.price),
    price_display: Number(row.price).toFixed(2),
    description: row.description,
    record_date: row.record_date,
    record_date_display: formatRecordDate(row.record_date),
    added_by: row.added_by,
    added_by_name: row.added_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function listRecords() {
  const { data, error } = await supabase
    .from('financial_records')
    .select('*')
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    throw error;
  }

  return (data || []).map(decorateRecord);
}

async function getRecord(id) {
  const { data, error } = await supabase
    .from('financial_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createHttpError(404, 'Financial record not found.');
  }

  return decorateRecord(data);
}

async function createRecord(payload, user) {
  const dataToSave = {
    ...validatePayload(payload),
    added_by: user?.id || null,
    added_by_name: getAdminName(user)
  };

  const { data, error } = await supabase
    .from('financial_records')
    .insert(dataToSave)
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return getRecord(data.id);
}

async function updateRecord(id, payload) {
  const dataToSave = validatePayload(payload);
  const { data, error } = await supabase
    .from('financial_records')
    .update(dataToSave)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return getRecord(data.id);
}

async function deleteRecord(id) {
  const { error } = await supabase.from('financial_records').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

module.exports = {
  listRecords,
  createRecord,
  updateRecord,
  deleteRecord
};
