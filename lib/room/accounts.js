import { randomBytes } from 'node:crypto';
import { EMAILS } from './emails.js';
import { PHONES } from './phones.js';
import { HttpError, ConflictError } from './errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { normalizeEmail, normalizeLoginId, sha256Hex, toE164, validEmail } from './phone.js';

export { HttpError };

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const CITIES = ['Delhi', 'Bombay', 'Hyderabad', 'London', 'Dubai'];
const PRIVACY_KEYS = ['building', 'principle', 'proud'];

const acctKey = (id) => `acct/${id}`;
const emailKey = (hash) => `email/${hash}`;
const phoneKey = (hash) => `phone/${hash}`;
const sessKey = (hash) => `sess/${hash}`;

let dummyHash = '';
async function dummyPasswordHash() {
  if (!dummyHash) dummyHash = await hashPassword('room-dummy-password-not-used');
  return dummyHash;
}

function cleanName(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function clip(value, max) {
  return String(value ?? '').slice(0, max);
}

export function publicAccount(account) {
  const entry = account.entry || {};
  return {
    loginId: account.loginId,
    name: account.name,
    status: account.status,
    entry: {
      name: entry.name || account.name,
      city: entry.city || '',
      months: Array.isArray(entry.months) ? entry.months : [],
    },
    profile: account.profile || null,
  };
}

export function sanitizeProfile(input, fallbackName) {
  const src = input && typeof input === 'object' ? input : {};
  const privacyIn = src.privacy && typeof src.privacy === 'object' ? src.privacy : {};
  const privacy = {};
  for (const key of PRIVACY_KEYS) privacy[key] = Boolean(privacyIn[key]);
  const months = Array.isArray(src.attendanceMonths)
    ? src.attendanceMonths.map((month) => clip(month, 40)).filter(Boolean).slice(0, 24)
    : [];
  const city = CITIES.includes(src.city) ? src.city : 'Delhi';
  return {
    id: 'me',
    name: clip(src.name || fallbackName || '', 80).trim(),
    role: clip(src.role, 120),
    city,
    area: clip(src.area, 80),
    tone: clip(src.tone || 'oxblood', 24),
    editions: Array.isArray(src.editions) ? src.editions.map((item) => clip(item, 24)).slice(0, 24) : [],
    visible: src.visible !== false,
    listed: src.listed !== false,
    attendanceMonths: months,
    privacy,
    building: clip(src.building, 500),
    principle: clip(src.principle, 500),
    proud: clip(src.proud, 500),
  };
}

function lists(deps) {
  return {
    store: deps.store,
    emails: deps.emails || EMAILS,
    phones: deps.phones || PHONES,
  };
}

function newToken() {
  return randomBytes(32).toString('hex');
}

async function openSession(store, loginId) {
  const token = newToken();
  await store.put(sessKey(sha256Hex(token)), { loginId, exp: Date.now() + SESSION_MS }, SESSION_SECONDS);
  return token;
}

export async function registerAccount(input, deps) {
  const { store, emails, phones } = lists(deps);
  const name = cleanName(input && input.name);
  if (name.length < 2) throw new HttpError(400, 'invalid_name');
  const loginId = normalizeLoginId(input && input.loginId);
  if (!loginId) throw new HttpError(400, 'invalid_login');
  const password = String((input && input.password) || '');
  const confirm = String((input && (input.password2 ?? input.confirm)) || '');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'invalid_password');
  if (password !== confirm) throw new HttpError(400, 'password_mismatch');

  const emailRaw = normalizeEmail(input && input.email);
  let email = '';
  if (emailRaw) {
    if (!validEmail(emailRaw)) throw new HttpError(400, 'invalid_email');
    email = emailRaw;
  }
  const phoneRaw = String((input && input.phone) || '').trim();
  let phoneHash = null;
  if (phoneRaw) {
    const e164 = toE164(phoneRaw);
    if (!e164) throw new HttpError(400, 'invalid_phone');
    phoneHash = sha256Hex(e164);
  }
  if (!email && !phoneHash) throw new HttpError(400, 'need_email_or_phone');

  const emailHash = email ? sha256Hex(email) : null;
  const emailHit = emailHash ? emails[emailHash] : null;
  const phoneHit = phoneHash ? phones[phoneHash] : null;

  if (await store.get(acctKey(loginId))) throw new HttpError(409, 'login_taken');
  if (emailHash && await store.get(emailKey(emailHash))) throw new HttpError(409, 'email_taken');
  if (phoneHash && await store.get(phoneKey(phoneHash))) throw new HttpError(409, 'phone_taken');

  const months = [];
  for (const hit of [emailHit, phoneHit]) {
    const list = hit && Array.isArray(hit.months) ? hit.months : [];
    for (const month of list) if (month && !months.includes(month)) months.push(month);
  }
  const city = (emailHit && emailHit.city) || (phoneHit && phoneHit.city) || '';
  const listName = (emailHit && emailHit.listName) || (phoneHit && phoneHit.name) || '';
  const accepted = Boolean(emailHit || phoneHit);
  const matchedBy = emailHit && phoneHit ? 'email+phone' : emailHit ? 'email' : phoneHit ? 'phone' : null;
  const now = new Date().toISOString();
  const account = {
    loginId,
    name,
    email: email || null,
    emailHash,
    phoneHash,
    passwordHash: await hashPassword(password),
    status: accepted ? 'accepted' : 'pending',
    matchedBy,
    listName: listName || null,
    entry: { name, city, months },
    profile: null,
    createdAt: now,
    acceptedAt: accepted ? now : null,
  };

  try {
    await store.putNew(acctKey(loginId), account);
  } catch (err) {
    if (err instanceof ConflictError) throw new HttpError(409, 'login_taken');
    throw err;
  }
  if (emailHash) {
    try {
      await store.putNew(emailKey(emailHash), loginId);
    } catch (err) {
      await store.del(acctKey(loginId));
      if (err instanceof ConflictError) throw new HttpError(409, 'email_taken');
      throw err;
    }
  }
  if (phoneHash) {
    try {
      await store.putNew(phoneKey(phoneHash), loginId);
    } catch (err) {
      if (emailHash) await store.del(emailKey(emailHash));
      await store.del(acctKey(loginId));
      if (err instanceof ConflictError) throw new HttpError(409, 'phone_taken');
      throw err;
    }
  }

  if (!accepted) return { token: null, body: { ok: true, status: 'pending', loginId } };
  const token = await openSession(store, loginId);
  return { token, body: { ok: true, status: 'accepted', account: publicAccount(account) } };
}

