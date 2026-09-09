'use server';

/**
 * The couple's hand-made order for ONE bench category — read, write, reset.
 *
 * Owner 2026-09-09: *"per category"* and *"all hosts of that event see the same
 * order."* So the arrangement lives on the celebration (unlike the sort lens,
 * which is `persistBenchSort` in localStorage), and every write is scoped to one
 * `(event_id, tile)`.
 *
 * ── IT DECIDES NOTHING ──────────────────────────────────────────────────────
 * Every rule about what an arrangement MEANS — pins beat sort, a newcomer lands
 * where the lens puts it, a clamped pin, a collision — is in the pure
 * `lib/bench-arrangement.ts` and is unit tested there. This file moves rows.
 *
 * ── AUTH IS RLS, AND THE CLIENT IS THE COUPLE'S OWN ─────────────────────────
 * Deliberately the user's own Supabase client, never the admin one: the four
 * policies on `event_bench_arrangement` already say "a host of this
 * celebration", so a non-member's write fails at the database rather than at a
 * check this file could forget. The signed-in check below is a courtesy that
 * turns an RLS refusal into a sentence, not the gate itself.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { BenchPin } from '@/lib/bench-arrangement';

export type ArrangementResult = { ok: true } | { ok: false; error: string };

/** Hard ceiling on one category's pin set. A rail is a shortlist, not a
 *  catalogue; anything past this is a malformed client, and refusing it is
 *  cheaper than writing it. Mirrors the column CHECK (position <= 500). */
const MAX_PINS = 200;

function cleanTile(raw: unknown): string | null {
  const t = String(raw ?? '').trim();
  return t.length > 0 && t.length <= 120 ? t : null;
}

/**
 * Replace one category's arrangement with exactly this pin set.
 *
 * 🔑 REPLACE, NOT MERGE. `pinsAfterMove` returns the WHOLE set for the category
 * precisely so this can be one idempotent write — a merge would leave a pin the
 * couple has just moved off sitting in the table, and the next read would put
 * a card somewhere they never dropped it.
 *
 * The delete-then-insert is scoped to the one `(event_id, tile)` and runs on the
 * couple's own client, so RLS bounds both halves to their own celebration.
 */
export async function saveBenchArrangement(input: {
  eventId: string;
  tile: string;
  pins: BenchPin[];
}): Promise<ArrangementResult> {
  const eventId = String(input.eventId ?? '').trim();
  const tile = cleanTile(input.tile);
  if (!eventId || !tile) return { ok: false, error: 'Missing event or category.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  // Sanitise here as well as in the pure module: this is a network boundary, and
  // the pure module's `pinMap` runs on the READ side, which is too late to keep
  // a malformed row out of the table.
  const seen = new Set<string>();
  const rows: {
    event_id: string;
    tile: string;
    vendor_id: string;
    position: number;
    set_by: string;
  }[] = [];
  for (const p of input.pins ?? []) {
    const vendorId = String(p?.vendorId ?? '').trim();
    const position = Number(p?.position);
    if (!vendorId || seen.has(vendorId)) continue;
    if (!Number.isInteger(position) || position < 0 || position > 500) continue;
    seen.add(vendorId);
    rows.push({ event_id: eventId, tile, vendor_id: vendorId, position, set_by: user.id });
    if (rows.length >= MAX_PINS) break;
  }

  const { error: clearError } = await supabase
    .from('event_bench_arrangement')
    .delete()
    .eq('event_id', eventId)
    .eq('tile', tile);
  if (clearError) return { ok: false, error: clearError.message };

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('event_bench_arrangement')
      .insert(rows);
    if (insertError) return { ok: false, error: insertError.message };
  }

  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true };
}

/**
 * Reset — give ONE category's rail back to the lens.
 *
 * ⚠ ONE CATEGORY. That is not a detail of the implementation, it is the owner's
 * ruling: an arrangement is per category, so the control that undoes it reaches
 * exactly as far. A couple who arranged their caterers three weeks ago must not
 * lose that by tidying their florists today.
 */
export async function resetBenchArrangement(input: {
  eventId: string;
  tile: string;
}): Promise<ArrangementResult> {
  const eventId = String(input.eventId ?? '').trim();
  const tile = cleanTile(input.tile);
  if (!eventId || !tile) return { ok: false, error: 'Missing event or category.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in.' };

  const { error } = await supabase
    .from('event_bench_arrangement')
    .delete()
    .eq('event_id', eventId)
    .eq('tile', tile);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/${eventId}/vendors`);
  return { ok: true };
}
