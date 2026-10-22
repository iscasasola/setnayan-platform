/**
 * open-shop-draft.ts — what a stranger typed into the shop wizard survives leaving
 * the page for Google or Apple.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────
 * Step 3 of `/open-shop` now creates the account (owner 2026-09-22). "Continue with
 * Google" on that step genuinely LEAVES: it is Google's page, and the OAuth callback
 * brings the person back to `/open-shop` as a brand-new vendor (`lib/oauth-signup.ts`
 * · `buildOAuthCallbackUrl`). Nothing is written to the database before the final
 * submit, so without this the shop name, address, service and events typed on steps
 * 1–2 would be gone when they land — the exact loss `four-steps.test.ts` guards
 * against on the server side, reproduced by the client.
 *
 * ── WHAT IT IS, AND IS NOT ────────────────────────────────────────────────────
 * A short-lived, same-tab note in `sessionStorage`: the 2026-07-21 onboarding verdict
 * proposed a signed 7-day cookie for a logged-out draft; this is the smaller thing
 * that the OAuth round trip actually needs — one tab, one hour. It NEVER carries the
 * password (the account is created by the provider on this path, and a password in
 * web storage is a leak waiting for an XSS), and everything read back is re-validated
 * by the server action as if typed fresh. Pure: no `window`, so it can be executed
 * by a test; the wizard supplies the storage.
 *
 * The chosen web address is NOT carried across the OAuth round trip: `AddressPreview` owns
 * that choice and re-derives it from the shop name, so a restored name yields the same
 * default and the vendor re-picks a custom one on the step they land back on.
 *
 * ── PARKED AT SUBMIT TOO (owner "yes to all" 2026-10-22, journey_fixes_later Supplier 4c) ──
 * The step-1 availability check makes a taken address rare, not impossible: two people can
 * pick one word in the same minute, the unique index refuses at Submit, and `becomeVendor`
 * redirects to `/open-shop?…&error=`. The page reloads with only the step and the banner —
 * and name, logo, service, events and contact were React state, gone. So the wizard parks
 * this same draft as the form submits (`atSubmit`), WITH the address it sent (`slug`, the
 * one that was refused), and restores it only on that error reload: the person changes one
 * word instead of typing four steps again. A submit that succeeded leaves the dashboard, and
 * the parked note is dropped unread the next time the wizard opens without an error.
 */

export const OPEN_SHOP_DRAFT_KEY = 'setnayan.open-shop.draft.v1';
/** One hour: long enough for a slow OAuth consent, short enough to be a DRAFT. */
export const OPEN_SHOP_DRAFT_TTL_MS = 60 * 60 * 1000;

export type OpenShopDraft = {
  v: 1;
  /** Epoch ms when it was written. */
  at: number;
  step: 1 | 2 | 3 | 4;
  shopName: string;
  logoUrl: string;
  service: string;
  serviceLabel: string | null;
  events: string[];
  position: string;
  phone: string;
  email: string;
  /** Parked as the form submitted — restored only when the server sends it back with `?error=`. */
  atSubmit?: boolean;
  /** The web address that was submitted (parked at submit only) — the one the refusal is about. */
  slug?: string;
};

export type OpenShopDraftInput = Omit<OpenShopDraft, 'v' | 'at'>;

const MAX = { shopName: 128, logoUrl: 512, service: 64, serviceLabel: 128, position: 64, phone: 32, email: 254, event: 64, slug: 32 } as const;

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

export function serializeOpenShopDraft(d: OpenShopDraftInput, now: number = Date.now()): string {
  const draft: OpenShopDraft = {
    v: 1,
    at: now,
    step: d.step,
    shopName: str(d.shopName, MAX.shopName),
    logoUrl: str(d.logoUrl, MAX.logoUrl),
    service: str(d.service, MAX.service),
    serviceLabel: d.serviceLabel ? str(d.serviceLabel, MAX.serviceLabel) : null,
    events: d.events.filter((e): e is string => typeof e === 'string').map((e) => e.slice(0, MAX.event)),
    position: str(d.position, MAX.position),
    phone: str(d.phone, MAX.phone),
    email: str(d.email, MAX.email),
    ...(d.atSubmit ? { atSubmit: true } : {}),
    ...(d.slug ? { slug: str(d.slug, MAX.slug) } : {}),
  };
  return JSON.stringify(draft);
}

/**
 * Null for anything that is not a fresh draft of this version: junk, another
 * version, expired, a clock that says it was written in the future, or a payload
 * that smuggles a password (dropped on the floor — never read, never restored).
 */
export function parseOpenShopDraft(raw: string | null | undefined, now: number = Date.now()): OpenShopDraft | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 8192) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object') return null;
  const d = o as Record<string, unknown>;
  if (d.v !== 1) return null;
  if (typeof d.at !== 'number' || !Number.isFinite(d.at)) return null;
  if (d.at > now || now - d.at > OPEN_SHOP_DRAFT_TTL_MS) return null;
  const step = d.step === 1 || d.step === 2 || d.step === 3 || d.step === 4 ? d.step : 1;
  return {
    v: 1,
    at: d.at,
    step,
    shopName: str(d.shopName, MAX.shopName),
    logoUrl: str(d.logoUrl, MAX.logoUrl),
    service: str(d.service, MAX.service),
    serviceLabel: typeof d.serviceLabel === 'string' && d.serviceLabel ? d.serviceLabel.slice(0, MAX.serviceLabel) : null,
    events: Array.isArray(d.events)
      ? d.events.filter((e): e is string => typeof e === 'string').map((e) => e.slice(0, MAX.event)).slice(0, 32)
      : [],
    position: str(d.position, MAX.position),
    phone: str(d.phone, MAX.phone),
    email: str(d.email, MAX.email),
    ...(d.atSubmit === true ? { atSubmit: true } : {}),
    ...(typeof d.slug === 'string' && d.slug ? { slug: d.slug.slice(0, MAX.slug) } : {}),
  };
}

/**
 * Should the wizard restore this draft on THIS load? An OAuth round-trip draft — always. A draft parked at
 * submit — only when the server sent the form back with an error (`?error=`); after a submit that succeeded
 * there is nothing to restore.
 */
export function restoresOnThisLoad(d: Pick<OpenShopDraft, 'atSubmit'>, cameBackWithError: boolean): boolean {
  return d.atSubmit ? cameBackWithError : true;
}
