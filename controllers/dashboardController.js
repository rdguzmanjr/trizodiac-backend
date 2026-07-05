const Order = require('../models/order');

async function showDashboard(req, res, next) {
  try {
    const [orders, customers, inventoryItems] = await Promise.all([
      Order.listOrders(),
      Order.listCustomers(),
      Order.listAvailableInventoryItems()
    ]);

    res.render('dashboard', {
      orders,
      ordersJson: JSON.stringify(orders).replace(/</g, '\\u003c'),
      customersJson: JSON.stringify(customers).replace(/</g, '\\u003c'),
      inventoryItemsJson: JSON.stringify(inventoryItems).replace(/</g, '\\u003c'),
      settingsMode: Boolean(req.settingsMode)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  showDashboard
};
