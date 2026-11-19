/**
 * 🖼 "OPENED BY YOU" — the shop opened one of its albums (Portfolio, simpler · owner 2026-11-19).
 *
 * One small own-row write to `public.vendor_album_opens` (migration 20271351728222): `opened_at` = now for this shop's
 * album. RLS is the boundary (the shop's own rows only), exactly like a notice close (`lib/notice-memory.ts`) — so it
 * needs no server action (the export budget is at its ceiling, `scripts/lint-server-action-budget.mjs`).
 *
 * Best-effort: an album opens the same whether or not this was written; a refused write is said in the console and
 * the Sort simply does not learn of this open.
 *
 * ⚡ The browser client is import()ed on first use, never statically (`scripts/check-maker-js-budget.mjs`).
 * BROWSER ONLY — called from a press.
 */
import type { AlbumKind } from './portfolio-albums';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordAlbumOpen(vendorProfileId: string, kind: AlbumKind, key: string): Promise<void> {
  // A lab's shop ("lab") has no row to write under.
  if (!UUID_RE.test(vendorProfileId) || !key || key.length > 200) return;
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const { error } = await createClient()
      .from('vendor_album_opens')
      .upsert({ vendor_profile_id: vendorProfileId, album_kind: kind, album_key: key, opened_at: new Date().toISOString() }, { onConflict: 'vendor_profile_id,album_kind,album_key' });
    if (error) console.warn('[portfolio] this open was not recorded', error.message);
  } catch {
    /* the album still opens */
  }
}
