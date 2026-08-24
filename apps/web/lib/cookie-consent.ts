// Cookie-consent state — the single source of truth for whether the
// visitor has agreed to non-essential (analytics) cookies under RA 10173
// (Philippine Data Privacy Act). Essential cookies (auth session, theme,
// CSRF) are always allowed and never gated here — they're strictly
// necessary to deliver the service the user asked for.
//
// The choice is persisted in TWO places and both are needed:
//
//   · localStorage — instant, synchronous, and enough within a session.
//   · a first-party cookie SET BY THE SERVER (POST /api/cookie-consent).
//
// 🔴 WHY THE SECOND ONE EXISTS. Until 2026-08-24 there was only localStorage,
// and the owner reported the banner "re-asks people who have already answered".
// Safari's Intelligent Tracking Prevention DELETES ALL SCRIPT-WRITABLE STORAGE
// after seven days without a first-party interaction — localStorage, IndexedDB
// and `document.cookie` alike. Answer once, come back a fortnight later, get
// asked again, on a device where nothing was broken.
//
// 🔑 SO `document.cookie` WOULD NOT HAVE FIXED IT. The seven-day cap is about
// HOW a value was written, not what it is; a script-written cookie is capped
// exactly like localStorage. Only a `Set-Cookie` from our own server escapes it.
//
// ⚖ PER-DEVICE AND ANONYMOUS, deliberately: a cookie on the browser that
// answered, and nothing else — no database row, no account, no identifier.
// Keying consent to a USER would create an RA 10173 proof-of-consent record,
// which is a DPO decision nobody has made.
//
// Neither store needs consent itself: remembering that somebody declined is
// strictly necessary to honour the refusal they just made.
//
// The choice is also broadcast on the window so the analytics provider can
// react the instant the visitor decides — no page reload needed.

export const CONSENT_STORAGE_KEY = 'setnayan-cookie-consent-v1';

/** 400 days — the longest Chrome will honour, and far past Safari's 7-day cap
 *  on script-written storage, which is the bug this exists to fix. */
export const CONSENT_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

// Fired whenever the visitor saves a choice. `detail` is the new
// CookieConsent. The PostHog provider listens for this to (de)activate
// analytics live.
export const CONSENT_CHANGE_EVENT = 'setnayan:cookie-consent-change';

// Fired by "Cookie settings" links (footer + /cookies page) to re-open
// the banner's manage panel even after a choice was already made.
export const OPEN_CONSENT_EVENT = 'setnayan:open-cookie-settings';

export type CookieConsent = {
  /** Non-essential analytics/product-measurement cookies (PostHog). */
  analytics: boolean;
  /** ISO timestamp of the decision — proof-of-consent for RA 10173. */
  decidedAt: string;
};

/** The server-set cookie, read synchronously so a returning visitor never sees
 *  the banner flash before it hides itself. */
function readConsentCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${CONSENT_STORAGE_KEY}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    // ⚠ COOKIE FIRST. It is the one that survives Safari's seven-day purge, so
    // on the visit where localStorage has been wiped it is the only record
    // there is. Falling back to localStorage keeps every visitor who decided
    // before this shipped from being asked again.
    const raw = readConsentCookie() ?? window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed.analytics !== 'boolean') return null;
    return { analytics: parsed.analytics, decidedAt: parsed.decidedAt ?? '' };
  } catch {
    return null;
  }
}

/** Has the visitor made any choice yet? (controls whether the banner shows) */
export function hasDecidedConsent(): boolean {
  return readConsent() !== null;
}

/** Are non-essential analytics cookies allowed right now? */
export function analyticsAllowed(): boolean {
  return readConsent()?.analytics === true;
}

export function writeConsent(analytics: boolean): void {
  if (typeof window === 'undefined') return;
  const value: CookieConsent = {
    analytics,
    decidedAt: new Date().toISOString(),
  };
  // Ask the server to set the durable cookie. Fire-and-forget on purpose: this
  // runs from a click handler and the visitor's choice must take effect in this
  // tab immediately whether or not the request lands. If it fails they are no
  // worse off than before this existed — localStorage still carries them for
  // the session.
  try {
    void fetch('/api/cookie-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analytics }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let persistence failure block the choice taking effect.
  }

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private-mode / storage-disabled browsers: we still broadcast the
    // choice for this session so analytics honors it; it just won't
    // persist across reloads (the banner will re-ask, which is correct).
  }
  window.dispatchEvent(
    new CustomEvent<CookieConsent>(CONSENT_CHANGE_EVENT, { detail: value }),
  );
}

/** Ask the mounted banner to re-open its manage panel. */
export function openConsentManager(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT));
}
