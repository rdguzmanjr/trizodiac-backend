const User = require('../models/user');

function adminRedirect(req, res) {
  const referrer = req.get('Referrer');
  return res.redirect(referrer && referrer.startsWith(`${req.protocol}://${req.get('host')}`) ? referrer : '/admin');
}

function getSortParams(query) {
  const sort = query.sort || 'created_at';
  const direction = query.direction === 'asc' ? 'asc' : 'desc';
  return { sort, direction };
}

async function showAdminPanel(req, res, next) {
  try {
    const { sort, direction } = getSortParams(req.query);
    const search = req.query.search || '';
    const users = await User.listUsers({ search, sort, direction });

    res.render('admin', {
      users,
      search,
      sort,
      direction
    });
  } catch (error) {
    next(error);
  }
}

async function promoteUser(req, res, next) {
  try {
    await User.setAdminStatus(req.params.id, true);
    req.flash('success', 'User promoted to administrator.');
    adminRedirect(req, res);
  } catch (error) {
    next(error);
  }
}

async function demoteUser(req, res, next) {
  try {
    const admins = await User.countAdmins();

    if (admins <= 1) {
      req.flash('error', 'At least one administrator must remain.');
      return adminRedirect(req, res);
    }

    if (req.params.id === req.user.id) {
      req.flash('error', 'You cannot remove your own admin access.');
      return adminRedirect(req, res);
    }

    await User.setAdminStatus(req.params.id, false);
    req.flash('success', 'Admin access removed.');
    return adminRedirect(req, res);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showAdminPanel,
  promoteUser,
  demoteUser
};
