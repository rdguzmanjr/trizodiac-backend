const express = require('express');
const {
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
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/', showInventory);
router.get('/manage', showInventoryManagement);
router.post('/entries', createEntry);
router.put('/entries/:id', updateEntry);
router.delete('/entries/:id', deleteEntry);
router.post('/bundles', createBundle);
router.put('/bundles/:id', updateBundle);
router.delete('/bundles/:id', deleteBundle);
router.post('/types', createType);
router.put('/types/:id', updateType);
router.delete('/types/:id', deleteType);
router.post('/product-specifications', createProductSpecification);
router.put('/product-specifications/:id', updateProductSpecification);
router.delete('/product-specifications/:id', deleteProductSpecification);

module.exports = router;
