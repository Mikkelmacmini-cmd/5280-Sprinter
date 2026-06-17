/* POST /.netlify/functions/update-settings  (ADMIN)
   Body: { destinationEmail }  — one OR more addresses (comma/space separated).
   Validates each address, then saves them to Blobs. */
const { json, isAuthed, isEmail, getSettingsStore, writeDestinationEmail } = require('../lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!isAuthed(event)) return json(401, { error: 'Not authorized.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const raw = (body.destinationEmail || '').trim();
  const list = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);

  if (!list.length || !list.every(isEmail)) {
    return json(400, { error: 'Enter one or more valid email addresses, separated by commas.' });
  }

  try {
    const store = await getSettingsStore();
    const value = list.join(', ');
    await writeDestinationEmail(store, value);
    return json(200, { ok: true, destinationEmail: value });
  } catch (err) {
    console.error('update-settings failed:', err);
    return json(500, { error: 'Could not save the destination email.' });
  }
};
