import 'server-only';
/**
 * 🎞 The public URL of a paid widget's Toolkit clip (rule in ./toolkit-videos.ts): the `setnayan-media` object at the
 * widget's key, as a stored `r2://` ref through the one public-URL resolver (`publicUrlForStoredAsset` — application
 * code never calls the key-taking builders; public-url-takes-a-key-not-a-ref.test.ts). null = no clip yet — the slot
 * draws nothing.
 */
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { toolVideoKey } from '@/lib/toolkit-videos';

export function toolVideoSrc(tool: string): string | null {
  const key = toolVideoKey(tool);
  return key ? publicUrlForStoredAsset(`r2://${PUBLIC_R2_BUCKET}/${key}`) : null;
}
