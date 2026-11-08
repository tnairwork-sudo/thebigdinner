import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const N = 16384;
const r = 8;
const p = 1;
const keylen = 32;

/** scrypt hash. Stored form: scrypt$N$r$p$saltHex$hashHex. Never store the password. */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, keylen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const n = Number(nRaw);
  const rr = Number(rRaw);
  const pp = Number(pRaw);
  if (!Number.isFinite(n) || !Number.isFinite(rr) || !Number.isFinite(pp)) return false;
  if (n < 1024 || n > 1048576 || rr < 1 || rr > 32 || pp < 1 || pp > 8) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 16) return false;
  const hash = await scrypt(String(password), salt, expected.length, { N: n, r: rr, p: pp });
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}
