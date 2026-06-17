/* ===========================================================================
   Shared helpers for the 5280 Sprinter Netlify Functions.
   (CommonJS. ESM-only deps like @netlify/blobs are loaded with dynamic import.)
   Lives outside the /functions directory so Netlify never treats it as its own
   endpoint, but esbuild still bundles it into each function that requires it.
   =========================================================================== */
const crypto = require('crypto');

// --- Session cookie config -------------------------------------------------
const COOKIE_NAME = 'sb_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

// --- JSON response helper --------------------------------------------------
function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

// --- base64url helpers -----------------------------------------------------
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (str) =>
  Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// --- HMAC-signed session tokens --------------------------------------------
// token = base64url(payloadJSON) + "." + base64url(HMAC_SHA256(payload, secret))
function signSession(secret) {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_MS });
  const p = b64url(payload);
  const sig = crypto.createHmac('sha256', secret).update(p).digest();
  return `${p}.${b64url(sig)}`;
}

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [p, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(p).digest();
  const given = fromB64url(sig);
  if (expected.length !== given.length) return false;
  if (!crypto.timingSafeEqual(expected, given)) return false;
  try {
    const payload = JSON.parse(fromB64url(p).toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(header = '') {
  const out = {};
  String(header)
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .forEach((c) => {
      const i = c.indexOf('=');
      if (i === -1) return;
      out[c.slice(0, i)] = decodeURIComponent(c.slice(i + 1));
    });
  return out;
}

// Returns true if the request carries a valid, unexpired admin session cookie.
function isAuthed(event) {
  const secret = process.env.SESSION_SECRET;
  const header = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  return verifyToken(parseCookies(header)[COOKIE_NAME], secret);
}

function sessionCookieHeader(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// Constant-time string comparison (avoids leaking the password via timing).
function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isEmail = (v) => typeof v === 'string' && EMAIL_RE.test(v.trim());

// --- Netlify Blobs ---------------------------------------------------------
// One store ("settings") holds two keys: "positions" (JSON) and
// "destinationEmail" (text). Strong consistency so admin edits read back
// immediately.
async function getSettingsStore() {
  const { getStore } = await import('@netlify/blobs');
  const options = { name: 'settings', consistency: 'strong' };
  // Some Netlify deploy contexts don't auto-inject the Blobs environment
  // (MissingBlobsEnvironmentError). If explicit credentials are provided,
  // use them; otherwise fall back to Netlify's automatic configuration.
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    options.siteID = siteID;
    options.token = token;
  }
  return getStore(options);
}

const defaultPositions = () => [
  { id: crypto.randomUUID(), title: 'Sprinter Technician', status: 'active' },
  { id: crypto.randomUUID(), title: 'Service Advisor', status: 'active' },
];

// Reads positions; seeds sensible defaults on first run if none exist.
async function readPositions(store) {
  let positions = await store.get('positions', { type: 'json' });
  if (!Array.isArray(positions)) {
    positions = defaultPositions();
    await store.setJSON('positions', positions);
  }
  return positions;
}

async function writePositions(store, positions) {
  await store.setJSON('positions', positions);
}

// Reads the raw stored destination value (may be a comma-separated list), or "".
async function readDestinationRaw(store) {
  const v = await store.get('destinationEmail', { type: 'text' });
  return v && v.trim() ? v.trim() : '';
}

// Resolves the destination, falling back to DEFAULT_TO_EMAIL env var.
async function readDestinationEmail(store) {
  return (await readDestinationRaw(store)) || (process.env.DEFAULT_TO_EMAIL || '').trim();
}

async function writeDestinationEmail(store, value) {
  await store.set('destinationEmail', value);
}

module.exports = {
  COOKIE_NAME,
  json,
  signSession,
  verifyToken,
  isAuthed,
  sessionCookieHeader,
  clearCookieHeader,
  timingSafeEqualStr,
  isEmail,
  getSettingsStore,
  readPositions,
  writePositions,
  readDestinationRaw,
  readDestinationEmail,
  writeDestinationEmail,
};
