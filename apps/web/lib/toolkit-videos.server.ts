import 'server-only';
/**
 * 🎞 The public URL of a paid widget's Toolkit clip (rule in ./toolkit-videos.ts): the `setnayan-media` object at the
 * widget's key, through the one R2 URL builder. null = no clip yet — the slot draws nothing.
 */
import { R2_BUCKETS, r2PublicUrl } from '@/lib/r2';
import { toolVideoKey } from '@/lib/toolkit-videos';

export function toolVideoSrc(tool: string): string | null {
  const key = toolVideoKey(tool);
  return key ? r2PublicUrl(R2_BUCKETS.media, key) : null;
}
