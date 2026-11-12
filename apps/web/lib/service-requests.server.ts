/**
 * service-requests.server.ts — the reads behind the two service-request pages.
 *
 * The rules live in `service-requests.ts` (pure, tested). This module only READS:
 *   · the group → category → service tree a supplier browses (the same tree the maker and
 *     Find use — `getCoverageTaxonomy`, never a second copy);
 *   · a shop's own requests, with how many of its cards wait on each;
 *   · the AI draft's verdict for one request (the drafter writes; this reads).
 *
 * 🔑 A READ THAT FAILED IS SAID, NEVER DRAWN AS "NONE" (the repo's own disease, CLAUDE.md
 * 2026-08-20): every loader returns `{ ok: false }` on a refused read, and the pages print
 * "Couldn't load … · Try again" instead of an empty list. An empty category tree is a failure
 * too — the live directory is never empty.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { isRequestStatus, type RequestStatus } from '@/lib/service-requests';

type Db = SupabaseClient;

export type RequestCategory = { tileId: string; label: string; group: string; services: Array<{ key: string; label: string }> };
export type RequestGroup = { id: string; label: string; categories: RequestCategory[] };

export type RequestTree = {
  groups: RequestGroup[];
  /** tile id → "Category" label. */
  categoryLabel: Map<string, string>;
  /** tile id → "Group" label. */
  groupOf: Map<string, string>;
  /** canonical service → its label and category. */
  service: Map<string, { label: string; tileId: string; categoryLabel: string }>;
};

/** The live tree, or null when it could not be read (never an empty tree passed off as real). */
export async function loadRequestTree(): Promise<RequestTree | null> {
  let parents;
  try {
    parents = await getCoverageTaxonomy();
  } catch {
    return null;
  }
  if (!parents || parents.length === 0) return null;
  const groups: RequestGroup[] = [];
  const categoryLabel = new Map<string, string>();
  const groupOf = new Map<string, string>();
  const service = new Map<string, { label: string; tileId: string; categoryLabel: string }>();
  for (const p of parents) {
    const categories: RequestCategory[] = [];
    for (const b of p.branches) {
      categoryLabel.set(b.tileId, b.label);
      groupOf.set(b.tileId, p.label);
      const services = b.leaves.map((l) => ({ key: l.canonicalService, label: l.label }));
      for (const s of services) service.set(s.key, { label: s.label, tileId: b.tileId, categoryLabel: b.label });
      categories.push({ tileId: b.tileId, label: b.label, group: p.label, services });
    }
    groups.push({ id: p.folderId, label: p.label, categories });
  }
  return { groups, categoryLabel, groupOf, service };
}

export type MyRequest = {
  request_id: string;
  proposed_label: string;
  proposed_note: string | null;
  tile_id: string | null;
  status: RequestStatus;
  mapped_to_canonical: string | null;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  supplier_seen_at: string | null;
  /** The shop's cards tagged with this request; null when the count could not be read. */
  cards: number | null;
};

export type Loaded<T> = { ok: true; value: T } | { ok: false };

const MY_REQUEST_COLUMNS =
  'request_id, proposed_label, proposed_note, tile_id, status, mapped_to_canonical, resolution_note, created_at, reviewed_at, supplier_seen_at';

/**
 * A shop's own requests, read through the SESSION client (the row policy admits only the shop's
 * own rows), with the count of its cards that wait on each.
 */
export async function loadMyRequests(supabase: Db, vendorProfileId: string): Promise<Loaded<MyRequest[]>> {
  const { data, error } = await supabase
    .from('taxonomy_category_requests')
    .select(MY_REQUEST_COLUMNS)
    .eq('proposed_by_vendor_id', vendorProfileId)
    .order('created_at', { ascending: false });
  if (error) {
    logQueryError('loadMyRequests (taxonomy_category_requests)', error);
    return { ok: false };
  }
  const rows = ((data ?? []) as Array<Omit<MyRequest, 'cards'> & { status: string }>).filter((r) => isRequestStatus(r.status));
  const counts = await countCardsByRequest(
    supabase,
    vendorProfileId,
    rows.map((r) => r.request_id),
  );
  return {
    ok: true,
    value: rows.map((r) => ({ ...(r as Omit<MyRequest, 'cards'>), cards: counts ? counts.get(r.request_id) ?? 0 : null })),
  };
}

