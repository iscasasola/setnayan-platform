import 'server-only';

/**
 * WHO HANDLES EACH CLIENT, for the shop's Clients list (supplier roles d–h, #8013 (f)). The columns are the server's
 * (revoked from every browser role), so this reads them with the SERVICE ROLE, scoped by the caller's own shop id.
 *
 * `null` = the read was refused or incomplete — Clients then falls back to the card's people, as it did before; an
 * unknown is never turned into "nobody handles this client".
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAllPages } from '@/lib/read-all-pages';
import { logQueryError } from '@/lib/supabase/error-detect';

export type HandledBy = {
  /** The client's one Account Manager (or the manager who took them). */
  handledBy: string | null;
  /** A second card's pick, waiting for "Keep" or "Give" — drawn as the Hand over mark. */
  handOver: string | null;
  /** Covering while the holder's seat is paused (g). */
  covering: string | null;
};

export async function readHandledByForShop(admin: SupabaseClient, vendorProfileId: string): Promise<Map<string, HandledBy> | null> {
  const read = await readAllPages(
    async (from, to) => {
      const { data, error, count } = await admin
        .from('chat_threads')
        .select('event_id, handled_by_member_id, hand_over_member_id, covering_member_id', { count: 'exact' })
        .eq('vendor_profile_id', vendorProfileId)
        .eq('kind', 'supplier')
        .order('thread_id', { ascending: true })
        .range(from, to);
      return { rows: data ?? null, error: error ? error.message : null, total: count };
    },
    { pageSize: 1000 },
  );
  if (read.error || !read.complete) {
    logQueryError('readHandledByForShop', { message: read.error ?? 'incomplete' }, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const out = new Map<string, HandledBy>();
  for (const r of read.rows as Array<{ event_id: string; handled_by_member_id: string | null; hand_over_member_id: string | null; covering_member_id: string | null }>) {
    if (out.has(r.event_id)) continue;
    out.set(r.event_id, { handledBy: r.handled_by_member_id, handOver: r.hand_over_member_id, covering: r.covering_member_id });
  }
  return out;
}

/** The person a client is with right now: the cover while the holder is paused, else the holder. */
export const currentHandlerOf = (h: HandledBy | undefined): string | null => h?.covering ?? h?.handledBy ?? null;
