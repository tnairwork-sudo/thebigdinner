/**
 * Activate a pending Room login after a Gmail acceptance.
 * There is no public admin page. Call this from a private shell.
 *
 *   POST /api/room/accept
 *   Authorization: Bearer $ROOM_ACCEPT_SECRET
 *   Content-Type: application/json
 *
 *   { "loginId": "their-id" }
 *   { "email": "the-address-they-typed@example.com" }
 *
 * ROOM_ACCEPT_SECRET must be set on the Vercel project (Preview and Production),
 * at least 16 characters. A missing or wrong secret does not activate anything.
 * The call is idempotent: an already accepted login stays accepted.
 *
 * 200 { ok, loginId, status, name, email, listName }
 * 401 unauthorized
 * 404 not_found
 * 503 accept_unconfigured
 */
import { acceptAccount, HttpError } from '../../lib/room/accounts.js';
import { readJson, send } from '../../lib/room/http.js';
import { checkSecret, secretFrom } from '../../lib/room/secret.js';
import { createStore } from '../../lib/room/store.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    const verdict = checkSecret(secretFrom(req));
    if (verdict === 'unconfigured') return send(res, 503, { error: 'accept_unconfigured' });
    if (verdict !== 'yes') return send(res, 401, { error: 'unauthorized' });
    const store = await createStore();
    if (!store) return send(res, 503, { error: 'store_unconfigured' });
    const body = await readJson(req);
    const result = await acceptAccount(body, { store });
    return send(res, 200, result);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.error });
    console.error('room accept', err && err.name);
    return send(res, 500, { error: 'generic' });
  }
}
