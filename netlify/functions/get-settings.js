/* GET /.netlify/functions/get-settings  (ADMIN)
   Returns the current destination email (and whether it's still the env-var
   default rather than a saved value). */
const { json, isAuthed, getSettingsStore, readDestinationRaw } = require('../lib/shared');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed.' });
  if (!isAuthed(event)) return json(401, { error: 'Not authorized.' });
  try {
    const store = await getSettingsStore();
    const saved = await readDestinationRaw(store);
    const destinationEmail = saved || (process.env.DEFAULT_TO_EMAIL || '').trim();
    return json(200, { destinationEmail, usingDefault: !saved });
  } catch (err) {
    console.error('get-settings failed:', err);
    return json(500, { error: 'Could not load settings.' });
  }
};
