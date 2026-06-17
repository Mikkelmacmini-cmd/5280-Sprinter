/* POST /.netlify/functions/logout — clears the admin session cookie. */
const { json, clearCookieHeader } = require('../lib/shared');

exports.handler = async () =>
  json(200, { ok: true }, { 'Set-Cookie': clearCookieHeader() });
