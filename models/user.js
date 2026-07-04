const { supabase } = require('../config/supabase');

const SORT_COLUMNS = new Set(['name', 'email', 'created_at', 'last_login', 'is_admin']);
const INITIAL_ADMIN_EMAIL = (process.env.INITIAL_ADMIN_EMAIL || 'jr.dguzman@gmail.com').toLowerCase();

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseGoogleProfile(profile) {
  const email = normalizeEmail(profile.emails && profile.emails[0] && profile.emails[0].value);

  if (!email) {
    throw new Error('Google account did not provide an email address.');
  }

  return {
    google_id: profile.id,
    email,
    name: profile.displayName || email,
    avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null
  };
}

async function findById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findByGoogleId(googleId) {
  const { data, error } = await supabase.from('users').select('*').eq('google_id', googleId).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function findByEmail(email) {
  const { data, error } = await supabase.from('users').select('*').eq('email', normalizeEmail(email)).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function createUserFromGoogle(profile) {
  const userData = parseGoogleProfile(profile);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .insert({
      ...userData,
      is_admin: userData.email === INITIAL_ADMIN_EMAIL,
      created_at: now,
      last_login: now
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updateLogin(user, profile) {
  const userData = parseGoogleProfile(profile);

  const { data, error } = await supabase
    .from('users')
    .update({
      google_id: userData.google_id,
      email: userData.email,
      name: userData.name,
      avatar: userData.avatar,
      last_login: new Date().toISOString()
    })
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function findOrCreateFromGoogle(profile) {
  const parsed = parseGoogleProfile(profile);
  const user = (await findByGoogleId(parsed.google_id)) || (await findByEmail(parsed.email));

  if (user) {
    return updateLogin(user, profile);
  }

  return createUserFromGoogle(profile);
}

async function listUsers({ search = '', sort = 'created_at', direction = 'desc' } = {}) {
  const sortColumn = SORT_COLUMNS.has(sort) ? sort : 'created_at';
  const ascending = String(direction).toLowerCase() === 'asc';
  const trimmedSearch = String(search || '').trim();

  let query = supabase.from('users').select('*', { count: 'exact' });

  if (trimmedSearch) {
    const safeSearch = trimmedSearch.replace(/[%_]/g, '\\$&');
    query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  }

  const { data, error } = await query.order(sortColumn, { ascending }).limit(250);

  if (error) {
    throw error;
  }

  return data || [];
}

async function setAdminStatus(id, isAdmin) {
  const { data, error } = await supabase
    .from('users')
    .update({ is_admin: isAdmin })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function countAdmins() {
  const { count, error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin', true);

  if (error) {
    throw error;
  }

  return count || 0;
}

module.exports = {
  findById,
  findByGoogleId,
  findByEmail,
  findOrCreateFromGoogle,
  listUsers,
  setAdminStatus,
  countAdmins
};