export async function loginAccount(input, deps) {
  const { store } = lists(deps);
  const loginId = normalizeLoginId(input && input.loginId);
  const password = String((input && input.password) || '');
  const account = loginId ? await store.get(acctKey(loginId)) : null;
  const hash = account && account.passwordHash ? account.passwordHash : await dummyPasswordHash();
  const matches = await verifyPassword(password, hash);
  if (!account || !matches) throw new HttpError(401, 'mismatch');
  if (account.status !== 'accepted') throw new HttpError(403, 'pending');
  const token = await openSession(store, account.loginId);
  return { token, body: { ok: true, account: publicAccount(account) } };
}

export async function accountFromToken(token, deps) {
  const { store } = lists(deps);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = sessKey(sha256Hex(token));
  const session = await store.get(key);
  if (!session || !session.exp || session.exp < Date.now()) {
    if (session) await store.del(key);
    return null;
  }
  const account = await store.get(acctKey(session.loginId));
  if (!account || account.status !== 'accepted') return null;
  return account;
}

export async function saveProfile(token, profile, deps) {
  const { store } = lists(deps);
  const account = await accountFromToken(token, deps);
  if (!account) throw new HttpError(401, 'mismatch');
  const clean = sanitizeProfile(profile, account.name);
  if (clean.name.trim().length < 2) throw new HttpError(400, 'invalid_name');
  account.profile = clean;
  account.name = clean.name;
  await store.put(acctKey(account.loginId), account);
  return publicAccount(account);
}

export async function logoutToken(token, deps) {
  const { store } = lists(deps);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  await store.del(sessKey(sha256Hex(token)));
}

export async function acceptAccount(input, deps) {
  const { store } = lists(deps);
  let loginId = normalizeLoginId(input && input.loginId);
  if (!loginId && input && input.email) {
    const email = normalizeEmail(input.email);
    if (!validEmail(email)) throw new HttpError(400, 'invalid_email');
    const found = await store.get(emailKey(sha256Hex(email)));
    if (!found || typeof found !== 'string') throw new HttpError(404, 'not_found');
    loginId = found;
  }
  if (!loginId) throw new HttpError(400, 'invalid_login');
  const account = await store.get(acctKey(loginId));
  if (!account) throw new HttpError(404, 'not_found');
  if (account.status !== 'accepted') {
    account.status = 'accepted';
    account.acceptedAt = new Date().toISOString();
    if (!account.matchedBy) account.matchedBy = 'manual';
    await store.put(acctKey(loginId), account);
  }
  return {
    ok: true,
    loginId: account.loginId,
    status: account.status,
    name: account.name,
    email: account.email,
    listName: account.listName,
  };
}
