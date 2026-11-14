import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCount } from '@/lib/format-number';
import { loadCategories, loadVocab } from '../categories/_components/load';
import { CatalogueHomeView } from './_components/catalogue-home-view';

export const metadata = { title: 'Catalogue · Admin' };
export const dynamic = 'force-dynamic';

/**
 * /admin/catalogue — the Catalogue tab's Home (owner 14 Nov 2026: "Yes, queue the builds"; the approved drawing
 * `Setnayan-specs/prototypes/admin_pub/catalogue.html`, screen `catalogue`).
 *
 * What waits on the admin (the Next card — the oldest supplier request for a service we lack), three numbers, then
 * every view of the tab in the drawing's four sections. Every row rises to the SHIPPED page it names; nothing is
 * edited here, so nothing here can disagree with those pages.
 *
 * READS, NEVER A COPY. The counts come through the same loaders the Categories page uses (`loadCategories`,
 * `loadVocab`) and the three tables the price list reads (`platform_retail_catalog_v2`,
 * `platform_package_catalog`, `vendor_billing_catalog`). No price is read or typed here — only how many rows are
 * on sale and how many are switched off.
 *
 * 🔑 HONEST STATES (T28/T29). A refused read never prints 0 or "all clear": its number is "—", its line says it
 * could not count, and the Next card says some lists didn't read. "Nothing waits on you" is only said when the
 * requests were READ and are none.
 */

type PriceCount = { onSale: number; off: number } | null;

async function countPrices(admin: ReturnType<typeof createAdminClient>): Promise<PriceCount> {
  const tables = ['platform_retail_catalog_v2', 'platform_package_catalog', 'vendor_billing_catalog'] as const;
  const reads = await Promise.all(tables.map((t) => admin.from(t).select('is_active')));
  let onSale = 0;
  let off = 0;
  for (const [i, res] of reads.entries()) {
    if (res.error) {
      logQueryError(`CatalogueHome (${tables[i]})`, res.error);
      return null;
    }
    for (const row of (res.data ?? []) as Array<{ is_active: boolean }>) {
      if (row.is_active) onSale += 1;
      else off += 1;
    }
  }
  return { onSale, off };
}

const n = (v: number) => formatCount(v);

export default async function CatalogueHome() {
  await requireAdmin();
  const admin = createAdminClient();
  const [cats, vocab, prices] = await Promise.all([
    loadCategories(admin, null),
    loadVocab(admin, { readiness: false }),
    countPrices(admin),
  ]);

  const treeRead = !cats.failed.includes('the category tree');
  const servicesRead = !cats.failed.includes('services');
  const requestsRead = !cats.failed.includes('supplier requests');
  const typesRead = !vocab.failed.includes('event types');
  const religionsRead = !vocab.failed.includes('religions');

  // Requests are read newest first; the Next card is the one that has waited longest.
  const oldest = requestsRead ? (cats.requests[cats.requests.length - 1] ?? null) : null;
  const inPicker = vocab.eventTypes.filter((e) => e.status === 'active' && e.enabled).length;
  const liveFaiths = vocab.religions.filter((r) => r.launch?.status === 'active').length;

  return (
    <CatalogueHomeView
      facts={{
        anyFailed: !treeRead || !servicesRead || !requestsRead || prices === null,
        categories: treeRead ? cats.categories.length : null,
        services: servicesRead ? cats.services.length : null,
        asking: requestsRead ? cats.requests.length : null,
        next: oldest ? { requestId: oldest.requestId, label: oldest.proposedLabel, supplier: oldest.supplierName } : null,
        categoriesLine: treeRead
          ? `${n(cats.groups.length)} groups · ${n(cats.categories.length)} categories · ${servicesRead ? n(cats.services.length) : '—'} services`
          : 'Couldn’t read the categories — not the same as none',
        typesLine: typesRead
          ? `${n(vocab.eventTypes.length)} · ${n(inPicker)} in the picker`
          : 'Couldn’t read the event types — not the same as none',
        religionsLine: religionsRead
          ? `${n(vocab.religions.length)} · ${n(liveFaiths)} live for couples`
          : 'Couldn’t read the religions — not the same as none',
        pricesLine: prices
          ? `${n(prices.onSale)} on sale · ${n(prices.off)} switched off`
          : 'Couldn’t read the price list — not the same as none',
      }}
    />
  );
}
