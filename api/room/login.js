import { HttpError, loginAccount } from '../../lib/room/accounts.js';
import { originAllowed, readJson, send, sessionCookie } from '../../lib/room/http.js';
import { createStore } from '../../lib/room/store.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (!originAllowed(req)) return send(res, 403, { error: 'forbidden' });
    const store = await createStore();
    if (!store) return send(res, 503, { error: 'store_unconfigured' });
    const body = await readJson(req);
    const result = await loginAccount(body, { store });
    return send(res, 200, result.body, { 'Set-Cookie': sessionCookie(result.token, req) });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.error });
    console.error('room login', err && err.name);
    return send(res, 500, { error: 'generic' });
  }
}
