import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * The owner's days of silence before a photo shared to a couple's story counts as accepted
 * (`platform_settings.story_photo_silence_days`, Today v3). null = not set OR unread — decides nothing.
 * Its own module so the story read stays clear of the Files reads (which touch chat lines).
 */
export async function readStorySilenceDays(admin: SupabaseClient): Promise<number | null> {
  const r = await admin.from('platform_settings').select('story_photo_silence_days').eq('id', 1).maybeSingle();
  if (r.error) {
    logQueryError('story-silence: silence days', r.error, {}, 'graceful_degrade');
    return null;
  }
  const n = Number((r.data as { story_photo_silence_days?: number | null } | null)?.story_photo_silence_days);
  return Number.isInteger(n) && n > 0 ? n : null;
}
