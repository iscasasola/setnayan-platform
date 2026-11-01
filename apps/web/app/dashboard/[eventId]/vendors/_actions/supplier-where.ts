'use server';

/**
 * 📍 setSupplierWhere — the host picks WHERE a supplier goes: the chapters they work (owner 2026-11-01, DECISION_LOG
 * "MANY VENUES PER EVENT; SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE"; `lib/supplier-where.ts`).
 *
 * The ONE writer is the database's `set_supplier_where` (migration 20271300598766), on the caller's own session, so RLS
 * decides who may and the three refusals (a coordinator · not a chapter · a booked supplier left on none) are the
 * database's — this action only turns them into words. A booked supplier whose chapters changed is told in the app
 * (`notifySupplierWhereChanged`); the price is never touched.
 *
 * Answers `{ ok: false, message }` instead of throwing, so the row says it in place and keeps what was on screen
 * (owner: a save never resets the screen).
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import { WHERE_WORDS } from '@/lib/supplier-where';
import { notifySupplierWhereChanged } from '@/lib/supplier-where-notify.server';

export type SetSupplierWhereResult = { ok: true; picked: string[]; told: boolean } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The database's refusal → the words the row says. Unknown → a plain "didn't save". */
function refusalWords(message: string): string {
  if (message.includes('a_booked_supplier_needs_a_chapter')) return WHERE_WORDS.keepOne;
  if (message.includes('coordinators_are_everywhere')) return WHERE_WORDS.everywhereInfo;
  if (message.includes('not_a_chapter')) return 'That chapter is gone. Reload and pick again.';
  if (message.includes('not_saved') || message.includes('supplier_not_found')) return 'This account can’t change where this supplier goes.';
  return 'That didn’t save. Nothing changed — try again.';
}

export async function setSupplierWhere(input: {
  eventId: string;
  vendorId: string;
  blockIds: readonly string[];
  /** An in-house group under this booking ("catering"), or null for the supplier's own Where. */
  coveredGroup?: string | null;
  /** Its label ("Catering") — only for the words of the notice. */
  coveredLabel?: string | null;
}): Promise<SetSupplierWhereResult> {
  const eventId = String(input.eventId ?? '').trim();
  const vendorId = String(input.vendorId ?? '').trim();
  const blockIds = (input.blockIds ?? []).map((b) => String(b).trim());
  if (!UUID.test(eventId) || !UUID.test(vendorId) || blockIds.some((b) => !UUID.test(b))) {
    return { ok: false, message: 'That didn’t save. Nothing changed — try again.' };
  }
  const helper = await limitedHelperRefusal(eventId, 'vendors');
  if (helper) return { ok: false, message: helper };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sign in again to change this.' };

  const { data, error } = await supabase.rpc('set_supplier_where', {
    p_vendor_id: vendorId,
    p_block_ids: blockIds,
    p_covered_group: input.coveredGroup ?? null,
  });
  if (error || !data) {
    if (error) logQueryError('setSupplierWhere.rpc', error, { eventId, vendorId }, 'graceful_degrade');
    return { ok: false, message: refusalWords(error?.message ?? '') };
  }
  const r = data as {
    event_id: string;
    booked: boolean;
    shop: string | null;
    before: string[] | null;
    after: string[];
    after_names: string[];
  };

  // 🔔 A change after booking tells the supplier, in the app (no email). Not booked, or nothing changed → nobody.
  const told = await notifySupplierWhereChanged({
    eventId: r.event_id,
    shopId: r.shop,
    booked: r.booked,
    before: r.before,
    after: r.after ?? [],
    afterNames: r.after_names ?? [],
    inHouse: input.coveredGroup ? (input.coveredLabel ?? null) : null,
    actorUserId: user.id,
  });

  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true, picked: r.after ?? [], told: told === 'told' };
}
