import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';

/**
 * Alaala memory-orb feed — the consumer half of the Papic → Alaala flywheel.
 *
 * The orb (apps/web/app/_components/marketing/AlaalaOrb.tsx) crossfades real
 * Papic CLIPS inside a warm sphere; until this fetcher existed it had no
 * producer and cold-started FOREVER. This resolves the playable clips for it.
 *
 * OWNER-LOCKED GATE (memory project_setnayan_alaala_orb_video_consent): a clip
 * reaches a PUBLIC showcase surface ONLY when BOTH are true —
 *   • consent_to_public            (the guest consented to public sharing)
 *   • couple_approved_for_showcase (the couple picked it for the orb)
 * Cold-start (no clip clears both gates yet) → [] → the orb keeps its existing
 * CSS-gradient skin. Nothing here throws; every failure degrades to [].
 *
 * Surface scoping: the brand /our-story manifesto has no event in context, so
 * the orb there draws from the curated SHOWCASE events (events.is_sample) —
 * the same trust boundary the public no-login tour uses. The two consent gates
 * are the real guarantee; is_sample just keeps the marketing orb pointed at
 * the curated couples rather than every wedding. Read through the admin
 * (service-role) client because the surface is anonymous, mirroring every
 * other public recap/editorial fetcher.
 *
 * The clip's `r2_object_key` holds an `r2://bucket/key` ref (papic capture
 * writes it that way); displayUrlForStoredAsset presigns it to a short-lived
 * GET URL the <video src> can play.
 *
 * PRODUCER (Option A · owner-chosen): the feed reads GUEST-RECORDED clips from
 * `papic_guest_captures` (media_type='clip'). That's the path with a real
 * consent producer — the guest who RECORDS the clip is the one who appears in
 * it, so their capture-time opt-in IS consent_to_public (the cleanest chain).
 * The old papic_photos (paparazzi seat) read had no consent producer: a seat
 * clip is shot BY the photographer, so consent_to_public there could never be
 * set by the depicted guest. The guest-capture read replaces it.
 */

// Keep the orb light — a handful of clips crossfade plenty. Reading a few more
// than we render leaves headroom if a presign returns null for a stray row.
const ORB_CLIP_LIMIT = 12;

/**
 * Resolve presigned, playable clip URLs for the public Alaala showcase orb.
 *
 * @param opts.eventIds  Restrict to these events (e.g. one couple's own page).
 *                       Omit → draw from the curated showcase (events.is_sample).
 * @param opts.limit     Max clips to return (default {@link ORB_CLIP_LIMIT}).
 */
export const fetchAlaalaOrbClips = cache(async function fetchAlaalaOrbClips(
  opts: { eventIds?: string[]; limit?: number } = {},
): Promise<string[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? ORB_CLIP_LIMIT, 50));

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  // Resolve the event scope. Explicit ids win; otherwise the curated showcase.
  let eventIds = opts.eventIds?.filter((id) => typeof id === 'string' && id.length > 0) ?? null;
  if (!eventIds) {
    try {
      const { data, error } = await admin
        .from('events')
        .select('event_id')
        .eq('is_sample', true)
        .eq('event_type', 'wedding');
      if (error) return [];
      eventIds = (data ?? [])
        .map((r) => (r as { event_id?: string }).event_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch {
      return [];
    }
  }
  if (eventIds.length === 0) return [];

  // The two-gate query over GUEST-RECORDED clips. BOTH consent gates true +
  // media_type='clip' + non-hidden + NSFW-clean (never 'unscreened' or a
  // *_blocked verdict on a public surface). Newest first. Graceful-degrade: a
  // missing column (pre-migration) → [], orb stays cold rather than crashing the
  // marketing page. We presign the clip's own r2_object_key (the video) — the
  // poster_r2_key is only the moderation proxy, not what the orb plays.
  let rows: Array<{ r2_object_key: string | null }>;
  try {
    const { data, error } = await admin
      .from('papic_guest_captures')
      .select('r2_object_key, captured_at')
      .in('event_id', eventIds)
      .eq('media_type', 'clip')
      .eq('consent_to_public', true)
      .eq('couple_approved_for_showcase', true)
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .order('captured_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    rows = (data ?? []) as Array<{ r2_object_key: string | null }>;
  } catch {
    return [];
  }

  const refs = rows
    .map((r) => r.r2_object_key)
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
  if (refs.length === 0) return [];

  const urls = await Promise.all(refs.map((ref) => displayUrlForStoredAsset(ref)));
  return urls.filter((u): u is string => Boolean(u));
});
