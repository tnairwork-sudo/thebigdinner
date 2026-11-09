import { HttpError, saveProfile } from '../../lib/room/accounts.js';
import { originAllowed, readCookie, readJson, respond, send, SESSION_COOKIE } from '../../lib/room/http.js';
import { createStore } from '../../lib/room/store.js';

export default async function handler(req, res) {
  let store = null;
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!originAllowed(req)) return send(res, 403, { error: 'forbidden' });
    store = await createStore(req);
    if (!store) return send(res, 503, { error: 'store_unconfigured' });
    const body = await readJson(req);
    const account = await saveProfile(readCookie(req, SESSION_COOKIE), body && body.profile, { store });
    return respond(res, 200, { ok: true, account }, req, store);
  } catch (err) {
    if (err instanceof HttpError) return respond(res, err.status, { error: err.error }, req, store);
    console.error('room profile', err && err.name);
    return send(res, 500, { error: 'generic' });
  }
}
