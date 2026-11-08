import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { CHANGE_OPS, type ChangeArea, type ChangeOp, type ChangeStatus } from '@/lib/change-requests';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import { guestDisplayName } from '@/lib/guests';

/**
 * ✍️ THE READS BEHIND A SUPPLIER'S PROPOSED CHANGES (owner 8 Nov 2026) — all through the caller's OWN session, so RLS
 * decides what comes back (`event_change_requests` policies, migration 20271331202840; the guest list, tables and
 * suppliers through the grant the supplier holds). Every read reports `measured: false` when it was refused — said on
 * screen, never drawn as "nothing here".
 */

export type ChangeRow = {
  changeId: string;
  area: ChangeArea;
  op: ChangeOp;
  summary: string;
  note: string | null;
  status: ChangeStatus;
  answerNote: string | null;
  createdAt: string;
  supplierName: string;
};

type DbRow = {
  change_id: string;
  area: ChangeArea;
  op: ChangeOp;
  summary: string;
  note: string | null;
  status: ChangeStatus;
  answer_note: string | null;
  created_at: string;
  vendor_profile_id: string | null;
};

const COLUMNS = 'change_id, area, op, summary, note, status, answer_note, created_at, vendor_profile_id';

async function withNames(supabase: SupabaseClient, rows: DbRow[], eventId: string): Promise<ChangeRow[]> {
  const ids = [...new Set(rows.map((r) => r.vendor_profile_id).filter((v): v is string => !!v))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const shops = await supabase.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', ids);
    if (shops.error) logQueryError('changeRequests.names', shops.error, { eventId }, 'graceful_degrade');
    for (const s of (shops.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
      if (s.business_name) names.set(s.vendor_profile_id, s.business_name);
    }
  }
  return rows.map((r) => ({
    changeId: r.change_id,
    area: r.area,
    op: r.op,
    summary: r.summary,
    note: r.note,
    status: r.status,
    answerNote: r.answer_note,
    createdAt: r.created_at,
    supplierName: (r.vendor_profile_id && names.get(r.vendor_profile_id)) || 'A supplier',
  }));
}

/** The OPEN changes on an event — what a host or the booked coordinator answers. Two round trips (rows, names). */
export async function readOpenChangeRequests(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ measured: boolean; rows: ChangeRow[] }> {
  const { data, error } = await supabase
    .from('event_change_requests')
    .select(COLUMNS)
    .eq('event_id', eventId)
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) {
    logQueryError('readOpenChangeRequests', error, { eventId }, 'graceful_degrade');
    return { measured: false, rows: [] };
  }
  return { measured: true, rows: await withNames(supabase, (data ?? []) as DbRow[], eventId) };
}

/** The supplier's OWN changes on this event, newest first — "waiting", then the answer. One round trip. */
export async function readMyChangeRequests(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<{ measured: boolean; rows: ChangeRow[] }> {
  const { data, error } = await supabase
    .from('event_change_requests')
    .select(COLUMNS)
    .eq('event_id', eventId)
    .eq('proposed_by_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    logQueryError('readMyChangeRequests', error, { eventId }, 'graceful_degrade');
    return { measured: false, rows: [] };
  }
  return {
    measured: true,
    rows: ((data ?? []) as DbRow[]).map((r) => ({
      changeId: r.change_id,
      area: r.area,
      op: r.op,
      summary: r.summary,
      note: r.note,
      status: r.status,
      answerNote: r.answer_note,
      createdAt: r.created_at,
      supplierName: '',
    })),
  };
}

export type ProposeTargets = {
  measured: boolean;
  guests: { id: string; name: string }[];
  tables: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
};

/**
 * What a supplier can point a proposal at — only the parts they hold (`ops`), read through their own grant: the guest
 * list's names, the seat plan's tables, the supplier rows. At most three reads, in parallel (one round trip).
 */
export async function readProposeTargets(supabase: SupabaseClient, eventId: string, ops: readonly ChangeOp[]): Promise<ProposeTargets> {
  const areas = new Set(ops.map((o) => CHANGE_OPS[o].area));
  const wantsGuests = areas.has('guest_list') || areas.has('seat_plan');
  const [guests, tables, suppliers] = await Promise.all([
    wantsGuests
      ? supabase.from('guests').select(ENTOURAGE_COLUMNS).eq('event_id', eventId).is('deleted_at', null).order('last_name').limit(1000)
      : Promise.resolve({ data: [], error: null }),
    areas.has('seat_plan')
      ? supabase.from('event_tables').select('table_id, table_label, sort_order').eq('event_id', eventId).order('sort_order').limit(200)
      : Promise.resolve({ data: [], error: null }),
    areas.has('vendors')
      ? supabase.from('event_vendors').select('vendor_id, vendor_name').eq('event_id', eventId).is('archived_at', null).limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const refused = [guests.error, tables.error, suppliers.error].find(Boolean);
  if (refused) logQueryError('readProposeTargets', refused as { message: string }, { eventId }, 'graceful_degrade');
  return {
    measured: !refused,
    guests: ((guests.data ?? []) as { guest_id: string; display_name: string | null; first_name: string | null; last_name: string | null }[]).map((g) => ({
      id: g.guest_id,
      name: guestDisplayName(g as Parameters<typeof guestDisplayName>[0]) || 'Unnamed guest',
    })),
    tables: ((tables.data ?? []) as { table_id: string; table_label: string | null }[]).map((t) => ({
      id: t.table_id,
      name: t.table_label?.trim() || 'Untitled table',
    })),
    suppliers: ((suppliers.data ?? []) as { vendor_id: string; vendor_name: string | null }[]).map((v) => ({
      id: v.vendor_id,
      name: v.vendor_name?.trim() || 'A supplier',
    })),
  };
}
