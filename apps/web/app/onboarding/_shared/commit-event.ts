'use server';

/**
 * Iteration 0053 Phase 3 — the GENERIC (non-wedding) onboarding commit. A SEPARATE
 * server action from `commitOnboardingWedding` (which stays byte-identical): the
 * wedding wizard is untouched. This reuses the same proven spine — anon-draft
 * session mint, unique slug, single events INSERT, event_members ownership — but
 * for a non-wedding type, with every wedding-only CHECK column NULL (built by the
 * pure `buildGenericEventInsert`). Inert until PR2's `/onboarding/[type]` route
 * calls it.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { anonOnboardingEnabled } from '@/lib/anon-onboarding';
import { experienceQuizEnabled } from '@/lib/experience-quiz';
import { generateUniqueSlug } from '@/lib/slugs';
import { resolveProfile } from '@/lib/event-type-profile';
import { buildGenericEventInsert } from '@/lib/onboarding/event-insert';
import type { GenericOnboardingPayload, GenericCommitResult } from '@/lib/onboarding/types';

export async function commitOnboardingEvent(
  payload: GenericOnboardingPayload,
): Promise<GenericCommitResult> {
  // The generic flow NEVER commits a wedding — that has its own dedicated commit
  // (commitOnboardingWedding) with the wedding CHECK columns + bride/groom seeds.
  if (!payload.eventType || payload.eventType === 'wedding') {
    return { ok: false, error: 'invalid_event_type' };
  }

  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Anon-draft onboarding (flag-gated): mint a Supabase NATIVE anonymous session
    // so the events + event_members insert + all RLS work unchanged. Same contract
    // as the wedding commit; OFF → unchanged not_authenticated.
    if (anonOnboardingEnabled()) {
      const { data: anon, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError || !anon.user) {
        console.error('[commitOnboardingEvent] anon sign-in failed:', anonError?.message);
        return { ok: false, error: 'not_authenticated' };
      }
      user = anon.user;
    } else {
      return { ok: false, error: 'not_authenticated' };
    }
  }

  // Resolve the profile for a sensible display-name fallback + to confirm the type
  // is real (degrades to GENERIC_PROFILE on a missing row, which is fine).
  const profile = await resolveProfile(payload.eventType);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'server_config_error' };
  }

  const displayName =
    payload.displayName?.trim() ||
    `Our ${profile.terminology.eventWord || 'Event'}`;
  const slug = await generateUniqueSlug(admin, displayName);
  const now = new Date().toISOString();

  const row = buildGenericEventInsert(
    { ...payload, displayName },
    {
      slug,
      now,
      userId: user.id,
      isAnonymous: Boolean(user.is_anonymous),
      experienceEnabled: experienceQuizEnabled(),
    },
  );

  // events.event_id is the UUID every FK + the dashboard route use (events.id is
  // the internal bigserial). The on_event_created trigger mints the join token.
  const { data: insertedEvent, error: insertError } = await admin
    .from('events')
    .insert(row)
    .select('event_id')
    .single();
  if (insertError || !insertedEvent) {
    console.error(
      '[commitOnboardingEvent] events INSERT failed:',
      insertError?.message,
      insertError?.code,
      insertError?.details,
    );
    return { ok: false, error: insertError?.message ?? 'event_insert_failed' };
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.event_id,
    user_id: user.id,
    member_type: 'couple', // the canonical "organizer" member_type (same as a non-wedding create)
    joined_via: 'created_event',
  });
  if (memberError) {
    console.error('[commitOnboardingEvent] event_members INSERT failed:', memberError.message);
    return { ok: false, error: memberError.message };
  }

  return { ok: true, eventId: insertedEvent.event_id };
}
