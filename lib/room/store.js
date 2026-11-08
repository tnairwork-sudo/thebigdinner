import fs from 'node:fs/promises';
import path from 'node:path';
import { ConflictError } from './errors.js';

const KEY_RE = /^[a-z]+\/[a-z0-9._-]+$/;

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

/**
 * Durable on Vercel when a private Blob store or Upstash/Vercel KV Redis is connected.
 * Local dev and tests use a file directory (not used on Vercel).
 */
export async function createStore() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (redisUrl && redisToken) return createRedisStore(redisUrl, redisToken);
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return createBlobStore();
  if (process.env.VERCEL) return null;
  const dir = process.env.ROOM_DATA_DIR || path.join(process.cwd(), '.data', 'room');
  return createFileStore(dir);
}
