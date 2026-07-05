const Order = require('../models/order');
const { renderOrderLabelPng } = require('../services/labelRenderer');

function sendError(res, error) {
  if (error.code === '23505') {
    return res.status(409).json({ error: 'A record with that name already exists.' });
  }

  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Order request failed.'
  });
}

async function nextMetadata(req, res) {
  try {
    res.json(await Order.getNextMetadata());
  } catch (error) {
    sendError(res, error);
  }
}

async function createOrder(req, res) {
  try {
    const { order, customer } = await Order.createOrder(req.body, req.user.id);
    const inventoryItems = await Order.listAvailableInventoryItems();
    res.status(201).json({ order, customer, inventoryItems });
  } catch (error) {
    sendError(res, error);
  }
}

async function availableInventory(req, res) {
  try {
    res.json({ inventoryItems: await Order.listAvailableInventoryItems() });
  } catch (error) {
    sendError(res, error);
  }
}

async function orderInventoryItems(req, res) {
  try {
    const order = await Order.getOrder(req.params.id);
    const inventoryItems = await Order.listInventoryItemsByIds(order.inventory_item_ids);
    res.json({ inventoryItems });
  } catch (error) {
    sendError(res, error);
  }
}

async function labelImage(req, res) {
  try {
    const order = await Order.getOrder(req.params.id);
    const inventoryItems = await Order.listInventoryItemsByIds(order.inventory_item_ids);
    const labelOrder = inventoryItems.length
      ? { ...order, items: Order.formatInventoryItemsForOrder(inventoryItems) }
      : order;
    const image = await renderOrderLabelPng(labelOrder);
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', image.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `${disposition}; filename="${labelOrder.order_number}.png"`);
    res.send(image);
  } catch (error) {
    console.error('Label image render failed', {
      orderId: req.params.id,
      message: error.message,
      stack: error.stack
    });
    sendError(res, error);
  }
}

async function updateOrder(req, res) {
  try {
    const { order, customer } = await Order.updateOrder(req.params.id, req.body);
    const inventoryItems = await Order.listAvailableInventoryItems();
    res.json({ order, customer, inventoryItems });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteOrder(req, res) {
  try {
    await Order.deleteOrder(req.params.id);
    res.json({ inventoryItems: await Order.listAvailableInventoryItems() });
  } catch (error) {
    sendError(res, error);
  }
}

async function showCustomerManagement(req, res, next) {
  try {
    const customers = await Order.listCustomers();
    res.render('customers', {
      customersJson: JSON.stringify(customers).replace(/</g, '\\u003c')
    });
  } catch (error) {
    next(error);
  }
}

async function createCustomer(req, res) {
  try {
    const customer = await Order.createCustomer(req.body);
    res.status(201).json({ customer });
  } catch (error) {
    sendError(res, error);
  }
}

async function updateCustomer(req, res) {
  try {
    const customer = await Order.updateCustomer(req.params.id, req.body);
    res.json({ customer });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteCustomer(req, res) {
  try {
    await Order.deleteCustomer(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  nextMetadata,
  availableInventory,
  orderInventoryItems,
  createOrder,
  labelImage,
  updateOrder,
  deleteOrder,
  showCustomerManagement,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
