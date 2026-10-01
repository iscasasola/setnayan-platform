/**
 * apps/web/lib/couple-media-allowance.ts — THE 100 MB ALLOWANCE IS A CAP, NOT
 * ONLY A METER.
 *
 * DECISION_LOG 2026-09-25 ("COUPLE UPLOADS: 100 MB PER EVENT, COMPRESSED"):
 * *"that means they can only upload a total of 100MB compressed files"* — the
 * couple's OWN Event Hub uploads (photos, short clips, a Pro background song)
 * share one allowance per event, measured after browser compression, with a
 * visible meter. Guest/Papic media is separate (credits) and never counts.
 *
 * Until this file the allowance was only COUNTED: `/api/upload` incremented
 * `events.couple_media_bytes` after the presign and never refused, and a removed
 * photo never gave its bytes back. Two halves now:
 *
 *   · REFUSE — `/api/upload` reserves the incoming bytes atomically
 *     (`reserve_couple_media_bytes`, which only adds when the total stays within
 *     the cap) BEFORE it signs the PUT, and refuses with `coupleMediaFullMessage`.
 *   · FREE — removing a picture is a draft/row edit that drops its ref; the R2
 *     object is not deleted (no surface deletes couple media one at a time). So
 *     a removed picture frees its bytes when the counter is SETTLED: the event's
 *     folders are listed once (sizes from R2 itself) and only the objects the
 *     event still references — live rows, the draft, its undo snapshot — or
 *     that landed in the last few minutes (an upload whose save is still in
 *     flight) are counted (`measureCoupleMediaBytes`, pure, below).
 *
 * Pure. No I/O — the reads and the listing live in
 * `couple-media-allowance.server.ts`.
 */
import { MAKER_EVENT_MEDIA_BYTES_CAP } from './maker-media-limits';

/**
 * Which `events/<eventId>/…` sub-paths count toward the couple's allowance — the
 * couple's OWN Event Hub media: the hero photo, the gallery, background music,
 * the hero clip, the Save-the-Date video/background, the Main background and a
 * scene's own upload. Deliberately an ALLOWLIST, not "every upload naming this
 * event": `events/<id>/pakanta-song` (admin-delivered), `payment-proof/…`,
 * `paperwork/…`, `disputes/…` and `zone-walkthroughs/…` also carry this event's
 * id but are NOT the media the owner's ₱21/decade math was about. Papic captures
 * live under `papic/…` and supplier media under `vendors/…`, so neither can ever
 * match. Extend this set only for a genuine couple media surface.
 */
export const COUPLE_MEDIA_METER_SUBPATHS: ReadonlySet<string> = new Set([
  'landing-page-hero',
  'landing-page-hero-video',
  'hero-video',
  'our-photos',
  'site-music',
  'std-video',
  'std-background',
  // The Main background's own clip or photo and its still (Maker Phase 10) —
  // a genuine Maker media surface: the couple's own footage behind every scene.
  'main-background',
  // A scene's own background photo or clip and its still ("Upload media" in the
  // Maker's scene Format tab, owner 2026-09-28) — the same kind of surface.
  'scene-background',
]);

/** True for an upload prefix (or an object key) inside one of this event's counted folders. */
export function isCoupleMediaMeterPath(pathOrKey: string, eventId: string): boolean {
  const segs = pathOrKey.split('/');
  return segs[0] === 'events' && segs[1] === eventId && COUPLE_MEDIA_METER_SUBPATHS.has(segs[2] ?? '');
}

/** The machine-readable half of the refusal (the sentence is `coupleMediaFullMessage`). */
export const COUPLE_MEDIA_FULL_CODE = 'event_media_full';

/**
 * An object this young counts even when nothing references it yet: the couple
 * uploaded it and the save that records it may still be in flight. Without this
 * a settle running between "PUT done" and "draft saved" would hand those bytes
 * back and let the next upload overshoot the cap.
 */
export const COUPLE_MEDIA_IN_FLIGHT_GRACE_MS = 15 * 60 * 1000;

function mb(bytes: number): string {
  const v = bytes / (1024 * 1024);
  return v < 10 ? `${(Math.round(v * 10) / 10).toFixed(1)} MB` : `${Math.round(v)} MB`;
}

/**
 * The plain reason the couple reads (INTERACTION_RULES: failure = the plain
 * reason; the uploader stays open, so picking again IS the "Try again").
 */
export function coupleMediaFullMessage(
  usedBytes: number,
  incomingBytes: number,
  capBytes: number = MAKER_EVENT_MEDIA_BYTES_CAP,
): string {
  const remaining = Math.max(0, capBytes - Math.max(0, usedBytes));
  // Under 0.1 MB left reads as "0.0 MB left" — say it is full instead.
  if (remaining < 0.1 * 1024 * 1024) {
    return `This event has used its ${mb(capBytes)} of uploads. Remove a photo or video to add more.`;
  }
  return `This file is ${mb(incomingBytes)}, and this event has ${mb(remaining)} of its ${mb(capBytes)} of uploads left. Remove a photo or video to make room, or pick a smaller file.`;
}

/** One object as R2's listing reports it. */
export type ListedObject = { key: string; size: number; lastModified: Date | null };

/**
 * Every `events/<eventId>/…` key named anywhere in `text` — the stringified rows
 * a ref can live on. Keys are minted by `/api/upload` as
 * `<prefix>/<uuid>-<sanitized filename>`, all `[A-Za-z0-9._/-]`, so the match
 * stops at the quote, `?` or space that ends a ref, an `r2://` ref or a public
 * URL alike.
 */
export function referencedEventKeys(text: string, eventId: string): Set<string> {
  const out = new Set<string>();
  if (!/^[0-9a-fA-F-]{36}$/.test(eventId)) return out;
  const re = new RegExp(`events/${eventId}/[A-Za-z0-9._/-]+`, 'g');
  for (const m of text.matchAll(re)) out.add(m[0]);
  return out;
}

/**
 * THE SETTLED NUMBER: the bytes this event's couple media really occupies — the
 * sum of R2's own sizes for every object in a counted folder that the event
 * still references, or that landed within the in-flight grace.
 *
 * A removed photo is no longer referenced, so it stops counting: that is how a
 * remove frees bytes. A presign whose PUT never happened has no object, so it
 * never counts either.
 */
export function measureCoupleMediaBytes(args: {
  eventId: string;
  objects: readonly ListedObject[];
  /** Every ref-holding row for the event, stringified and joined. */
  referenceText: string;
  now: Date;
  graceMs?: number;
}): number {
  const referenced = referencedEventKeys(args.referenceText, args.eventId);
  const grace = args.graceMs ?? COUPLE_MEDIA_IN_FLIGHT_GRACE_MS;
  let total = 0;
  for (const o of args.objects) {
    if (!isCoupleMediaMeterPath(o.key, args.eventId)) continue;
    const size = Number.isFinite(o.size) && o.size > 0 ? o.size : 0;
    if (size === 0) continue;
    const fresh = o.lastModified !== null && args.now.getTime() - o.lastModified.getTime() < grace;
    if (referenced.has(o.key) || fresh) total += size;
  }
  return total;
}
