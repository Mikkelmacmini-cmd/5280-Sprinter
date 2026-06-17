/* POST /.netlify/functions/apply
   Accepts multipart/form-data (resume is a file), validates everything, then
   emails the application (with the resume attached) to the configured
   destination via Resend. */
const multipart = require('parse-multipart-data');
const {
  json,
  getSettingsStore,
  readPositions,
  readDestinationEmail,
} = require('../lib/shared');

const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB — Netlify's effective payload ceiling
const ALLOWED_EXT = { pdf: true, doc: true, docx: true };
const HONEYPOT_FIELD = 'company'; // must stay empty for real humans

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  // --- Parse the multipart body --------------------------------------------
  const contentType =
    (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || '';
  if (!contentType.includes('multipart/form-data')) {
    return json(400, { error: 'Expected multipart/form-data.' });
  }
  const boundary = multipart.getBoundary(contentType);
  if (!boundary) return json(400, { error: 'Malformed form submission.' });

  const bodyBuffer = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');

  let parts;
  try {
    parts = multipart.parse(bodyBuffer, boundary);
  } catch {
    return json(400, { error: 'Could not read the submitted form.' });
  }

  const fields = {};
  let resume = null;
  for (const part of parts) {
    if (part.filename) {
      if (part.name === 'resume') resume = part; // { filename, type, data: Buffer, name }
    } else {
      fields[part.name] = (part.data ? part.data.toString('utf8') : '').trim();
    }
  }

  // --- Honeypot: silently accept and drop suspected bots --------------------
  if (fields[HONEYPOT_FIELD]) return json(200, { ok: true });

  // --- Required-field validation -------------------------------------------
  const fullName = fields.fullName || '';
  const email = fields.email || '';
  const phone = fields.phone || '';
  const position = fields.position || '';
  const fieldErrors = {};

  if (!fullName) fieldErrors.fullName = 'Please enter your name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = 'Please enter a valid email address.';
  if (phone.replace(/\D/g, '').length < 10) fieldErrors.phone = 'Please enter a valid phone number.';
  if (!position) fieldErrors.position = 'Please choose a position.';
  if (!resume || !resume.data || !resume.data.length) fieldErrors.resume = 'Please attach your resume.';

  if (Object.keys(fieldErrors).length) {
    return json(400, { error: 'Please fix the highlighted fields.', fields: fieldErrors });
  }

  // --- Storage + validate the position is currently active ------------------
  let store;
  try {
    store = await getSettingsStore();
  } catch {
    return json(500, { error: 'Server storage is unavailable. Please try again shortly.' });
  }

  const positions = await readPositions(store);
  const activeTitles = positions.filter((p) => p.status === 'active').map((p) => p.title);
  if (!activeTitles.includes(position)) {
    return json(400, { error: 'That position is no longer available. Please refresh the page and choose again.' });
  }

  // --- Validate the resume file type + size --------------------------------
  const ext = (resume.filename.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT[ext]) {
    return json(400, { error: 'Your resume must be a PDF, DOC, or DOCX file.' });
  }
  if (resume.data.length > MAX_FILE_BYTES) {
    return json(413, { error: 'That file is too large — please upload a resume under 4MB.' });
  }

  // --- Resolve recipients + email config -----------------------------------
  const destination = await readDestinationEmail(store); // may be a comma-separated list
  if (!destination) return json(500, { error: 'No destination email is configured.' });

  const toList = destination.split(',').map((s) => s.trim()).filter(Boolean);
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!fromEmail || !apiKey) return json(500, { error: 'Email service is not configured.' });

  // --- Build + send the email via Resend -----------------------------------
  const consent = fields.consent ? 'Yes' : 'No';
  const html = `
    <h2 style="font-family:Arial,sans-serif">New 5280 Sprinter application</h2>
    <table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(fullName)}</td></tr>
      <tr><td><strong>Position</strong></td><td>${escapeHtml(position)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(phone)}</td></tr>
      <tr><td><strong>Consent to texts/calls</strong></td><td>${consent}</td></tr>
    </table>
    <p style="color:#666;font-family:Arial,sans-serif;font-size:12px">Resume attached: ${escapeHtml(resume.filename)}</p>`;
  const text =
    `New 5280 Sprinter application\n\n` +
    `Name: ${fullName}\nPosition: ${position}\nEmail: ${email}\nPhone: ${phone}\n` +
    `Consent to texts/calls: ${consent}\nResume: ${resume.filename}`;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toList,
      reply_to: email,
      subject: `New 5280 Sprinter application: ${fullName} — ${position}`,
      html,
      text,
      attachments: [{ filename: resume.filename, content: resume.data.toString('base64') }],
    });
    if (error) {
      console.error('Resend error:', error);
      return json(502, { error: 'We could not send your application. Please try again, or call (720) 807-3353.' });
    }
  } catch (err) {
    console.error('Email send failed:', err);
    return json(502, { error: 'We could not send your application. Please try again, or call (720) 807-3353.' });
  }

  return json(200, { ok: true });
};
