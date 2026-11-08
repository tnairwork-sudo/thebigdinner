import { timingSafeEqual } from 'node:crypto';

/** Used only by the local dev server. Rejected when VERCEL is set. */
export const LOCAL_DEV_SECRET = 'local-dev-only-secret-not-for-vercel';

export function secretFrom(req) {
  const direct = req.headers['x-room-accept-secret'];
  if (direct) return String(Array.isArray(direct) ? direct[0] : direct).trim();
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : '';
}

/** 'yes' | 'no' | 'unconfigured' */
export function checkSecret(presented) {
  const expected = process.env.ROOM_ACCEPT_SECRET || '';
  if (expected.length < 16) return 'unconfigured';
  if (process.env.VERCEL && expected === LOCAL_DEV_SECRET) return 'unconfigured';
  const got = String(presented || '').slice(0, 256);
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return 'no';
  }
  return timingSafeEqual(a, b) ? 'yes' : 'no';
}
