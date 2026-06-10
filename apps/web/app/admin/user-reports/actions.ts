'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// /admin/user-reports actions — moderator resolution path for the UGC report
// queue (Apple guideline 1.2 / Google Play UGC). A report can be:
//   · hidden     — hide the reported photo (papic_guest_captures.hidden_at) AND
//                  mark the report actioned.
//   · blocked    — event-scoped block of the uploading guest AND mark actioned.
//   · escalated  — leave the content up but flag the report as escalated
//                  (action_taken note) for owner/legal review; status actioned.
//   · dismissed  — no action; status dismissed.
//
// Mirrors the requireAdmin + revalidatePath shape of app/admin/disputes/actions.ts.

async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return { userId: user.id };
}

const ACTIONS = ['hide', 'block', 'escalate', 'dismiss'] as const;
type Action = (typeof ACTIONS)[number];

function isAction(v: FormDataEntryValue | null): v is Action {
  return typeof v === 'string' && (ACTIONS as readonly string[]).includes(v);
}

const ACTION_NOTE: Record<Action, string> = {
  hide: 'Content hidden by Setnayan moderator.',
  block: 'Uploader blocked (event-scoped) by Setnayan moderator.',
  escalate: 'Escalated to owner / legal review.',
  dismiss: 'Dismissed — no policy violation found.',
};

const ACTION_STATUS: Record<Action, 'actioned' | 'dismissed'> = {
  hide: 'actioned',
  block: 'actioned',
  escalate: 'actioned',
  dismiss: 'dismissed',
};

/**
 * Resolve a UGC report. Optionally hides the reported photo and/or blocks the
 * uploading guest (event-scoped), then stamps status + action_taken + reviewer.
 */
export async function resolveReport(formData: FormData) {
  const { userId } = await requireAdmin();
  const reportId = formData.get('report_id');
  const action = formData.get('action');

  if (typeof reportId !== 'string' || reportId.length === 0) {
    throw new Error('Invalid input');
  }
  if (!isAction(action)) {
    throw new Error('Pick an action');
  }

  const admin = createAdminClient();

  // Load the report so we know the target + event.
  const { data: report, error: loadError } = await admin
    .from('user_reports')
    .select('report_id, event_id, target_type, target_id, status')
    .eq('report_id', reportId)
    .maybeSingle();
  if (loadError || !report) {
    throw new Error('Report not found');
  }

  // Side effects for the content-action lanes. Both target the reported photo
  // capture; a 'user' target means the target_id IS the guest id.
  if (action === 'hide' && report.target_type === 'photo') {
    await admin
      .from('papic_guest_captures')
      .update({ hidden_at: new Date().toISOString() })
      .eq('capture_id', report.target_id as string)
      .eq('event_id', report.event_id as string);
  }

  if (action === 'block') {
    // Resolve the uploading guest. For a photo target, look it up from the
    // capture; for a user target, the target_id is already the guest id.
    let guestId: string | null = null;
    if (report.target_type === 'user') {
      guestId = report.target_id as string;
    } else if (report.target_type === 'photo') {
      const { data: cap } = await admin
        .from('papic_guest_captures')
        .select('guest_id')
        .eq('capture_id', report.target_id as string)
        .maybeSingle();
      guestId = (cap?.guest_id as string | null) ?? null;
    }
    if (guestId) {
      await admin.from('event_blocked_users').upsert(
        {
          event_id: report.event_id as string,
          blocked_guest_id: guestId,
          blocked_by_user_id: userId,
          reason: 'Blocked from admin report review.',
        },
        { onConflict: 'event_id,blocked_guest_id', ignoreDuplicates: true },
      );
      // Also hide the offending photo when we block off a photo report.
      if (report.target_type === 'photo') {
        await admin
          .from('papic_guest_captures')
          .update({ hidden_at: new Date().toISOString() })
          .eq('capture_id', report.target_id as string)
          .eq('event_id', report.event_id as string);
      }
    }
  }

  const { error: updateError } = await admin
    .from('user_reports')
    .update({
      status: ACTION_STATUS[action],
      action_taken: ACTION_NOTE[action],
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('report_id', reportId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath('/admin/user-reports');
}
