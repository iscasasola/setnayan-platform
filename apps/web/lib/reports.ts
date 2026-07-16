'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * fileReport — the shared write path behind the reusable "Report this page"
 * entry (app/_components/report-page-button.tsx). Files a report of a PUBLIC
 * page into the single existing moderation queue (public.user_reports, migration
 * 20261108000000), where it resolves at /admin/user-reports alongside every
 * other report — no second moderation surface (solo-op red line).
 *
 * Public-page targets (added by migration 20270812329751):
 *   • 'event'         — a public invitation page /[slug]; target_id = events.event_id
 *   • 'user_profile'  — a public profile page /u/[slug]; target_id = users.user_id
 *
 * The reporter is a public visitor who may be signed OUT (an invitation page is
 * public), so this runs server-side with the service-role client rather than
 * relying on the authenticated-only INSERT RLS policy — the same shape the
 * guest-camera report path (report_guest_capture) uses. When the reporter IS
 * signed in we stamp reporter_user_id (and dedup their open reports); anonymous
 * reports land with a NULL reporter, exactly like a guest-filed photo report.
 */

const REASONS = [
  'nudity_sexual',
  'violence',
  'hate_harassment',
  'spam',
  'not_my_event',
  'other',
] as const;
type Reason = (typeof REASONS)[number];

// Only the two PUBLIC-page targets are fileable through this entry. Photo /
// user / ai_output reports have their own dedicated in-context paths.
const PUBLIC_TARGETS = ['event', 'user_profile'] as const;
type PublicTarget = (typeof PUBLIC_TARGETS)[number];

export type FileReportInput = {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string | null;
};

export type FileReportResult = { ok: boolean; error?: string };

export async function fileReport(input: FileReportInput): Promise<FileReportResult> {
  const targetType = input.targetType;
  const targetId = typeof input.targetId === 'string' ? input.targetId.trim() : '';
  const reason = input.reason;
  const details = (input.details ?? '').toString().trim().slice(0, 2000) || null;

  if (!(PUBLIC_TARGETS as readonly string[]).includes(targetType)) {
    return { ok: false, error: 'bad_target' };
  }
  if (!targetId) {
    return { ok: false, error: 'bad_target' };
  }
  if (!(REASONS as readonly string[]).includes(reason)) {
    return { ok: false, error: 'bad_reason' };
  }

  const admin = createAdminClient();

  // Verify the target exists and resolve the event scope. An 'event' report is
  // event-scoped (event_id set → the couple also sees it); a 'user_profile'
  // report is not tied to any event (event_id stays NULL → admins only).
  let eventId: string | null = null;
  if ((targetType as PublicTarget) === 'event') {
    const { data } = await admin
      .from('events')
      .select('event_id')
      .eq('event_id', targetId)
      .maybeSingle();
    if (!data) return { ok: false, error: 'invalid_target' };
    eventId = data.event_id as string;
  } else {
    const { data } = await admin
      .from('users')
      .select('user_id')
      .eq('user_id', targetId)
      .maybeSingle();
    if (!data) return { ok: false, error: 'invalid_target' };
    eventId = null;
  }

  // Signed-in reporter (nullable — the page is public).
  let reporterUserId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    reporterUserId = user?.id ?? null;
  } catch {
    reporterUserId = null;
  }

  // One open report per (signed-in reporter, target) — keeps the queue clean.
  // Anonymous reporters can't be deduped (no stable key), matching the existing
  // guest-report path.
  if (reporterUserId) {
    const { data: existing } = await admin
      .from('user_reports')
      .select('report_id')
      .eq('reporter_user_id', reporterUserId)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('status', 'open')
      .maybeSingle();
    if (existing) return { ok: true };
  }

  const { error } = await admin.from('user_reports').insert({
    reporter_user_id: reporterUserId,
    event_id: eventId,
    target_type: targetType as PublicTarget,
    target_id: targetId,
    reason: reason as Reason,
    details,
  });
  if (error) return { ok: false, error: 'insert_failed' };

  return { ok: true };
}
