const express = require('express');
const {
  nextMetadata,
  createOrder,
  updateOrder,
  deleteOrder
} = require('../controllers/orderController');

const router = express.Router();

router.get('/next', nextMetadata);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

module.exports = router;
