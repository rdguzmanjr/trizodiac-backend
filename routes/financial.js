const express = require('express');
const {
  showFinancial,
  createRecord,
  updateRecord,
  deleteRecord
} = require('../controllers/financialController');

const router = express.Router();

router.get('/', showFinancial);
router.post('/records', createRecord);
router.put('/records/:id', updateRecord);
router.delete('/records/:id', deleteRecord);

module.exports = router;
