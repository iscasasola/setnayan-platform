// Cookie-consent state — the single source of truth for whether the
// visitor has agreed to non-essential (analytics) cookies under RA 10173
// (Philippine Data Privacy Act). Essential cookies (auth session, theme,
// CSRF) are always allowed and never gated here — they're strictly
// necessary to deliver the service the user asked for.
//
// The choice is persisted in localStorage (not a server cookie) so it
// survives reloads without itself requiring consent, and is broadcast on
// the window so the analytics provider can react the instant the visitor
// decides — no page reload needed.

export const CONSENT_STORAGE_KEY = 'setnayan-cookie-consent-v1';

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

export function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
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
