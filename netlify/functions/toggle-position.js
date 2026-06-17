/* POST /.netlify/functions/toggle-position  (ADMIN)
   Body: { id }  — flips a position between active and hidden. */
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

  const id = body.id;
  if (!id) return json(400, { error: 'Position id is required.' });

  try {
    const store = await getSettingsStore();
    const positions = await readPositions(store);
    const pos = positions.find((p) => p.id === id);
    if (!pos) return json(404, { error: 'Position not found.' });
    pos.status = pos.status === 'active' ? 'hidden' : 'active';
    await writePositions(store, positions);
    return json(200, { ok: true, positions });
  } catch (err) {
    console.error('toggle-position failed:', err);
    return json(500, { error: 'Could not update the position.' });
  }
};
