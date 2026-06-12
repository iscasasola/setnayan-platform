import type { SupabaseClient } from '@supabase/supabase-js';
import { displayServiceLabel } from '@/lib/vendors';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';

/**
 * thread_service_interests — structured per-service inquiry context on the ONE
 * couple↔vendor chat thread (migration 20261205000000). Owner-locked
 * 2026-06-12 "Link-gated build cascade + multi-service inquiry mapping": an
 * inquiry can name the service the couple clicked Inquire on (source='initial'),
 * the vendor's price-included linked services (source='linked'), extra
 * standalone services the couple opts into (source='couple_added'), and
 * services the vendor offers back from their own thread view
 * (source='vendor_offered'). All hang off the single thread + single unlock.
 */
export type ThreadInterestSource = 'initial' | 'linked' | 'couple_added' | 'vendor_offered';
export type ThreadInterestStatus = 'asked' | 'quoted' | 'declined' | 'withdrawn';

export type ThreadServiceInterestRow = {
  interest_id: string;
  thread_id: string;
  vendor_service_id: string | null;
  category_key: string | null;
  source: ThreadInterestSource;
  status: ThreadInterestStatus;
  added_by_role: 'couple' | 'vendor';
  created_at: string;
};

/** A single interest the caller wants recorded against a thread. */
export type InterestSeed = {
  vendorServiceId: string | null;
  categoryKey: string | null;
  source: ThreadInterestSource;
};

const INTEREST_SELECT =
  'interest_id,thread_id,vendor_service_id,category_key,source,status,added_by_role,created_at';

/**
 * Fetch every interest row on a thread (chip-row feed for both the couple and
 * vendor thread views). RLS scopes the read to the two parties via the parent
 * chat_threads row (thread_service_interests_member_read), so a plain query is
 * safe for both sides — no SECURITY DEFINER reader needed.
 *
 * GRACEFUL DEGRADE: this sits on the thread-render path. The migration is
 * owner-pushed and may not be applied yet — on ANY error (missing relation or
 * transient) we log + return [] so opening a thread is never blocked; the chip
 * row simply doesn't render until the migration lands.
 */
export async function fetchThreadInterests(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ThreadServiceInterestRow[]> {
  try {
    const { data, error } = await supabase
      .from('thread_service_interests')
      .select(INTEREST_SELECT)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) {
      logQueryError(
        'fetchThreadInterests',
        error,
        { thread_id: threadId, missing_relation: isMissingRelationError(error) },
        'graceful_degrade',
      );
      return [];
    }
    return (data ?? []) as ThreadServiceInterestRow[];
  } catch (caught) {
    logQueryError(
      'fetchThreadInterests (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { thread_id: threadId },
      'graceful_degrade',
    );
    return [];
  }
}

/**
 * Human label for one interest chip. Prefers the resolved service title (passed
 * in by the caller that already loaded vendor_services), else falls back to the
 * category_key run through displayServiceLabel (canonical → label, custom → raw).
 */
export function interestChipLabel(
  row: Pick<ThreadServiceInterestRow, 'category_key'>,
  serviceTitle?: string | null,
): string {
  const title = serviceTitle?.trim();
  if (title) return title;
  if (row.category_key) return displayServiceLabel(row.category_key);
  return 'Service';
}

/**
 * Insert interest rows against a thread, best-effort + idempotent. The
 * UNIQUE(thread_id, vendor_service_id) constraint makes a repeat capture a
 * no-op for concrete services (ON CONFLICT DO NOTHING); category-only rows
 * (null vendor_service_id) are de-duplicated here against what already exists
 * so re-opening the composer doesn't stack duplicate category chips.
 *
 * Never throws — interests are metadata on the inquiry; a capture hiccup must
 * never break the inquiry itself (the thread + first message already landed).
 * The caller passes added_by_role so the RLS role↔source check is satisfied
 * (couple → initial/linked/couple_added; vendor → vendor_offered).
 */
export async function recordThreadInterests(
  supabase: SupabaseClient,
  args: {
    threadId: string;
    addedByRole: 'couple' | 'vendor';
    seeds: InterestSeed[];
  },
): Promise<void> {
  const seeds = args.seeds.filter(
    (s) => s.vendorServiceId !== null || (s.categoryKey ?? '').trim().length > 0,
  );
  if (seeds.length === 0) return;

  try {
    // De-dupe category-only seeds (null service) against existing rows so the
    // composer re-open doesn't pile up duplicates. Concrete-service dupes are
    // handled by the DB UNIQUE constraint via onConflict.
    const existing = await fetchThreadInterests(supabase, args.threadId);
    const existingServiceIds = new Set(
      existing.map((r) => r.vendor_service_id).filter((v): v is string => v !== null),
    );
    const existingCategoryOnly = new Set(
      existing
        .filter((r) => r.vendor_service_id === null && r.category_key)
        .map((r) => r.category_key as string),
    );

    const rows: Array<Record<string, unknown>> = [];
    const seenCategoryOnly = new Set<string>();
    for (const seed of seeds) {
      if (seed.vendorServiceId) {
        if (existingServiceIds.has(seed.vendorServiceId)) continue;
      } else {
        const key = (seed.categoryKey ?? '').trim();
        if (key.length === 0) continue;
        if (existingCategoryOnly.has(key) || seenCategoryOnly.has(key)) continue;
        seenCategoryOnly.add(key);
      }
      rows.push({
        thread_id: args.threadId,
        vendor_service_id: seed.vendorServiceId,
        category_key: seed.categoryKey,
        source: seed.source,
        added_by_role: args.addedByRole,
      });
    }
    if (rows.length === 0) return;

    const { error } = await supabase
      .from('thread_service_interests')
      .upsert(rows, { onConflict: 'thread_id,vendor_service_id', ignoreDuplicates: true });
    if (error) {
      logQueryError(
        'recordThreadInterests',
        error,
        { thread_id: args.threadId, missing_relation: isMissingRelationError(error) },
        'graceful_degrade',
      );
    }
  } catch (caught) {
    logQueryError(
      'recordThreadInterests (threw)',
      caught instanceof Error ? caught : new Error(String(caught)),
      { thread_id: args.threadId },
      'graceful_degrade',
    );
  }
}
