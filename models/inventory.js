const { supabase } = require('../config/supabase');

function normalizeText(value) {
  return String(value || '').trim();
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isForeignKeyError(error) {
  return error && error.code === '23503';
}

function decorateEntry(row) {
  const bundle = row.bundle || {};
  const spec = row.spec || {};
  const type = row.type || {};

  return {
    id: row.id,
    bundle_id: row.bundle_id,
    type_id: row.type_id,
    product_specification_id: row.product_specification_id,
    bundle_name: bundle.bundle_name || row.bundle_name,
    type_name: type.type_name || row.type_name,
    code_number: row.code_number,
    product_specification: spec.product_specification || row.product_specification,
    size_inches: row.size_inches,
    length_inches: row.length_inches,
    price: type.price || row.price,
    status: row.status || 'Available',
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function validateEntryPayload(payload) {
  const values = {
    bundle_id: normalizeText(payload.bundle_id),
    type_id: normalizeText(payload.type_id),
    product_specification_id: normalizeText(payload.product_specification_id),
    bundle_name: normalizeText(payload.bundle_name),
    type_name: normalizeText(payload.type_name),
    code_number: normalizeText(payload.code_number),
    product_specification: normalizeText(payload.product_specification),
    size_inches: normalizeText(payload.size_inches),
    length_inches: normalizeText(payload.length_inches),
    price: normalizeText(payload.price)
  };
  const required = ['bundle_name', 'type_name', 'code_number', 'product_specification', 'size_inches', 'length_inches', 'price'];
  const missing = required.filter((field) => !values[field]);

  if (missing.length) {
    throw createHttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }

  return values;
}

function validateBundlePayload(payload) {
  const bundleName = normalizeText(payload.bundle_name);
  if (!bundleName) {
    throw createHttpError(400, 'Bundle name is required.');
  }

  return { bundle_name: bundleName };
}

function validateProductSpecificationPayload(payload) {
  const productSpecification = normalizeText(payload.product_specification);
  if (!productSpecification) {
    throw createHttpError(400, 'Product specification is required.');
  }

  return { product_specification: productSpecification };
}

function validateTypePayload(payload) {
  const typeName = normalizeText(payload.type_name);
  const price = normalizeText(payload.price);

  if (!typeName || !price) {
    throw createHttpError(400, 'Type name and price are required.');
  }

  return {
    type_name: typeName,
    price
  };
}

async function listBundles() {
  const { data, error } = await supabase
    .from('inventory_bundles')
    .select('id, bundle_name')
    .order('bundle_name', { ascending: true })
    .limit(2000);

  if (error) {
    throw error;
  }

  return data || [];
}

async function listTypes() {
  const { data, error } = await supabase
    .from('inventory_types')
    .select('id, type_name, price')
    .order('type_name', { ascending: true })
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
    .select('id, bundle_name')
    .ilike('bundle_name', bundleName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findTypeByName(typeName) {
  const { data, error } = await supabase
    .from('inventory_types')
    .select('id, type_name, price')
    .ilike('type_name', typeName)
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
    .select('id, bundle_name')
    .eq('id', bundleId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getTypeById(typeId) {
  if (!typeId) {
    return null;
  }

  const { data, error } = await supabase
    .from('inventory_types')
    .select('id, type_name, price')
    .eq('id', typeId)
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

async function upsertBundle(bundleName, bundleId) {
  const existingById = await getBundleById(bundleId);

  if (existingById) {
    if (existingById.bundle_name === bundleName) {
      return existingById;
    }

    return updateBundle(existingById.id, { bundle_name: bundleName });
  }

  const existingByName = await findBundleByName(bundleName);
  if (existingByName) {
    return existingByName;
  }

  return createBundle({ bundle_name: bundleName });
}

async function resolveType(typeName, price, typeId) {
  const existingById = await getTypeById(typeId);
  if (existingById) {
    if (existingById.type_name.toLowerCase() !== typeName.toLowerCase()) {
      throw createHttpError(400, 'Selected Type does not match the typed Type name.');
    }

    return existingById;
  }

  const existingByName = await findTypeByName(typeName);
  if (existingByName) {
    return existingByName;
  }

  return createType({ type_name: typeName, price });
}

async function upsertProductSpecification(productSpecification, productSpecificationId) {
  const existingById = await getProductSpecificationById(productSpecificationId);

  if (existingById) {
    if (existingById.product_specification === productSpecification) {
      return existingById;
    }

    return updateProductSpecification(existingById.id, { product_specification: productSpecification });
  }

  const existingByName = await findProductSpecificationByName(productSpecification);
  if (existingByName) {
    return existingByName;
  }

  return createProductSpecification({ product_specification: productSpecification });
}

async function resolveEntryData(payload) {
  const values = validateEntryPayload(payload);
  const [bundle, type, spec] = await Promise.all([
    upsertBundle(values.bundle_name, values.bundle_id),
    resolveType(values.type_name, values.price, values.type_id),
    upsertProductSpecification(values.product_specification, values.product_specification_id)
  ]);

  return {
    bundle_id: bundle.id,
    type_id: type.id,
    product_specification_id: spec.id,
    bundle_name: bundle.bundle_name,
    type_name: type.type_name,
    code_number: values.code_number,
    product_specification: spec.product_specification,
    size_inches: values.size_inches,
    length_inches: values.length_inches,
    price: type.price,
    status: 'Available'
  };
}

function entrySelect() {
  return `
    id,
    bundle_id,
    type_id,
    product_specification_id,
    bundle_name,
    type_name,
    code_number,
    product_specification,
    size_inches,
    length_inches,
    price,
    status,
    created_by,
    created_at,
    updated_at,
    bundle:inventory_bundles(id, bundle_name),
    type:inventory_types(id, type_name, price),
    spec:product_specifications(id, product_specification)
  `;
}

async function listEntries() {
  const { data, error } = await supabase
    .from('inventory_entries')
    .select(entrySelect())
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
    .select(entrySelect())
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

async function updateEntriesByLookup(matchColumn, matchValue, updates) {
  const { error } = await supabase.from('inventory_entries').update(updates).eq(matchColumn, matchValue);

  if (error) {
    throw error;
  }
}

async function createBundle(payload) {
  const dataToSave = validateBundlePayload(payload);
  const { data, error } = await supabase
    .from('inventory_bundles')
    .insert(dataToSave)
    .select('id, bundle_name')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateBundle(id, payload) {
  const dataToSave = validateBundlePayload(payload);
  const { data, error } = await supabase
    .from('inventory_bundles')
    .update(dataToSave)
    .eq('id', id)
    .select('id, bundle_name')
    .single();

  if (error) {
    throw error;
  }

  await updateEntriesByLookup('bundle_id', data.id, { bundle_name: data.bundle_name });
  return data;
}

async function deleteBundle(id) {
  const { error } = await supabase.from('inventory_bundles').delete().eq('id', id);

  if (error) {
    if (isForeignKeyError(error)) {
      throw createHttpError(409, 'This bundle is used by inventory entries and cannot be deleted.');
    }

    throw error;
  }
}

async function createType(payload) {
  const dataToSave = validateTypePayload(payload);
  const { data, error } = await supabase
    .from('inventory_types')
    .insert(dataToSave)
    .select('id, type_name, price')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateType(id, payload) {
  const dataToSave = validateTypePayload(payload);
  const { data, error } = await supabase
    .from('inventory_types')
    .update(dataToSave)
    .eq('id', id)
    .select('id, type_name, price')
    .single();

  if (error) {
    throw error;
  }

  await updateEntriesByLookup('type_id', data.id, { type_name: data.type_name, price: data.price });
  return data;
}

async function deleteType(id) {
  const { error } = await supabase.from('inventory_types').delete().eq('id', id);

  if (error) {
    if (isForeignKeyError(error)) {
      throw createHttpError(409, 'This type is used by inventory entries and cannot be deleted.');
    }

    throw error;
  }
}

async function createProductSpecification(payload) {
  const dataToSave = validateProductSpecificationPayload(payload);
  const { data, error } = await supabase
    .from('product_specifications')
    .insert(dataToSave)
    .select('id, product_specification')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateProductSpecification(id, payload) {
  const dataToSave = validateProductSpecificationPayload(payload);
  const { data, error } = await supabase
    .from('product_specifications')
    .update(dataToSave)
    .eq('id', id)
    .select('id, product_specification')
    .single();

  if (error) {
    throw error;
  }

  await updateEntriesByLookup('product_specification_id', data.id, { product_specification: data.product_specification });
  return data;
}

async function deleteProductSpecification(id) {
  const { error } = await supabase.from('product_specifications').delete().eq('id', id);

  if (error) {
    if (isForeignKeyError(error)) {
      throw createHttpError(409, 'This product specification is used by inventory entries and cannot be deleted.');
    }

    throw error;
  }
}

module.exports = {
  listEntries,
  listBundles,
  listTypes,
  listProductSpecifications,
  createEntry,
  updateEntry,
  deleteEntry,
  createBundle,
  updateBundle,
  deleteBundle,
  createType,
  updateType,
  deleteType,
  createProductSpecification,
  updateProductSpecification,
  deleteProductSpecification
};
