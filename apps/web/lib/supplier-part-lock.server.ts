import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { BOOKED_EVENT_VENDOR_STATUSES } from '@/lib/vendor-funnel';
import { lockedLine } from '@/lib/supplier-schedule-marks';
import { lockedShopFor, type PartChangeShape, type PartLocks } from '@/lib/supplier-part-lock';
import type { PartSnapshot } from '@/lib/supplier-part-notify.server';

/**
 * 🔒 Which of this event's supplier rows are LOCKED right now (audit D7) — read under the HOST's own session: the
 * couple and Schedule helpers read `event_supplier_schedule_marks` (20271300619930) and their event's `event_vendors`.
 * One query when nobody is locked (the usual day). A refused read answers "none locked" and is logged: this is the
 * polite half — the database's `*_part_lock` triggers (20271303409352) still refuse the write.
 */
export async function readPartLocks(supabase: SupabaseClient, eventId: string): Promise<PartLocks> {
  const out = new Map<string, string>();
  try {
    const marks = await supabase
      .from('event_supplier_schedule_marks')
      .select('vendor_profile_id')
      .eq('event_id', eventId)
      .not('locked_at', 'is', null);
    if (marks.error) {
      logQueryError('readPartLocks.marks', marks.error, { eventId }, 'graceful_degrade');
      return out;
    }
    const shops = ((marks.data ?? []) as { vendor_profile_id: string }[]).map((m) => m.vendor_profile_id);
    if (shops.length === 0) return out;
    const [rowsRes, namesRes] = await Promise.all([
      supabase
        .from('event_vendors')
        .select('vendor_id, vendor_name, marketplace_vendor_id')
        .eq('event_id', eventId)
        .in('marketplace_vendor_id', shops)
        .in('status', [...BOOKED_EVENT_VENDOR_STATUSES])
        .is('archived_at', null),
      supabase.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', shops),
    ]);
    if (rowsRes.error) {
      logQueryError('readPartLocks.rows', rowsRes.error, { eventId }, 'graceful_degrade');
      return out;
    }
    const names = new Map(
      ((namesRes.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((n) => [n.vendor_profile_id, n.business_name?.trim() ?? '']),
    );
    for (const r of (rowsRes.data ?? []) as { vendor_id: string; vendor_name: string | null; marketplace_vendor_id: string }[]) {
      out.set(r.vendor_id, names.get(r.marketplace_vendor_id) || r.vendor_name?.trim() || 'the supplier');
    }
  } catch (e) {
    console.error('[readPartLocks] read failed:', e);
  }
  return out;
}

/**
 * Throws the host's calm line ("<shop> isn’t taking changes. Send them a request instead.") when this change would touch a
 * locked supplier's part; returns quietly otherwise. Called by every host schedule action BEFORE its write.
 */
export async function refuseLockedPart(
  supabase: SupabaseClient,
  part: PartSnapshot,
  change: PartChangeShape,
  /** Only these moments move (a field save that touches nothing of the part passes none). Default: every one read. */
  moments = part.before,
): Promise<void> {
  if (moments.length === 0) return;
  const locks = await readPartLocks(supabase, part.eventId);
  const shop = lockedShopFor(moments, locks, change);
  if (shop) throw new Error(lockedLine(shop));
}
