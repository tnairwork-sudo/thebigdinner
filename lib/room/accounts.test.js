import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import checkHandler from '../../api/room/check.js';
import loginHandler from '../../api/room/login.js';
import logoutHandler from '../../api/room/logout.js';
import registerHandler from '../../api/room/register.js';
import sessionHandler from '../../api/room/session.js';
import { loginAccount, prepareClaim, registerWithClaim } from './accounts.js';
import { indexMembers, parseMembersCsv, SAMPLE_MEMBERS } from './members.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { PREVIEW_DEMO_PASSWORD_HASH, previewDemoAccount } from './preview-demo.js';
import { normalizeLoginId, sha256Hex, toE164, validEmail } from './phone.js';
import { createFileStore, createStore } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SAMPLE = [
  { name: 'A. Sample', phone: '+91 90000 00001', city: 'Delhi', month: '1 Jan 2026' },
  { name: 'A. Sample', phone: '919000000001', city: 'Delhi', month: '3 Mar 2026' },
  { name: 'B. Sample', phone: '+44 7000 000002', city: 'London', month: '2 Feb 2026' },
];

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

test('phone rules still fold country code, trunk zero, spaces, and dashes', () => {
  assert.equal(toE164('9000000001'), '+919000000001');
  assert.equal(toE164('09000000001'), '+919000000001');
  assert.equal(toE164('919000000001'), '+919000000001');
  assert.equal(toE164('+91 90000 00001'), '+919000000001');
  assert.equal(toE164('+91-90000-00001'), '+919000000001');
  assert.equal(toE164('+44 7000 000002'), '+447000000002');
  assert.equal(toE164('123'), null);
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(normalizeLoginId('  Nair.Sahani '), 'nair.sahani');
  assert.equal(normalizeLoginId('Tushar Nair'), 'tushar nair');
  assert.equal(validEmail('person@example.com'), true);
});

test('passwords are scrypt hashes', async () => {
  const stored = await hashPassword('a-long-password');
  assert.equal(stored.startsWith('scrypt$'), true);
  assert.equal(stored.includes('a-long-password'), false);
  assert.equal(await verifyPassword('a-long-password', stored), true);
  assert.equal(await verifyPassword('other-password', stored), false);
});

