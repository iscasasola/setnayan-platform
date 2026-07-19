/**
 * /admin/marketing — legacy redirect → /admin/studio.
 *
 * WHY: the standalone Marketing tab was retired on 2026-07-04 when its lane
 * (social queue · Spotlight Awards · Journal Spotlights · discount codes ·
 * referrals) folded into the Studio hub. This card-grid landing survived only
 * as a bookmark URL; page-layer hygiene 2026-07-12 converts it to a redirect
 * so old links land on the consolidated hub instead of a stale grid.
 * Pattern mirrors /admin/queues → /admin/work.
 */

import { redirect } from 'next/navigation';

export default function AdminMarketingLegacyRedirect() {
  redirect('/admin/studio');
}
