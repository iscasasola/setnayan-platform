'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import { ensureFreePapicOneCameraAdmin } from '@/lib/papic-one';
import { mintPapicOnboardingOrders } from '@/lib/papic-onboarding-orders';
import {
  PAPIC_FIELD_ONE_CAMERAS,
  PAPIC_FIELD_ONE_RUNG,
  PAPIC_FIELD_POOL_RUNG,
} from './_components/papic-step-field-names';
import { captureEvent } from '@/lib/analytics';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { getBlockingLifeEvent } from '@/app/dashboard/(account)/create-event/life-event-guard';

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

  // Life-event gate (2026-07-17): simple_event is LIFESTYLE class so this
  // returns null immediately (zero rules, unlimited — owner-verbatim). The
  // call stands anyway: every events-insert path runs the guard so the
  // lib/life-event-gate.test.ts insert-path scan holds as an invariant.
  const blockingLifeEvent = await getBlockingLifeEvent(supabase, user.id, {
    eventType: 'simple_event',
  });
  if (blockingLifeEvent) {
    return redirect(
      `/dashboard/create-event?error=life_event_exists&existing=${encodeURIComponent(blockingLifeEvent.eventId)}`,
    );
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

  // Arm the free Papic pool (owner-locked 2026-07-27 · 50 pts). A Simple Event is
  // vendor-free and the in-app services ARE the point of the type, so Papic must
  // be metered here as much as anywhere. Idempotent + non-fatal.
  await ensureFreePapicPoolGrantAdmin(admin, insertedEvent.event_id);
  // …and the ONE free Papic ONE camera: a dedicated camera with its own QR and
  // its own 5 unshared points (owner-locked 2026-07-29). Armed alongside the
  // shared pool because the two are different products — the pool grant does
  // NOT create a camera, and a couple with no camera has nothing to try. SQL-side
  // idempotent (fixed seat index + a partial unique index on the grant), so the
  // creation call and the studio self-heal collapse to one camera.
  await ensureFreePapicOneCameraAdmin(admin, insertedEvent.event_id);

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

  // ── what they picked on the Papic step (owner 2026-08-11) ────────────────
  // LAST, after the event, its ownership row and both free grants are committed,
  // so nothing here can cost them their event. Never throws: a rung that went
  // inactive mid-flow or a failed insert comes back as `paymentPath: null` and
  // they land on the ordinary dashboard with a working, free Papic and no
  // charge. Nothing is granted here — the order is minted `submitted` and the
  // shots appear only when an admin approves the payment, which is why this
  // cannot gate the finish (reconciliation is manual, up to a day).
  //
  // The three fields come from <PapicStepFields>, and carry service_codes + a
  // count and NO amount; mintPapicOnboardingOrders re-parses and re-prices them.
  const papic = await mintPapicOnboardingOrders(admin, {
    eventId: insertedEvent.event_id,
    userId: user.id,
    rawSelection: {
      poolRungKey: formData.get(PAPIC_FIELD_POOL_RUNG),
      oneRungKey: formData.get(PAPIC_FIELD_ONE_RUNG),
      oneExtraCameras: formData.get(PAPIC_FIELD_ONE_CAMERAS),
    },
  });

  return redirect(papic.paymentPath ?? `/dashboard/${insertedEvent.event_id}`);
}
