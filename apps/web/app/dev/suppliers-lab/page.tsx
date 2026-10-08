/**
 * /dev/suppliers-lab — the couple's Suppliers page (Find · Build · Booked) on
 * fixture data, with no sign-in and no database. DEV-ONLY: production builds
 * 404 this route, the same kill-switch as `/dev/guests-lab`
 * (`the-lab-never-ships.test.ts`).
 *
 * Why it exists: the page's faults so far were all LAYOUT and MOTION — a verb
 * row of two heights, a strip of the list showing between the top bar and the
 * pinned date line while the bar slides — and no unit test lays out or scrolls.
 * It draws the REAL shell (`ServicesTakeover`), the REAL Find body
 * (`ShortlistCategories`) and the REAL supplier sheet inside a stand-in for the
 * app's top bar that slides away on a phone exactly as the real one does.
 *
 *   ?open=<tile>        open a category on load (catering · cake · reception …)
 *   ?inspect=v:<id>     the supplier sheet for one of the couple's cards
 *                       (v-bituin · v-lola · v-hiraya · v-santuario)
 *   &fail=1             the marketplace read ("More to compare") fails
 *   &empty=1            a new event: no suppliers yet
 *
 * Run with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true` — the one-screen page is
 * behind that flag, and a client bundle reads it at build time.
 */
import { notFound } from 'next/navigation';
import { InspectorLayout } from '@/app/_components/inspector/inspector-column';
import { ServicesTakeover } from '@/app/dashboard/[eventId]/vendors/_components/services-takeover';
import { DatePlaceLine } from '@/app/dashboard/[eventId]/vendors/_components/date-place-line';
import { VendorQuickViewInspector } from '@/app/dashboard/[eventId]/vendors/_components/vendor-quickview-inspector';
import { SupplierSheetActions } from '@/app/dashboard/[eventId]/vendors/_components/supplier-sheet-actions';
import { buildShortlistFolders, type ShortlistVendor } from '@/lib/shortlist-taxonomy';
import { popularTilesFor } from '@/lib/supplier-find';
import { SuppliersLabStage } from './lab-stage';
import { LabBench } from './lab-bench';
import { LAB_CARDS, LAB_ENRICHMENT, LAB_EVENT, LAB_ROWS, LAB_STANDINGS } from './fixtures';

export default async function SuppliersLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const empty = one('empty') === '1';
  const rows = empty ? [] : LAB_ROWS;

  const folders = buildShortlistFolders({
    vendorRows: rows,
    enrichmentByVendorId: LAB_ENRICHMENT,
    eventType: 'wedding',
    faithSet: new Set(),
    eventId: LAB_EVENT,
    lockHandshakeEnabled: true,
  });

  const inspectId = one('inspect')?.startsWith('v:') ? one('inspect')!.slice(2) : null;
  let selected: { vendor: ShortlistVendor; categoryLabel: string } | null = null;
  for (const folder of folders) {
    for (const tile of folder.tiles) {
      const vendor = tile.vendors.find((v) => v.vendorId === inspectId);
      if (vendor && !selected) selected = { vendor, categoryLabel: tile.label };
    }
  }

  const booked = rows.filter((r) => r.status === 'contracted').length;
  const bench = (
    <LabBench
      key={`sl-${one('open') ?? ''}`}
      fail={one('fail') === '1'}
      folders={folders}
      eventId={LAB_EVENT}
      standings={LAB_STANDINGS}
      initialOpenTile={one('open')}
      starterTiles={[...popularTilesFor('wedding')]}
      serviceCardByVendorId={LAB_CARDS}
      payHrefByVendorId={{ 'v-seda': `/dev/suppliers-lab?open=reception` }}
      unread={{ pairs: [['t-lola', 2]], measured: true }}
    />
  );

  return (
    <SuppliersLabStage>
      <section className="sn-col max-w-none" data-lab-suppliers="">
        <ServicesTakeover
          eventId={LAB_EVENT}
          initialTab="shortlist"
          factsSlot={
            <DatePlaceLine
              eventId={LAB_EVENT}
              facts={{ date: { text: 'Sat, Dec 12, 2026', open: false }, place: { text: 'Pick the place', open: true } }}
            />
          }
          tally={{ filled: booked, total: 5, knownPhp: 1_056_000, unpriced: 1 }}
          bookedCount={booked}
          shortlistSlot={
            <InspectorLayout
              paramKey="inspect"
              hasSelection={Boolean(selected)}
              master={bench}
              mobileSheet
              inspector={
                selected ? (
                  <VendorQuickViewInspector
                    vendor={selected.vendor}
                    categoryLabel={selected.categoryLabel}
                    fullHref={selected.vendor.href}
                    sheet={{
                      serviceCard: LAB_CARDS[selected.vendor.vendorId] ?? null,
                      cardsRead: true,
                      selfAdded: selected.vendor.marketplaceVendorId == null,
                      reviews: [
                        { id: 'r1', stars: 5, month: 'Dec 2025', words: 'The tasting sold us; the day matched it.' },
                        { id: 'r2', stars: 5, month: 'Aug 2025', words: 'On time, clean set-up, and they handled 200 heads without a hitch.' },
                      ],
                      work: [
                        { id: 'w1', kind: 'Wedding', month: 'Dec 2025' },
                        { id: 'w2', kind: 'Debut', month: 'Aug 2025' },
                      ],
                      workTotal: 2,
                      actions: (
                        <SupplierSheetActions
                          eventId={LAB_EVENT}
                          vendorId={selected.vendor.vendorId}
                          threadId={selected.vendor.threadId}
                          canAsk={selected.vendor.marketplaceVendorId != null && selected.vendor.status !== 'locked'}
                        />
                      ),
                    }}
                  />
                ) : null
              }
            />
          }
          buildSlot={<p className="py-10 text-sm text-ink/55">Build — not drawn in this lab.</p>}
          teamSlot={<p className="py-10 text-sm text-ink/55">Booked — not drawn in this lab.</p>}
        />
      </section>
    </SuppliersLabStage>
  );
}
