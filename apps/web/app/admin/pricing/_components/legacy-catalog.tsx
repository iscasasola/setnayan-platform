import { Archive } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCentavosPhp } from '@/lib/sku-catalog';
import { ConsoleTable } from '@/app/admin/_components/console-table';

/**
 * The 43-row legacy v1 `service_catalog` — WHATS_NEXT_Managing_Prices_2026-08-26.md
 * § 6 build unit 8: "readable at last, and deliberately not editable: an
 * editable dead catalogue is a second price authority waiting to disagree
 * with this one." Before this it was a download button and nothing else.
 *
 * Read-only by construction — `ConsoleTable`'s columns are render functions
 * with no `name=` attribute anywhere, so there is no form to submit even by
 * accident. The download link (`/admin/addons/pricing-report`, the only
 * export path for this table since the Add-ons tab was removed 2026-07-21)
 * stays on the page masthead for anyone who wants the full audit file.
 */

type ServiceCatalogRow = {
  sku_code: string;
  display_name: string;
  category: string;
  price_centavos: number;
  unit: string;
  is_active: boolean;
};

export async function LegacyCatalogDisclosure() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('service_catalog')
    .select('sku_code,display_name,category,price_centavos,unit,is_active')
    .order('is_active', { ascending: false })
    .order('category', { ascending: true })
    .order('sku_code', { ascending: true });

  if (error) logQueryError('LegacyCatalogDisclosure', error);
  const rows = data as ServiceCatalogRow[] | null;

  return (
    <details className="overflow-hidden rounded-2xl border border-ink/10">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink/70 transition hover:bg-ink/5 [&::-webkit-details-marker]:hidden">
        <span>Older catalogue — the previous system&apos;s prices</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">read-only</span>
      </summary>
      <div className="border-t border-ink/10 px-4 py-3">
        <p className="mb-3 text-[13px] text-ink/60">
          These are the prices from the system Setnayan used before. Readable here at last, and
          deliberately not editable — an editable dead catalogue would be a second price authority
          waiting to disagree with the one above. Use the &quot;Download legacy catalog
          report&quot; link at the top of this page for the full file.
        </p>
        <ConsoleTable<ServiceCatalogRow>
          rows={rows}
          rowKey={(r) => r.sku_code}
          label="Legacy catalogue"
          reads="the legacy catalogue"
          readPermitted
          readError={error}
          minWidth="36rem"
          empty={{
            Icon: Archive,
            title: 'No rows in the legacy catalogue.',
            blurb: 'The previous pricing system has nothing on file.',
          }}
          columns={[
            { header: 'SKU', cell: (r) => r.sku_code, mono: true },
            { header: 'Name', cell: (r) => r.display_name },
            { header: 'Category', cell: (r) => r.category, hideBelow: 'md' },
            {
              header: 'Price',
              cell: (r) => formatCentavosPhp(r.price_centavos),
              align: 'right',
              mono: true,
            },
            {
              header: 'State',
              cell: (r) => (r.is_active ? 'Active' : 'Inactive'),
              hideBelow: 'lg',
            },
          ]}
        />
      </div>
    </details>
  );
}
