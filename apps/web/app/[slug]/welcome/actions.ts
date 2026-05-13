'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession, clearGuestSession } from '@/lib/guest-session';

export async function confirmPlusOneName(
  slug: string,
  formData: FormData,
): Promise<void> {
  const first_name = String(formData.get('first_name') ?? '').trim();
  const last_name = String(formData.get('last_name') ?? '').trim();

  if (!first_name || !last_name) {
    redirect(`/${slug}/welcome?error=missing`);
  }
  if (first_name.length > 80 || last_name.length > 80) {
    redirect(`/${slug}/welcome?error=too_long`);
  }

  const session = await readGuestSession();
  if (!session) redirect(`/${slug}`);

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: primary } = await admin
    .from('guests')
    .select('guest_id, first_name')
    .eq('guest_id', session.guest_id)
    .maybeSingle();

  if (!primary?.guest_id) redirect(`/${slug}`);

  const { error } = await admin
    .from('guests')
    .update({
      first_name,
      last_name,
      plus_one_name_confirmed_at: now,
      updated_at: now,
    })
    .eq('guest_id', session.guest_id);

  if (error) {
    redirect(`/${slug}/welcome?error=${encodeURIComponent(error.message)}`);
  }

  // Record this as a separate scan event so the couple's admin can see the
  // onboarding moment distinctly from regular invitation scans.
  await admin.from('scan_events').insert({
    event_id: session.event_id,
    guest_id: session.guest_id,
    source: 'browser',
    context: { entry: 'plus_one_onboarded' },
  });

  redirect(`/${slug}`);
}

export async function abandonPlusOneInvite(
  slug: string,
  _formData: FormData,
): Promise<void> {
  // "This isn't me — I scanned the wrong code". Clear the cookie so no row is
  // mutated, then drop them on the public landing.
  await clearGuestSession();
  redirect(`/${slug}`);
}
