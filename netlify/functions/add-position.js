/* POST /.netlify/functions/add-position  (ADMIN)
   Body: { title }  — appends a new active position. */
const crypto = require('crypto');
const { json, isAuthed, getSettingsStore, readPositions, writePositions } = require('../lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!isAuthed(event)) return json(401, { error: 'Not authorized.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const title = (body.title || '').trim();
  if (!title) return json(400, { error: 'Position title is required.' });
  if (title.length > 80) return json(400, { error: 'That title is too long.' });

  try {
    const store = await getSettingsStore();
    const positions = await readPositions(store);
    if (positions.some((p) => p.title.toLowerCase() === title.toLowerCase())) {
      return json(409, { error: 'A position with that title already exists.' });
    }
    positions.push({ id: crypto.randomUUID(), title, status: 'active' });
    await writePositions(store, positions);
    return json(200, { ok: true, positions });
  } catch (err) {
    console.error('add-position failed:', err);
    return json(500, { error: 'Could not add the position.' });
  }
};
