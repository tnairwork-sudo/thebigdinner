import { createHash } from 'node:crypto';

/** SHA-256 hex of a UTF-8 string. Matches the old client allowlist (Web Crypto). */
export function sha256Hex(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/**
 * Same rules as the previous Room phone field.
 * Indian mobiles may be typed as 10 digits; everything else needs a country code.
 * Returns E.164 with a leading +, or null.
 */
export function toE164(raw) {
  const s = String(raw || '').trim();
  const keep = s.replace(/[^\d+]/g, '');
  let d;
  if (keep.startsWith('+')) d = keep.replace(/\D/g, '');
  else {
    d = keep.replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
  }
  if (!d) return null;
  if (d.length === 10 && '6789'.includes(d[0])) return '+91' + d;
  if (d.length === 11 && d.startsWith('0')) return '+91' + d.slice(1);
  if (d.startsWith('91') && d.length === 12) return '+' + d;
  if (d.startsWith('44') && d.length >= 11) return '+' + d;
  if (d.startsWith('971') && d.length >= 11) return '+' + d;
  if (d.length >= 10) return '+' + d;
  return null;
}

export function normalizeLoginId(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.length < 3 || s.length > 40) return '';
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/.test(s)) return '';
  return s;
}

export function validEmail(email) {
  const s = String(email || '');
  if (s.length > 200) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}