test('committed allowlist is the fictional sample only', async () => {
  const sample = await fs.readFile(path.join(root, 'lib/room/members.js'), 'utf8');
  assert.match(sample, /FICTIONAL preview sample/);
  assert.equal(SAMPLE_MEMBERS.length, 2);
  assert.equal(toE164(SAMPLE_MEMBERS[0].phone), '+919000000001');
  await assert.rejects(fs.access(path.join(root, 'lib/room/phones.js')));
  await assert.rejects(fs.access(path.join(root, 'lib/room/emails.js')));
  await assert.rejects(fs.access(path.join(root, 'api/room/accept.js')));
  const html = await fs.readFile(path.join(root, 'c27b141aa0bbb112ebe5405b/index.html'), 'utf8');
  const visible = html.split('\n').filter((line) => !line.includes('base64')).join('\n');
  const login = visible.slice(visible.indexOf('const ROOM_ERRORS'), visible.indexOf('function Welcome('));
  for (const word of ['table', 'apply', 'founders', 'seated', 'seat', 'sms', 'otp', 'price', 'prices']) {
    assert.equal(new RegExp(`\\b${word}\\b`, 'i').test(login), false, word);
  }
  assert.equal(/[—–]/.test(login), false);
  assert.equal(/five star|the taj|one-time|six digit/i.test(login), false);
  assert.equal(login.includes('data-testid="request-password"'), true);
  assert.equal(login.includes('not_listed'), true);
  const upload = '/home/ubuntu/.cursor/projects/agent-repos-thebigdinner/uploads/allowlist_for_app_3a92.csv';
  try {
    const csv = await fs.readFile(upload, 'utf8');
    const tracked = [
      sample,
      login,
      await fs.readFile(path.join(root, 'lib/room/accounts.js'), 'utf8'),
    ].join('\n');
    const phones = new Set();
    for (const line of csv.split('\n').slice(1)) {
      const phone = (line.split(',')[1] || '').replace(/\D/g, '');
      if (phone.length >= 10) phones.add(phone);
    }
    for (const phone of phones) {
      assert.equal(tracked.includes(phone), false);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
});

test('a listed phone can set a password, and any other phone cannot', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'room-'));
  const snapshot = {
    ROOM_DATA_DIR: process.env.ROOM_DATA_DIR,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID,
    KV_REST_API_URL: process.env.KV_REST_API_URL,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    MEMBERS_CSV_PATH: process.env.MEMBERS_CSV_PATH,
    MEMBERS_CSV_DIR: process.env.MEMBERS_CSV_DIR,
  };
  const restore = () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  };
  process.env.ROOM_DATA_DIR = dir;
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.MEMBERS_CSV_PATH;
  delete process.env.MEMBERS_CSV_DIR;

  try {
    const csv = [
      'name,phone,city,month,group',
      'C. Sample,+91 90000 00003,Hyderabad,4 Apr 2026,FICTION',
      'C. Sample,09000000003,Hyderabad,5 May 2026,FICTION',
    ].join('\n');
    const parsed = parseMembersCsv(csv);
    const indexed = indexMembers(parsed);
    assert.equal(indexed.get('+919000000003').months.length, 2);
    assert.equal(indexed.has('+919000000099'), false);

    let res = mockRes();
    await checkHandler(mockReq({
      body: { name: 'Nobody', email: 'nobody@example.com', loginId: 'nobody', phone: '9000000099' },
    }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, 'not_listed');
    assert.equal(res.json().claim, undefined);
    const accounts = await fs.readdir(path.join(dir, 'acct')).catch(() => []);
    assert.equal(accounts.length, 0);

    res = mockRes();
    await registerHandler(mockReq({
      body: { password: 'sample-password', password2: 'sample-password' },
    }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, 'claim_required');

    res = mockRes();
    await checkHandler(mockReq({
      body: {
        name: 'Preview Guest',
        email: 'preview@example.com',
        loginId: 'sampleguest',
        phone: '09000000001',
      },
    }), res);
    assert.equal(res.statusCode, 200);
    const claim = res.json().claim;
    assert.equal(typeof claim, 'string');
    assert.equal(res.json().name, undefined);
    assert.equal(JSON.stringify(res.json()).includes('9000000001'), false);

    res = mockRes();
    await registerHandler(mockReq({
      body: { claim, password: 'sample-password', password2: 'sample-password' },
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().account.loginId, 'sampleguest');
    assert.equal(res.json().account.entry.city, 'Delhi');
    assert.equal(res.json().account.phone, undefined);
    const saved = await fs.readFile(path.join(dir, 'acct', 'sampleguest.json'), 'utf8');
    assert.equal(saved.includes('sample-password'), false);
    assert.match(saved, /scrypt\$/);
    assert.match(saved, /\+919000000001/);

    res = mockRes();
    await checkHandler(mockReq({
      body: { name: 'Second', email: '', loginId: 'secondguest', phone: '+91-90000-00001' },
    }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.json().error, 'phone_taken');

    res = mockRes();
    await loginHandler(mockReq({ body: { loginId: 'sampleguest', password: 'sample-password' } }), res);
    assert.equal(res.statusCode, 200);
    const token = (res.headers['set-cookie'] || '').match(/room_session=([a-f0-9]{64})/)[1];
    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: `room_session=${token}` } }), res);
    assert.equal(res.json().account.loginId, 'sampleguest');
    assert.equal(JSON.stringify(res.json()).includes('+919000000001'), false);

    const direct = await prepareClaim({
      name: 'London Sample',
      loginId: 'londonsample',
      phone: '447000000002',
    }, { store: createFileStore(dir), members: SAMPLE });
    const created = await registerWithClaim({
      claim: direct.body.claim,
      password: 'london-password',
      password2: 'london-password',
    }, { store: createFileStore(dir), members: SAMPLE });
    assert.equal(created.body.account.entry.city, 'London');
    const again = await loginAccount(
      { loginId: 'londonsample', password: 'london-password' },
      { store: createFileStore(dir) },
    );
    assert.equal(again.body.account.loginId, 'londonsample');

    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';
    res = mockRes();
    await checkHandler(mockReq({
      body: { name: 'Preview Guest', loginId: 'another', phone: '9000000001' },
    }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error, 'store_unconfigured');
    assert.equal(res.json().preview, undefined);
  } finally {
    restore();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('preview demo account signs in from the signed cookie and stays out of production', async () => {
  const keys = ['VERCEL', 'VERCEL_ENV', 'ROOM_DATA_DIR', 'BLOB_READ_WRITE_TOKEN', 'BLOB_STORE_ID', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'PREVIEW_DEMO_LOGIN_ID', 'PREVIEW_DEMO_PASSWORD'];
  const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const restore = () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  };
  const jar = {};
  const cookieHeader = () => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; ');
  const absorb = (res) => {
    const raw = res.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const item of list) {
      const pair = String(item).split(';')[0];
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1);
      if (!value) delete jar[name];
      else jar[name] = value;
    }
  };
  process.env.VERCEL = '1';
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_DEMO_LOGIN_ID = 'Tushar Nair';
  process.env.PREVIEW_DEMO_PASSWORD = 'preview-demo-pass-1';
  for (const key of keys) {
    if (key === 'VERCEL' || key === 'VERCEL_ENV' || key.startsWith('PREVIEW_DEMO_')) continue;
    delete process.env[key];
  }
  try {
    let res = mockRes();
    await checkHandler(mockReq({
      body: { name: 'Nobody', email: 'nobody@example.com', loginId: 'nobody', phone: '9000000099' },
    }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, 'not_listed');
    assert.equal(res.json().preview, true);

    res = mockRes();
    await checkHandler(mockReq({
      headers: { cookie: cookieHeader() },
      body: { name: 'Preview Guest', email: 'preview@example.com', loginId: 'sampleguest', phone: '90000 00001' },
    }), res);
    assert.equal(res.statusCode, 200);
    absorb(res);
    const claim = res.json().claim;
    res = mockRes();
    await registerHandler(mockReq({
      headers: { cookie: cookieHeader() },
      body: { claim, password: 'sample-password', password2: 'sample-password' },
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().account.loginId, 'sampleguest');
    absorb(res);
    assert.equal(String(jar.room_preview_vault || '').includes('sample-password'), false);

    res = mockRes();
    await loginHandler(mockReq({
      headers: { cookie: cookieHeader() },
      body: { loginId: 'Tushar Nair', password: 'preview-demo-pass-1' },
    }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().account.profile.name, 'Tushar Nair');
    assert.equal(res.json().account.phone, undefined);
    absorb(res);
    assert.equal(String(jar.room_preview_vault).includes('preview-demo-pass-1'), false);

    res = mockRes();
    await logoutHandler(mockReq({ headers: { cookie: cookieHeader() } }), res);
    assert.equal(res.statusCode, 200);
    absorb(res);
    assert.equal(jar.room_session, undefined);

    res = mockRes();
    await loginHandler(mockReq({
      headers: { cookie: cookieHeader() },
      body: { loginId: 'Tushar Nair', password: 'preview-demo-pass-1' },
    }), res);
    assert.equal(res.statusCode, 200);
    absorb(res);
    res = mockRes();
    await sessionHandler(mockReq({ method: 'GET', headers: { cookie: cookieHeader() } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().account.profile.name, 'Tushar Nair');

    delete process.env.PREVIEW_DEMO_PASSWORD;
    const demo = await previewDemoAccount();
    assert.equal(demo.passwordHash, PREVIEW_DEMO_PASSWORD_HASH);
    assert.equal(await verifyPassword('preview-demo-pass-1', demo.passwordHash), false);

    process.env.VERCEL_ENV = 'production';
    res = mockRes();
    await loginHandler(mockReq({
      headers: { cookie: cookieHeader() },
      body: { loginId: 'Tushar Nair', password: 'preview-demo-pass-1' },
    }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(await previewDemoAccount(), null);
  } finally {
    restore();
  }
});
