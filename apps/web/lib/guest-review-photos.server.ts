import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { loadGuestBlurGate, guestSafeKeyForCapture } from '@/lib/papic-guest-blur-gate';
import type { GuestReviewRow } from '@/lib/guest-reviews';

const URL_TTL_SECONDS = 60 * 60;

/**
 * The photo thumb on a guest review row (prototype § 9: "photo thumb (if any)") — the guest's OWN Papic shot, passed
 * through THE ONE blur gate every guest-facing read uses (`lib/papic-guest-blur-gate.ts`), so a shot of somebody who
 * withdrew consent is shown blurred or not at all, on a public page most of all. A shot that is hidden, not clean, a
 * clip, or that fails the gate simply has no thumb — the review still shows. Per event, in parallel; fail-soft.
 */
export async function resolveGuestReviewPhotoUrls(rows: ReadonlyArray<GuestReviewRow>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const withShot = rows.filter((r) => r.capture_id);
  if (withShot.length === 0) return out;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('papic_guest_captures')
      .select('capture_id, event_id, thumb_r2_key, display_r2_key')
      .in('capture_id', withShot.map((r) => r.capture_id as string))
      .eq('moderation_state', 'clean')
      .eq('media_type', 'photo')
      .is('hidden_at', null);
    if (error) {
      console.error('[supabase-error] lib/guest-review-photos.server.ts · from:papic_guest_captures.select', error);
      return out;
    }
    const caps = (data ?? []) as Array<{ capture_id: string; event_id: string; thumb_r2_key: string | null; display_r2_key: string | null }>;
    const byEvent = new Map<string, typeof caps>();
    for (const c of caps) byEvent.set(c.event_id, [...(byEvent.get(c.event_id) ?? []), c]);
    await Promise.all(
      [...byEvent.entries()].map(async ([eventId, list]) => {
        const gate = await loadGuestBlurGate(
          admin,
          eventId,
          list.map((c) => ({ sourceTable: 'papic_guest_captures' as const, sourceId: c.capture_id })),
        );
        if (gate.failed) return;
        await Promise.all(
          list.map(async (c) => {
            const key = guestSafeKeyForCapture(
              gate,
              { sourceTable: 'papic_guest_captures', sourceId: c.capture_id },
              c.thumb_r2_key ?? c.display_r2_key,
              'thumb',
            );
            if (!key) return;
            const url = await displayUrlForStoredAsset(key, { ttlSeconds: URL_TTL_SECONDS }).catch(() => null);
            if (url) out.set(c.capture_id, url);
          }),
        );
      }),
    );
  } catch {
    return out;
  }
  return out;
}
