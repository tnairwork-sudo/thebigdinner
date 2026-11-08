import { randomBytes } from 'node:crypto';
import { HttpError, ConflictError } from './errors.js';
import { indexMembers, loadMemberIndex } from './members.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { normalizeEmail, normalizeLoginId, sha256Hex, toE164, validEmail } from './phone.js';

export { HttpError };

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const CLAIM_MS = 1000 * 60 * 15;
const CITIES = ['Delhi', 'Bombay', 'Hyderabad', 'London', 'Dubai'];
const PRIVACY_KEYS = ['building', 'principle', 'proud'];

const acctKey = (id) => `acct/${id}`;
const phoneKey = (e164) => `phone/${e164.replace(/^\+/, '')}`;
const sessKey = (hash) => `sess/${hash}`;
const claimKey = (token) => `claim/${token}`;

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

function memberIndex(deps) {
  if (deps && deps.members) return indexMembers(deps.members);
  return loadMemberIndex();
}

function newToken() {
  return randomBytes(32).toString('hex');
}

async function openSession(store, loginId) {
  const token = newToken();
  await store.put(sessKey(sha256Hex(token)), { loginId, exp: Date.now() + SESSION_MS }, SESSION_SECONDS);
  return token;
}

function readIdentity(input) {
  const name = cleanName(input && input.name);
  if (name.length < 2) throw new HttpError(400, 'invalid_name');
  const loginId = normalizeLoginId(input && input.loginId);
  if (!loginId) throw new HttpError(400, 'invalid_login');
  const emailRaw = normalizeEmail(input && input.email);
  let email = '';
  if (emailRaw) {
    if (!validEmail(emailRaw)) throw new HttpError(400, 'invalid_email');
    email = emailRaw;
  }
  const phoneRaw = String((input && input.phone) || '').trim();
  if (!phoneRaw) throw new HttpError(400, 'invalid_phone');
  const phone = toE164(phoneRaw);
  if (!phone) throw new HttpError(400, 'invalid_phone');
  return { name, loginId, email, phone };
}

async function assertFree(store, loginId, phone) {
  if (await store.get(acctKey(loginId))) throw new HttpError(409, 'login_taken');
  const existing = await store.get(phoneKey(phone));
  if (existing) throw new HttpError(409, 'phone_taken');
}

/**
 * Match the phone against the attendance list. A match returns a short-lived claim
 * so the password step can create the account. No match creates nothing.
 */
export async function prepareClaim(input, deps) {
  const { store } = deps;
  const identity = readIdentity(input);
  const hit = memberIndex(deps).get(identity.phone);
  if (!hit) throw new HttpError(403, 'not_listed');
  await assertFree(store, identity.loginId, identity.phone);
  const token = newToken();
  await store.put(claimKey(token), {
    ...identity,
    city: hit.city || '',
    months: hit.months || [],
    listName: hit.listName || '',
    exp: Date.now() + CLAIM_MS,
  }, 15 * 60);
  return { body: { ok: true, claim: token } };
}

export async function registerWithClaim(input, deps) {
  const { store } = deps;
  const token = String((input && input.claim) || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'claim_required');
  const claim = await store.get(claimKey(token));
  if (!claim || !claim.exp || claim.exp < Date.now()) throw new HttpError(400, 'claim_required');
  const password = String((input && input.password) || '');
  const confirm = String((input && (input.password2 ?? input.confirm)) || '');
  if (password.length < 8 || password.length > 200) throw new HttpError(400, 'invalid_password');
  if (password !== confirm) throw new HttpError(400, 'password_mismatch');

  const hit = memberIndex(deps).get(claim.phone);
  if (!hit) throw new HttpError(403, 'not_listed');
  await assertFree(store, claim.loginId, claim.phone);

  const now = new Date().toISOString();
  const account = {
    loginId: claim.loginId,
    name: claim.name,
    email: claim.email || null,
    phone: claim.phone,
    passwordHash: await hashPassword(password),
    status: 'accepted',
    matchedBy: 'phone',
    listName: claim.listName || hit.listName || null,
    entry: {
      name: claim.name,
      city: claim.city || hit.city || '',
      months: Array.isArray(claim.months) ? claim.months : [],
    },
    profile: null,
    createdAt: now,
    acceptedAt: now,
  };

  try {
    await store.putNew(acctKey(account.loginId), account);
  } catch (err) {
    if (err instanceof ConflictError) throw new HttpError(409, 'login_taken');
    throw err;
  }
  try {
    await store.putNew(phoneKey(account.phone), account.loginId);
  } catch (err) {
    await store.del(acctKey(account.loginId));
    if (err instanceof ConflictError) throw new HttpError(409, 'phone_taken');
    throw err;
  }
  await store.del(claimKey(token));
  const session = await openSession(store, account.loginId);
  return { token: session, body: { ok: true, status: 'accepted', account: publicAccount(account) } };
}

export async function loginAccount(input, deps) {
  const { store } = deps;
  const loginId = normalizeLoginId(input && input.loginId);
  const password = String((input && input.password) || '');
  const account = loginId ? await store.get(acctKey(loginId)) : null;
  const hash = account && account.passwordHash ? account.passwordHash : await dummyPasswordHash();
  const matches = await verifyPassword(password, hash);
  if (!account || !matches) throw new HttpError(401, 'mismatch');
  if (account.status !== 'accepted' || !account.phone) throw new HttpError(403, 'inactive');
  const token = await openSession(store, account.loginId);
  return { token, body: { ok: true, account: publicAccount(account) } };
}

export async function accountFromToken(token, deps) {
  const { store } = deps;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = sessKey(sha256Hex(token));
  const session = await store.get(key);
  if (!session || !session.exp || session.exp < Date.now()) {
    if (session) await store.del(key);
    return null;
  }
  const account = await store.get(acctKey(session.loginId));
  if (!account || account.status !== 'accepted' || !account.phone) return null;
  return account;
}

export async function saveProfile(token, profile, deps) {
  const { store } = deps;
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
  const { store } = deps;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  await store.del(sessKey(sha256Hex(token)));
}
