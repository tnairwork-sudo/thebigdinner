import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'room_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function secureFlag(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return Boolean(process.env.VERCEL);
}

export function sessionCookie(token, req) {
  const secure = secureFlag(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
}

export function clearSessionCookie(req) {
  const secure = secureFlag(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return '';
}

export function send(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value == null) continue;
    res.setHeader(key, value);
  }
  res.end(body);
}

export function respond(res, status, body, req, store, cookies) {
  const list = [];
  if (Array.isArray(cookies)) list.push(...cookies.filter(Boolean));
  else if (cookies) list.push(cookies);
  if (store && typeof store.commit === 'function') {
    try {
      const vault = store.commit(req);
      if (vault) list.push(vault);
    } catch {
      return send(res, 503, { error: 'store_unconfigured' });
    }
  }
  const payload = process.env.VERCEL_ENV === 'preview' ? { preview: true, ...body } : body;
  const headers = {};
  if (list.length === 1) headers['Set-Cookie'] = list[0];
  else if (list.length > 1) headers['Set-Cookie'] = list;
  return send(res, status, payload, headers);
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = '';
  if (typeof req.body === 'string') raw = req.body;
  else {
    const chunks = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (!raw) return {};
  if (raw.length > 20000) throw new HttpError(413, 'too_large');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  try {
    return new URL(String(origin)).host === host;
  } catch {
    return false;
  }
}
