/**
 * Surprise-mode ("hidden website") — the pure state resolver.
 *
 * Owner-locked 2026-07-12 (scope: "just the hidden website"). Some events are a
 * surprise for the honoree (a surprise anniversary the kids plan, a surprise
 * milestone birthday). The only way the app could spoil it is the event's PUBLIC
 * WEBSITE — so surprise-mode keeps that site SEALED until the event day, reusing
 * the exact machinery Save-the-Date already uses (private visibility + a
 * scheduled launch that auto-reveals at read time — see ./launch-save-the-date).
 *
 * `events.is_surprise` is only the host-side FRAMING marker; the seal itself is
 * `landing_page_visibility` + `scheduled_launch_at`. This module reads both and
 * reports one clean state for the dashboard to render. Pure — no I/O, no writes.
 */
import { resolveEffectiveVisibility, type LaunchState } from './launch-save-the-date';

/** The event fields surprise-mode reads (superset of LaunchState + the flag). */
export type SurpriseInput = LaunchState & {
  is_surprise?: boolean | null;
  event_date?: string | null;
};

export type SurpriseState = {
  /** The host flagged this event as a surprise. */
  isSurprise: boolean;
  /** Surprise is ON and the public site is still hidden (not yet revealed). */
  sealed: boolean;
  /** When the site auto-reveals (the scheduled launch), or null if unscheduled. */
  revealAt: string | null;
  /** Surprise is ON but nothing is scheduled to reveal it (no date set / already
   *  public) — the host must set an event date or launch manually. */
  needsRevealDate: boolean;
};

/**
 * Resolve the surprise state from an event row. `sealed` is the load-bearing bit:
 * the surprise is protecting the honoree exactly while the site reads as private.
 * Once the scheduled launch is due (or the host goes public), `sealed` is false —
 * the surprise is over, even if the flag is still set.
 */
export function resolveSurpriseState(
  event: SurpriseInput,
  now: number = Date.now(),
): SurpriseState {
  const isSurprise = event.is_surprise === true;
  const revealAt =
    typeof event.scheduled_launch_at === 'string' ? event.scheduled_launch_at : null;

  if (!isSurprise) {
    return { isSurprise: false, sealed: false, revealAt, needsRevealDate: false };
  }

  const effective = resolveEffectiveVisibility(event, now);
  const sealed = effective === 'private';
  // Surprise is on but nothing will reveal it: either it is already public, or it
  // is private with no scheduled launch (the host still needs to pick a date).
  const needsRevealDate = sealed && revealAt === null;

  return { isSurprise: true, sealed, revealAt, needsRevealDate };
}

/**
 * The scheduled-launch instant to seal a surprise site until — the event's own
 * date at local midnight (the site opens the morning of the celebration). Returns
 * null when there is no usable date yet, so the caller can seal privately and
 * prompt the host to set one. Kept here so the action and any preview agree.
 */
export function surpriseRevealAtFor(eventDate: string | null | undefined): string | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
