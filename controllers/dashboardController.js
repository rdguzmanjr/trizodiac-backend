const Order = require('../models/order');

async function showDashboard(req, res, next) {
  try {
    const orders = await Order.listOrders();
    res.render('dashboard', {
      orders,
      ordersJson: JSON.stringify(orders).replace(/</g, '\\u003c'),
      settingsMode: Boolean(req.settingsMode)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  showDashboard
};
