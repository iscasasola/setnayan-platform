'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  collectEventMediaRefs,
  sweepEventMedia,
} from '@/lib/event-media-sweep';
import { emitNotification } from '@/lib/notification-emit';

/**
 * /admin/event-deletions — a couple has asked us to remove a celebration that
 * money is holding.
 *
 * ─── WHY THIS QUEUE EXISTS ─────────────────────────────────────────────────
 * A couple can remove their own celebration. They cannot when money has moved:
 * a bill we confirmed, an official receipt, or a payment nobody has checked
 * yet. Until 2026-08-28 that was a sentence and a Cancel button — "message us
 * and we'll help" was written down and was not a control. This is the control.
 *
 * ⚖ WHY A PERSON ANSWERS EACH ONE, rather than the couple pressing through.
 * The alternative was to let them remove it and lose what they paid for, said
 * on screen as "no refund". That is a promise about money printed next to
 * services carrying a BIR official receipt, and it can be made at 1 a.m. with
 * nobody in the loop. Answering by hand costs nothing today — production has
 * held exactly one bill, ever — and keeps the decision with a human until there
 * is enough of it to write a rule from.
 *
 * ─── THERE IS NO ONE-CLICK APPROVE, AND THAT IS THE DESIGN ─────────────────
 * `lib/admin/queue-peek.ts` states the house rule: a fast button invites a
 * wrong call at speed on exactly the queues where being wrong costs most.
 * Approving one of these destroys a celebration's photographs and ends paid
 * services. It is the most irreversible thing in this console, so it takes a
 * typed note and opens nothing else.
 */

async function requireAdmin() {
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
  return { adminUserId: user.id };
}

/**
 * Load a request and prove it is still answerable.
 *
 * 🔑 A STALE REQUEST IS THE NORMAL CASE, NOT AN EDGE ONE. The couple can
 * withdraw theirs, and two admins can open the same row. Checking the status
 * here — rather than trusting what the page rendered a minute ago — is what
 * stops a second approval destroying a celebration whose request was already
 * withdrawn.
 */
async function loadPending(requestId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('event_deletion_requests')
    .select('id, event_id, event_name, user_id, status, reason_code, reason')
    .eq('id', requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('That request is gone.');
  if (data.status !== 'pending') {
    throw new Error('That request has already been answered.');
  }
  return data as {
    id: string;
    event_id: string;
    event_name: string;
    user_id: string;
    status: string;
    reason_code: string;
    reason: string | null;
  };
}

/**
 * Remove the celebration, for good, because the couple asked us to.
 *
 * 🚨 THE FILES ARE COLLECTED BEFORE THE DELETE AND SWEPT AFTER IT. There is no
 * row left to name them afterwards — the keys live on the photo rows and on the
 * celebration itself, and both are gone the moment the DELETE lands. The
 * couple's own removal path carries the identical sequence for the identical
 * reason. ⚠ The older `/admin/events` delete does NOT sweep, which is how an
 * admin removal could tell a couple their photographs were gone while the files
 * sat in storage; that path is fixed in the same change.
 */
export async function approveEventDeletion(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const note = String(formData.get('admin_note') ?? '').trim();
  if (!requestId) throw new Error('Which request?');
  if (!note) {
    throw new Error(
      'Say what you did about the money before removing the celebration.',
    );
  }

  const req = await loadPending(requestId);
  const admin = createAdminClient();

  const mediaRefs = await collectEventMediaRefs(req.event_id);

  /*
    Unpaid bills are cancelled first or they OUTLIVE the celebration invisibly:
    `orders.event_id` is ON DELETE SET NULL, so the bill survives, still owing
    money, with its link wiped — and the buyer's only route to a bill is through
    the celebration. The couple's own path learned this from a real ₱499 order
    stranded in production on 2026-08-20.

    ⚠ SETTLED BILLS ARE DELIBERATELY LEFT ALONE. A paid bill is a receipt and a
    BIR record; what happens to that money is the note above, decided by a
    person, not something this action rewrites.
  */
  const { error: strandErr } = await admin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('event_id', req.event_id)
    .in('status', ['submitted', 'awaiting_payment']);
  if (strandErr) {
    console.error('[event-deletions] could not cancel unpaid bills', strandErr);
  }

  const { data: deleted, error: delErr } = await admin
    .from('events')
    .delete()
    .eq('event_id', req.event_id)
    .select('event_id');
  if (delErr) throw new Error(delErr.message);

  /*
    🔑 THE REQUEST IS MARKED EVEN IF THE CELEBRATION WAS ALREADY GONE. A row
    that returns nothing means somebody removed it another way between the
    request and this press — the answer still has to be recorded, or the queue
    keeps a row nobody can ever drain.
  */
  await admin
    .from('event_deletion_requests')
    .update({
      status: 'approved',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      admin_note: note.slice(0, 2000),
    })
    .eq('id', req.id);

  if (deleted && deleted.length > 0 && mediaRefs && mediaRefs.length > 0) {
    const swept = await sweepEventMedia(mediaRefs);
    if (swept.failed > 0) {
      console.error(
        `[event-deletions] ${swept.failed} of ${mediaRefs.length} files could not be removed`,
      );
    }
  }

  /*
    TELL THEM. They asked and then waited; a queue that answers silently is the
    same defect as a request nobody is told about, pointed the other way.
    Best-effort — the celebration is already gone and a notification hiccup must
    not turn a completed removal into an error.
  */
  try {
    await emitNotification({
      userId: req.user_id,
      type: 'event_deletion_answered',
      title: `${req.event_name} has been removed`,
      body: note.slice(0, 500),
      relatedUrl: '/dashboard',
    });
  } catch (err) {
    console.error('[event-deletions] could not tell the couple', err);
  }

  revalidatePath('/admin/event-deletions');
  revalidatePath('/dashboard');
}

/**
 * Say no, with a reason the couple actually reads.
 *
 * The celebration stays exactly as it was. A refusal with no words is the
 * dead end this whole queue exists to replace, so the note is required here
 * too — and it is the body of the notice they receive.
 */
export async function rejectEventDeletion(formData: FormData) {
  const { adminUserId } = await requireAdmin();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const note = String(formData.get('admin_note') ?? '').trim();
  if (!requestId) throw new Error('Which request?');
  if (!note) throw new Error('Tell them why, in words they can act on.');

  const req = await loadPending(requestId);

  await createAdminClient()
    .from('event_deletion_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminUserId,
      reviewed_at: new Date().toISOString(),
      admin_note: note.slice(0, 2000),
    })
    .eq('id', req.id);

  try {
    await emitNotification({
      userId: req.user_id,
      type: 'event_deletion_answered',
      title: `About removing ${req.event_name}`,
      body: note.slice(0, 500),
      relatedUrl: '/dashboard',
    });
  } catch (err) {
    console.error('[event-deletions] could not tell the couple', err);
  }

  revalidatePath('/admin/event-deletions');
  revalidatePath('/dashboard');
}
