/**
 * lib/moodboard-finalization-rows.ts — the finalization ROWS, and nothing that
 * needs a database to interpret them.
 *
 * 🛑 WHY THIS IS A SEPARATE FILE FROM `lib/moodboard-finalization.ts`.
 * That module answers "who may be asked about this part", which it does by
 * composing MB10's slot → trade map — and that map reaches
 * `lib/vendor-counts.ts` → `lib/taxonomy-db.ts` → `lib/supabase/server.ts` →
 * `next/headers`. A `'use client'` file that imports a VALUE from it therefore
 * fails the production build with *"You're importing a component that needs
 * next/headers"*.
 *
 * 🔑 AND `tsc` CANNOT SEE THAT. It typechecks; it is not a bundler and does not
 * know what `'use client'` means. Unit tests import the module directly in
 * node, where everything resolves happily. `next build` is the only detector,
 * and MB12 shipped this exact chain to CI before it was caught — from
 * `palette-board-context.tsx`, one import of one four-line helper.
 * `moodboard-gallery.ts`'s own docblock had already written the warning down.
 *
 * So: everything a browser needs in order to READ the rows lives here, with no
 * import outside `lib/mood-board.ts`'s pure vocabulary. Everything that needs
 * the taxonomy stays server-side and is resolved into props by `page.tsx`.
 * `lint-server-only-boundary.mjs` now treats `next/headers` as a boundary root,
 * so this cannot silently come back.
 */

/**
 * One `moodboard_part_finalizations` row, as every surface reads it.
 *
 * Deliberately the DB column names: this shape is what the query returns, and
 * renaming on the way in is how a field quietly stops being read.
 */
export type PartFinalizationRecord = {
  finalization_id: string;
  part_id: string;
  vendor_id: string;
  state: string;
  expires_at: string | null;
  agreed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  reopen_state: string | null;
  reopen_expires_at: string | null;
  reopen_decline_reason: string | null;
  frozen_palette_keys: string[] | null;
  frozen_dressing_fields: string[] | null;
};

/**
 * Index the live rows by part. At most one row per part can be pending or
 * agreed — `moodboard_part_finalizations_one_live_uniq` enforces it — so this
 * map is total, not a "last one wins".
 */
export function liveByPart(
  rows: readonly PartFinalizationRecord[],
): Map<string, PartFinalizationRecord> {
  const out = new Map<string, PartFinalizationRecord>();
  for (const row of rows) {
    if (row.state !== 'pending' && row.state !== 'agreed') continue;
    out.set(row.part_id, row);
  }
  return out;
}

/**
 * What is CURRENTLY frozen on this board, read from the rows themselves.
 *
 * 🔑 FROM `frozen_palette_keys`, NOT FROM `paletteKeysFrozenBy`. The row records
 * what the agreement ACTUALLY added; the map says what an agreement WOULD add
 * today. They differ whenever the couple had already touched a role by hand
 * before finalizing — and re-deriving the answer from the map would then claim
 * their own edit as ours and release it on re-open. The database releases
 * exactly `frozen_palette_keys` for the same reason.
 */
export function frozenNow(rows: readonly PartFinalizationRecord[]): {
  paletteKeys: Set<string>;
  dressingFields: Set<string>;
} {
  const paletteKeys = new Set<string>();
  const dressingFields = new Set<string>();
  for (const row of rows) {
    if (row.state !== 'agreed') continue;
    for (const k of row.frozen_palette_keys ?? []) paletteKeys.add(k);
    for (const f of row.frozen_dressing_fields ?? []) dressingFields.add(f);
  }
  return { paletteKeys, dressingFields };
}
