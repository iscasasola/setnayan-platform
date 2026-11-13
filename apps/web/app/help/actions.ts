'use server';

import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { notifyAdminsOfHelpMessage } from '@/lib/help-message-notify.server';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { VENDOR_TIERS, type VendorTier } from '@/lib/vendor-tier-caps';
import { logHelpAsk, type HelpAskCoverage } from '@/lib/help-asks.server';
import { isStoreShellRequest } from '@/lib/request-platform';

const ASK_COVERAGES: ReadonlyArray<HelpAskCoverage> = ['user', 'guest', 'supplier', 'public', 'team'];

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

/**
 * ❓ "DID THIS ANSWER IT?" rides THIS action (`intent=answered`), not a new export — the server-action budget is full
 * (scripts/lint-server-action-budget.mjs), and Yes / No is the Help's own feedback into the Help's own log. It writes
 * one `help_asks` row (yes · no; no name, no email) and returns nothing: the press already says "Saved." in place.
 */
async function recordAnswered(formData: FormData): Promise<void> {
  const vote = formData.get('vote');
  const coverage = formData.get('coverage');
  if ((vote !== 'yes' && vote !== 'no') || typeof coverage !== 'string') return;
  if (!(ASK_COVERAGES as ReadonlyArray<string>).includes(coverage)) return;
  await logHelpAsk({
    words: trimmed(formData.get('words'), 120) || trimmed(formData.get('slug'), 120),
    coverage: coverage as HelpAskCoverage,
    surface: (await isStoreShellRequest()) ? 'app' : 'web',
    outcome: vote,
    articleSlug: trimmed(formData.get('slug'), 120) || null,
  });
}

/** Back to the Help this message was sent from — only ever a /help address with its own account (`for`). */
function helpBack(formData: FormData): string {
  const f = formData.get('for');
  return f === 'guest' || f === 'shop' ? `/help?for=${f}&` : '/help?';
}

export async function submitHelpMessage(formData: FormData) {
  if (formData.get('intent') === 'answered') return recordAnswered(formData);
  const back = helpBack(formData);
  const email = trimmed(formData.get('sender_email'), 160);
  const name = trimmed(formData.get('sender_name'), 128);
  const topic = trimmed(formData.get('topic'), 64);
  const subject = trimmed(formData.get('subject'), 160);
  // "Message us" from an answer sends what was asked and what was shown with it (prototype: "Sent with it: your
  // question and the answers we showed."), under the person's own words.
  const asked = trimmed(formData.get('asked'), 120);
  const shown = trimmed(formData.get('shown'), 600);
  const typed = trimmed(formData.get('body'), 4000);
  const body = typed && asked
    ? `${typed}\n\n— Asked in Help: “${asked}”${shown ? ` · shown: ${shown}` : ' · no answer shown'}`.slice(0, 4000)
    : typed;

  if (email.length === 0 || subject.length === 0 || body.length === 0) {
    return redirect(
      `${back}error=${encodeURIComponent('Email, subject, and message are required.')}`,
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
      `${back}error=${encodeURIComponent(error?.message ?? 'Could not submit. Try again.')}`,
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

  return redirect(`${back}submitted=${encodeURIComponent(data.public_id)}`);
}
