'use server';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import { notifyAdminsOfHelpMessage } from '@/lib/help-message-notify.server';
import { REPORT_BODY_MAX, REPORT_SUBJECT_MAX, reportOriginPage } from '@/lib/supplier-report';

/**
 * 🚩 SUBMIT REPORT — Clients › <client> › Report (owner 2026-11-08, DECISION_LOG "REPORT = SUBJECT · NOTE · ORIGIN":
 * *"report will be subject, note and we must know where it came from"*; THE ONE BUILD §5.4, B2 §2.6).
 *
 * It lands in the SHIPPED admin inbox — `help_messages` → /admin/help — with its origin (migration 20271325290605):
 * the reporter's own shop, the event it was filed on, and the page. The origin is never typed by the supplier: the
 * shop is the session's (`fetchOwnVendorProfile`), the event is the page's, the page is a fixed slug. The database
 * guards it again (`help_messages_origin_guard`: own shop · an event that shop talks to · user_id = auth.uid()).
 *
 * Then every admin is told IN THE APP ONLY (`supplier_report`, not on EMAIL_ENABLED_TYPES — no email). The insert is
 * the success; a failed notice is not reported as a failed report.
 *
 * 💾 Returns a state, no redirect (a save never resets the screen).
 */
export type ReportState =
  | { status: 'idle' }
  | { status: 'sent'; publicId: string }
  | { status: 'error'; message: string };

export async function submitSupplierReport(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const subject = String(formData.get('subject') ?? '').trim().slice(0, REPORT_SUBJECT_MAX);
  const body = String(formData.get('note') ?? '').trim().slice(0, REPORT_BODY_MAX);
  const eventId = String(formData.get('event_id') ?? '');
  const page = reportOriginPage(String(formData.get('page') ?? 'report'));
  if (!subject) return { status: 'error', message: 'Write a subject — one line.' };
  if (!body) return { status: 'error', message: 'Write a note.' };
  if (!eventId) return { status: 'error', message: 'Missing client.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please sign in again.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { status: 'error', message: 'Only a shop can send a report.' };

  // The client must be one this shop talks to (the trigger checks it again).
  const { data: thread, error: tErr } = await supabase
    .from('chat_threads')
    .select('thread_id')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (tErr) return { status: 'error', message: 'We couldn’t send your report. Please try again.' };
  if (!thread) return { status: 'error', message: 'This client is not one of yours.' };

  let tier: string | null = null;
  try {
    tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  } catch {
    tier = null; // priority is best-effort and never blocks a report
  }

  const { data, error } = await supabase
    .from('help_messages')
    .insert({
      user_id: user.id,
      sender_email: (user.email ?? profile.contact_email ?? 'unknown').slice(0, 160),
      sender_name: profile.business_name?.slice(0, 128) ?? null,
      topic: 'supplier_report',
      subject,
      body,
      submitter_vendor_tier: tier,
      origin_vendor_profile_id: profile.vendor_profile_id,
      origin_event_id: eventId,
      origin_page: page,
    })
    .select('message_id, public_id')
    .single();
  if (error || !data) {
    if (error) console.error('[submitSupplierReport] insert failed:', error.message);
    return { status: 'error', message: 'We couldn’t send your report. Nothing you typed was lost — please try again.' };
  }

  await notifyAdminsOfHelpMessage({
    type: 'supplier_report',
    messageId: (data as { message_id: string }).message_id,
    title: `Report · ${subject}`,
    body: `${profile.business_name ?? 'A supplier'}: ${body.slice(0, 140)}`,
  });
  return { status: 'sent', publicId: (data as { public_id: string }).public_id };
}
