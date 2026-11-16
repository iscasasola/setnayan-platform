/**
 * /admin/directory — the People tab's dashboard (admin reorg v7, the drawing's "5 tab dashboards", owner 17 Nov 2026).
 *
 * It was the retired phone card grid for the Accounts group. It now draws People's head numbers and its three group
 * cards (Look up · Papers · Ties), each opening its ONE merged page with the view preselected. Drawn by the shared
 * `TabLanding`.
 */
import { requireAdmin } from '@/lib/admin/require-admin';
import { TabLanding } from '../_components/tab-landing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'People · Admin' };

export default async function AdminPeopleLanding() {
  await requireAdmin();
  return <TabLanding tab="people" />;
}
