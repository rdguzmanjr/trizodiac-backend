const session = require('express-session');
const { supabase } = require('../config/supabase');

class SupabaseSessionStore extends session.Store {
  async get(sid, callback) {
    try {
      const { data, error } = await supabase.from('sessions').select('sess, expire').eq('sid', sid).maybeSingle();

      if (error) {
        throw error;
      }

      if (!data || new Date(data.expire).getTime() <= Date.now()) {
        return callback(null, null);
      }

      return callback(null, data.sess);
    } catch (error) {
      return callback(error);
    }
  }

  async set(sid, sess, callback) {
    try {
      const maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
      const expire = new Date(Date.now() + maxAge).toISOString();

      const { error } = await supabase.from('sessions').upsert(
        {
          sid,
          sess,
          expire
        },
        { onConflict: 'sid' }
      );

      if (error) {
        throw error;
      }

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async destroy(sid, callback) {
    try {
      const { error } = await supabase.from('sessions').delete().eq('sid', sid);

      if (error) {
        throw error;
      }

      return callback(null);
    } catch (error) {
      return callback(error);
    }
  }

  async touch(sid, sess, callback) {
    return this.set(sid, sess, callback);
  }
}

module.exports = SupabaseSessionStore;
