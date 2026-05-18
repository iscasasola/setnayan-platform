'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';
import { captureEvent } from '@/lib/analytics';
import { startConciergeTrial } from '@/app/dashboard/profile/concierge/actions';

const ALLOWED_TYPES = ['wedding'] as const; // V1: Weddings only per iteration 0000 § 2.5

// 0000 § 2.5b — DIY · Trial · Paid choice card (locked 2026-05-17).
// `paid` lands on the dashboard then routes to checkout; `trial` invokes
// startConciergeTrial server-side; `diy` lands on the dashboard with no
// upgrade.
const ALLOWED_CONCIERGE_CHOICES = ['diy', 'trial', 'paid'] as const;
type ConciergeChoice = (typeof ALLOWED_CONCIERGE_CHOICES)[number];

export async function createWeddingEvent(formData: FormData) {
  const display_name = String(formData.get('display_name') ?? '').trim();
  const event_type = String(formData.get('event_type') ?? 'wedding');
  const concierge_choice = String(formData.get('concierge_choice') ?? 'diy') as ConciergeChoice;

  if (!display_name) {
    return redirect('/dashboard/create-event?error=missing_name');
  }
  if (!ALLOWED_TYPES.includes(event_type as (typeof ALLOWED_TYPES)[number])) {
    return redirect('/dashboard/create-event?error=invalid_type');
  }
  const choice: ConciergeChoice = ALLOWED_CONCIERGE_CHOICES.includes(concierge_choice)
    ? concierge_choice
    : 'diy';

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
