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
 * (`ShortlistCategories`) and the REAL supplier sheet (press any card) inside a stand-in for the
 * app's top bar that slides away on a phone exactly as the real one does.
 *
 *   ?open=<tile>        open a category on load (catering · cake · reception …)
 *   &fail=1             the marketplace read ("More to compare") fails
 *   &sheetfail=1        the supplier sheet's one request fails (press a card)
 *   &slow=1             …or takes 2.5 s, to read the line it shows meanwhile
 *   &empty=1            a new event: no suppliers yet
 *   ?find=<tile>        Find a supplier's list for a category (the REAL rows of
 *                       `vendors/categories/page.tsx`, on fixtures)
 *   &far=1              …with "farther away" open (cake has nobody farther)
 *   &booked=1           …with every supplier in the category full on the date
 *
 * Run with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true` — the one-screen page is
 * behind that flag, and a client bundle reads it at build time.
 */
import { notFound } from 'next/navigation';
import { InspectorLayout } from '@/app/_components/inspector/inspector-column';
import { ServicesTakeover } from '@/app/dashboard/[eventId]/vendors/_components/services-takeover';
import { DatePlaceLine } from '@/app/dashboard/[eventId]/vendors/_components/date-place-line';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { FIND_EMPTY_WORDS, findEmptyState, popularTilesFor } from '@/lib/supplier-find';
import { SuppliersLabStage } from './lab-stage';
import { LabBench } from './lab-bench';
import { FindFartherAway, FindSupplierList } from '@/app/dashboard/[eventId]/vendors/categories/_components/find-supplier-list';
import { WEDDING_TILE_LABEL, type WeddingTile } from '@/lib/taxonomy';
import { formatCount } from '@/lib/format-number';
import { LAB_CARDS, LAB_ENRICHMENT, LAB_EVENT, LAB_FAR, LAB_MARKET, LAB_ROWS, LAB_STANDINGS } from './fixtures';

export default async function SuppliersLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const find = one('find');
  if (find) {
    // Find a supplier › a category: the page's own count line and rows.
    // `&booked=1` — every supplier in the category is full on the date: the
    // search returns nobody and says how many it hid.
    const allBooked = one('booked') === '1';
    const rows = allBooked ? [] : (LAB_MARKET[find]?.rows ?? []);
    const empty = findEmptyState({
      found: rows.length,
      shown: rows.length,
      hiddenForDate: allBooked ? (LAB_MARKET[find]?.rows.length ?? 0) : 0,
      filtering: false,
    });
    return (
      <SuppliersLabStage>
        <div className="mx-auto w-full max-w-2xl pb-24 pt-5" data-lab-find="">
          <header className="mb-4 mt-3">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink/50">Find a supplier</p>
            <h2 className="mt-1 font-serif text-3xl text-ink">{WEDDING_TILE_LABEL[find as WeddingTile] ?? find}</h2>
          </header>
          <p className="mt-3 text-[13px] text-ink/55">
            {rows.length === 1 ? '1 supplier' : `${formatCount(rows.length)} suppliers`} · nearest first
          </p>
          {empty ? (
            <p className="mt-6 text-[15px] text-ink/65" data-find-empty={empty}>
              {FIND_EMPTY_WORDS[empty]}
            </p>
          ) : (
            <FindSupplierList eventId={LAB_EVENT} tile={find} rows={rows} />
          )}
          <div className="mt-4">
            <FindFartherAway
              eventId={LAB_EVENT}
              tile={find}
              openHref={`/dev/suppliers-lab?find=${encodeURIComponent(find)}&far=1`}
              rows={one('far') === '1' ? (LAB_FAR[find] ?? []) : null}
            />
          </div>
        </div>
      </SuppliersLabStage>
    );
  }
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

  const booked = rows.filter((r) => r.status === 'contracted').length;
  const bench = (
    <LabBench
      key={`sl-${one('open') ?? ''}`}
      fail={one('fail') === '1'}
      sheetFail={one('sheetfail') === '1'}
      slow={one('slow') === '1'}
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
          shortlistSlot={<InspectorLayout paramKey="inspect" hasSelection={false} master={bench} inspector={null} />}
          buildSlot={<p className="py-10 text-sm text-ink/55">Build — not drawn in this lab.</p>}
          teamSlot={<p className="py-10 text-sm text-ink/55">Booked — not drawn in this lab.</p>}
        />
      </section>
    </SuppliersLabStage>
  );
}
