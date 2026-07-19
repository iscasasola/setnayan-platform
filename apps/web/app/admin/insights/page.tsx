/**
 * /admin/insights — legacy redirect → /admin/app-performance?tab=intelligence.
 *
 * WHY: the Insights mobile landing grid dated from the retired 6-tab IA
 * (2026-06-15) and was orphaned when the 2026-07-03 respine dropped the
 * standalone Insights tab. Its only unique content — the Peso-per-Lead ROI
 * and Won/Lost vendor unit-economics cards (Wave 6) — moved into the
 * Intelligence tab of the App Performance studio (page-layer hygiene
 * 2026-07-12), so this route redirects there for bookmark continuity.
 * Pattern mirrors /admin/queues → /admin/work.
 */

import { redirect } from 'next/navigation';

export default function AdminInsightsLegacyRedirect() {
  redirect('/admin/app-performance?tab=intelligence');
}
