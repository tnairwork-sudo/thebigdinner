import { hashPassword } from './passwords.js';
import { normalizeLoginId } from './phone.js';

/**
 * Preview-only demo account. Production never reads this.
 * Login id and password prefer PREVIEW_DEMO_LOGIN_ID and PREVIEW_DEMO_PASSWORD
 * on the Vercel Preview environment. Those could not be set from this repo,
 * so the password fallback below is a scrypt hash and not the password itself.
 */
export const PREVIEW_DEMO_PASSWORD_HASH = 'scrypt$16384$8$1$3ee5d2059e85e370d4aa2d6ba0c3dc73$b5d9ef276ed05fdf60a1dbb35d6718867697aad0851e5b3e9f679ce41b669a9c';

const DEMO_PHONE = '+919000000088';
let envHash = { password: '', hash: '' };

export async function previewDemoAccount() {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  const loginId = normalizeLoginId(process.env.PREVIEW_DEMO_LOGIN_ID || 'Tushar Nair');
  if (!loginId) return null;
  const fromEnv = process.env.PREVIEW_DEMO_PASSWORD || '';
  let passwordHash = PREVIEW_DEMO_PASSWORD_HASH;
  if (fromEnv) {
    if (envHash.password !== fromEnv) envHash = { password: fromEnv, hash: await hashPassword(fromEnv) };
    passwordHash = envHash.hash;
  }
  return {
    loginId,
    name: 'Tushar Nair',
    email: null,
    phone: DEMO_PHONE,
    passwordHash,
    status: 'accepted',
    matchedBy: 'preview-demo',
    listName: null,
    entry: { name: 'Tushar Nair', city: 'Delhi', months: ['1 Jan 2026'] },
    profile: {
      id: 'me',
      name: 'Tushar Nair',
      role: '',
      city: 'Delhi',
      area: 'Civil Lines',
      tone: 'oxblood',
      editions: [],
      visible: true,
      listed: true,
      attendanceMonths: ['1 Jan 2026'],
      privacy: { building: true, principle: true, proud: true },
      building: '',
      principle: '',
      proud: '',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: '2026-01-01T00:00:00.000Z',
  };
}
