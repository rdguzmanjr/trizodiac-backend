const Order = require('../models/order');
const { renderOrderLabelPng } = require('../services/labelRenderer');

function sendError(res, error) {
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
    const order = await Order.createOrder(req.body, req.user.id);
    res.status(201).json({ order });
  } catch (error) {
    sendError(res, error);
  }
}

async function labelImage(req, res) {
  try {
    const order = await Order.getOrder(req.params.id);
    const image = await renderOrderLabelPng(order);
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', image.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `${disposition}; filename="${order.order_number}.png"`);
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
    const order = await Order.updateOrder(req.params.id, req.body);
    res.json({ order });
  } catch (error) {
    sendError(res, error);
  }
}

async function deleteOrder(req, res) {
  try {
    await Order.deleteOrder(req.params.id);
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
}

module.exports = {
  nextMetadata,
  createOrder,
  labelImage,
  updateOrder,
  deleteOrder
};
