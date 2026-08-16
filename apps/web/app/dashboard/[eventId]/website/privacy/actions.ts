'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { EVENT_VISIBILITIES, type EventVisibility } from '@/lib/event-visibility';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveReturnTo } from '@/lib/editor-return';

/**
 * Landing-page visibility toggle — server actions.
 *
 * Per CLAUDE.md 2026-05-22 owner directive: hosts need a way to make
 * their wedding landing page private (or restrict who can view it).
 * Cross-references CLAUDE.md 2026-05-19 row 426 (Phase 4 Public
 * Editorial mode + 8 RA 10173 safe-harbor guardrails) — privacy
 * controls are required by spec; this PR ships the V1 minimum-viable
 * visibility lever.
 *
 * Gate pattern mirrors apps/web/app/dashboard/[eventId]/sponsors/actions.ts
 * (requireHostMembership): caller must be an accepted host (event_moderators)
 * OR a legacy event_members 'couple' row. Mirrors iteration 0048 V1 host
 * model from PR #183 (2026-05-20).
 */

const ALLOWED_VISIBILITY = new Set<string>(EVENT_VISIBILITIES);

async function requireHostMembership(
  eventId: string,
  opts?: { secured?: boolean },
): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Anon-draft boundary: making the page public/unlisted is a public-identity
  // action — a native anonymous principal must secure their plan first.
  if (opts?.secured && user.is_anonymous) {
    redirect(`/signup?next=/dashboard/${eventId}`);
  }

  // Source 1 — event_moderators (canonical going forward · iteration 0048).
  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();

  if (moderator) return user.id;

  // Source 2 — event_members couple row (V1 backwards-compat).
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (legacy && (legacy as { member_type: string }).member_type === 'couple') {
    return user.id;
  }

  throw new Error('Forbidden — only current hosts can change page visibility.');
}

/**
 * Update the landing-page visibility for an event. Form submits one of
 * 'public' / 'unlisted' / 'private'; we validate against the enum and
 * stamp `events.landing_page_visibility`.
 *
 * Revalidates the hub page + the public landing page so the change is
 * visible immediately (no hard refresh needed).
 */
export async function updateLandingPageVisibility(formData: FormData) {
  const eventIdRaw = formData.get('event_id');
  const visibilityRaw = formData.get('visibility');

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  const eventId = eventIdRaw as string;

  if (typeof visibilityRaw !== 'string' || !ALLOWED_VISIBILITY.has(visibilityRaw)) {
    throw new Error('Invalid visibility value.');
  }
  const visibility = visibilityRaw as EventVisibility;

  // Anon can set 'private' (harmless), but going public/unlisted requires a
  // secured account.
  await requireHostMembership(eventId, { secured: visibility !== 'private' });

  const supabase = await createClient();

  // Fetch the slug first so we can revalidate the public landing path
  // after the update lands. Same supabase client so RLS catches any
  // mid-flight membership change.
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Failed to load event: ${fetchErr.message}`);
  }
  if (!event) {
    redirect('/dashboard');
  }

  const { error: updateErr } = await supabase
    .from('events')
    .update({ landing_page_visibility: visibility })
    .eq('event_id', eventId);

  if (updateErr) {
    throw new Error(`Failed to update visibility: ${updateErr.message}`);
  }

  // Revalidate the hub + privacy editor + public landing so the toggle
  // surfaces immediately on every read path. The public landing path is
  // ISR-cached (`revalidate = 60` per app/[slug]/page.tsx) so this
  // invalidation matters — otherwise the locked screen could lag up to
  // 60 seconds after the host flips to 'private'.
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath(`/dashboard/${eventId}/website/privacy`);
  if (event.slug) {
    revalidatePath(`/${event.slug}`);
  }

  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/privacy?saved=1`, '?saved=1'),
  );
}

