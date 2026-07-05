const { supabase } = require('../config/supabase');

function normalizeText(value) {
  return String(value || '').trim();
}

function createBadRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function decorateEntry(row) {
  const bundle = row.bundle || {};
  const spec = row.spec || {};

  return {
    id: row.id,
    bundle_id: row.bundle_id,
    product_specification_id: row.product_specification_id,
    bundle_name: bundle.bundle_name || row.bundle_name,
    code_number: row.code_number,
    product_specification: spec.product_specification || row.product_specification,
    size_inches: row.size_inches,
    length_inches: row.length_inches,
    price: bundle.price || row.price,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function validatePayload(payload) {
  const required = ['bundle_name', 'code_number', 'product_specification', 'size_inches', 'length_inches', 'price'];
  const values = {
    bundle_id: normalizeText(payload.bundle_id),
    product_specification_id: normalizeText(payload.product_specification_id),
    bundle_name: normalizeText(payload.bundle_name),
    code_number: normalizeText(payload.code_number),
    product_specification: normalizeText(payload.product_specification),
    size_inches: normalizeText(payload.size_inches),
    length_inches: normalizeText(payload.length_inches),
    price: normalizeText(payload.price)
  };
  const missing = required.filter((field) => !values[field]);

  if (missing.length) {
    throw createBadRequest(`Missing required fields: ${missing.join(', ')}`);
  }

  return values;
}

async function listBundles() {
  const { data, error } = await supabase
    .from('inventory_bundles')
    .select('id, bundle_name, price')
    .order('bundle_name', { ascending: true })
    .limit(2000);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listProductSpecifications() {
  const { data, error } = await supabase
    .from('product_specifications')
    .select('id, product_specification')
    .order('product_specification', { ascending: true })
    .limit(2000);

  if (error) {
    throw error;
  }

  return data || [];
}

async function findBundleByName(bundleName) {
  const { data, error } = await supabase
    .from('inventory_bundles')
    .select('id, bundle_name, price')
    .ilike('bundle_name', bundleName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findProductSpecificationByName(productSpecification) {
  const { data, error } = await supabase
    .from('product_specifications')
    .select('id, product_specification')
    .ilike('product_specification', productSpecification)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getBundleById(bundleId) {
  if (!bundleId) {
    return null;
  }

  const { data, error } = await supabase
    .from('inventory_bundles')
    .select('id, bundle_name, price')
    .eq('id', bundleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getProductSpecificationById(productSpecificationId) {
  if (!productSpecificationId) {
    return null;
  }

  const { data, error } = await supabase
    .from('product_specifications')
    .select('id, product_specification')
    .eq('id', productSpecificationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertBundle(bundleName, price, bundleId) {
  const existingById = await getBundleById(bundleId);

  if (existingById) {
    const updates = {};
    if (existingById.bundle_name !== bundleName) {
      updates.bundle_name = bundleName;
    }
    if (existingById.price !== price) {
      updates.price = price;
    }

    if (!Object.keys(updates).length) {
      return existingById;
    }

    const { data, error } = await supabase
      .from('inventory_bundles')
      .update(updates)
      .eq('id', existingById.id)
      .select('id, bundle_name, price')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const existingByName = await findBundleByName(bundleName);

  if (existingByName) {
    if (existingByName.price === price) {
      return existingByName;
    }

    const { data, error } = await supabase
      .from('inventory_bundles')
      .update({ price })
      .eq('id', existingByName.id)
      .select('id, bundle_name, price')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('inventory_bundles')
    .insert({ bundle_name: bundleName, price })
    .select('id, bundle_name, price')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function upsertProductSpecification(productSpecification, productSpecificationId) {
  const existingById = await getProductSpecificationById(productSpecificationId);

  if (existingById) {
    if (existingById.product_specification === productSpecification) {
      return existingById;
    }

    const { data, error } = await supabase
      .from('product_specifications')
      .update({ product_specification: productSpecification })
      .eq('id', existingById.id)
      .select('id, product_specification')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const existingByName = await findProductSpecificationByName(productSpecification);

  if (existingByName) {
    return existingByName;
  }

  const { data, error } = await supabase
    .from('product_specifications')
    .insert({ product_specification: productSpecification })
    .select('id, product_specification')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function resolveEntryData(payload) {
  const values = validatePayload(payload);
  const [bundle, spec] = await Promise.all([
    upsertBundle(values.bundle_name, values.price, values.bundle_id),
    upsertProductSpecification(values.product_specification, values.product_specification_id)
  ]);

  return {
    bundle_id: bundle.id,
    product_specification_id: spec.id,
    bundle_name: bundle.bundle_name,
    code_number: values.code_number,
    product_specification: spec.product_specification,
    size_inches: values.size_inches,
    length_inches: values.length_inches,
    price: bundle.price
  };
}

async function listEntries() {
  const { data, error } = await supabase
    .from('inventory_entries')
    .select(`
      id,
      bundle_id,
      product_specification_id,
      bundle_name,
      code_number,
      product_specification,
      size_inches,
      length_inches,
      price,
      created_by,
      created_at,
      updated_at,
      bundle:inventory_bundles(id, bundle_name, price),
      spec:product_specifications(id, product_specification)
    `)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    throw error;
  }

  return (data || []).map(decorateEntry);
}

async function getEntry(id) {
  const { data, error } = await supabase
    .from('inventory_entries')
    .select(`
      id,
      bundle_id,
      product_specification_id,
      bundle_name,
      code_number,
      product_specification,
      size_inches,
      length_inches,
      price,
      created_by,
      created_at,
      updated_at,
      bundle:inventory_bundles(id, bundle_name, price),
      spec:product_specifications(id, product_specification)
    `)
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return decorateEntry(data);
}

async function createEntry(payload, userId) {
  const entryData = await resolveEntryData(payload);
  const { data, error } = await supabase
    .from('inventory_entries')
    .insert({ ...entryData, created_by: userId })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return getEntry(data.id);
}

async function updateEntry(id, payload) {
  const entryData = await resolveEntryData(payload);
  const { data, error } = await supabase
    .from('inventory_entries')
    .update(entryData)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return getEntry(data.id);
}

async function deleteEntry(id) {
  const { error } = await supabase.from('inventory_entries').delete().eq('id', id);

  if (error) {
    throw error;
  }
}

module.exports = {
  listEntries,
  listBundles,
  listProductSpecifications,
  createEntry,
  updateEntry,
  deleteEntry
};
