function logout(req, res, next) {
  req.logout((error) => {
    if (error) {
      return next(error);
    }

    req.session.destroy(() => {
      res.clearCookie('trizodiac.sid');
      res.redirect('/login');
    });
  });
}

module.exports = {
  logout
};
