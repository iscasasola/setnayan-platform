'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidSlug } from '@/lib/slugs';

/**
 * Slug edit server action — Website tab variant.
 *
 * WHY a Website-tab-specific action when invitation/actions.ts already has
 * `updateEventSlug`?
 *   1. Revalidation surface is different. The Website tab is the canonical
 *      surface for the public URL going forward (CLAUDE.md 2026-05-22 owner
 *      directive) — it owns the iframe preview + QR + share link, so it
 *      must revalidate `/dashboard/${eventId}/website` first. The
 *      invitation editor stays as a sibling surface for the monogram +
 *      guest-tokens it owns; both call paths revalidate the public
 *      `/[slug]` landing page so the surface that drove the change sees
 *      its own fresh state.
 *   2. Old + new slug invalidation. When the slug rotates, the OLD path
 *      may still be ISR-cached (per `revalidate = 60` on
 *      apps/web/app/[slug]/page.tsx). Without invalidating both, a guest
 *      pasting the old URL could load a stale ISR copy for up to 60
 *      seconds — the host's intent is "the new URL is live now."
 *   3. Host-gate enforcement at action time. RLS on `events.slug` UPDATE
 *      already restricts writes to the host (event_moderators with
 *      accepted_at IS NOT NULL OR legacy event_members couple row), but
 *      we mirror the pattern from website/privacy/actions.ts so the
 *      action returns a clean error path instead of a Postgres
 *      `permission denied for table events` if something is mis-wired.
 *
 * Validation uses the canonical `isValidSlug()` from @/lib/slugs which
 * also checks the RESERVED_SLUGS set — so app routes like `dashboard`
 * `vendors` `admin` `weddings` `privacy` `for-vendors` are all blocked
 * at action time AS WELL AS at the live-check endpoint.
 */
async function requireHostMembership(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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

  throw new Error('Forbidden — only current hosts can change the wedding website slug.');
}

/**
 * Update the event's slug from the Website tab inline editor.
 *
 * Signature mirrors apps/web/app/dashboard/[eventId]/invitation/actions.ts
 * updateEventSlug — `.bind(null, eventId)` from the page wraps the
 * eventId so <SlugField> stays a generic component that only takes
 * `saveAction(formData)`.
 */
export async function updateEventSlugFromWebsite(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const requested = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase();

  if (!requested) {
    redirect(`/dashboard/${eventId}/website?slug_error=missing`);
  }

  // Validate format + reserved-slug guard in one call. Mirrors the
  // /api/slugs/check endpoint so the action can't be bypassed by a
  // direct form submit that skipped the debounced live-check.
  if (!isValidSlug(requested)) {
    if (requested.length < 3 || requested.length > 32) {
      redirect(`/dashboard/${eventId}/website?slug_error=invalid_format`);
    }
    if (!/^[a-z0-9-]+$/.test(requested)) {
      redirect(`/dashboard/${eventId}/website?slug_error=invalid_chars`);
    }
    redirect(`/dashboard/${eventId}/website?slug_error=reserved`);
  }

  await requireHostMembership(eventId);

  const admin = createAdminClient();

  // Uniqueness check — case-insensitive across all events except this one.
  const { data: clash } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', requested)
    .neq('event_id', eventId)
    .maybeSingle();
  if (clash) {
    redirect(`/dashboard/${eventId}/website?slug_error=taken`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Read the old slug so we can:
  //  (a) invalidate its ISR-cached public landing path (else the old URL
  //      could serve stale HTML for up to 60s after rotation), and
  //  (b) log the change to slug_change_log for the 90-day-redirect
  //      promise we already make in apps/web/middleware.ts.
  const { data: existing } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  const { error: updateErr } = await supabase
    .from('events')
    .update({ slug: requested, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (updateErr) {
    redirect(
      `/dashboard/${eventId}/website?slug_error=${encodeURIComponent(updateErr.message)}`,
    );
  }

  // Log the rotation. The slug_change_log table powers the 90-day
  // redirect from old slug → new slug in middleware.ts; failures here
  // shouldn't roll back the update (logging is best-effort).
  if (existing?.slug && existing.slug !== requested) {
    await admin.from('slug_change_log').insert({
      entity_type: 'event',
      entity_id: eventId,
      old_slug: existing.slug,
      new_slug: requested,
      changed_by: user?.id ?? null,
    });
  }

  // Revalidate every surface that displays the slug so the rotation is
  // visible immediately — no hard refresh needed by the host, no stale
  // ISR for guests landing on either URL.
  revalidatePath(`/dashboard/${eventId}/website`);
  revalidatePath(`/dashboard/${eventId}/invitation`);
  revalidatePath(`/${requested}`);
  if (existing?.slug && existing.slug !== requested) {
    revalidatePath(`/${existing.slug}`);
  }

  redirect(`/dashboard/${eventId}/website?slug_saved=1`);
}
