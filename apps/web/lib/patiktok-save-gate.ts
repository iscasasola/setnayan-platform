import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventSkuActive } from '@/lib/entitlements';
import { PATIKTOK_SERVICE_KEY } from '@/lib/patiktok';

/**
 * apps/web/lib/patiktok-save-gate.ts — THE server-side answer to "may this
 * event take a Patiktok reel out?" (save · download · share · TikTok).
 *
 * The rule and the list of paid actions live in `lib/patiktok-access.ts`
 * (owner 2026-09-29: *"yes use for free. but pay to save and share"*). This is
 * the one place that MEASURES it, so every save/share/post entry point asks the
 * same question the same way:
 *
 *   • `eventSkuActive` — the bundle-aware HANDSHAKE gate: an admin-APPROVED
 *     `PATIKTOK_COMPILER` (or a bundle / comp / promo / internal event that
 *     grants it). A payment still under review does NOT unlock — the same rule
 *     every paid feature follows (owner 2026-06-18).
 *   • ADMIN client, because orders RLS is purchaser-scoped: a co-host who did
 *     not personally place the order would otherwise read "not paid".
 *
 * Fails CLOSED: an unexpected database error throws out of `eventSkuActive`, so
 * the caller refuses rather than saving.
 */
export async function patiktokSaveUnlocked(eventId: string): Promise<boolean> {
  return eventSkuActive(createAdminClient(), eventId, PATIKTOK_SERVICE_KEY);
}