/** One of the shop's own requests (null = not theirs or gone; `ok:false` = the read failed). */
export async function loadMyRequest(supabase: Db, vendorProfileId: string, requestId: string): Promise<Loaded<MyRequest | null>> {
  const all = await loadMyRequests(supabase, vendorProfileId);
  if (!all.ok) return all;
  return { ok: true, value: all.value.find((r) => r.request_id === requestId) ?? null };
}

/** The shop's cards per request; null when unreadable (the page then says so instead of "0 cards"). */
async function countCardsByRequest(supabase: Db, vendorProfileId: string, ids: string[]): Promise<Map<string, number> | null> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('vendor_services')
    .select('category_request_id')
    .eq('vendor_profile_id', vendorProfileId)
    .in('category_request_id', ids);
  if (error) {
    logQueryError('countCardsByRequest (vendor_services)', error);
    return null;
  }
  const m = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ category_request_id: string | null }>) {
    if (!r.category_request_id) continue;
    m.set(r.category_request_id, (m.get(r.category_request_id) ?? 0) + 1);
  }
  return m;
}

/** The shop's cards for one request, for the detail screen and the "put a card here" picker. */
export async function loadMyCards(
  supabase: Db,
  vendorProfileId: string,
): Promise<Loaded<Array<{ vendor_service_id: string; title: string | null; category: string; category_request_id: string | null; is_active: boolean }>>> {
  const { data, error } = await supabase
    .from('vendor_services')
    .select('vendor_service_id, title, category, category_request_id, is_active')
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('loadMyCards (vendor_services)', error);
    return { ok: false };
  }
  return { ok: true, value: (data ?? []) as never };
}

/**
 * The AI's verdict on one request, read AFTER `maybeDraftCategoryProposal` ran (which writes and
 * returns nothing, by contract). `existing` + a live service = the supplier goes straight to that
 * service's card maker. Read with the service role because the drafts table admits no session at
 * all; the id comes from `proposeCategory`'s own INSERT, never the browser.
 */
export async function draftSaysExisting(requestId: string, tree: RequestTree | null): Promise<string | null> {
  if (!requestId || !tree) return null;
  try {
    const { data, error } = await createAdminClient()
      .from('taxonomy_category_request_drafts')
      .select('verdict, closest_existing')
      .eq('request_id', requestId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { verdict: string; closest_existing: string | null };
    if (row.verdict !== 'existing' || !row.closest_existing) return null;
    return tree.service.has(row.closest_existing) ? row.closest_existing : null;
  } catch {
    return null;
  }
}

/**
 * Opening a decided request clears the notice on Services. The row policy lets only admins UPDATE
 * requests, so the write is made with the service role — but only for a row the caller's own
 * SESSION read returns (the read policy admits only the shop's own rows), and scoped by both ids.
 * NOT a server action on purpose. Best-effort: a failed write leaves the notice up, never an error.
 */
export async function markRequestSeen(supabase: Db, vendorProfileId: string, requestId: string): Promise<void> {
  if (!requestId || !vendorProfileId) return;
  try {
    const { data } = await supabase
      .from('taxonomy_category_requests')
      .select('request_id')
      .eq('request_id', requestId)
      .eq('proposed_by_vendor_id', vendorProfileId)
      .neq('status', 'pending')
      .is('supplier_seen_at', null)
      .maybeSingle();
    if (!data) return;
    await createAdminClient()
      .from('taxonomy_category_requests')
      .update({ supplier_seen_at: new Date().toISOString() })
      .eq('request_id', requestId)
      .eq('proposed_by_vendor_id', vendorProfileId)
      .neq('status', 'pending')
      .is('supplier_seen_at', null);
  } catch {
    /* the notice simply stays up */
  }
}
