/**
 * MB23 · A PLACEHOLDER PHOTOGRAPH MUST NOT REACH A COUPLE.
 *
 * Owner's bug report, 2026-09-05 (verbatim): "we do not have a design yet for
 * the palette and there are already samples on in your colors." One of the
 * things they were looking at was a card labelled "Ceremony" whose asset was
 * `https://picsum.photos/seed/setnayan-church-1/1200/800` — a random stock
 * photograph, seeded during bring-up on 2026-05-31, approved 2026-05-22, and
 * live to customers ever since.
 *
 * Migration `20271205919528` retires the two rows that were still live. This
 * module is the OTHER half: the retirement is a fact about today's rows, and a
 * fact about rows is undone by one admin click. The predicate below is the rule,
 * and `approveAsset` in `app/admin/moodboard-library/actions.ts` refuses on it.
 *
 * ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
 * `admin/moodboard-library/actions.ts` is the busiest file in the moodboard arc
 * — MB19, MB20 and MB21 all landed in it within two days. Keeping the rule here
 * means MB23 adds one import and one call there, so the merge is trivial and the
 * rule is unit-testable without a Supabase client.
 *
 * ── WHAT COUNTS AS A PLACEHOLDER ────────────────────────────────────────────
 * Two independent tests, deliberately OR'd rather than AND'd, because each
 * catches rows the other misses (measured on prod, 2026-09-05):
 *
 *   • `source = 'internet_placeholder'` — the seeds' own self-declaration. This
 *     catches the eight Pexels rows, whose host is not picsum at all.
 *   • a placeholder image HOST in `storage_path` — catches a row whose `source`
 *     was left null or overwritten on a later edit.
 *
 * DELIBERATELY NOT HERE: a DNS or reachability check on the host. Ten unapproved
 * `venue_scene` rows point at `media.setnayan.com`, which does not resolve, and
 * their objects 404 on the working host too — but a network probe inside an
 * admin action is a flake generator, and a host that is down for ninety seconds
 * is not the same thing as a stock photograph. That one is reported to the
 * session that owns the pilot, not enforced here.
 */

/** The seeds' self-declared provenance for a bring-up stand-in. */
export const PLACEHOLDER_SOURCE = 'internet_placeholder';

/**
 * Hosts that only ever serve stand-in imagery. Matched on the host portion of
 * the URL (and as a suffix, so `images.pexels.com` matches `pexels.com`) rather
 * than anywhere in the string — otherwise an R2 object legitimately named
 * `.../picsum-photos-replacement.webp` would be refused.
 */
export const PLACEHOLDER_HOSTS = ['picsum.photos', 'pexels.com', 'placehold.co'] as const;

export type PlaceholderCandidate = {
  source?: string | null;
  storage_path?: string | null;
};

function hostOf(storagePath: string): string | null {
  try {
    return new URL(storagePath).hostname.toLowerCase();
  } catch {
    return null; // relative/app-served path (e.g. /moodboard-seed/florals/…) — fine
  }
}

/** True when `storage_path` is served by a known stand-in image host. */
export function isPlaceholderHost(storagePath: string | null | undefined): boolean {
  if (!storagePath) return false;
  const host = hostOf(storagePath);
  if (!host) return false;
  return PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** True when the row is a bring-up stand-in rather than real artwork. */
export function isPlaceholderAsset(row: PlaceholderCandidate | null | undefined): boolean {
  if (!row) return false;
  return row.source === PLACEHOLDER_SOURCE || isPlaceholderHost(row.storage_path);
}

/**
 * The refusal an admin reads, or `null` when the row is fine to approve.
 * Names WHICH of the two tests fired, so the admin can tell "this is stock" from
 * "someone mislabelled the source".
 */
export function placeholderRefusal(row: PlaceholderCandidate | null | undefined): string | null {
  if (!row) return null;
  if (row.source === PLACEHOLDER_SOURCE) {
    return (
      'This asset is a bring-up placeholder (source = "internet_placeholder"), not real ' +
      'artwork, and must not be published to couples. Replace it with a supplied asset, ' +
      'then approve that instead. (MB23, owner ruling 2026-09-05.)'
    );
  }
  if (isPlaceholderHost(row.storage_path)) {
    return (
      `This asset is served from a stock-image host (${hostOf(row.storage_path!)}), not from ` +
      'our own storage, and must not be published to couples. Upload the real file, then ' +
      'approve that instead. (MB23, owner ruling 2026-09-05.)'
    );
  }
  return null;
}

/** The two columns the rule reads. Exported so the call site cannot drift from it. */
export const PLACEHOLDER_COLUMNS = 'source, storage_path';

/**
 * A thunk that runs the single-row read and resolves like a PostgREST response.
 *
 * 🪤 THE GUARD TAKES A FETCH, NOT A CLIENT — and that is not a style choice.
 * The first version took a structural `{ from: (t) => { select … } }` so this
 * file could stay Supabase-free. Passing the real admin client into it made tsc
 * fail with TS2589, "type instantiation is excessively deep and possibly
 * infinite": `select()` carries a const string generic that PostgREST resolves
 * into the whole schema's row types, and matching that against ANY hand-written
 * structural shape sends the checker off a cliff. A thunk sidesteps it — the
 * generic resolves once, at the call site, against its own concrete types, and
 * only the plain result shape crosses this boundary. No `any`, no cast.
 *
 * `data` is `unknown` for the same reason, and is narrowed at runtime — which is
 * where the row actually arrives untyped from the wire anyway.
 */
export type PlaceholderRowFetch = () => PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

/**
 * Read the asset and throw if it is a placeholder. One statement in
 * `approveAsset`.
 *
 * Throws rather than returning a flag on purpose: `approveAsset` returns void
 * and its callers treat a throw as the failure path already, so a silent
 * `return` here would look identical to a successful publish in the admin UI.
 */
export async function assertNotPlaceholder(fetchRow: PlaceholderRowFetch): Promise<void> {
  const { data, error } = await fetchRow();
  // A read failure must not become a silent approval of an unread row.
  if (error) throw new Error(`approve failed: could not read asset — ${error.message}`);
  if (!data) throw new Error('approve failed: asset not found');
  const refusal = placeholderRefusal(data as PlaceholderCandidate);
  if (refusal) throw new Error(refusal);
}
