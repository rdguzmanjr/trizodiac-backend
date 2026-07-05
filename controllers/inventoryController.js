const Inventory = require('../models/inventory');

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function sendError(res, error) {
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Inventory request failed.'
  });
}

async function showInventory(req, res, next) {
  try {
    const [entries, bundles, productSpecifications] = await Promise.all([
      Inventory.listEntries(),
      Inventory.listBundles(),
      Inventory.listProductSpecifications()
    ]);

    res.render('inventory', {
      entries,
      entriesJson: jsonForScript(entries),
      bundlesJson: jsonForScript(bundles),
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

module.exports = {
  showInventory,
  createEntry,
  updateEntry,
  deleteEntry
};
