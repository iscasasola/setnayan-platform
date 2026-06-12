import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchThreadInterests,
  interestChipLabel,
  type ThreadServiceInterestRow,
} from '@/lib/thread-interests';

/**
 * ThreadInterestChips — compact "Inquiring about: Catering · Cake · Mobile Bar"
 * row near the top of both thread views (owner-locked 2026-06-12 "multi-service
 * inquiry mapping"). Reads thread_service_interests (RLS-scoped to the two
 * parties via the parent chat_threads row, so both couple + vendor see it),
 * resolves each chip's label from the linked vendor_services title (admin
 * client — label-only lookup, no RLS leak of vendor-private data beyond the
 * service name the couple already saw on the profile), and falls back to the
 * category_key. Renders nothing when there are no interests OR the migration
 * isn't applied yet (fetch graceful-degrades to []).
 */
export async function ThreadInterestChips({
  supabase,
  threadId,
}: {
  supabase: SupabaseClient;
  threadId: string;
}) {
  const interests = await fetchThreadInterests(supabase, threadId);
  if (interests.length === 0) return null;

  // Resolve display titles for interests that point at a concrete service.
  const serviceIds = Array.from(
    new Set(
      interests
        .map((r) => r.vendor_service_id)
        .filter((v): v is string => v !== null),
    ),
  );
  const titleById = new Map<string, string | null>();
  if (serviceIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from('vendor_services')
        .select('vendor_service_id, title, category')
        .in('vendor_service_id', serviceIds);
      for (const s of data ?? []) {
        const row = s as { vendor_service_id: string; title: string | null; category: string | null };
        // Prefer the per-listing title; else leave null so interestChipLabel
        // falls back to the interest's category_key.
        titleById.set(row.vendor_service_id, row.title);
      }
    } catch {
      /* label-only enrichment — degrade to category_key labels */
    }
  }

  // De-dupe by resolved label so an 'initial' + a 'couple_added' that resolve
  // to the same human label don't double-render.
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const r of interests as ThreadServiceInterestRow[]) {
    if (r.status === 'withdrawn') continue;
    const label = interestChipLabel(
      r,
      r.vendor_service_id ? titleById.get(r.vendor_service_id) : null,
    );
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink/10 bg-cream/60 px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        Inquiring about
      </span>
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full border border-terracotta/30 bg-terracotta/5 px-2.5 py-0.5 text-[12px] text-ink/80"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
