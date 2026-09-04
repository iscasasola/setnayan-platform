'use server';

/**
 * MB12 · the SUPPLIER's half of the per-part finalization handshake.
 *
 * Agree · turn down · answer a re-open request. The couple's half lives in
 * `app/dashboard/[eventId]/studio/mood-board/finalization-actions.ts`.
 *
 * 🔑 AGREEING IS THE MOMENT THE DESIGN STOPS MOVING, AND THAT IS ONE ACT, NOT
 * TWO. `vendor_agree_to_part` flips the row AND freezes the snapshot into
 * `events.role_palette` inside one function body. There is deliberately no
 * "…and now write the palette" step in this file: a second call here would be a
 * second transaction, and the gap between them is exactly where a supplier ends
 * up agreeing to a design that can still change under them.
 *
 * ⚠ EVERY OWNERSHIP GATE IS IN THE RPC, NOT HERE. These functions pass a
 * `finalization_id` straight through; `current_vendor_event_vendor_ids()`
 * inside the DEFINER function is what proves the caller is the asked supplier.
 * An action-level check would be a second opinion that can drift — and the RPC
 * is reachable without this file anyway.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { renderPartLabel } from '@/lib/moodboard-finalization';
import type { NotificationType } from '@/lib/notifications';

export type VendorFinalizationResult =
  | { status: 'ok' }
  | { status: 'already'; current?: string }
  | { status: 'expired' }
  | { status: 'not_pending'; current?: string }
  | { status: 'error'; message: string };

/** "Yes — build it as designed." Freezes the part, in the same transaction. */
export async function vendorAgreeToPart(
  finalizationId: string,
): Promise<VendorFinalizationResult> {
  const out = await callVendorRpc('vendor_agree_to_part', { p_finalization_id: finalizationId });
  if (out.status === 'ok') {
    await notifyCouple(finalizationId, (part, shop) => ({
      type: 'part_finalization_agreed',
      title: `${shop} agreed to your ${part}`,
      body:
        `${shop} has signed off on your ${part}, so it is settled — it will stop following ` +
        `changes to your main colours. To change it you can ask them to re-open it.`,
    }));
  }
  return out;
}

/** "No — not as designed", in the supplier's own words. Freezes nothing. */
export async function vendorDeclinePart(
  finalizationId: string,
  reason: string,
): Promise<VendorFinalizationResult> {
  const trimmed = reason.trim().slice(0, 240);
  const out = await callVendorRpc('vendor_decline_part', {
    p_finalization_id: finalizationId,
    p_reason: trimmed || null,
  });
  if (out.status === 'ok') {
    await notifyCouple(finalizationId, (part, shop) => ({
      type: 'part_finalization_declined',
      title: `${shop} turned down your ${part}`,
      body: trimmed
        ? `${shop} cannot build your ${part} as designed. In their words: “${trimmed}” — your ${part} is still yours to change.`
        : `${shop} cannot build your ${part} as designed. It is still yours to change, and you can ask them again once you have.`,
    }));
  }
  return out;
}

/**
 * Answer the couple's request to re-open a part you already agreed to.
 *
 * On yes the release rides in the same transaction as the answer — the same
 * weld as the agreement, pointed the other way.
 */
export async function vendorAnswerPartReopen(
  finalizationId: string,
  agree: boolean,
  reason: string,
): Promise<VendorFinalizationResult> {
  const trimmed = reason.trim().slice(0, 240);
  const out = await callVendorRpc('vendor_answer_part_reopen', {
    p_finalization_id: finalizationId,
    p_agree: agree,
    p_reason: trimmed || null,
  });
  if (out.status === 'ok') {
    await notifyCouple(finalizationId, (part, shop) => ({
      type: 'part_reopen_answered',
      title: agree ? `${shop} re-opened your ${part}` : `${shop} would rather keep your ${part} as agreed`,
      body: agree
        ? `${shop} agreed to re-open your ${part}. It follows your main colours again and is yours to change.`
        : trimmed
          ? `${shop} would rather keep your ${part} as you both agreed. In their words: “${trimmed}”`
          : `${shop} would rather keep your ${part} as you both agreed, so it stays settled for now.`,
    }));
  }
  return out;
}

/* ── shared plumbing ─────────────────────────────────────────────────────── */

async function callVendorRpc(
  fn: 'vendor_agree_to_part' | 'vendor_decline_part' | 'vendor_answer_part_reopen',
  args: Record<string, unknown>,
): Promise<VendorFinalizationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { status: 'error', message: error.message };
  const env = (data ?? {}) as { status?: string; current?: string };
  switch (env.status) {
    case 'ok':
      return { status: 'ok' };
    case 'already':
      return { status: 'already', current: env.current };
    case 'expired':
      return { status: 'expired' };
    case 'not_pending':
    case 'not_requested':
      return { status: 'not_pending', current: env.current };
    default:
      return { status: 'error', message: env.status ?? 'unknown' };
  }
}

/**
 * Tell every couple member on the event.
 *
 * Fail-soft, and best-effort per member: the answer is already committed by the
 * RPC and a notification hiccup must never roll it back. But it is not
 * in-app-only — all three types are on `EMAIL_ENABLED_TYPES`, because a couple
 * who is told nothing simply watches a part they asked about sit there, which
 * is indistinguishable from nobody having looked at it.
 */
async function notifyCouple(
  finalizationId: string,
  compose: (partLabel: string, shopName: string) => {
    type: NotificationType;
    title: string;
    body: string;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from('moodboard_part_finalizations')
      .select('event_id, part_id, vendor_id')
      .eq('finalization_id', finalizationId)
      .maybeSingle();
    if (!row) return;
    const { event_id: eventId, part_id: partId, vendor_id: vendorId } = row as {
      event_id: string;
      part_id: string;
      vendor_id: string;
    };

    const [{ data: booking }, { data: members }] = await Promise.all([
      admin.from('event_vendors').select('vendor_name').eq('vendor_id', vendorId).maybeSingle(),
      admin.from('event_members').select('user_id').eq('event_id', eventId).eq('member_type', 'couple'),
    ]);
    const shop = (booking as { vendor_name?: string } | null)?.vendor_name?.trim() || 'Your supplier';
    const note = compose(renderPartLabel(partId).toLowerCase(), shop);

    for (const m of members ?? []) {
      const userId = (m as { user_id: string | null }).user_id;
      if (!userId) continue;
      await emitNotification({
        userId,
        type: note.type,
        title: note.title,
        body: note.body,
        relatedUrl: `/dashboard/${eventId}/studio/mood-board#palette`,
      });
    }

    revalidatePath(`/vendor-dashboard/clients/${eventId}/mood-board`);
    revalidatePath(`/dashboard/${eventId}/studio/mood-board`);
  } catch (e) {
    console.error(
      `[vendorFinalization] couple notify failed for finalization_id=${finalizationId}:`,
      e,
    );
  }
}
