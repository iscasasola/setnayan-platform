import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { TabLanding } from '@/app/admin/_components/tab-landing';
import { loadCategories } from '../categories/_components/load';

export const metadata = { title: 'Catalogue · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/catalogue — the Catalogue tab's Home (#7693; `ADMIN_TAB_LANDING.catalogue` in `lib/admin/admin-pages.ts`).
 *
 * 📐 DRAWN AS EVERY OTHER TAB'S LANDING. Owner, 17 Nov 2026: *"i want a more visually functional work, money, people,
 * catalogue, insights page"* — so this is the shared `TabLanding` (admin reorg v7), never a frame of its own: the head
 * numbers, then one card per Catalogue page (Services · Studio's two groups · How the app finds things), each opening
 * its merged page with the view preselected. The 14 Nov A3 drawing's own Home (its Next card, Prices section and the
 * Templates · Media · Design kit hubs) is superseded by v7: Prices live in Money, templates and media in Studio,
 * Colours in Setup.
 *
 * READS, NEVER A COPY. The head's taxonomy counts come through the Categories page's own loader (`loadCategories`);
 * "Asking" and "Oldest" are the Work queue digest's `service-requests` row, the same read the Requests chip counts.
 * 🔑 A refused read prints "—" and the greeting says some counts could not be read — never 0, never "all clear".
 */
export default async function CatalogueHome() {
  await requireAdmin();
  const cats = await loadCategories(createAdminClient(), null);
  return (
    <TabLanding
      tab="catalogue"
      catalogue={{
        categories: cats.failed.includes('the category tree') ? null : cats.categories.length,
        services: cats.failed.includes('services') ? null : cats.services.length,
      }}
    />
  );
}
