/* GET /.netlify/functions/list-positions  (ADMIN)
   Returns ALL positions (active + hidden) for the admin manager. */
const { json, isAuthed, getSettingsStore, readPositions } = require('../lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (!isAuthed(event)) return json(401, { error: 'Not authorized.' });
  try {
    const store = await getSettingsStore();
    const positions = await readPositions(store);
    return json(200, { positions });
  } catch (err) {
    console.error('list-positions failed:', err);
    return json(500, { error: 'Could not load positions.' });
  }
};
