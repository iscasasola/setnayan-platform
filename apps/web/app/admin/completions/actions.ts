'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * /admin/completions actions — the human backstop for the per-vendor completion
 * handshake (Event Lifecycle Menu §6.1). Two outcomes on a stuck/disputed row:
 *
 *  • forceCompleteVendor — completion_status='confirmed' (+ confirm-received
 *    stamp) so the review/recommendation gate unlocks. For a delivered service
 *    whose handshake stalled (vendor never marked complete, or a dispute that
 *    turned out to be a misunderstanding).
 *  • upholdNonDelivery — the vendor genuinely didn't deliver. completion_status
 *    stays 'disputed' (the review STAYS frozen — correct), but the row is marked
 *    resolved so it leaves the admin queue.
 *
 * Auth: the /admin layout 404s non-admins for the PAGE, but a server action can
 * be POSTed directly, so each action re-gates with requireAdmin(). All writes go
 * through the service-role admin client — the completion columns have no
 * couple/admin UPDATE RLS path (same as the couple-side handshake).
 */

// Copied per the admin-actions convention (each admin actions file defines its
// own — see disputes/actions.ts + payments/actions.ts).
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

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

type EventVendorLookup = {
  marketplace_vendor_id: string | null;
  vendor_name: string | null;
  completion_status: string | null;
  customer_confirmed_received_at: string | null;
};

