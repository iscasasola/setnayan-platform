/**
 * Reads (and the one write) for the Mood Board render-credit ledger MB2 built
 * (migration `20271199871696_moodboard_render_credits_ledger_and_the_one_pack_sku.sql`).
 *
 * MB7 is the FREE tier: nothing here spends a credit
 * (`moodboard_reserve_render_credits` is MB8's, when a real provider call
 * exists to spend one on). What MB7 needs to be honest is:
 *   · the config row (credits per part / whole look / pack, the note cap) —
 *     `readMoodboardRenderConfig`
 *   · the balance — `readMoodboardRenderBalance`, which returns `null` for
 *     ZERO ROWS (a refused read), never a fabricated zero
 *   · a real "Buy" button — `MOODBOARD_RENDER_PACK_SKU`, wired to the
 *     existing apply-then-pay checkout the same way every other one-SKU
 *     add-on is, and `grantMoodboardRenderPackCredits`, the per-SKU
 *     activation hook that turns a manually-approved order into a grant row.
 *     Without it the Buy button would place a real order that never becomes
 *     a credit — a purchase that reads as working and silently isn't, the
 *     exact failure class this repo keeps closing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { type MoodboardRenderConfig } from './moodboard-render-parts';

export const MOODBOARD_RENDER_PACK_SKU = 'MOODBOARD_RENDER_PACK';

type ConfigRow = {
  credits_per_part: number;
  credits_whole_look: number;
  credits_per_pack: number;
  pack_service_code: string;
  max_note_chars: number;
  is_active: boolean;
};

/**
 * The live render-config row. `null` on any read failure or an inactive row
 * — callers must show "unavailable", never assume 1/5/50 as a fallback: a
 * quietly-assumed cost is a charge nobody authorised (see the table's own
 * COMMENT ON TABLE).
 */
export async function readMoodboardRenderConfig(
  supabase: SupabaseClient,
): Promise<MoodboardRenderConfig | null> {
  const { data, error } = await supabase
    .from('moodboard_render_config')
    .select('credits_per_part, credits_whole_look, credits_per_pack, pack_service_code, max_note_chars, is_active')
    .eq('config_key', 'default')
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ConfigRow;
  if (!row.is_active) return null;
  return {
    creditsPerPart: row.credits_per_part,
    creditsWholeLook: row.credits_whole_look,
    creditsPerPack: row.credits_per_pack,
    packServiceCode: row.pack_service_code,
    maxNoteChars: row.max_note_chars,
    isActive: row.is_active,
  };
}

export type MoodboardRenderBalance = {
  creditsGranted: number;
  creditsUsed: number;
  creditsLeft: number;
};

/**
 * `moodboard_render_balance` returns ZERO ROWS — not a zero balance — to a
 * caller who may not ask (see the function's own migration comment). This
 * mirrors that exactly: `null` means "not permitted to know", `{creditsLeft:
 * 0, …}` means a real, answered zero. The two must never render the same
 * banner.
 */
export async function readMoodboardRenderBalance(
  supabase: SupabaseClient,
  eventId: string,
): Promise<MoodboardRenderBalance | null> {
  const { data, error } = await supabase.rpc('moodboard_render_balance', { p_event_id: eventId });
  if (error || !data || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as { credits_granted: number; credits_used: number; credits_left: number };
  return {
    creditsGranted: row.credits_granted,
    creditsUsed: row.credits_used,
    creditsLeft: row.credits_left,
  };
}
