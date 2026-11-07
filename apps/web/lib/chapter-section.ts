/**
 * chapter-section.ts — the part of its chapter a moment is in (Ingress · Event · Egress), and BACKSTAGE. A leaf module
 * (no imports): the Event Hub's guest readers and its client bundle read it without `lib/schedule-chapters.ts`.
 */

/** A chapter's times, as stored (wall clocks in UTC columns — lib/schedule-datetime-local.ts). */
export type ChapterTimes = { start_at: string; end_at: string | null; time_tba?: boolean | null };

/**
 * Which part of its chapter a moment is in — Ingress · Event · Egress (plan §3 "Opening a chapter shows Ingress · Event
 * · Egress"). Read from the times, never stored: before the chapter starts is Ingress, at or after it ends is Egress,
 * the rest is the Event. A chapter with no end has no Egress by time.
 */
export type ChapterSection = 'Ingress' | 'Event' | 'Egress';
export function momentSection(momentStart: string, c: ChapterTimes): ChapterSection {
  if (c.time_tba) return 'Event';
  const t = Date.parse(momentStart);
  if (!Number.isFinite(t)) return 'Event';
  if (t < Date.parse(c.start_at)) return 'Ingress';
  if (c.end_at && t >= Date.parse(c.end_at)) return 'Egress';
  return 'Event';
}

/**
 * 🎭 BACKSTAGE (owner 2026-11-04, prototype frames 2 and 8: *"Ingress and egress are back-end plans: when suppliers set
 * up and pack up. They never show on the Event Hub. Only the chapter and its front-of-house moments do."*). A moment in
 * its chapter's Ingress or Egress — before the chapter starts or at/after it ends — is backstage, whatever its eye
 * says. Every guest reader drops it (`lib/guest-your-schedule.ts`, `lib/invitation-chapters.ts`,
 * `app/[slug]/_components/schedule-widget.tsx`, `lib/schedule-view-as.ts` guestDay); the chapter's setup and pack-up
 * times themselves are never read by them. 🔒 lib/a-guest-never-sees-backstage.test.ts
 */
export const BACKSTAGE_WORDS = 'Backstage · guests don’t see this';
export const BACKSTAGE_TIP =
  'Ingress and egress are back-end plans: when suppliers set up and pack up. They never show on the Event Hub — only the chapter and its front-of-house moments do.';

export function isBackstage(momentStart: string, c: ChapterTimes | null | undefined): boolean {
  if (!c || !c.start_at) return false;
  return momentSection(momentStart, c) !== 'Event';
}

/** A list of blocks (chapters and their moments together) without its backstage moments — for a reader holding both. */
export function withoutBackstage<B extends { block_id: string; parent_block_id?: string | null; start_at: string; end_at?: string | null; time_tba?: boolean | null }>(
  blocks: readonly B[],
): B[] {
  const parents = new Map(blocks.filter((b) => !b.parent_block_id).map((b) => [b.block_id, b]));
  return blocks.filter((b) => {
    if (!b.parent_block_id) return true;
    const c = parents.get(b.parent_block_id);
    return !(c && isBackstage(b.start_at, { start_at: c.start_at, end_at: c.end_at ?? null, time_tba: c.time_tba === true }));
  });
}

