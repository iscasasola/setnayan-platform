import { normalizeVisibility, openToStrangers, type EventVisibility } from '@/lib/event-visibility';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Save-the-Date launch helpers — the single source of truth for "what it means
 * for a wedding website to go public", shared by:
 *   • the manual "Launch now" action (launchSaveTheDate, save-the-date/actions.ts)
 *   • the scheduled (cron-free) auto-launch evaluated at read time in
 *     apps/web/app/[slug]/page.tsx
 *   • the scheduling UI (status copy on the launch panel + privacy page)
 *
 * Owner ruling 2026-06-20: a wedding page is PRIVATE until the couple launches
 * their Save-the-Date. Owner ask 2026-06-28: couples can also SCHEDULE that
 * launch for a future date/time (events.scheduled_launch_at). Both paths flip
 * the same columns, so they live here and can never drift.
 */

/** The visibility-bearing event fields these helpers read. */
export type LaunchState = {
  landing_page_visibility?: EventVisibility | null;
  scheduled_launch_at?: string | null;
  std_launched_at?: string | null;
};

/**
 * True when a private event's scheduled launch moment has arrived. The ONLY
 * trigger for the cron-free auto-launch — evaluated fresh on every page read.
 * `now` is injectable for testing; defaults to the current instant.
 */
export function isScheduledLaunchDue(
  event: LaunchState,
  now: number = Date.now(),
): boolean {
  // 🔑 NAMED, NOT EXCLUDED. A scheduled launch flips a PRIVATE page public at
  // its moment — that is the only case it was built for. Any other setting is a
  // deliberate choice by the couple, and 'invited_accounts' especially must
  // never be auto-flipped to public by a timer they set months earlier. The old
  // spelling (`!== 'private'`) happened to decline too, but only by accident of
  // which side of the test the new value landed on.
  const autoLaunchable = normalizeVisibility(event.landing_page_visibility) === 'private';
  if (!autoLaunchable) return false;
  if (!event.scheduled_launch_at) return false;
  const due = new Date(event.scheduled_launch_at).getTime();
  return Number.isFinite(due) && due <= now;
}

/**
 * Effective visibility for a render: the stored visibility, except a private
 * event whose scheduled launch is due reads as 'public'. Pure — no writes. Used
 * by both generateMetadata (robots/index) and the page body so they agree.
 */
export function resolveEffectiveVisibility(
  event: LaunchState,
  now: number = Date.now(),
): EventVisibility {
  if (isScheduledLaunchDue(event, now)) return 'public';
  // Normalised, not cast: an unknown value must fail to 'private', never leak
  // through as itself and get compared by exclusion downstream.
  return normalizeVisibility(event.landing_page_visibility);
}

/**
 * Flip an event public: visibility -> 'public', stamp std_launched_at (the
 * go-live moment), and clear any pending schedule. Idempotent — safe to call on
 * an already-public event (re-launch). Returns the event's slug for revalidation
 * (or null on failure). Callers own revalidatePath() + email fan-out so this
 * stays usable from both a server action and a deferred after() task.
 */
export async function publishSaveTheDate(
  client: SupabaseClient,
  eventId: string,
): Promise<{ slug: string | null } | null> {
  const { data, error } = await client
    .from('events')
    .update({
      landing_page_visibility: 'public',
      std_launched_at: new Date().toISOString(),
      scheduled_launch_at: null,
    })
    .eq('event_id', eventId)
    .select('slug')
    .single();
  if (error || !data) return null;
  return { slug: (data.slug as string | null) ?? null };
}

/**
 * What the COUPLE should be told about their own page — derived from the same
 * predicate the guest page renders from, never from a separate signal.
 *
 * 🔴 THE BUG THIS EXISTS FOR. Two surfaces claimed the page was live on
 * evidence that had nothing to do with whether anyone could open it:
 *
 *   • the website home showed a green tick and "Live — this link is yours" the
 *     moment `event.slug` was non-null. A slug is a NAME. Every event has one
 *     from creation, months before launch, and a private page has one too.
 *   • the privacy page computed `launched = std_launched_at || visibility ===
 *     'public'`, so a couple who launched their Save-the-Date and LATER set
 *     visibility to Private saw "Your page is live — anyone with your link can
 *     view your page" directly above a radio button set to Private. The banner
 *     and the control contradicted each other on the same screen, and the
 *     banner was the wrong one: guests were getting the locked screen.
 *
 * A couple puts this link on printed invitations. "Live" has to mean a person
 * who opens it sees the page.
 *
 * `launchedButHidden` is the case worth naming: they DID launch, and something
 * they changed afterwards is now overriding it. Saying "not live" alone would
 * be true and useless — they would go looking for a launch button they already
 * pressed.
 */
export type SiteReachability = {
  /** Can a person who opens the link see the page right now? */
  reachable: boolean;
  /**
   * public (indexable) · unlisted (link-only) · invited_accounts (guest list,
   * signed in) · private (locked screen).
   */
  visibility: EventVisibility;
  /** They launched, but the page is private anyway — explain, don't just deny. */
  launchedButHidden: boolean;
  /** A launch is set for the future and has not arrived yet. */
  scheduled: boolean;
};

export function resolveSiteReachability(
  event: LaunchState & { slug?: string | null },
  now: number = Date.now(),
): SiteReachability {
  const visibility = resolveEffectiveVisibility(event, now);
  // No slug means there is no address to open, whatever the visibility says.
  const hasAddress = Boolean(event.slug);
  // 🔑 ALLOW-LIST, NOT `!== 'private'`. "Reachable" here means a person who was
  // sent the address can open it. 'invited_accounts' fails that — the link
  // alone does nothing — so the old exclusion test would have told the host
  // their site was reachable when it was not.
  const reachable = hasAddress && openToStrangers(visibility);
  return {
    reachable,
    visibility,
    launchedButHidden:
      Boolean(event.std_launched_at) && !openToStrangers(visibility),
    scheduled:
      visibility === 'private' &&
      Boolean(event.scheduled_launch_at) &&
      !isScheduledLaunchDue(event, now),
  };
}
