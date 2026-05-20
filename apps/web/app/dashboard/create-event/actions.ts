'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';
import { startConciergeTrial } from '@/app/dashboard/profile/concierge/actions';

// V1.1 multi-event roster (iteration 0041). Wedding is the original V1
// type; gender_reveal (2026-05-20) and debut (2026-05-20) are the first
// V1.1 expansions. Other 0041 types (baptism, anniversary, etc.) land as
// separate per-type migrations as the product surfaces support them —
// vendor matching + Concierge are still wedding-themed, so non-wedding
// events render the dashboard tools (guest list / budget / etc.) as
// generic event-planning utilities.
const ALLOWED_TYPES = ['wedding', 'gender_reveal', 'debut'] as const;

// 0000 § 2.5b — DIY · Trial · Paid choice card (locked 2026-05-17).
// `paid` lands on the dashboard then routes to checkout; `trial` invokes
// startConciergeTrial server-side; `diy` lands on the dashboard with no
// upgrade.
const ALLOWED_CONCIERGE_CHOICES = ['diy', 'trial', 'paid'] as const;
type ConciergeChoice = (typeof ALLOWED_CONCIERGE_CHOICES)[number];

// Iteration 0043 — wedding-type picker. Active ceremonies + venue settings
// the create-event form may submit. CHECK constraints on `events` mirror
// these lists; we validate here so a bad submission is caught before the
// round-trip to the DB. The four "coming soon" faiths (christian / inc /
// muslim / cultural) are intentionally NOT in ALLOWED_CEREMONIES — the
// picker blocks them client-side and routes interest to
// couple_wedding_type_notify_signups via notifyWhenWeddingTypeLaunches below.
const ALLOWED_CEREMONIES = ['catholic', 'civil', 'mixed'] as const;
const ALLOWED_VENUES = [
  'banquet_hall',
  'garden',
  'beach',
  'destination',
  'heritage',
  'outdoor_tent',
  'civil_registrar',
] as const;
const ALLOWED_SECONDARY = ['catholic', 'civil', 'inc', 'christian', 'muslim', 'cultural'] as const;
const ALLOWED_MUSLIM_SUB = [
  'maranao',
  'tausug',
  'maguindanao',
  'sama_bajau',
  'yakan',
  'general_muslim',
] as const;
const ALLOWED_CULTURAL_SUB = [
  'igorot_cordillera',
  'manobo',
  'visayan_folk',
  'tagalog_folk',
  'kapampangan_folk',
  'other',
] as const;

