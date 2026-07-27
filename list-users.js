// netlify/functions/list-users.js
//
// Admin-only endpoint. Returns the list of everyone currently authorized
// to sign in (i.e. everyone that's been invited). Same env vars as
// invite-user.js.

const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();

  if (!SUPABASE_URL || !SERVICE_KEY || !ADMIN_EMAIL) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured. Missing environment variables.' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Not signed in.' }) };
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData || !callerData.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session.' }) };
  }
  if ((callerData.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Only the admin can view team members.' }) };
  }

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }

  const users = (data.users || []).map(function (u) {
    return {
      email: u.email,
      user_metadata: u.user_metadata,
      email_confirmed_at: u.email_confirmed_at,
      created_at: u.created_at
    };
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true, users: users }) };
};
