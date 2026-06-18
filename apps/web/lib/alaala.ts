/**
 * Alaala clip helpers — server-side utilities for the Alaala orb pipeline.
 *
 * Resolves stored R2 object keys → browser-loadable video URLs.
 * Uses publicUrlFor (no-async, media bucket CDN URL) so the editorial page
 * doesn't need to presign each clip individually.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrlFor, R2_BUCKETS } from '@/lib/r2';

/**
 * Returns ordered video URLs for approved Alaala clips on an event.
 * Only clips with both consent flags = true are returned (public editorial
 * page safety — see memory: project_setnayan_alaala_orb_video_consent).
 *
 * Returns [] when:
 *   - No clips exist yet (orb shows cold-start gradient)
 *   - R2 URL env vars are missing (dev env without R2 configured)
 */
export async function getPublicAlaalaClipUrls(eventId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('alaala_clips')
    .select('r2_object_key')
    .eq('event_id', eventId)
    .eq('consent_to_public', true)
    .eq('couple_approved_for_showcase', true)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .limit(20);

  if (error || !data?.length) return [];

  return data.map((row) => publicUrlFor(R2_BUCKETS.media, row.r2_object_key));
}

/**
 * Returns all clips for an event regardless of consent flags — for the couple's
 * own dashboard view where they manage their Alaala content.
 */
export async function getAllAlaalaClips(eventId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('alaala_clips')
    .select('id, source, r2_object_key, duration_ms, sort_order, consent_to_public, couple_approved_for_showcase, created_at')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  return data ?? [];
}