export async function createWeddingEvent(formData: FormData) {
  const display_name = String(formData.get('display_name') ?? '').trim();
  const event_type = String(formData.get('event_type') ?? 'wedding');
  const concierge_choice = String(formData.get('concierge_choice') ?? 'diy') as ConciergeChoice;

  // Iteration 0043 — picker fields. Defaults match the events table column
  // defaults (catholic + banquet_hall) so a form submitted without the
  // picker still produces a valid row.
  const raw_ceremony = String(formData.get('ceremony_type') ?? 'catholic');
  const raw_venue = String(formData.get('venue_setting') ?? 'banquet_hall');
  const raw_sub_type = String(formData.get('ceremony_sub_type') ?? '').trim();
  const raw_is_mixed = String(formData.get('is_mixed_ceremony') ?? 'false') === 'true';
  const raw_secondary = String(formData.get('secondary_ceremony_type') ?? '').trim();

  const ceremony_type = (ALLOWED_CEREMONIES as readonly string[]).includes(raw_ceremony)
    ? raw_ceremony
    : 'catholic';
  const venue_setting = (ALLOWED_VENUES as readonly string[]).includes(raw_venue)
    ? raw_venue
    : 'banquet_hall';
  // Sub-type only persisted (and required) for muslim/cultural. Since the
  // picker blocks those today, ceremony_sub_type stays null in V1.1 but the
  // validation is in place for V1.2+ activation.
  const ceremony_sub_type = ceremony_type === 'muslim'
    ? ((ALLOWED_MUSLIM_SUB as readonly string[]).includes(raw_sub_type) ? raw_sub_type : null)
    : ceremony_type === 'cultural'
      ? ((ALLOWED_CULTURAL_SUB as readonly string[]).includes(raw_sub_type) ? raw_sub_type : null)
      : null;
  const is_mixed_ceremony = ceremony_type === 'mixed' && raw_is_mixed;
  const secondary_ceremony_type = is_mixed_ceremony
    && (ALLOWED_SECONDARY as readonly string[]).includes(raw_secondary)
    ? raw_secondary
    : null;

  // Conditional integrity guards — mirror the DB CHECK constraints so the
  // user sees a friendly error rather than a Postgres failure string.
  if ((ceremony_type === 'muslim' || ceremony_type === 'cultural') && !ceremony_sub_type) {
    return redirect('/dashboard/create-event?error=missing_sub_type');
  }
  if (is_mixed_ceremony && !secondary_ceremony_type) {
    return redirect('/dashboard/create-event?error=missing_secondary');
  }

  if (!display_name) {
    return redirect('/dashboard/create-event?error=missing_name');
  }
  if (!ALLOWED_TYPES.includes(event_type as (typeof ALLOWED_TYPES)[number])) {
    return redirect('/dashboard/create-event?error=invalid_type');
  }
  // Concierge is wedding-only in V1.1; force DIY for any other event_type
  // so a stale conciergeChoice (e.g. couple toggled "trial" on a wedding,
  // then changed event_type to gender_reveal without resetting the picker
  // UI) never starts a trial or charges a non-wedding event.
  const rawChoice: ConciergeChoice = ALLOWED_CONCIERGE_CHOICES.includes(concierge_choice)
    ? concierge_choice
    : 'diy';
  const choice: ConciergeChoice = event_type === 'wedding' ? rawChoice : 'diy';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login');
  }

  // Single-field event setup per iteration 0000 § 2.5 (locked 2026-05-14):
  // event_name only — date + venue are deferred to Setnayan Concierge or Profile.
  // Both writes go through the admin client because the user-scoped JWT can
  // be stale or the role can resolve to anon at the edge — RLS would then
  // reject the insert even though the action already authenticated the user.
  const admin = createAdminClient();
  const slug = await generateUniqueSlug(admin, display_name);

  // Insert the event. The on_event_created trigger mints the join token row.
  const { data: insertedEvent, error: insertError } = await admin
    .from('events')
    .insert({
      event_type,
      display_name,
      event_date: null,
      venue_name: null,
      venue_address: null,
      slug,
      is_primary: true,
      // Iteration 0043 — wedding-type picker columns. Defaults applied above
      // so a row always lands in a valid state per the events_*_check
      // constraints.
      ceremony_type,
      venue_setting,
      ceremony_sub_type,
      is_mixed_ceremony,
      secondary_ceremony_type,
    })
    .select('event_id, slug')
    .single();

  if (insertError || !insertedEvent) {
    return redirect(
      `/dashboard/create-event?error=${encodeURIComponent(insertError?.message ?? 'unknown')}`,
    );
  }

  // Add the creating user as a couple member.
  const { error: memberError } = await admin.from('event_members').insert({
    event_id: insertedEvent.event_id,
    user_id: user.id,
    member_type: 'couple',
    joined_via: 'created_event',
  });

  if (memberError) {
    return redirect(
      `/dashboard/create-event?error=${encodeURIComponent('member_link_failed: ' + memberError.message)}`,
    );
  }

  // Funnel event. Fire-and-forget; never block the redirect to the new
  // event dashboard.
  try {
    await captureEvent({
      distinctId: user.id,
      event: 'event_created',
      properties: {
        event_id: insertedEvent.event_id,
        event_type,
        concierge_choice: choice,
        ceremony_type,
        venue_setting,
        is_mixed_ceremony,
      },
    });
  } catch {
    // analytics never breaks the user-facing flow.
  }

  // 0000 § 2.5b — wire the choice card. Event is already created at this
  // point; the trial / paid options are layered on top, never gate creation.
  if (choice === 'trial') {
    try {
      const result = await startConciergeTrial({ eventId: insertedEvent.event_id });
      // Pass the trial-attach result through the URL so the dashboard can
      // surface the right inline status banner (started · already_used ·
      // enforcement_blocked · under_review).
      return redirect(
        `/dashboard/${insertedEvent.event_id}?concierge_trial=${result.status}`,
      );
    } catch (e) {
      // Trial failures shouldn't block the user — fall through to DIY landing.
      console.error('[create-event] trial start failed:', e);
    }
  } else if (choice === 'paid') {
    // Route the couple to the Concierge order checkout page. The order flow
    // exists in iteration 0034; until that route lands the order/new route
    // accepts ?sku=concierge_complete and surfaces payment instructions.
    return redirect(
      `/dashboard/${insertedEvent.event_id}/orders/new?sku=concierge_complete&intent=concierge`,
    );
  }

  return redirect(`/dashboard/${insertedEvent.event_id}`);
}

// Iteration 0043 — email capture for "Coming Soon" ceremony types. Returns a
// plain { ok } object instead of redirecting because the picker calls this
// from a client component over fetch and uses the result to flip the inline
// UI between "submitting → sent → error" states without leaving the form.
const NOTIFY_FAITHS = ['catholic', 'civil', 'inc', 'christian', 'muslim', 'cultural'] as const;

export async function notifyWhenWeddingTypeLaunches(
  formData: FormData,
): Promise<{ ok: boolean; reason?: string }> {
  const email = String(formData.get('email') ?? '').trim();
  const ceremony = String(formData.get('ceremony_type_interested') ?? '').trim();
  const region = String(formData.get('region') ?? '').trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'invalid_email' };
  }
  if (!(NOTIFY_FAITHS as readonly string[]).includes(ceremony)) {
    return { ok: false, reason: 'invalid_ceremony' };
  }

  // user_id is optional — the form works pre-account. When the caller IS
  // signed in we attribute the signup so admins can correlate later.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { error } = await admin.from('couple_wedding_type_notify_signups').insert({
    user_id: user?.id ?? null,
    email,
    ceremony_type_interested: ceremony,
    region,
  });

  if (error) {
    console.error('[create-event] notify signup failed:', error);
    return { ok: false, reason: error.message };
  }

  // Funnel signal — recruitment uses this to prioritize vendor sourcing by
  // faith × region demand. Fire-and-forget per the existing pattern.
  try {
    await captureEvent({
      distinctId: user?.id ?? email,
      event: 'wedding_type_notify_signup',
      properties: { ceremony_type: ceremony, region: region ?? undefined },
    });
  } catch {
    // analytics never breaks user-facing flow
  }

  return { ok: true };
}