/** Resolve the couple member user_ids (≥1 — joint accounts) for an event. */
async function coupleUserIds(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<string[]> {
  const { data } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('member_type', 'couple');
  return (data ?? [])
    .map((r) => (r as { user_id: string | null }).user_id)
    .filter((v): v is string => Boolean(v));
}

/** Resolve the vendor's owning user_id — null for an off-platform vendor. */
async function vendorUserId(
  admin: ReturnType<typeof createAdminClient>,
  marketplaceVendorId: string | null,
): Promise<string | null> {
  if (!marketplaceVendorId) return null;
  const { data } = await admin
    .from('vendor_profiles')
    .select('user_id')
    .eq('vendor_profile_id', marketplaceVendorId)
    .maybeSingle();
  return (data as { user_id: string | null } | null)?.user_id ?? null;
}

/**
 * Open a vendor_disputes row so the demotion cron has input (cross-account QA,
 * 2026-06-19). `vendor_disputes` was orphaned for INSERT, severing the
 * completion-dispute → 30-day auto-demotion chain
 * (api/admin/cron/dispute-counter). When an admin UPHOLDS a non-delivery the
 * vendor genuinely didn't deliver, so it must count toward demotion.
 *
 * Constraints honored (same as the couple-side helper in review/actions.ts):
 *  • vendor_profile_id resolved from the already-looked-up marketplace_vendor_id;
 *    SKIP when null (off-platform vendor — nothing to demote, FK would reject).
 *  • CHECK (payout_id OR order_id): link the most recent matching order when one
 *    exists; otherwise the insert can't satisfy the CHECK and is swallowed —
 *    fail-soft so the uphold write always commits.
 *  • Idempotent: dedupe on linked order_id when present, else (vendor, opener,
 *    category, open) so a re-uphold doesn't stack open disputes.
 */
async function openUpheldDispute(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    eventId: string;
    vendorProfileId: string | null;
    openedByUserId: string | null;
    note: string | null;
  },
): Promise<void> {
  try {
    const vendorProfileId = args.vendorProfileId;
    if (!vendorProfileId) return; // off-platform vendor — nothing to demote.

    const { data: orderRow } = await admin
      .from('orders')
      .select('order_id')
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const orderId = (orderRow as { order_id: string } | null)?.order_id ?? null;

    let dedupe = admin
      .from('vendor_disputes')
      .select('dispute_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'open');
    dedupe = orderId
      ? dedupe.eq('order_id', orderId)
      : args.openedByUserId
        ? dedupe.eq('opened_by_user_id', args.openedByUserId).eq('category', 'quality_issue')
        : dedupe.eq('category', 'quality_issue');
    const { data: existing } = await dedupe.limit(1).maybeSingle();
    if (existing) return;

    const { error: insErr } = await admin.from('vendor_disputes').insert({
      vendor_profile_id: vendorProfileId,
      order_id: orderId,
      opened_by_user_id: args.openedByUserId,
      category: 'quality_issue',
      description:
        'Setnayan team upheld a non-delivery report — the vendor did not deliver the service.' +
        (args.note ? ` ${args.note}` : ''),
      counts_toward_demotion: true,
    });
    if (insErr) {
      // eslint-disable-next-line no-console
      console.error(
        `[openUpheldDispute] insert skipped (event_id=${args.eventId}):`,
        insErr.message,
      );
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[openUpheldDispute] failed (non-fatal):', e);
  }
}

async function writeAudit(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    action: string;
    vendorId: string;
    eventId: string;
    actorUserId: string;
    beforeStatus: string | null;
    afterStatus: string;
    note: string | null;
  },
): Promise<void> {
  try {
    await admin.from('admin_audit_log').insert({
      action: args.action,
      target_table: 'event_vendors',
      target_id: args.vendorId,
      actor_user_id: args.actorUserId,
      reason: args.note,
      before_json: { completion_status: args.beforeStatus },
      after_json: { completion_status: args.afterStatus },
      metadata: { event_id: args.eventId },
    });
  } catch (e) {
    // Non-fatal — the completion write already committed.
    // eslint-disable-next-line no-console
    console.error('[admin/completions] audit insert failed (non-fatal):', e);
  }
}

/**
 * Force-complete a vendor's service → unlocks the couple's review + recommendation
 * for that vendor. Idempotent (skips rows already confirmed).
 */
export async function forceCompleteVendor(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const note = nullIfBlank(formData.get('note'));

  const admin = createAdminClient();
  const { data: evRow } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, vendor_name, completion_status, customer_confirmed_received_at')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  const ev = evRow as EventVendorLookup | null;
  if (!ev) throw new Error('Vendor not found for this event');

  const now = new Date().toISOString();
  const { error } = await admin
    .from('event_vendors')
    .update({
      completion_status: 'confirmed',
      // Stamp confirm-received if the couple never did, so the read-side gate
      // reads as a clean two-party completion.
      customer_confirmed_received_at: ev.customer_confirmed_received_at ?? now,
      completion_resolved_at: now,
      completion_resolution_note: note,
    })
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .neq('completion_status', 'confirmed'); // idempotent
  if (error) throw new Error(error.message);

  await writeAudit(admin, {
    action: 'force_complete_event_vendor',
    vendorId,
    eventId,
    actorUserId: adminUserId,
    beforeStatus: ev.completion_status,
    afterStatus: 'confirmed',
    note,
  });

  const vendorName = (ev.vendor_name ?? '').trim() || 'your vendor';
  // Notify couple(s) — best-effort, fail-soft.
  try {
    const couples = await coupleUserIds(admin, eventId);
    await Promise.all(
      couples.map((uid) =>
        emitNotification({
          userId: uid,
          type: 'booking_confirmed',
          title: 'Service marked complete',
          body: `The Setnayan team confirmed ${vendorName}'s service as delivered. You can now leave a review.`,
          relatedUrl: `/dashboard/${eventId}/vendors/${vendorId}/review`,
        }),
      ),
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/completions] couple notify failed (non-fatal):', e);
  }
  // Notify the vendor — only when there's a platform account.
  try {
    const vUser = await vendorUserId(admin, ev.marketplace_vendor_id);
    if (vUser) {
      await emitNotification({
        userId: vUser,
        type: 'booking_confirmed',
        title: 'Service marked complete',
        body: 'The Setnayan team confirmed this booking as delivered.',
        relatedUrl: `/vendor-dashboard/clients/${eventId}`,
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/completions] vendor notify failed (non-fatal):', e);
  }

  revalidatePath('/admin/completions');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/review`);
}

/**
 * Uphold a non-delivery dispute — the vendor genuinely didn't deliver. Keeps
 * completion_status='disputed' (the review stays frozen) but stamps the row
 * resolved so it leaves the admin queue. Only valid on a disputed row.
 */
export async function upholdNonDelivery(formData: FormData) {
  const { userId: adminUserId } = await requireAdmin();
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const note = nullIfBlank(formData.get('note'));
  if (!note) {
    throw new Error('Upholding a non-delivery needs a note — record what was decided and why.');
  }

  const admin = createAdminClient();
  const { data: evRow } = await admin
    .from('event_vendors')
    .select('marketplace_vendor_id, vendor_name, completion_status, customer_confirmed_received_at')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .maybeSingle();
  const ev = evRow as EventVendorLookup | null;
  if (!ev) throw new Error('Vendor not found for this event');
  if (ev.completion_status !== 'disputed') {
    throw new Error('Only an open dispute can be upheld as a non-delivery.');
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('event_vendors')
    .update({
      // status stays 'disputed' → review remains frozen (correct for a real
      // non-delivery); only the resolution stamp changes so it leaves the queue.
      completion_resolved_at: now,
      completion_resolution_note: note,
    })
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .eq('completion_status', 'disputed')
    .is('completion_resolved_at', null); // idempotent
  if (error) throw new Error(error.message);

  await writeAudit(admin, {
    action: 'uphold_non_delivery_event_vendor',
    vendorId,
    eventId,
    actorUserId: adminUserId,
    beforeStatus: ev.completion_status,
    afterStatus: 'disputed',
    note,
  });

  // Re-arm the demotion chain (cross-account QA, 2026-06-19): an upheld
  // non-delivery must count toward the 30-day auto-demotion, so open a
  // vendor_disputes row the dispute-counter cron can see. Attribute it to a
  // couple member (the harmed party) when resolvable. Idempotent + fail-soft —
  // never blocks the uphold write above.
  const [openerUserId] = await coupleUserIds(admin, eventId);
  await openUpheldDispute(admin, {
    eventId,
    vendorProfileId: ev.marketplace_vendor_id,
    openedByUserId: openerUserId ?? null,
    note,
  });

  // Notify couple(s): the dispute was reviewed; the review stays closed.
  try {
    const couples = await coupleUserIds(admin, eventId);
    const vendorName = (ev.vendor_name ?? '').trim() || 'your vendor';
    await Promise.all(
      couples.map((uid) =>
        emitNotification({
          userId: uid,
          type: 'dispute_filed',
          title: 'Your non-delivery report was upheld',
          body: `The Setnayan team reviewed your report about ${vendorName} and upheld it. No review will be requested for this service.`,
          relatedUrl: `/dashboard/${eventId}/vendors/${vendorId}/review`,
        }),
      ),
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[admin/completions] couple notify failed (non-fatal):', e);
  }

  revalidatePath('/admin/completions');
  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/review`);
}
