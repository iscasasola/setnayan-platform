'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTileDerivative } from '@/lib/papic-derivatives';
import { isClipRow, type PapicDisplayRow } from '@/lib/papic-display-ref';

/**
 * Fill `tile_r2_key` (long-edge 640 AVIF — the copy a grid WALL renders) on
 * capture rows that predate it.
 *
 * ── WHY THIS IS A SERVER ACTION AND NOT THE ROUTE IT REPLACED ──────────────
 * It shipped first as `POST /api/admin/papic/backfill-tiles`, with **no caller
 * and no button anywhere in the app**. That is a mechanism never proven
 * reachable — the exact defect class this repo keeps paying for — and it was
 * written while quoting that rule. `/admin/website-media` already ships the
 * idiom for a bulk admin operation (`actions.ts` + a client button), so this
 * uses it: one fewer HTTP surface to secure, and a control a person can
 * actually press.
 *
 * ── WHY A BACKFILL AT ALL ──────────────────────────────────────────────────
 * `resolveLargeStillRef` falls back to `display_r2_key` when a row has no
 * tile, so nothing is broken without this. But display is long-edge 1280 —
 * measured in prod at **96 KB average against the tile's ~24 KB, max 780 KB** —
 * so every pre-existing photo keeps costing ~4× what it needs to. Without a
 * backfill the saving is theoretical for exactly the photos that already exist.
 *
 * Batched and idempotent: it selects rows where `tile_r2_key IS NULL`, and the
 * object key is derived from the source key, so a second press overwrites the
 * same object while the WHERE clause has already excluded what succeeded.
 */

/** Rows per press. Image encoding in a serverless invocation — keep it modest. */
const MAX_BATCH = 40;

export type BackfillResult =
  | { ok: true; filled: number; skipped: number; remaining: number | null }
  | { ok: false; error: string };

type Table = 'papic_photos' | 'papic_guest_captures';

/**
 * The best still to derive a tile FROM.
 *
 *   photo: the original (unless dropped — then it is a dead pointer) → display
 *   clip : the poster / display still. NEVER `r2_object_key`, which is the MP4:
 *          sharp cannot decode video, so passing one in fails per row.
 *
 * Null when there is nothing decodable, so the row is reported as SKIPPED
 * rather than counted as a failure.
 */
function sourceRefFor(row: PapicDisplayRow): string | null {
  if (isClipRow(row)) return row.poster_r2_key ?? row.display_r2_key ?? null;
  const original = row.full_res_dropped_at ? null : row.r2_object_key;
  return original ?? row.display_r2_key ?? null;
}

async function backfillTable(
  table: Table,
  idColumn: 'photo_id' | 'capture_id',
): Promise<{ filled: number; skipped: number; remaining: number | null }> {
  const admin = createAdminClient();
  const typeColumn = table === 'papic_photos' ? 'photo_type' : 'media_type';

  const { data, error } = await admin
    .from(table)
    .select(
      `${idColumn}, ${typeColumn}, r2_object_key, display_r2_key, poster_r2_key, full_res_dropped_at`,
    )
    .is('tile_r2_key', null)
    .limit(MAX_BATCH);

  // A rejected query is not a thrown error — never report a confident zero
  // over a read that never ran.
  if (error) throw new Error(`${table}: ${error.code ?? ''} ${error.message}`);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  let filled = 0;
  let skipped = 0;

  // Sequential on purpose: each row decodes and re-encodes an image, and a
  // parallel burst is how a serverless invocation runs out of memory.
  for (const row of rows) {
    const source = sourceRefFor(row as PapicDisplayRow);
    if (!source) {
      skipped++;
      continue;
    }
    const key = await generateTileDerivative(source, table, idColumn, row[idColumn] as string);
    if (key) filled++;
    else skipped++;
  }

  const { count } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .is('tile_r2_key', null);

  // `count === null` means NOT MEASURED, never zero. Passing the null through
  // keeps "nothing left" and "nobody counted" as two different answers.
  return { filled, skipped, remaining: count };
}

export async function backfillTileDerivativesAction(): Promise<BackfillResult> {
  await requireAdmin();
  try {
    const results = [
      await backfillTable('papic_photos', 'photo_id'),
      await backfillTable('papic_guest_captures', 'capture_id'),
    ];
    const filled = results.reduce((n, r) => n + r.filled, 0);
    const skipped = results.reduce((n, r) => n + r.skipped, 0);
    const unmeasured = results.some((r) => r.remaining == null);
    const remaining = unmeasured
      ? null
      : results.reduce((n, r) => n + (r.remaining ?? 0), 0);
    revalidatePath('/admin/papic-storage');
    return { ok: true, filled, skipped, remaining };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
