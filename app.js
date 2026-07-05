require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const morgan = require('morgan');
const flash = require('connect-flash');

const SupabaseSessionStore = require('./models/sessionStore');
require('./config/passport');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/orders');
const { showDashboard } = require('./controllers/dashboardController');
const { ensureAuthenticated, ensureAdmin } = require('./middleware/auth');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const assetVersion = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || Date.now().toString(36);
const cspDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  imgSrc: ["'self'", 'https:', 'data:'],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  connectSrc: ["'self'"]
};

if (isProduction) {
  cspDirectives.upgradeInsecureRequests = [];
} else {
  cspDirectives.upgradeInsecureRequests = null;
}

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives
    }
  })
);
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1d' : 0 }));

const requiredEnv = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_SECRET'
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0 && process.env.NODE_ENV !== 'test') {
  console.warn(`Missing required environment variables: ${missingEnv.join(', ')}`);
}

app.use(
  session({
    name: 'trizodiac.sid',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    store: new SupabaseSessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use((req, res, next) => {
  const isSignedIn = req.isAuthenticated && req.isAuthenticated();

  if (isSignedIn && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.locals.currentUser = req.user || null;
  res.locals.csrfToken = req.session.csrfToken || '';
  res.locals.assetVersion = assetVersion;
  res.locals.error = req.session.flash ? req.flash('error') : [];
  res.locals.success = req.session.flash ? req.flash('success') : [];
  next();
});

function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.get('x-csrf-token') || (req.body && req.body._csrf);

  if (token && token === req.session.csrfToken) {
    return next();
  }

  return res.status(403).render('error', {
    statusCode: 403,
    message: 'Invalid form token.'
  });
}

app.get('/', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }

  return req.user.is_admin ? res.redirect('/dashboard') : res.redirect('/black');
});

app.get('/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return req.user.is_admin ? res.redirect('/dashboard') : res.redirect('/black');
  }

  return res.render('login');
});

app.get('/black', ensureAuthenticated, (req, res) => {
  if (req.user.is_admin) {
    return res.redirect('/dashboard');
  }

  return res.render('black');
});

app.get('/dashboard', ensureAuthenticated, ensureAdmin, showDashboard);

app.get('/settings', ensureAuthenticated, ensureAdmin, (req, res, next) => {
  req.settingsMode = true;
  return showDashboard(req, res, next);
});

app.use('/auth', authRoutes);
app.use('/admin', ensureAuthenticated, ensureAdmin, verifyCsrf, adminRoutes);
app.use('/inventory', ensureAuthenticated, ensureAdmin, verifyCsrf, inventoryRoutes);
app.use('/orders', ensureAuthenticated, ensureAdmin, verifyCsrf, orderRoutes);

app.use((req, res) => {
  res.status(404).render('error', {
    statusCode: 404,
    message: 'Page not found.'
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }

  return res.status(err.status || 500).render('error', {
    statusCode: err.status || 500,
    message: isProduction ? 'Something went wrong.' : err.message
  });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

module.exports = app;
