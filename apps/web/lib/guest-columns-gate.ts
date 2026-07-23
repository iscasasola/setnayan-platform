/**
 * Guest Columns — the SERVER activation gate (env flag AND the DPO control).
 *
 * Separate from lib/guest-columns.ts on purpose: that module's constants are
 * imported by client components (the guest form), and this gate pulls in the
 * admin client via lib/data-privacy-controls — server-only territory.
 *
 * Order matters (hot guest paths — the [slug] site renders on every guest
 * visit): the env flag is a plain process.env read and short-circuits FIRST,
 * so while GUEST_COLUMNS_ENABLED is off (today's prod) this adds ZERO DB
 * reads. Only with the env flag on does the DPO-control read run — and it is
 * request-cached (isDataPrivacyControlActive) and fail-closed: missing row,
 * 'inactive', 'blocked', 'retired', or any read error all mean OFF, exactly
 * as if the env flag were off. The owner approves 'guest_columns' at
 * /admin/data-privacy (seed migration 20270919527984).
 */

import { guestColumnsEnabled } from '@/lib/guest-columns';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';

export async function guestColumnsActive(): Promise<boolean> {
  if (!guestColumnsEnabled()) return false;
  return isDataPrivacyControlActive('guest_columns');
}
