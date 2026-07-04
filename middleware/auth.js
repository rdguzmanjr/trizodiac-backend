function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }

  if (!req.user || !req.user.is_admin) {
    return res.redirect('/black');
  }

  return next();
}

module.exports = {
  ensureAuthenticated,
  ensureAdmin
};
