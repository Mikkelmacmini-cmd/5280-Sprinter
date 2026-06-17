/* POST /.netlify/functions/login
   Body: { email, password }
   Checks the password against ADMIN_PASSWORD (and email against ADMIN_EMAIL if
   set), then issues a short-lived HMAC-signed session cookie. */
const { json, signSession, sessionCookieHeader, timingSafeEqualStr } = require('../lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  const secret = process.env.SESSION_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!secret || !adminPassword) {
    return json(500, { error: 'Admin login is not configured (missing ADMIN_PASSWORD or SESSION_SECRET).' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const email = (body.email || '').trim();
  const password = body.password || '';
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim();

  const emailOk = !adminEmail || email.toLowerCase() === adminEmail.toLowerCase();
  const passwordOk = timingSafeEqualStr(password, adminPassword);

  if (!emailOk || !passwordOk) {
    return json(401, { error: 'Incorrect email or password.' });
  }

  const token = signSession(secret);
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookieHeader(token) });
};
