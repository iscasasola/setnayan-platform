'use server';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { notifyAdminsOfHelpMessage } from '@/lib/help-message-notify.server';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { VENDOR_TIERS, type VendorTier } from '@/lib/vendor-tier-caps';

function trimmed(raw: FormDataEntryValue | null, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, max);
}

/**
 * Priority-support stamp: if the submitter is a vendor (owns a store, or sits on
 * a vendor team), resolve their point-in-time tier so /admin/help can float paid
 * vendors to the front of the queue. Couples / guests / anonymous submitters get
 * NULL — they stay in the flat FIFO. Returns the highest tier across every
 * vendor profile the user is attached to (a user on several stores is served at
 * their best-paying store's SLA). Never throws — priority is best-effort and must
 * not block a support request.
 */
async function resolveSubmitterVendorTier(
  supabase: SupabaseClient,
  userId: string,
): Promise<VendorTier | null> {
  try {
    const profileIds = new Set<string>();

    const { data: owned } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .eq('user_id', userId);
    for (const row of owned ?? [])
      profileIds.add((row as { vendor_profile_id: string }).vendor_profile_id);

    const { data: memberships } = await supabase
      .from('vendor_team_members')
      .select('vendor_profile_id')
      .eq('user_id', userId);
    for (const row of memberships ?? [])
      profileIds.add((row as { vendor_profile_id: string }).vendor_profile_id);

    if (profileIds.size === 0) return null;

    const tiers = await Promise.all(
      [...profileIds].map((id) => resolveVendorTier(supabase, id)),
    );
    // Pick the strongest tier by its position in the VENDOR_TIERS ladder
    // (free < verified < solo < pro < enterprise).
    return tiers.reduce<VendorTier>(
      (best, t) =>
        VENDOR_TIERS.indexOf(t) > VENDOR_TIERS.indexOf(best) ? t : best,
      tiers[0] ?? 'free',
    );
  } catch {
    return null;
  }
}

export async function submitHelpMessage(formData: FormData) {
  const email = trimmed(formData.get('sender_email'), 160);
  const name = trimmed(formData.get('sender_name'), 128);
  const topic = trimmed(formData.get('topic'), 64);
  const subject = trimmed(formData.get('subject'), 160);
  const body = trimmed(formData.get('body'), 4000);

  if (email.length === 0 || subject.length === 0 || body.length === 0) {
    return redirect(
      `/help?error=${encodeURIComponent('Email, subject, and message are required.')}`,
    );
  }

  // Attach user_id when the submitter is signed in — doesn't reveal identity
  // beyond what they typed, but lets admins thread replies.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Vendor-side submissions get their tier snapshotted for priority triage in
  // /admin/help. Couple / guest / anon submissions leave this NULL.
  const submitterVendorTier = user?.id
    ? await resolveSubmitterVendorTier(supabase, user.id)
    : null;

  const { data, error } = await supabase
    .from('help_messages')
    .insert({
      user_id: user?.id ?? null,
      sender_email: email,
      sender_name: name.length > 0 ? name : null,
      topic: topic.length > 0 ? topic : null,
      subject,
      body,
      submitter_vendor_tier: submitterVendorTier,
    })
    .select('message_id, public_id')
    .single();

  if (error || !data) {
    return redirect(
      `/help?error=${encodeURIComponent(error?.message ?? 'Could not submit. Try again.')}`,
    );
  }

  // Notify every internal admin so they see a count in their dashboard bell (the shared loop — the supplier Report
  // tells the same people; `lib/help-message-notify.server.ts`). Never throws.
  await notifyAdminsOfHelpMessage({
    type: 'chat_message',
    messageId: data.message_id,
    title: `Help request · ${subject}`,
    body: `${email}: ${body.slice(0, 140)}`,
  });

  return redirect(`/help?submitted=${encodeURIComponent(data.public_id)}`);
}
