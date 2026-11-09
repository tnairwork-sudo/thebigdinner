import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpError, ConflictError } from './errors.js';
import { readCookie } from './http.js';

const KEY_RE = /^[a-z]+\/[a-z0-9](?:[a-z0-9._-]| [a-z0-9])*$/;

function assertKey(key) {
  if (!KEY_RE.test(key)) throw new Error('bad key');
  const parts = key.split('/');
  if (parts.length !== 2 || parts.some((part) => part === '.' || part === '..')) throw new Error('bad key');
  return parts;
}

function isConflict(err) {
  const message = String(err && err.message ? err.message : '');
  return /already exists/i.test(message) || err?.status === 409 || err?.statusCode === 409;
}

export function createFileStore(dir) {
  let chain = Promise.resolve();
  const lock = (fn) => {
    const run = chain.then(fn, fn);
    chain = run.then(() => {}, () => {});
    return run;
  };

  const fileFor = (key) => {
    const [bucket, id] = assertKey(key);
    return path.join(dir, bucket, `${id}.json`);
  };

  async function read(key) {
    try {
      const text = await fs.readFile(fileFor(key), 'utf8');
      return JSON.parse(text);
    } catch (err) {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }
  }

  async function writeNew(key, value) {
    const file = fileFor(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    let fh;
    try {
      fh = await fs.open(file, 'wx');
    } catch (err) {
      if (err && err.code === 'EEXIST') throw new ConflictError();
      throw err;
    }
    try {
      await fh.writeFile(JSON.stringify(value), 'utf8');
    } finally {
      await fh.close();
    }
  }

  async function write(key, value) {
    const file = fileFor(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), 'utf8');
    await fs.rename(tmp, file);
  }

  async function remove(key) {
    try {
      await fs.unlink(fileFor(key));
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
  }

  return {
    kind: 'file',
    get: (key) => lock(() => read(key)),
    putNew: (key, value) => lock(() => writeNew(key, value)),
    put: (key, value) => lock(() => write(key, value)),
    del: (key) => lock(() => remove(key)),
  };
}

export function createRedisStore(url, token) {
  const base = String(url).replace(/\/$/, '');
  async function command(args) {
    const res = await fetch(base, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `redis ${res.status}`);
    return data.result;
  }
  const redisKey = (key) => {
    assertKey(key);
    return `tbd:room:${key.replaceAll('/', ':')}`;
  };
  return {
    kind: 'redis',
    async get(key) {
      const raw = await command(['GET', redisKey(key)]);
      if (raw == null) return null;
      return JSON.parse(raw);
    },
    async putNew(key, value) {
      const result = await command(['SET', redisKey(key), JSON.stringify(value), 'NX']);
      if (result == null) throw new ConflictError();
    },
    async put(key, value, ttlSeconds) {
      const args = ['SET', redisKey(key), JSON.stringify(value)];
      if (ttlSeconds) args.push('EX', String(ttlSeconds));
      await command(args);
    },
    async del(key) {
      await command(['DEL', redisKey(key)]);
    },
  };
}

async function createBlobStore() {
  const { get, put, del } = await import('@vercel/blob');
  const pathname = (key) => {
    assertKey(key);
    return `room/${key}.json`;
  };
  const common = { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 0 };
  async function read(key) {
    const result = await get(pathname(key), { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  }
  return {
    kind: 'blob',
    get: read,
    async putNew(key, value) {
      try {
        await put(pathname(key), JSON.stringify(value), { ...common, allowOverwrite: false });
      } catch (err) {
        if (isConflict(err)) throw new ConflictError();
        throw err;
      }
    },
    async put(key, value) {
      await put(pathname(key), JSON.stringify(value), { ...common, allowOverwrite: true });
    },
    async del(key) {
      const result = await get(pathname(key), { access: 'private', useCache: false });
      if (!result || !result.blob || !result.blob.url) return;
      await del(result.blob.url);
    },
  };
}

const VAULT_COOKIE = 'room_preview_vault';
const VAULT_MAX_AGE = 60 * 60 * 24 * 30;
/** Preview demo integrity key. Not a user password. Ignored in production. */
const VAULT_KEY = 'tbd-room-preview-vault-v1';

function vaultSecure(req) {
  const proto = String((req && req.headers && req.headers['x-forwarded-proto']) || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return process.env.VERCEL_ENV === 'preview';
}

function encodeVault(data) {
  const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = createHmac('sha256', VAULT_KEY).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function decodeVault(raw) {
  if (!raw || !raw.includes('.')) return {};
  const dot = raw.lastIndexOf('.');
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac('sha256', VAULT_KEY).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return {};
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

/** Stateless preview store. The browser holds the HMAC-signed record. */
export function createCookieStore(req) {
  const data = decodeVault(readCookie(req || { headers: {} }, VAULT_COOKIE));
  let dirty = false;
  const now = Date.now();
  for (const [key, value] of Object.entries(data)) {
    if ((key.startsWith('claim/') || key.startsWith('sess/')) && value && value.exp && value.exp < now) {
      delete data[key];
      dirty = true;
    }
  }
  return {
    kind: 'cookie',
    async get(key) {
      assertKey(key);
      return data[key] === undefined ? null : data[key];
    },
    async putNew(key, value) {
      assertKey(key);
      if (data[key] !== undefined) throw new ConflictError();
      data[key] = value;
      dirty = true;
    },
    async put(key, value) {
      assertKey(key);
      data[key] = value;
      dirty = true;
    },
    async del(key) {
      assertKey(key);
      if (data[key] !== undefined) {
        delete data[key];
        dirty = true;
      }
    },
    commit(request) {
      if (!dirty) return null;
      const raw = encodeVault(data);
      if (raw.length > 3500) throw new HttpError(503, 'store_unconfigured');
      const secure = vaultSecure(request || req) ? '; Secure' : '';
      dirty = false;
      return `${VAULT_COOKIE}=${raw}; HttpOnly; Path=/; Max-Age=${VAULT_MAX_AGE}; SameSite=Lax${secure}`;
    },
  };
}

function externalStoreConfig() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (redisUrl && redisToken) return { kind: 'redis', redisUrl, redisToken };
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return { kind: 'blob' };
  return null;
}

/**
 * Redis or Blob when connected.
 * Preview deployments without those use a signed cookie.
 * Production without those fails closed.
 * Local dev uses a file directory.
 */
export async function createStore(req) {
  const external = externalStoreConfig();
  if (external && external.kind === 'redis') return createRedisStore(external.redisUrl, external.redisToken);
  if (external && external.kind === 'blob') return createBlobStore();
  if (process.env.VERCEL_ENV === 'production') return null;
  if (process.env.VERCEL_ENV === 'preview') return createCookieStore(req);
  if (process.env.VERCEL) return null;
  const dir = process.env.ROOM_DATA_DIR || path.join(process.cwd(), '.data', 'room');
  return createFileStore(dir);
}
