const express = require('express');
const {
  nextMetadata,
  createOrder,
  labelImage,
  updateOrder,
  deleteOrder
} = require('../controllers/orderController');

const router = express.Router();

router.get('/next', nextMetadata);
router.get('/:id/label.png', labelImage);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

module.exports = router;
