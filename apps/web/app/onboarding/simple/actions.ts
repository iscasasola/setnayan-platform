'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';
import { getCreatableEventTypes } from '@/lib/event-types-db';

/**
 * commitSimpleEvent — the create commit for a SIMPLE EVENT (owner 2026-06-27).
 *
 * A Simple Event is a vendor-free event whose only purpose is to exercise
 * Setnayan's in-app services. Its onboarding asks for just two things: a name
 * and a date. Unlike the generic onboarding commit (which stashes the date in
 * `date_candidates` and leaves `event_date` NULL), we set `event_date` directly
 * with day precision — the date is the whole point, so it must show everywhere
 * the dashboard reads `events.event_date`.
 *
 * Mirrors createWeddingEvent's proven non-wedding branch: every wedding-only
 * CHECK column is NULL/false, satisfying events_wedding_fields_consistency. The
 * event_type FK + the enabled-roster check are the backstops against a stale
 * form posting a bad type. Login-required (reached from the authed picker).
 */
export async function commitSimpleEvent(formData: FormData) {
  const display_name = String(formData.get('display_name') ?? '').trim();
  const event_date = String(formData.get('event_date') ?? '').trim();

  if (!display_name) {
    return redirect('/onboarding/simple?error=missing_name');
  }
  // YYYY-MM-DD from <input type="date">. Reject anything else so a hand-crafted
  // post can't write garbage into the date column.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    return redirect('/onboarding/simple?error=missing_date');
  }

  // The type must be in the enabled create-roster (same gate as the picker).
  const creatable = await getCreatableEventTypes();
  if (!creatable.some((t) => t.key === 'simple_event')) {
    return redirect('/dashboard/create-event?error=invalid_type');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login?next=/onboarding/simple');
  }

  // Both writes go through the admin client because the user-scoped JWT can be
  // stale / resolve to anon at the edge — RLS would then reject the insert even
  // though the action already authenticated the user (same as createWeddingEvent).
  const admin = createAdminClient();
  const slug = await generateUniqueSlug(admin, display_name);

  const { data: insertedEvent, error: insertError } = await admin
    .from('events')
    .insert({
      event_type: 'simple_event',
      display_name,
      event_date,
      // We have an exact date → day precision (the column DEFAULTs to 'year').
      event_date_precision: 'day',
      venue_name: null,
      venue_address: null,
      slug,
      is_primary: true,
      // Wedding-only CHECK columns: NULL/false for a non-wedding type
      // (events_wedding_fields_consistency requires this).
      ceremony_type: null,
      venue_setting: null,
      ceremony_sub_type: null,
      is_mixed_ceremony: false,
      secondary_ceremony_type: null,
      ceremony_type_locked_at: null,
      ceremony_type_locked_by: null,
      bride_name: null,
      groom_name: null,
    })
    .select('event_id')
    .single();

  if (insertError || !insertedEvent) {
    return redirect(
      `/onboarding/simple?error=${encodeURIComponent(insertError?.message ?? 'unknown')}`,
    );
  }

  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.event_id,
    user_id: user.id,
    member_type: 'couple', // the canonical "organizer" member_type (event-agnostic)
    joined_via: 'created_event',
  });
  if (memberError) {
    return redirect(
      `/onboarding/simple?error=${encodeURIComponent('member_link_failed: ' + memberError.message)}`,
    );
  }

  // Funnel event — fire-and-forget, never blocks the redirect.
  try {
    await captureEvent({
      distinctId: user.id,
      event: 'event_created',
      properties: {
        event_id: insertedEvent.event_id,
        event_type: 'simple_event',
        concierge_choice: 'diy',
      },
    });
  } catch {
    // analytics never breaks the user-facing flow.
  }

  return redirect(`/dashboard/${insertedEvent.event_id}`);
}
