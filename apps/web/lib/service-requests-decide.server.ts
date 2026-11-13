/**
 * service-requests-decide.server.ts — what a decision on a service request does to the CARDS
 * (owner rulings 2026-11-13, rulings 6 and 7).
 *
 * Before this, promote/map wrote only the request row: the supplier was told "Use X" and their cards
 * stayed exactly where they were. Now:
 *
 *   · ADD / MOVE — every card tagged with ANY of the decided requests (every shop that asked for that
 *     name) leaves "<category> › Others" for the decided service: `vendor_services.category` becomes
 *     the service key and the card is filed under the shop's coverage of it (created if the shop had
 *     none — the same `vendor_coverages` row the card maker writes).
 *   · KEEP / NOT ADDED — the cards stay where they are, online. Nothing is written to them.
 *
 * 🔒 A card moves ONLY when its shop filed the request it is tagged with (`cardMayFollow`). A
 * supplier can write the tag on their own card, so the tag alone proves nothing.
 *
 * Called only from `decideServiceRequest` (app/admin/categories/actions.ts), which is admin-gated and
 * audit-logged. Uses the service role: a decision moves several shops' cards at once.
 */
import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { normalisePhrase } from '@/lib/admin-map/ask-the-admin';
import { cardMayFollow } from '@/lib/service-requests';

type Admin = ReturnType<typeof createAdminClient>;

export type DecidedRequest = { request_id: string; proposed_by_vendor_id: string; proposed_label: string };

/** The cards tagged with these requests that may follow them (their shop filed the request). */
export async function cardsFollowingRequests(
  admin: Admin,
  requests: readonly DecidedRequest[],
): Promise<{ ok: true; cards: Array<{ vendor_service_id: string; vendor_profile_id: string }> } | { ok: false }> {
  if (requests.length === 0) return { ok: true, cards: [] };
  const byId = new Map(requests.map((r) => [r.request_id, r]));
  const { data, error } = await admin
    .from('vendor_services')
    .select('vendor_service_id, vendor_profile_id, category_request_id')
    .in('category_request_id', [...byId.keys()]);
  if (error) {
    logQueryError('cardsFollowingRequests (vendor_services)', error);
    return { ok: false };
  }
  const cards = ((data ?? []) as Array<{ vendor_service_id: string; vendor_profile_id: string; category_request_id: string }>).filter((c) => {
    const req = byId.get(c.category_request_id);
    return req ? cardMayFollow(c, req) : false;
  });
  return { ok: true, cards: cards.map(({ vendor_service_id, vendor_profile_id }) => ({ vendor_service_id, vendor_profile_id })) };
}

/**
 * Move the following cards to `canonical`. Returns how many moved, or an error sentence. Each shop's
 * coverage of the service is found or created first so the card is filed exactly like a card the
 * maker made under that service.
 */
export async function moveCardsToService(
  admin: Admin,
  cards: ReadonlyArray<{ vendor_service_id: string; vendor_profile_id: string }>,
  canonical: string,
): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  if (cards.length === 0) return { ok: true, moved: 0 };
  const shops = [...new Set(cards.map((c) => c.vendor_profile_id))];
  const { error: upErr } = await admin.from('vendor_coverages').upsert(
    shops.map((vendor_profile_id) => ({ vendor_profile_id, canonical_service: canonical })),
    { onConflict: 'vendor_profile_id,canonical_service', ignoreDuplicates: true },
  );
  if (upErr) return { ok: false, error: `Couldn’t file the shops under the service: ${upErr.message}` };
  const { data: covs, error: covErr } = await admin
    .from('vendor_coverages')
    .select('id, vendor_profile_id')
    .eq('canonical_service', canonical)
    .in('vendor_profile_id', shops);
  if (covErr) return { ok: false, error: `Couldn’t read the shops’ coverage: ${covErr.message}` };
  const coverageOf = new Map(((covs ?? []) as Array<{ id: number; vendor_profile_id: string }>).map((c) => [c.vendor_profile_id, c.id]));

  let moved = 0;
  for (const shop of shops) {
    const ids = cards.filter((c) => c.vendor_profile_id === shop).map((c) => c.vendor_service_id);
    const { data, error } = await admin
      .from('vendor_services')
      .update({ category: canonical, coverage_id: coverageOf.get(shop) ?? null, updated_at: new Date().toISOString() })
      .in('vendor_service_id', ids)
      .eq('vendor_profile_id', shop)
      .select('vendor_service_id');
    if (error) return { ok: false, error: `Couldn’t move the cards: ${error.message}` };
    moved += (data ?? []).length;
  }
  return { ok: true, moved };
}

/**
 * On ADD, the words the shops typed become search words for the new service (owner ruling 6). An
 * admin just decided they mean this service, so the rows are written REVIEWED — unlike
 * `recordCollectedTradePhrase`, whose rows wait for a person. Never overwrites an existing phrase.
 */
export async function saveDecidedSearchWords(
  admin: Admin,
  phrases: readonly string[],
  canonical: string,
  adminUserId: string,
): Promise<void> {
  const rows = [...new Set(phrases.map((p) => normalisePhrase(p).slice(0, 80)).filter((p) => p.length >= 2))].map((phrase) => ({
    phrase,
    canonical_service: canonical,
    source: 'collected',
    reviewed_at: new Date().toISOString(),
    reviewed_by: adminUserId,
  }));
  if (rows.length === 0) return;
  try {
    const { error } = await admin.from('canonical_service_aliases').upsert(rows, { onConflict: 'phrase', ignoreDuplicates: true });
    if (error) logQueryError('saveDecidedSearchWords (canonical_service_aliases)', error);
  } catch {
    /* a search word is a bonus; the decision already stands */
  }
}
