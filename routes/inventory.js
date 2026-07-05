const express = require('express');
const {
  showInventory,
  createEntry,
  updateEntry,
  deleteEntry
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/', showInventory);
router.post('/entries', createEntry);
router.put('/entries/:id', updateEntry);
router.delete('/entries/:id', deleteEntry);

module.exports = router;
