'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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

const ALLOWED_VISIBILITY = new Set(['public', 'unlisted', 'private']);

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
  const visibility = visibilityRaw as 'public' | 'unlisted' | 'private';

  await requireHostMembership(eventId);

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

  redirect(`/dashboard/${eventId}/website/privacy?saved=1`);
}
