import { accountFromToken, HttpError, publicAccount } from '../../lib/room/accounts.js';
import { readCookie, send, SESSION_COOKIE } from '../../lib/room/http.js';
import { createStore } from '../../lib/room/store.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' });
    const store = await createStore();
    if (!store) return send(res, 503, { error: 'store_unconfigured' });
    const account = await accountFromToken(readCookie(req, SESSION_COOKIE), { store });
    if (!account) return send(res, 401, { ok: false });
    return send(res, 200, { ok: true, account: publicAccount(account) });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.error });
    console.error('room session', err && err.name);
    return send(res, 500, { error: 'generic' });
  }
}
