const { supabase } = require('../config/supabase');

function validatePayload(payload) {
  const required = ['bundle_name', 'code_number', 'product_specification', 'size_inches', 'length_inches', 'price'];
  const missing = required.filter((field) => !String(payload[field] || '').trim());

  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }

  return {
    bundle_name: String(payload.bundle_name).trim(),
    code_number: String(payload.code_number).trim(),
    product_specification: String(payload.product_specification).trim(),
    size_inches: String(payload.size_inches).trim(),
    length_inches: String(payload.length_inches).trim(),
    price: String(payload.price).trim()
  };
}

async function listEntries() {
  const { data, error } = await supabase
    .from('inventory_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    throw error;
  }

  return data || [];
}

async function createEntry(payload, userId) {
  const entryData = validatePayload(payload);
  const { data, error } = await supabase
    .from('inventory_entries')
    .insert({ ...entryData, created_by: userId })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateEntry(id, payload) {
  const entryData = validatePayload(payload);
  const { data, error } = await supabase
    .from('inventory_entries')
    .update(entryData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteEntry(id) {
  const { error } = await supabase.from('inventory_entries').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

module.exports = {
  listEntries,
  createEntry,
  updateEntry,
  deleteEntry
};
