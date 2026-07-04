const express = require('express');
const passport = require('passport');
const { logout } = require('../controllers/authController');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    res.redirect(req.user && req.user.is_admin ? '/dashboard' : '/black');
  }
);

router.post('/logout', ensureAuthenticated, logout);

module.exports = router;
