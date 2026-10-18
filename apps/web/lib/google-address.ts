/**
 * google-address.ts — is a TYPED address a Google account? Pure; executed by
 * `google-address.test.ts`.
 *
 * ── THE RULE (owner 2026-10-18, verbatim) ────────────────────────────────────
 * "we want people to login via google and typing their google account be same."
 * A person who types their Google address must go through the SAME door as one
 * who taps "Continue with Google": the same Google page, the same callback, the
 * same account, the same landing. So the typed path does not get a second
 * mechanism — it hands the address to the shell's own Google flow as
 * `login_hint` (Google pre-selects that account on its page).
 *
 * ── WHICH ADDRESSES ARE GOOGLE ───────────────────────────────────────────────
 * • gmail.com / googlemail.com — Google by their name (no lookup).
 * • a Google Workspace domain — Google by its MAIL: the domain's PREFERRED
 *   (lowest-number) MX hosts are all Google's. That needs DNS, so it is asked
 *   server-side (`google-address.server.ts`, behind `/api/sign-in/google-domain`)
 *   and only the DOMAIN ever leaves the browser — never the address.
 *
 * ── WHAT THIS DOES NOT REVEAL ────────────────────────────────────────────────
 * Nothing about any ACCOUNT. Whether `example.com` routes its mail to Google is
 * public DNS; it says nothing about whether this address has a Setnayan account
 * or how that account signs in. The owner's 2026-09-23 rule — reveal an
 * account's provider only after a failed password attempt (lib/sign-in-door.ts)
 * — is untouched: that lookup still runs only after a refused password.
 */

/** Domains that are Google by name: every address there IS a Google account. */
const GOOGLE_NAMED_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

/** Google's mail hosts end in one of these (aspmx.l.google.com, smtp.google.com, …). */
const GOOGLE_MX_SUFFIXES = ['.google.com', '.googlemail.com'];

const DOMAIN_SHAPE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const LOCAL_SHAPE = /^[^\s@]{1,64}$/;

/** A domain we would look up, lower-cased — or null when it is not a plausible one. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  const d = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  return DOMAIN_SHAPE.test(d) ? d : null;
}

/** The domain of a typed address (lower-cased), or null while it is not an address yet. */
export function emailDomain(email: string | null | undefined): string | null {
  const e = String(email ?? '').trim();
  const at = e.lastIndexOf('@');
  if (at < 1) return null;
  if (!LOCAL_SHAPE.test(e.slice(0, at))) return null;
  return normalizeDomain(e.slice(at + 1));
}

/** gmail.com / googlemail.com — Google without asking anybody. */
export function isGoogleNamedDomain(domain: string | null | undefined): boolean {
  return domain != null && GOOGLE_NAMED_DOMAINS.has(domain.toLowerCase());
}

export type MxRecord = { exchange: string; priority: number };

/**
 * A Workspace domain: its PREFERRED MX hosts (the lowest priority number — where
 * mail actually goes first) are all Google's. A domain whose Google host is only
 * a backup is not Google; a domain with no MX is not Google.
 */
export function mxPointsAtGoogle(records: readonly MxRecord[] | null | undefined): boolean {
  const usable = (records ?? []).filter(
    (r) => r && typeof r.exchange === 'string' && r.exchange.trim() !== '' && Number.isFinite(r.priority),
  );
  if (usable.length === 0) return false;
  const best = Math.min(...usable.map((r) => r.priority));
  return usable
    .filter((r) => r.priority === best)
    .every((r) => {
      const host = r.exchange.trim().toLowerCase().replace(/\.$/, '');
      return GOOGLE_MX_SUFFIXES.some((s) => host.endsWith(s));
    });
}

/**
 * The `login_hint` handed to Google: the typed address, trimmed and lower-cased,
 * or null when it is not an address (then Google simply shows its own chooser).
 */
export function googleLoginHint(raw: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length > 254) return null;
  return emailDomain(e) ? e : null;
}

/**
 * The words of the typed-Google door. The button says exactly what the Google
 * button above it says (`verb` + "Google") — it IS that button, with the
 * address already filled in.
 */
export const GOOGLE_ADDRESS_WORDS = {
  usePassword: 'Use a password instead',
  pendingWeb: 'Redirecting to Google…',
  pendingBrowser: 'Opening your browser…',
} as const;

/** The live check's address. Only the DOMAIN is ever sent. */
export function googleDomainCheckUrl(domain: string): string {
  return `/api/sign-in/google-domain?domain=${encodeURIComponent(domain)}`;
}

export type GoogleDoorShell = 'web' | 'desktop' | 'native';

/**
 * Which Google flow this shell runs, from the two booleans every sign-in surface
 * already holds. Lives HERE, not beside the door: the door is a client module,
 * and a server page (/signup) cannot call a function exported from one — the
 * lab walk caught exactly that ("Attempted to call googleDoorShell() from the
 * server") on the first render.
 */
export function googleDoorShell(desktopOAuth: boolean, nativeOAuth: boolean): GoogleDoorShell {
  return desktopOAuth ? 'desktop' : nativeOAuth ? 'native' : 'web';
}
