/**
 * POST /api/admin/papic/backfill-tiles
 *
 * Fills `tile_r2_key` (long-edge 640 AVIF — the size a grid WALL renders) on
 * capture rows that predate it. Admin-only.
 *
 * ── WHY A BACKFILL AND NOT JUST A FALLBACK ─────────────────────────────────
 * `resolveLargeStillRef` already falls back to `display_r2_key` when a row has
 * no tile, so nothing is broken without this. But display is long-edge 1280 —
 * measured in prod, **96 KB average against the tile's ~24 KB, max 780 KB** —
 * so every pre-existing photo keeps costing 4× what it needs to. Without a
 * backfill the saving is theoretical for exactly the photos that already exist.
 *
 * ── SHAPE ──────────────────────────────────────────────────────────────────
 * Batched and idempotent. It selects rows where `tile_r2_key IS NULL`, derives
 * each from the best still available, and reports what it did. Re-running is
 * safe: the object key is derived from the source key, so a second pass
 * overwrites the same object and the WHERE clause has already excluded rows
 * that succeeded.
 *
 * `limit` is capped because this is a serverless invocation doing image
 * encoding — a caller who needs more presses the button again, and the response
 * says whether more remain. Better an honest second press than a timeout
 * halfway through with no record of where it stopped.
 *
 * 🔑 CLIPS ARE SKIPPED WHEN THEY HAVE NO POSTER. A clip's `r2_object_key` is an
 * MP4, and sharp cannot decode it — passing one in would burn the fetch and
 * fail per row. Its still is the poster, which is what the chain below asks for.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateTileDerivative } from '@/lib/papic-derivatives';
import { isClipRow, type PapicDisplayRow } from '@/lib/papic-display-ref';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Rows per press. Image encoding in a serverless invocation — keep it modest. */
const MAX_BATCH = 40;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in.' };

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';
  if (!isAdmin) return { ok: false as const, status: 403, error: 'Admin only.' };
  return { ok: true as const, userId: user.id };
}

type Table = 'papic_photos' | 'papic_guest_captures';

/**
 * The best still to derive a tile FROM.
 *
 *   photo: the original (unless dropped — then it is a dead pointer) → display
 *   clip : the poster / display still. NEVER `r2_object_key`, which is the MP4.
 *
 * Returns null when there is nothing decodable, so the row is reported as
 * skipped rather than counted as a failure.
 */
function sourceRefFor(row: PapicDisplayRow): string | null {
  if (isClipRow(row)) {
    return row.poster_r2_key ?? row.display_r2_key ?? null;
  }
  const original = row.full_res_dropped_at ? null : row.r2_object_key;
  return original ?? row.display_r2_key ?? null;
}

async function backfillTable(
  table: Table,
  idColumn: 'photo_id' | 'capture_id',
  limit: number,
): Promise<{ table: Table; scanned: number; filled: number; skipped: number; remaining: number }> {
  const admin = createAdminClient();
  const typeColumn = table === 'papic_photos' ? 'photo_type' : 'media_type';

  const { data, error } = await admin
    .from(table)
    .select(
      `${idColumn}, ${typeColumn}, r2_object_key, display_r2_key, poster_r2_key, full_res_dropped_at`,
    )
    .is('tile_r2_key', null)
    .limit(limit);

  // A rejected query is not a thrown error — say so rather than reporting a
  // confident zero over a read that never ran.
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
    const key = await generateTileDerivative(
      source,
      table,
      idColumn,
      row[idColumn] as string,
    );
    if (key) filled++;
    else skipped++;
  }

  const { count } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .is('tile_r2_key', null);

  return {
    table,
    scanned: rows.length,
    filled,
    skipped,
    // `count === null` means NOT MEASURED, never zero — surface it as -1 rather
    // than telling an operator the queue is clear when nobody counted it.
    remaining: count ?? -1,
  };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const requested = Number(new URL(req.url).searchParams.get('limit') ?? MAX_BATCH);
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(1, Math.trunc(requested)), MAX_BATCH)
    : MAX_BATCH;

  try {
    const results = [
      await backfillTable('papic_photos', 'photo_id', limit),
      await backfillTable('papic_guest_captures', 'capture_id', limit),
    ];
    const remaining = results.reduce((n, r) => (r.remaining < 0 ? n : n + r.remaining), 0);
    const unmeasured = results.some((r) => r.remaining < 0);
    return NextResponse.json({
      ok: true,
      results,
      // Two separate facts, never collapsed: whether anything is left, and
      // whether we were able to find out.
      more: unmeasured ? null : remaining > 0,
      note: unmeasured
        ? 'Some remaining counts could not be measured — press again and re-check.'
        : `${remaining} row(s) still without a tile derivative.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
