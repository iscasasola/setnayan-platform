/**
 * Supplier on-the-day Papic capture — WHAT A SHOP MAY CAPTURE AT ONE EVENT. PURE + unit-testable.
 *
 * 📸 OWNER 2026-11-23 (DECISION_LOG, the last of the day's rows winning — "PLUS GETS UNLIMITED EVENT PHOTOS AND VIDEOS
 * TOO"): per (shop, event)
 *   · Free      10 photos, no videos
 *   · Verified  10 photos, no videos
 *   · Plus · Pro · Ultra  no limit on photos or videos — the shop's storage is the only ceiling.
 * The numbers live ONLY in `TIER_CAPS` (`eventCaptureRule`, lib/vendor-tier-caps.ts). This file turns the rule plus
 * what the shop has already taken into one answer, so the route that DECIDES and the screen that SHOWS read one model.
 *
 * 🔁 THIS REPLACED the points model (Papic Lite 50 · Ltd 70 · Unli, the per-event credit ledger as a raise, the
 * 800-credit video threshold, and `vendor_papic_capture_grants`). A supplier's captures no longer spend anything —
 * not their own credits and NEVER the couple's Papic credits (`vendor_papic_captures` is the shop's own lane; it
 * never touches the event pool). The portfolio-import album (G3) still spends the shop's per-event credits; that is
 * a separate meter (`fetchVendorPapicPortfolioCredits`).
 *
 * 🔒 HONEST STATES. A count that could not be read is `null`, never 0: on a limited plan the shop is told
 * "Couldn't read" and the route refuses (a limit that waves shots through when blind is no limit). On a plan with no
 * limit the count is never needed. Storage full is said as "Storage full", never as a silent drop.
 */

import { eventCaptureRule, type EventCaptureRule } from '@/lib/vendor-tier-caps';
import { formatCount } from '@/lib/format-number';

export type VendorPapicMedia = 'photo' | 'clip';

/** Why one more capture is refused. Codes are the route's `error` and the uploader's KEPT refusals. */
export type CaptureRefusal = 'video_not_allowed' | 'event_photo_limit' | 'count_unread';

export type CaptureCheck = { ok: true } | { ok: false; reason: CaptureRefusal };

/**
 * May this shop take ONE more `media` at this event?
 *   · a clip on a plan without videos → `video_not_allowed`;
 *   · a photo on a limited plan: the count unread → `count_unread` (fail closed); at the limit → `event_photo_limit`.
 * Storage is checked by the route against the real bytes (`checkSupplierStorage`), not here.
 */
export function canCapture(
  rule: EventCaptureRule,
  photosTaken: number | null,
  media: VendorPapicMedia,
): CaptureCheck {
  if (media === 'clip') return rule.videos ? { ok: true } : { ok: false, reason: 'video_not_allowed' };
  if (rule.photoLimit === null) return { ok: true };
  if (photosTaken === null) return { ok: false, reason: 'count_unread' };
  return Math.max(0, Math.floor(photosTaken)) < rule.photoLimit ? { ok: true } : { ok: false, reason: 'event_photo_limit' };
}

/** What the shop's camera and badge need: the rule, the count, and what is left. */
export type EventCaptureAllowance = {
  rule: EventCaptureRule;
  /** Photos this shop has taken at this event (not hidden). `null` = could not be read. */
  photosTaken: number | null;
  /** Photos still allowed. `null` = no limit, OR the count is unread (see `photosTaken`). */
  photosLeft: number | null;
};

export function eventCaptureAllowance(tier: string | null | undefined, photosTaken: number | null): EventCaptureAllowance {
  const rule = eventCaptureRule(tier);
  const taken = photosTaken === null ? null : Math.max(0, Math.floor(Number(photosTaken)) || 0);
  const photosLeft = rule.photoLimit === null || taken === null ? null : Math.max(0, rule.photoLimit - taken);
  return { rule, photosTaken: taken, photosLeft };
}

/** The line a shop reads when its storage cannot take one more file. */
export const STORAGE_FULL_LINE = 'Storage full';

/** The line when a limited plan's count could not be read — said, never a 0. */
export const CAPTURE_COUNT_UNREAD = 'Couldn’t read how many photos you took here — try again in a moment';

/**
 * 🗣 THE HONEST LIMIT LINE (owner 2026-11-23): "10 of 10 photos at this event · Go Plus for unlimited", or
 * "Storage full". On a plan with no limit: "No limit · photos + video". The plan named is read from `TIER_CAPS`
 * (`liftedBy`), never typed.
 */
export function captureLimitLine(a: EventCaptureAllowance, storageFull = false): string {
  if (storageFull) return STORAGE_FULL_LINE;
  if (a.rule.photoLimit === null) return a.rule.videos ? 'No limit · photos + video' : 'No limit on photos';
  if (a.photosTaken === null) return CAPTURE_COUNT_UNREAD;
  const used = Math.min(a.photosTaken, a.rule.photoLimit);
  const head = `${formatCount(used)} of ${formatCount(a.rule.photoLimit)} photos at this event`;
  return a.rule.liftedBy ? `${head} · Go ${a.rule.liftedBy} for unlimited` : head;
}

/** The short words under the camera pill: what this plan may shoot. */
export function captureKindWords(rule: EventCaptureRule): string {
  return rule.videos ? 'photos + video' : 'photos only';
}
