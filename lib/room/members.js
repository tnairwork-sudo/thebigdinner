import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './errors.js';
import { toE164 } from './phone.js';

/**
 * FICTIONAL preview sample. These are not real guests.
 * The public preview uses only this list.
 * A real attendance file is read only when MEMBERS_CSV_PATH or MEMBERS_CSV_DIR is set,
 * and that file is never committed.
 */
export const SAMPLE_MEMBERS = [
  { name: 'A. Sample', phone: '+91 90000 00001', city: 'Delhi', month: '1 Jan 2026' },
  { name: 'B. Sample', phone: '+44 7000 000002', city: 'London', month: '2 Feb 2026' },
];

export function parseMembersCsv(text) {
  const records = parseCsv(String(text || ''));
  if (!records.length) return [];
  const header = records[0].map((cell) => cell.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const phoneCol = col('phone');
  if (phoneCol < 0) throw new HttpError(503, 'members_unconfigured');
  const nameCol = col('name');
  const cityCol = col('city');
  const monthCol = col('month');
  const rows = [];
  for (const record of records.slice(1)) {
    const phone = (record[phoneCol] || '').trim();
    if (!phone) continue;
    rows.push({
      name: nameCol >= 0 ? (record[nameCol] || '').trim() : '',
      phone,
      city: cityCol >= 0 ? (record[cityCol] || '').trim() : '',
      month: monthCol >= 0 ? (record[monthCol] || '').trim() : '',
    });
  }
  return rows;
}

export function indexMembers(rows) {
  const byPhone = new Map();
  for (const row of rows || []) {
    const e164 = toE164(row.phone);
    if (!e164) continue;
    const current = byPhone.get(e164) || { city: '', months: [], listName: '' };
    if (!current.city && row.city) current.city = String(row.city).trim();
    if (!current.listName && row.name) current.listName = String(row.name).trim();
    const month = row.month ? String(row.month).trim() : '';
    if (month && !current.months.includes(month)) current.months.push(month);
    byPhone.set(e164, current);
  }
  return byPhone;
}

function resolveMembersFile() {
  const direct = process.env.MEMBERS_CSV_PATH;
  if (direct) {
    if (!fs.existsSync(direct) || !fs.statSync(direct).isFile()) {
      throw new HttpError(503, 'members_unconfigured');
    }
    return direct;
  }
  const dir = process.env.MEMBERS_CSV_DIR;
  if (!dir) return null;
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new HttpError(503, 'members_unconfigured');
  }
  const names = fs.readdirSync(dir).filter((name) => name.toLowerCase().endsWith('.csv'));
  if (!names.length) throw new HttpError(503, 'members_unconfigured');
  const preferred = names.find((name) => name.toLowerCase().includes('allowlist')) || names[0];
  return path.join(dir, preferred);
}

let cache = null;

/** Real file when configured. Otherwise the fictional sample. */
export function loadMemberIndex() {
  const file = resolveMembersFile();
  if (!file) return indexMembers(SAMPLE_MEMBERS);
  const mtime = fs.statSync(file).mtimeMs;
  if (cache && cache.file === file && cache.mtime === mtime) return cache.index;
  const index = indexMembers(parseMembersCsv(fs.readFileSync(file, 'utf8')));
  cache = { file, mtime, index };
  return index;
}

export function resetMemberCache() {
  cache = null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}
