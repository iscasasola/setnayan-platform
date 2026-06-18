'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import { emitNotification } from '@/lib/notification-emit';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import type { KwentoMomentKey } from '@/lib/kwento-moments';
import { KWENTO_MOMENT_BY_KEY } from '@/lib/kwento-moments';

const MAX_NUDGES = 3;

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createAssignment(
  eventId: string,
  momentKey: KwentoMomentKey,
  guestId: string,
): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const admin = createAdminClient();
  const { error } = await admin.from('kwento_assignments').insert({
    event_id: eventId,
    moment_key: momentKey,
    assigned_guest_id: guestId,
    assigned_by_user_id: user.id,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'This guest is already assigned to that moment' };
    return { ok: false, error: error.message };
  }

  after(async () => {
    await dispatchNudgeEmail(admin, eventId, guestId, momentKey, 'assigned');
  });

  revalidatePath(`/dashboard/${eventId}/alaala/assignments`);
  return { ok: true };
}

export async function removeAssignment(
  eventId: string,
  momentKey: KwentoMomentKey,
  guestId: string,
): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('kwento_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('moment_key', momentKey)
    .eq('assigned_guest_id', guestId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${eventId}/alaala/assignments`);
  return { ok: true };
}

export async function nudgeAssignee(assignmentId: string): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const admin = createAdminClient();

  const { data: row, error: readErr } = await admin
    .from('kwento_assignments')
    .select('assignment_id, event_id, moment_key, assigned_guest_id, nudge_count')
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (readErr || !row) return { ok: false, error: 'Assignment not found' };
  if ((row.nudge_count as number) >= MAX_NUDGES) {
    return { ok: false, error: `Nudge limit reached (${MAX_NUDGES} per assignment)` };
  }

  const { error: updErr } = await admin
    .from('kwento_assignments')
    .update({
      nudge_count: (row.nudge_count as number) + 1,
      last_nudged_at: new Date().toISOString(),
    })
    .eq('assignment_id', assignmentId);

  if (updErr) return { ok: false, error: updErr.message };

  after(async () => {
    await dispatchNudgeEmail(
      admin,
      row.event_id as string,
      row.assigned_guest_id as string,
      row.moment_key as KwentoMomentKey,
      'nudge',
    );
  });

  revalidatePath(`/dashboard/${row.event_id as string}/alaala/assignments`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Internal helper — sends email + optional in-app notification to the guest
// ---------------------------------------------------------------------------

async function dispatchNudgeEmail(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
  momentKey: KwentoMomentKey,
  variant: 'assigned' | 'nudge',
): Promise<void> {
  try {
    const moment = KWENTO_MOMENT_BY_KEY.get(momentKey);
    if (!moment) return;

    const [{ data: guest }, { data: event }] = await Promise.all([
      admin
        .from('guests')
        .select('first_name, display_name, email')
        .eq('guest_id', guestId)
        .maybeSingle(),
      admin
        .from('events')
        .select('display_name, event_date')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);

    if (!guest?.email) return;

    const guestName = (guest.display_name as string) || (guest.first_name as string) || 'Guest';
    const coupleName = (event?.display_name as string) || 'the couple';

    const subject =
      variant === 'assigned'
        ? `You've been asked to tell a story — ${moment.label}`
        : `A gentle reminder: share your story of the ${moment.label}`;

    const text =
      variant === 'assigned'
        ? `Hi ${guestName},\n\n${coupleName} would love to hear your story of the ${moment.label}.\n\nHead to their Setnayan page to add your message — it'll become part of their living wedding memory.\n\nSetnayan`
        : `Hi ${guestName},\n\n${coupleName} wanted to remind you — they'd still love to hear your story of the ${moment.label}.\n\nYour words mean more than you know.\n\nSetnayan`;

    if (isEmailConfigured()) {
      await sendEmail({ to: guest.email as string, subject, text });
    }

    // In-app notification if the guest has a linked account
    const { data: member } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();

    if (member?.user_id) {
      await emitNotification({
        userId: member.user_id as string,
        type: 'kwento_assignment_nudge',
        title: subject,
        relatedUrl: `/dashboard/${eventId}/alaala`,
      });
    }
  } catch (e) {
    console.error('[kwento-assignments] nudge email failed:', e);
  }
}
