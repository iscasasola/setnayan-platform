/**
 * OTHER ACCOUNTS ON THIS PHONE — the jars (avatar sheet PR2, owner 2026-10-22: *"Like in facebook how i can switch
 * to different email addresses"*, option B: instant switch).
 *
 * ONE SESSION IS ACTIVE: the `sb-*` cookies @supabase/ssr reads, exactly as before — every server read, every RLS
 * check and every browser-client call runs as that one `auth.uid()`. Each OTHER account you added is PARKED in a
 * jar of its own:
 *
 *   · `sn_acct_<uid>` — its refresh token, httpOnly, Secure, SameSite=Lax, and **Path=/auth/accounts**. The browser
 *     sends a jar ONLY to the account routes (`add` · `switch` · `sign-out-all`); no page, no API route, no RLS read
 *     ever receives another account's credential, and page script can never read one.
 *   · `sn_accts` — the display list (uid · email · name) for the sheet's rows. No credential in it, by type and by
 *     guard.
 *
 * Switching = the server refreshes the target's jar into a fresh session, verifies its user IS the target, parks the
 * current session into its own jar, and writes the target's session as the `sb-*` cookies. Every later request is
 * the target, end to end. Removing an account = signing out while on it. "Sign out of all accounts" revokes every
 * jar's session at Supabase and expires every jar, then signs out the active one.
 *
 * Max {@link MAX_ACCOUNTS_PER_DEVICE} logins per device (the active one + the parked).
 */

export const JAR_PATH = '/auth/accounts';
export const JAR_PREFIX = 'sn_acct_';
export const ACCOUNTS_LIST_COOKIE = 'sn_accts';
export const MAX_ACCOUNTS_PER_DEVICE = 5;
const YEAR_S = 60 * 60 * 24 * 365;

/** A parked account as the sheet draws it — display only, never a credential. */
export type ParkedAccount = { uid: string; email: string; name: string | null };

/** What a jar holds — the parked account's refresh token. Lives only at {@link JAR_PATH}. */
export type Jar = { uid: string; refresh: string };

const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUid(v: unknown): v is string {
  return typeof v === 'string' && UID.test(v);
}

export function jarCookieName(uid: string): string {
  if (!isUid(uid)) throw new Error('jarCookieName: not a user id');
  return `${JAR_PREFIX}${uid.toLowerCase()}`;
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}
function b64urlDecode(s: string): string | null {
  try {
    return Buffer.from(s, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function encodeJar(jar: Jar): string {
  return b64urlEncode(JSON.stringify({ u: jar.uid, r: jar.refresh }));
}

export function decodeJar(raw: string | null | undefined): Jar | null {
  if (!raw) return null;
  const txt = b64urlDecode(raw);
  if (!txt) return null;
  try {
    const o = JSON.parse(txt) as { u?: unknown; r?: unknown };
    if (!isUid(o.u) || typeof o.r !== 'string' || o.r.length < 8 || o.r.length > 512) return null;
    return { uid: o.u.toLowerCase(), refresh: o.r };
  } catch {
    return null;
  }
}

/** The display list — only the three display fields survive, whatever else a tampered cookie carried. */
export function decodeParkedList(raw: string | null | undefined): ParkedAccount[] {
  if (!raw) return [];
  const txt = b64urlDecode(raw);
  if (!txt) return [];
  try {
    const arr = JSON.parse(txt) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: ParkedAccount[] = [];
    for (const v of arr) {
      const o = v as { u?: unknown; e?: unknown; n?: unknown };
      if (!isUid(o.u) || typeof o.e !== 'string') continue;
      if (out.some((a) => a.uid === (o.u as string).toLowerCase())) continue;
      out.push({ uid: o.u.toLowerCase(), email: o.e.slice(0, 254), name: typeof o.n === 'string' ? o.n.slice(0, 120) : null });
      if (out.length >= MAX_ACCOUNTS_PER_DEVICE - 1) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function encodeParkedList(list: readonly ParkedAccount[]): string {
  return b64urlEncode(JSON.stringify(list.map((a) => ({ u: a.uid, e: a.email, n: a.name }))));
}

/** Add (or refresh) a parked account, first in the list. Null when the device is full. */
export function parkInList(list: readonly ParkedAccount[], account: ParkedAccount): ParkedAccount[] | null {
  const rest = list.filter((a) => a.uid !== account.uid);
  if (rest.length + 1 > MAX_ACCOUNTS_PER_DEVICE - 1) return null;
  return [account, ...rest];
}

export function unparkFromList(list: readonly ParkedAccount[], uid: string): ParkedAccount[] {
  return list.filter((a) => a.uid !== uid.toLowerCase());
}

/** The other accounts the sheet draws for the signed-in one — never itself. */
export function otherAccounts(list: readonly ParkedAccount[], activeUid: string | null | undefined): ParkedAccount[] {
  const me = (activeUid ?? '').toLowerCase();
  return list.filter((a) => a.uid !== me);
}

/** May one more login be added on this device? (the active one + the parked ones) */
export function canAddAnother(list: readonly ParkedAccount[]): boolean {
  return list.length + 1 < MAX_ACCOUNTS_PER_DEVICE;
}

export function jarCookieOptions(secure: boolean) {
  return { path: JAR_PATH, httpOnly: true, secure, sameSite: 'lax' as const, maxAge: YEAR_S };
}

export function listCookieOptions(secure: boolean) {
  return { path: '/', httpOnly: true, secure, sameSite: 'lax' as const, maxAge: YEAR_S };
}

/** Every jar cookie a request carried (only the account routes ever receive them). */
export function jarNamesIn(names: readonly string[]): string[] {
  return names.filter((n) => n.startsWith(JAR_PREFIX));
}

/** The session cookies @supabase/ssr writes (`sb-<ref>-auth-token`, chunked `.0` `.1` …). */
export function isSessionCookie(name: string): boolean {
  return /^sb-[A-Za-z0-9]+-auth-token(?:\.\d+)?$/.test(name) || /^sb-[A-Za-z0-9]+-auth-token-code-verifier$/.test(name);
}
