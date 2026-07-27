// netlify/functions/invite-user.js
//
// Admin-only endpoint. Verifies the caller is signed in AND matches
// ADMIN_EMAIL, then uses the Supabase service_role key (server-side only,
// never sent to the browser) to invite a new user by email.
//
// Required Netlify environment variables (Site settings > Environment variables):
//   SUPABASE_URL              - same URL used in the app
//   SUPABASE_SERVICE_ROLE_KEY - the SECRET service_role key from
//                                Supabase > Project Settings > API
//                                (Legacy anon/service_role keys tab).
//                                Never put this key in the HTML file.
//   ADMIN_EMAIL                - your own login email, must match the
//                                ADMIN_EMAIL constant in index.html

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

  // Verify the caller's token actually belongs to the admin.
  const { data: callerData, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !callerData || !callerData.user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session.' }) };
  }
  if ((callerData.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Only the admin can invite team members.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }
  const email = (body.email || '').trim();
  const name = (body.name || '').trim();
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required.' }) };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name: name }
  });

  if (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, user: data.user }) };
};
