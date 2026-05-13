'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateUniqueSlug } from '@/lib/slugs';

const ALLOWED_TYPES = ['wedding'] as const; // V1: Weddings only per iteration 0000 § 2.5

export async function createWeddingEvent(formData: FormData) {
  const display_name = String(formData.get('display_name') ?? '').trim();
  const event_date = String(formData.get('event_date') ?? '').trim() || null;
  const venue_name = String(formData.get('venue_name') ?? '').trim() || null;
  const venue_address = String(formData.get('venue_address') ?? '').trim() || null;
  const event_type = String(formData.get('event_type') ?? 'wedding');

  if (!display_name) {
    return redirect('/dashboard/create-event?error=missing_name');
  }
  if (!ALLOWED_TYPES.includes(event_type as (typeof ALLOWED_TYPES)[number])) {
    return redirect('/dashboard/create-event?error=invalid_type');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/login');
  }

  // Generate a unique URL slug from the display name.
  const admin = createAdminClient();
  const slug = await generateUniqueSlug(admin, display_name);

  // Insert the event. The on_event_created trigger mints the join token row.
  const { data: insertedEvent, error: insertError } = await supabase
    .from('events')
    .insert({
      event_type,
      display_name,
      event_date,
      venue_name,
      venue_address,
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
  const { error: memberError } = await supabase.from('event_members').insert({
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

  return redirect(`/dashboard/${insertedEvent.event_id}`);
}