/**
 * Stories showcase consent — RA 10173 opt-in / one-click opt-out
 * (iteration 0046 "Phase B" surface referenced by
 * 20260519000000_phase_a_event_editorial_consent.sql).
 *
 * Sets/clears the couple's `users.public_summary_consent_at`. When set, the
 * couple's wedding becomes eligible for the public /realstories showcase 30 days
 * after the event (the loadPublishedShowcases gate); clearing it (NULL) removes
 * them. Consent is per-user (the migration: only customers/couples write it);
 * the host gate guarantees the caller owns this event, then we write the
 * caller's OWN row via the admin client (the `users` self-update path isn't
 * exposed to the anon/auth client).
 */
export async function setShowcaseConsent(formData: FormData) {
  const eventIdRaw = formData.get('event_id');
  const optIn = formData.get('opt_in') === '1';

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  const eventId = eventIdRaw as string;

  // Gate: caller must be a host (couple / accepted moderator) of this event.
  const userId = await requireHostMembership(eventId);

  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({
      public_summary_consent_at: optIn ? new Date().toISOString() : null,
    })
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update showcase consent: ${error.message}`);
  }

  revalidatePath(`/dashboard/${eventId}/website/privacy`);
  redirect(`/dashboard/${eventId}/website/privacy?saved=1`);
}

/**
 * Live media audience — who may watch the broadcast and the live photo wall.
 *
 * 🔴 THIS COLUMN HAD NO WRITER. `events.live_media_public` shipped on
 * 2026-09-20 as "the couple's opt-in for anonymous live media", `NOT NULL
 * DEFAULT FALSE`, read on every render of the guest site — and NOTHING
 * ANYWHERE SET IT. All five events in production are FALSE, including the
 * sample, because false is simply what the default was and there was never a
 * control to change it.
 *
 * What that costs: the guest site computes
 *
 *     liveMediaVisible = viewer is a guest OR live_media_public
 *
 * so a cookie-less visitor never sees the livestream or the live photo wall on
 * ANY event. That visitor is the relative overseas who opened the link someone
 * forwarded on Messenger — precisely the person a wedding livestream exists
 * for. They were being shown a page with no broadcast on it, on the day, while
 * the broadcast was running.
 *
 * The column also carries the ONLY audience decision the broadcast has, which
 * makes this the honest home for "we are live now": the couple opens the doors
 * when they are ready, and closes them after. (Nothing can detect whether a
 * stream is actually running — that would mean asking the YouTube API, and the
 * Google Cloud account is suspended, appeal 73857927.)
 *
 * ⚠ SERVICE-ROLE WRITE, DELIBERATELY. `live_media_public` is on the
 * withheld-from-authenticated list in
 * `20271005100000_events_column_update_privileges.sql` — its own comment says
 * "the host path deliberately routes through service-role", because
 * `events` UPDATE RLS is ROW-level and the anon key is public, so a
 * column a host could PATCH directly is a column anyone holding a host session
 * could set on any row their policy admits. The host gate below is what
 * authorizes it; the admin client is only how it is written.
 */
export async function setLiveMediaAudience(formData: FormData) {
  const eventIdRaw = formData.get('event_id');
  const open = formData.get('open') === '1';

  if (typeof eventIdRaw !== 'string' || eventIdRaw.length === 0) {
    redirect('/dashboard');
  }
  const eventId = eventIdRaw as string;

  // Opening the broadcast to people with no invitation is a public-audience
  // act, exactly like going public/unlisted — so an anonymous draft account
  // must secure itself first. Closing it again is always allowed.
  await requireHostMembership(eventId, { secured: open });

  const supabase = await createClient();
  const { data: event, error: fetchErr } = await supabase
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (fetchErr) {
    throw new Error(`Failed to load event: ${fetchErr.message}`);
  }
  if (!event) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ live_media_public: open })
    .eq('event_id', eventId);

  if (error) {
    throw new Error(`Failed to update the live audience: ${error.message}`);
  }

  // The public landing is ISR-cached (revalidate = 60), so without this the
  // doors take up to a minute to open — on the one day where a minute is the
  // difference between catching the entrance and missing it.
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath(`/dashboard/${eventId}/website/privacy`);
  if (event.slug) {
    revalidatePath(`/${event.slug}`);
    revalidatePath(`/${event.slug}/hub`);
  }

  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/privacy?saved=1`, '?saved=1'),
  );
}
