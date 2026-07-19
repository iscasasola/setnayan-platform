/**
 * Client-side carry for the compose-first "Inquire" funnel (owner design
 * session 2026-07-02). A visitor with no event yet composes an inquiry on a
 * vendor profile, then converts (signup + event onboarding). We do NOT persist
 * a server-side anon lead (owner decision: capture AFTER account created); the
 * composed inquiry rides localStorage through the signup → onboarding journey —
 * the same browser-survival mechanism onboarding itself uses. Once the couple
 * lands on the dashboard authenticated with an event, the dispatcher replays it
 * via the normal startServiceInquiry action.
 *
 * Trade-off (owner-accepted): a hard abandon (cleared storage / different
 * device) before finishing onboarding loses the composed message. The dispatcher
 * is best-effort; a couple can always inquire again from the vendor profile.
 */

export type PendingVendorInquiry = {
  vendorProfileId: string;
  vendorSlug: string;
  serviceId: string;
  categoryKey: string | null;
  message: string;
  /** epoch ms — a stale stash (>48h) is dropped rather than fired late. */
  savedAt: number;
};

const KEY = 'setnayan_pending_vendor_inquiry';
const MAX_AGE_MS = 1000 * 60 * 60 * 48;

export function writePendingVendorInquiry(
  input: Omit<PendingVendorInquiry, 'savedAt'>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...input, savedAt: Date.now() } satisfies PendingVendorInquiry),
    );
  } catch {
    // Storage blocked (private mode / quota) — non-fatal. The flow degrades to
    // a normal onboarding without the carried inquiry.
  }
}

export function readPendingVendorInquiry(): PendingVendorInquiry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingVendorInquiry>;
    if (!parsed || !parsed.vendorProfileId || !parsed.serviceId) return null;
    if (
      typeof parsed.savedAt === 'number' &&
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed as PendingVendorInquiry;
  } catch {
    return null;
  }
}

export function clearPendingVendorInquiry(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // non-fatal
  }
}
