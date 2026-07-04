const express = require('express');
const {
  showAdminPanel,
  promoteUser,
  demoteUser
} = require('../controllers/adminController');

const router = express.Router();

router.get('/', showAdminPanel);
router.post('/users/:id/promote', promoteUser);
router.post('/users/:id/demote', demoteUser);

module.exports = router;
