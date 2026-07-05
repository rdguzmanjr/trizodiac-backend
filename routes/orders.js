const express = require('express');
const {
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
} = require('../controllers/orderController');

const router = express.Router();

router.get('/next', nextMetadata);
router.get('/inventory/available', availableInventory);
router.get('/customers/manage', showCustomerManagement);
router.post('/customers', createCustomer);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);
router.get('/:id/inventory-items', orderInventoryItems);
router.get('/:id/label.png', labelImage);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

module.exports = router;
