import { createAdminClient } from '@/lib/supabase/admin';

export type KwentoDensityRow = {
  photoId: string;
  density: number;
  /** First 50 chars of the most recent approved Story for this photo (preview caption). */
  preview: string | null;
};

/**
 * Returns the top N photos sorted by approved/pending Kwento count (descending).
 * Used by the Alaala hub to surface "most storied moments" without any new table.
 *
 * Excludes rejected messages. Includes pending (flagged) ones so new events
 * that haven't been moderated yet still show density before couple approval.
 *
 * Returns [] if the event has no Kwentos yet — callers should hide the section.
 */
export async function getKwentoDensity(
  eventId: string,
  limit = 5,
): Promise<KwentoDensityRow[]> {
  const admin = createAdminClient();

  // COUNT per source_id, excluding rejected messages.
  const { data: counts } = await admin
    .from('photo_messages')
    .select('source_id')
    .eq('event_id', eventId)
    .neq('status', 'rejected')
    .not('source_id', 'is', null);

  if (!counts || counts.length === 0) return [];

  // Group in JS — avoids needing a DB function or a raw query.
  const densityMap = new Map<string, number>();
  for (const row of counts as Array<{ source_id: string }>) {
    densityMap.set(row.source_id, (densityMap.get(row.source_id) ?? 0) + 1);
  }

  // Sort descending, take top N.
  const topN = Array.from(densityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([photoId, density]) => ({ photoId, density }));

  if (topN.length === 0) return [];

  // Fetch the most recent approved Story preview text for each top photo.
  const photoIds = topN.map((r) => r.photoId);
  const { data: previews } = await admin
    .from('photo_messages')
    .select('source_id, body_text')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .in('source_id', photoIds)
    .order('updated_at', { ascending: false });

  // One preview per photo: the most recent approved message (already ordered desc).
  const previewMap = new Map<string, string>();
  for (const row of (previews ?? []) as Array<{ source_id: string; body_text: string }>) {
    if (!previewMap.has(row.source_id)) {
      previewMap.set(row.source_id, (row.body_text ?? '').slice(0, 50));
    }
  }

  return topN.map(({ photoId, density }) => ({
    photoId,
    density,
    preview: previewMap.get(photoId) ?? null,
  }));
}
