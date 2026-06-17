/* GET /.netlify/functions/get-positions  (PUBLIC)
   Returns only the active positions, for the dropdown on the landing page. */
const { json, getSettingsStore, readPositions } = require('../lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });
  try {
    const store = await getSettingsStore();
    const positions = await readPositions(store);
    const active = positions
      .filter((p) => p.status === 'active')
      .map((p) => ({ id: p.id, title: p.title }));
    return json(200, { positions: active });
  } catch (err) {
    console.error('get-positions failed:', err);
    return json(500, { error: 'Could not load positions.' });
  }
};
