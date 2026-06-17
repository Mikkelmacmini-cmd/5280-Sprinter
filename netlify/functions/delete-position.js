/* POST /.netlify/functions/delete-position  (ADMIN)
   Body: { id }  — permanently removes a position from storage. */
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
    const next = positions.filter((p) => p.id !== id);
    if (next.length === positions.length) return json(404, { error: 'Position not found.' });
    await writePositions(store, next);
    return json(200, { ok: true, positions: next });
  } catch (err) {
    console.error('delete-position failed:', err);
    return json(500, { error: 'Could not delete the position.' });
  }
};
