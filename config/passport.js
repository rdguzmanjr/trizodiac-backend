const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user || false);
  } catch (error) {
    done(error);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'missing-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'missing-google-client-secret',
      callbackURL: '/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await User.findOrCreateFromGoogle(profile);
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);
