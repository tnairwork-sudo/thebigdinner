import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import acceptHandler from '../../api/room/accept.js';
import loginHandler from '../../api/room/login.js';
import logoutHandler from '../../api/room/logout.js';
import profileHandler from '../../api/room/profile.js';
import registerHandler from '../../api/room/register.js';
import sessionHandler from '../../api/room/session.js';
import { acceptAccount, loginAccount, registerAccount } from './accounts.js';
import { EMAIL_COUNT, EMAILS } from './emails.js';
import { PHONE_COUNT, PHONES } from './phones.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { normalizeLoginId, sha256Hex, toE164, validEmail } from './phone.js';
import { LOCAL_DEV_SECRET } from './secret.js';
import { createFileStore, createStore } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function mockReq({ method = 'POST', body, headers = {} } = {}) {
  const raw = body == null ? '' : JSON.stringify(body);
  const stream = Readable.from([Buffer.from(raw)]);
  stream.method = method;
  stream.headers = { host: '127.0.0.1:4173', ...headers };
  return stream;
}

function mockRes() {
  const headers = {};
  let body = '';
  return {
    statusCode: 200,
    setHeader(key, value) { headers[String(key).toLowerCase()] = value; },
    end(chunk) { body = chunk == null ? '' : String(chunk); },
    json() { return JSON.parse(body || 'null'); },
    headers,
  };
}

function cookieOf(res) {
  const raw = String(res.headers['set-cookie'] || '');
  const match = raw.match(/room_session=([a-f0-9]{64})/);
  return match ? match[1] : '';
}

test('phone and login id rules match the old field', () => {
  assert.equal(toE164('9876543210'), '+919876543210');
  assert.equal(toE164('09876543210'), '+919876543210');
  assert.equal(toE164('919876543210'), '+919876543210');
  assert.equal(toE164('+44 7700 900123'), '+447700900123');
  assert.equal(toE164('123'), null);
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(normalizeLoginId('  Nair.Sahani '), 'nair.sahani');
  assert.equal(normalizeLoginId('ab'), '');
  assert.equal(normalizeLoginId('has space'), '');
  assert.equal(validEmail('person@example.com'), true);
  assert.equal(validEmail('not-an-email'), false);
});

test('passwords are scrypt hashes', async () => {
  const stored = await hashPassword('a-long-password');
  assert.equal(stored.startsWith('scrypt$'), true);
  assert.equal(stored.includes('a-long-password'), false);
  assert.equal(await verifyPassword('a-long-password', stored), true);
  assert.equal(await verifyPassword('other-password', stored), false);
});

