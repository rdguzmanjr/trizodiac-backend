const { createClient } = require('@supabase/supabase-js');

let cachedClient;

function createSupabaseClient(key) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = key || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and service role key are required.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function getSupabaseClient() {
  if (!cachedClient) {
    cachedClient = createSupabaseClient();
  }

  return cachedClient;
}

const supabase = new Proxy(
  {},
  {
    get(target, prop) {
      const client = getSupabaseClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    }
  }
);

module.exports = {
  supabase,
  createSupabaseClient,
  getSupabaseClient
};
