import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import {
  PART_FIELDS,
  changesByVendor,
  supplierPartBody,
  supplierPartHref,
  supplierPartTitle,
  type PartChange,
  type PartMoment,
} from '@/lib/supplier-part-notice';

/**
 * 🔔 THE ONE NOTIFIER FOR A HOST'S CHANGE TO A SUPPLIER'S PART (supplier gate audit D6, 2026-11-02; owner: *"getting
 * notifications if they are changed by user"*). Every host schedule action that changes a moment a supplier is on
 * (`app/dashboard/[eventId]/schedule/actions.ts`) calls it in two steps around its write:
 *
 *     const part = await partBefore(supabase, eventId, [blockId]);   // BEFORE the write
 *     …the write…
 *     await tellPartSuppliers(supabase, part, user.id);              // AFTER it landed
 *
 * The before-read is what makes a delete and a "took you off" reachable at all — after the write those suppliers are
 * no longer named on anything. One save → one in-app notice per PERSON (`supplier_part_changed`, not on the email
 * allowlist), however many moments it touched. The person who saved is never told their own save.
 *
 * BEST-EFFORT BY CONTRACT: the edit is already written; a failed read or notice is LOGGED and never throws into the
 * host's save. A failed after-read is NOT read as "every moment was deleted" — nobody is told rather than told wrong.
 */

const PART_SELECT = ['block_id', 'parent_block_id', 'responsible_vendor_ids', ...PART_FIELDS].join(', ');

export type PartSnapshot = {
  eventId: string;
  blockIds: string[];
  before: PartMoment[];
  /** Moments changed in a way PART_FIELDS cannot see (a crew line, a march): their suppliers are told "changed". */
  touched: Set<string>;
};

async function readMoments(
  supabase: SupabaseClient,
  eventId: string,
  blockIds: readonly string[],
  withChildren: boolean,
): Promise<PartMoment[] | null> {
  if (blockIds.length === 0) return [];
  const ids = [...new Set(blockIds)];
  const own = await supabase.from('event_schedule_blocks').select(PART_SELECT).eq('event_id', eventId).in('block_id', ids);
  if (own.error) {
    logQueryError('supplierPartNotify.read', own.error, { eventId }, 'graceful_degrade');
    return null;
  }
  const rows = (own.data ?? []) as unknown as PartMoment[];
  if (!withChildren) return rows;
  const kids = await supabase.from('event_schedule_blocks').select(PART_SELECT).eq('event_id', eventId).in('parent_block_id', ids);
  if (kids.error) {
    logQueryError('supplierPartNotify.readChildren', kids.error, { eventId }, 'graceful_degrade');
    return rows;
  }
  const seen = new Set(rows.map((r) => r.block_id));
  for (const k of (kids.data ?? []) as unknown as PartMoment[]) if (!seen.has(k.block_id)) rows.push(k);
  return rows;
}

/**
 * Read the moments a save is about to touch — BEFORE it writes. `withChildren` adds the moments inside a chapter (a
 * chapter move carries them; a chapter delete cascades to them). Never throws.
 */
export async function partBefore(
  supabase: SupabaseClient,
  eventId: string,
  blockIds: readonly string[],
  opts: { withChildren?: boolean; touched?: boolean } = {},
): Promise<PartSnapshot> {
  let before: PartMoment[] = [];
  try {
    before = (await readMoments(supabase, eventId, blockIds, opts.withChildren ?? false)) ?? [];
  } catch (e) {
    console.error('[partBefore] read failed:', e);
  }
  const ids = before.map((m) => m.block_id);
  return { eventId, blockIds: ids, before, touched: new Set(opts.touched ? ids : []) };
}

/** After the write landed: read the same moments again and tell each supplier on them, once. Never throws. */
export async function tellPartSuppliers(supabase: SupabaseClient, part: PartSnapshot, actorUserId: string): Promise<void> {
  try {
    // No moment was read before the write (none matched, or the read was refused): nothing to compare against.
    if (part.blockIds.length === 0) return;
    const after = await readMoments(supabase, part.eventId, part.blockIds, false);
    if (after === null) return; // a refused read is not "deleted" — logged inside, nobody told wrong
    const byVendor = changesByVendor(part.before, after, part.touched);
    if (byVendor.size === 0) return;
    await notifyByPerson(part.eventId, byVendor, actorUserId);
  } catch (e) {
    console.error('[tellPartSuppliers] best-effort notice failed:', e);
  }
}

async function notifyByPerson(eventId: string, byVendor: Map<string, PartChange[]>, actorUserId: string): Promise<void> {
  const admin = createAdminClient();
  // `responsible_vendor_ids` are THIS event's vendor rows; only a BOOKED one with a shop has anyone to tell.
  const [rowsRes, eventRes] = await Promise.all([
    admin
      .from('event_vendors')
      .select('vendor_id, marketplace_vendor_id')
      .eq('event_id', eventId)
      .in('vendor_id', [...byVendor.keys()])
      .in('status', [...BOOKED_EVENT_VENDOR_STATUSES])
      .is('archived_at', null)
      .not('marketplace_vendor_id', 'is', null),
    admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
  ]);
  if (rowsRes.error) {
    logQueryError('supplierPartNotify.booked', rowsRes.error, { eventId }, 'graceful_degrade');
    return;
  }
  const rows = (rowsRes.data ?? []) as { vendor_id: string; marketplace_vendor_id: string }[];
  if (rows.length === 0) return;
  const { data: owners, error: ownersErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, user_id')
    .in('vendor_profile_id', [...new Set(rows.map((r) => r.marketplace_vendor_id))]);
  if (ownersErr) {
    logQueryError('supplierPartNotify.owners', ownersErr, { eventId }, 'graceful_degrade');
    return;
  }
  const ownerOf = new Map(((owners ?? []) as { vendor_profile_id: string; user_id: string | null }[]).map((o) => [o.vendor_profile_id, o.user_id]));
  // One notice per PERSON per save: a person who owns two shops on this event gets their moments merged, once.
  const perPerson = new Map<string, PartChange[]>();
  for (const r of rows) {
    const userId = ownerOf.get(r.marketplace_vendor_id);
    if (!userId || userId === actorUserId) continue;
    const list = perPerson.get(userId) ?? [];
    for (const c of byVendor.get(r.vendor_id) ?? []) if (!list.some((x) => x.blockId === c.blockId)) list.push(c);
    perPerson.set(userId, list);
  }
  const name = ((eventRes.data ?? null) as { display_name?: string | null } | null)?.display_name?.trim() || 'The host';
  for (const [userId, changes] of perPerson) {
    if (changes.length === 0) continue;
    await emitNotification({
      userId,
      type: 'supplier_part_changed',
      title: supplierPartTitle(changes),
      body: supplierPartBody(name, changes),
      relatedUrl: supplierPartHref(eventId),
      eventId,
    });
  }
}
