const Inventory = require('../models/inventory');

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function sendError(res, error) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'A record with that name already exists.' });
  }

  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Inventory request failed.'
  });
}

async function showInventory(req, res, next) {
  try {
    const [entries, bundles, types, productSpecifications] = await Promise.all([
      Inventory.listEntries(),
      Inventory.listBundles(),
      Inventory.listTypes(),
      Inventory.listProductSpecifications()
    ]);

    res.render('inventory', {
      entries,
      entriesJson: jsonForScript(entries),
      bundlesJson: jsonForScript(bundles),
      typesJson: jsonForScript(types),
      productSpecificationsJson: jsonForScript(productSpecifications)
    });
  } catch (error) {
    next(error);
  }
}

async function showInventoryManagement(req, res, next) {
  try {
    const [bundles, types, productSpecifications] = await Promise.all([
      Inventory.listBundles(),
      Inventory.listTypes(),
      Inventory.listProductSpecifications()
    ]);

    res.render('inventory-management', {
      bundlesJson: jsonForScript(bundles),
      typesJson: jsonForScript(types),
      productSpecificationsJson: jsonForScript(productSpecifications)
    });
  } catch (error) {
    next(error);
  }
}

async function createEntry(req, res) {
  try {
    const entry = await Inventory.createEntry(req.body, req.user.id);
    res.status(201).json({ entry });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateEntry(req, res) {
  try {
    const entry = await Inventory.updateEntry(req.params.id, req.body);
    res.json({ entry });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteEntry(req, res) {
  try {
    await Inventory.deleteEntry(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

async function createBundle(req, res) {
  try {
    const bundle = await Inventory.createBundle(req.body);
    res.status(201).json({ bundle });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateBundle(req, res) {
  try {
    const bundle = await Inventory.updateBundle(req.params.id, req.body);
    res.json({ bundle });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteBundle(req, res) {
  try {
    await Inventory.deleteBundle(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

async function createType(req, res) {
  try {
    const type = await Inventory.createType(req.body);
    res.status(201).json({ type });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateType(req, res) {
  try {
    const type = await Inventory.updateType(req.params.id, req.body);
    res.json({ type });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteType(req, res) {
  try {
    await Inventory.deleteType(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

async function createProductSpecification(req, res) {
  try {
    const productSpecification = await Inventory.createProductSpecification(req.body);
    res.status(201).json({ productSpecification });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateProductSpecification(req, res) {
  try {
    const productSpecification = await Inventory.updateProductSpecification(req.params.id, req.body);
    res.json({ productSpecification });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteProductSpecification(req, res) {
  try {
    await Inventory.deleteProductSpecification(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  showInventory,
  showInventoryManagement,
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