test('allowlists are hashed and the client copy is gone', async () => {
  assert.equal(EMAIL_COUNT, 155);
  assert.equal(Object.keys(EMAILS).length, 155);
  assert.equal(PHONE_COUNT, 447);
  assert.equal(PHONES['6c6b4affa95a45d143544d836d26996ebea85ff81378c8f50504305c4ca7f659'].name, 'Abhishek Gupta');
  assert.equal(EMAILS[sha256Hex('nobody-not-listed@example.com')], undefined);
  const emailSrc = await fs.readFile(new URL('./emails.js', import.meta.url), 'utf8');
  assert.equal(/[^\s"@]+@[^\s"@]+\.[^\s"@]+/.test(emailSrc), false);
  const html = await fs.readFile(path.join(root, 'c27b141aa0bbb112ebe5405b/index.html'), 'utf8');
  const visible = html.split('\n').filter((line) => !line.includes('base64')).join('\n');
  assert.equal(/otp|sms|one-time|six digit|lookupAllowlist|ALLOWLIST/i.test(visible), false);
  assert.equal(visible.includes('6c6b4affa95a45d143544d836d26996ebea85ff81378c8f50504305c4ca7f659'), false);
  const login = visible.slice(visible.indexOf('const ROOM_ERRORS'), visible.indexOf('function Welcome('));
  for (const word of ['table', 'apply', 'founders', 'seated', 'seat', 'sms', 'otp', 'price', 'prices']) {
    assert.equal(new RegExp(`\\b${word}\\b`, 'i').test(login), false, word);
  }
  assert.equal(/five star|the taj|bombay is open|one-time|six digit/i.test(login), false);
  assert.equal(login.includes('Architected by'), true);
  assert.equal(login.includes('data-testid="credit-login"'), true);
  assert.equal(login.includes('cursor: url'), false);
});

test('request, pending, accept, sign in, and profile survive in the file store', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'room-'));
  const snapshot = {
    ROOM_DATA_DIR: process.env.ROOM_DATA_DIR,
    ROOM_ACCEPT_SECRET: process.env.ROOM_ACCEPT_SECRET,
    VERCEL: process.env.VERCEL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  const restore = () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  };
  process.env.ROOM_DATA_DIR = dir;
  process.env.ROOM_ACCEPT_SECRET = 'test-secret-value-123456';
  delete process.env.VERCEL;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const store = await createStore();
    assert.equal(store.kind, 'file');

    const email = 'guest@example.com';
    const opened = await registerAccount({
      name: 'Guest One',
      email,
      loginId: 'guest.one',
      password: 'correct-horse',
      password2: 'correct-horse',
    }, {
      store: createFileStore(dir),
      emails: { [sha256Hex(email)]: { city: 'Delhi', months: ['31 Oct 2026'], listName: 'Guest' } },
      phones: {},
    });
    assert.equal(opened.body.status, 'accepted');
    assert.equal(opened.body.account.entry.city, 'Delhi');
    assert.equal(opened.body.account.email, undefined);
    const saved = await fs.readFile(path.join(dir, 'acct', 'guest.one.json'), 'utf8');
    assert.equal(saved.includes('correct-horse'), false);
    assert.match(saved, /scrypt\$16384\$/);

    const phone = '9876543210';
    const phoneHash = sha256Hex(toE164(phone));
    const byPhone = await registerAccount({
      name: 'Phone Guest',
      loginId: 'phoneguest',
      password: 'another-password',
      password2: 'another-password',
      phone,
    }, {
      store: createFileStore(dir),
      emails: {},
      phones: { [phoneHash]: { name: 'Phone Guest', city: 'Hyderabad', months: ['20 Jun 2026'] } },
    });
    assert.equal(byPhone.body.status, 'accepted');
    assert.equal(byPhone.body.account.entry.city, 'Hyderabad');
    const phoneFile = await fs.readFile(path.join(dir, 'acct', 'phoneguest.json'), 'utf8');
    assert.equal(phoneFile.includes('9876543210'), false);
    assert.equal(phoneFile.includes('+919876543210'), false);
    assert.match(phoneFile, new RegExp(phoneHash));

    let res = mockRes();
    await registerHandler(mockReq({
      body: {
        name: 'Pending Person',
        email: 'nobody-pending@example.com',
        loginId: 'pending.person',
        password: 'pending-password',
        password2: 'pending-password',
      },
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'pending');
    assert.equal(cookieOf(res), '');

    res = mockRes();
    await loginHandler(mockReq({ body: { loginId: 'pending.person', password: 'pending-password' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, 'pending');

    res = mockRes();
    await loginHandler(mockReq({ body: { loginId: 'pending.person', password: 'wrong-password-here' } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error, 'mismatch');

    res = mockRes();
    await acceptHandler(mockReq({
      body: { loginId: 'pending.person' },
      headers: { authorization: 'Bearer nope-not-the-secret' },
    }), res);
    assert.equal(res.statusCode, 401);

    res = mockRes();
    await acceptHandler(mockReq({
      body: { email: 'Nobody-Pending@example.com' },
      headers: { authorization: 'Bearer test-secret-value-123456' },
    }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(
      { loginId: res.json().loginId, status: res.json().status, email: res.json().email },
      { loginId: 'pending.person', status: 'accepted', email: 'nobody-pending@example.com' },
    );

    res = mockRes();
    await loginHandler(mockReq({ body: { loginId: 'Pending.Person', password: 'pending-password' } }), res);
    assert.equal(res.statusCode, 200);
    const token = cookieOf(res);
    assert.equal(token.length, 64);
    assert.equal(JSON.stringify(res.json()).includes('passwordHash'), false);
    assert.equal(JSON.stringify(res.json()).includes('scrypt'), false);

    const second = mockRes();
    await loginHandler(mockReq({ body: { loginId: 'pending.person', password: 'pending-password' } }), second);
    const token2 = cookieOf(second);
    assert.notEqual(token2, token);

    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: `room_session=${token}` } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().account.status, 'accepted');
    assert.equal(res.json().account.profile, null);

    res = mockRes();
    await profileHandler(mockReq({
      headers: { cookie: `room_session=${token}` },
      body: {
        profile: {
          name: 'Pending Person',
          city: 'London',
          area: 'Mayfair',
          role: 'Host',
          tone: 'oxblood',
          building: 'A quiet practice',
          principle: 'Stay for the evening',
          proud: 'The night itself',
          privacy: { building: true, principle: false, proud: true },
          password: 'should-not-stick',
        },
      },
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().account.profile.city, 'London');
    assert.equal(res.json().account.profile.password, undefined);

    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: `room_session=${token}` } }), res);
    assert.equal(res.json().account.profile.name, 'Pending Person');
    assert.equal(res.json().account.profile.city, 'London');

    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: `room_session=${token2}` } }), res);
    assert.equal(res.statusCode, 200);

    res = mockRes();
    await logoutHandler(mockReq({ headers: { cookie: `room_session=${token}` } }), res);
    assert.equal(res.statusCode, 200);
    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: `room_session=${token}` } }), res);
    assert.equal(res.statusCode, 401);
    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: `room_session=${token2}` } }), res);
    assert.equal(res.statusCode, 200);

    res = mockRes();
    await registerHandler(mockReq({
      body: {
        name: 'Pending Person',
        email: 'other@example.com',
        loginId: 'pending.person',
        password: 'pending-password',
        password2: 'pending-password',
      },
    }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'login_taken');

    res = mockRes();
    await registerHandler(mockReq({
      body: { name: 'A', email: 'short@example.com', loginId: 'ab', password: 'short', password2: 'short' },
    }), res);
    assert.equal(res.statusCode, 400);

    res = mockRes();
    await registerHandler(mockReq({
      headers: { origin: 'https://evil.example' },
      body: {
        name: 'Other Person',
        email: 'other@example.com',
        loginId: 'other.person',
        password: 'pending-password',
        password2: 'pending-password',
      },
    }), res);
    assert.equal(res.statusCode, 403);

    process.env.VERCEL = '1';
    res = mockRes();
    await registerHandler(mockReq({
      body: {
        name: 'Other Person',
        email: 'other@example.com',
        loginId: 'other.person',
        password: 'pending-password',
        password2: 'pending-password',
      },
    }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error, 'store_unconfigured');

    process.env.ROOM_ACCEPT_SECRET = LOCAL_DEV_SECRET;
    res = mockRes();
    await acceptHandler(mockReq({
      body: { loginId: 'pending.person' },
      headers: { authorization: `Bearer ${LOCAL_DEV_SECRET}` },
    }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error, 'accept_unconfigured');

    const again = await loginAccount(
      { loginId: 'guest.one', password: 'correct-horse' },
      { store: createFileStore(dir) },
    );
    assert.equal(again.body.account.loginId, 'guest.one');
    const acceptedAgain = await acceptAccount({ loginId: 'guest.one' }, { store: createFileStore(dir) });
    assert.equal(acceptedAgain.status, 'accepted');
  } finally {
    restore();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
