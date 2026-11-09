import { accountFromToken, HttpError, publicAccount } from '../../lib/room/accounts.js';
import { readCookie, respond, send, SESSION_COOKIE } from '../../lib/room/http.js';
import { createStore } from '../../lib/room/store.js';

export default async function handler(req, res) {
  let store = null;
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' });
    store = await createStore(req);
    if (!store) return send(res, 503, { error: 'store_unconfigured' });
    const account = await accountFromToken(readCookie(req, SESSION_COOKIE), { store });
    if (!account) return respond(res, 401, { ok: false }, req, store);
    return respond(res, 200, { ok: true, account: publicAccount(account) }, req, store);
  } catch (err) {
    if (err instanceof HttpError) return respond(res, err.status, { error: err.error }, req, store);
    console.error('room session', err && err.name);
    return send(res, 500, { error: 'generic' });
  }
}
