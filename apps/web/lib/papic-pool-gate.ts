/**
 * Papic Shared Pool Gallery — the SERVER activation gate (env flag AND the
 * DPO control).
 *
 * Separate from lib/papic-pool-flag.ts on purpose: the flag module is a plain
 * NEXT_PUBLIC_ env read shared with client widgets, while this gate pulls in
 * the admin client via lib/data-privacy-controls — server-only territory.
 *
 * Order matters (guest paths — the Me page and pool routes serve every
 * session guest): the env flag is a plain process.env read and short-circuits
 * FIRST, so while NEXT_PUBLIC_PAPIC_POOL_GALLERY is off (today's prod) this
 * adds ZERO DB reads. Only with the env flag on does the DPO-control read run
 * — request-cached (isDataPrivacyControlActive) and fail-closed: missing row,
 * 'inactive', 'blocked', 'retired', or any read error all mean OFF, exactly
 * as if the env flag were off. The owner approves 'papic_pool_gallery' at
 * /admin/data-privacy (seed migration 20270919527984). The per-event couple
 * toggle (events.pool_gallery_open) remains a THIRD gate on top, enforced
 * inside the SECURITY DEFINER RPCs and re-checked by the callers.
 */

import { papicPoolGalleryEnabled } from '@/lib/papic-pool-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

export async function papicPoolGalleryActive(): Promise<boolean> {
  if (!papicPoolGalleryEnabled()) return false;
  return isDataPrivacyControlActive('papic_pool_gallery');
}
