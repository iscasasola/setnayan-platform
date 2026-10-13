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
 *   &writefail=1        Save / Remove on a card are refused (they answer in place)
 *
 * Run with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true` — the one-screen page is
 * behind that flag, and a client bundle reads it at build time.
 */
import { notFound } from 'next/navigation';
import { InspectorLayout } from '@/app/_components/inspector/inspector-column';
import { ServicesTakeover } from '@/app/dashboard/[eventId]/vendors/_components/services-takeover';
import { DatePlaceLine } from '@/app/dashboard/[eventId]/vendors/_components/date-place-line';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { popularTilesFor } from '@/lib/supplier-find';
import { resolveBenchRing } from '@/lib/explore-in-plan';
import { liveBuildTally, type LiveTallyBase } from '@/lib/suppliers-shell';
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

  const booked = rows.filter((r) => r.status === 'contracted').length;
  /* The shell's Build N/M and cart peek, counted the page's way from the fixtures — and handed over so a press counts
     again in place (`liveBuildTally`, batch-3 walk 2026-10-13). One plan group per category the fixtures use. */
  const vendors = folders.flatMap((f) => f.tiles.flatMap((t) => t.vendors));
  const groups = new Map<string, typeof vendors>();
  for (const v of vendors) if (v.planGroupId) groups.set(v.planGroupId, [...(groups.get(v.planGroupId) ?? []), v]);
  const ringTiles = folders.flatMap((f) => f.tiles.map((t) => ({ tile: t.tile, planned: t.planned, vendorCount: t.vendors.length, lockedCount: t.vendors.filter((v) => v.status === 'locked').length })));
  const ring = resolveBenchRing({ tiles: ringTiles, excludedTiles: [], pinnedTile: one('open'), starterTiles: [...popularTilesFor('wedding')] });
  const liveTally: LiveTallyBase = {
    children: [...groups].map(([groupId, vs]) => ({
      groupId,
      picks: vs.map((v) => ({ vendor_id: v.vendorId, raw_status: v.status === 'locked' ? 'contracted' : 'considering', rolled_cost_php: v.totalCostPhp })),
      buildPickVendorIds: [],
    })),
    lockedCentavos: vendors.filter((v) => v.status === 'locked').reduce((n, v) => n + (v.totalCostPhp ?? 0) * 100, 0),
    ring: { tiles: folders.flatMap((f) => f.tiles.map((t) => ({ tile: t.tile, lockedCount: t.vendors.filter((v) => v.status === 'locked').length, vendorIds: t.vendors.map((v) => v.vendorId) }))), inPlan: [...ring.inPlan] },
    drawnIn: [],
  };
  const bench = (
    <LabBench
      key={`sl-${one('open') ?? ''}`}
      fail={one('fail') === '1'}
      sheetFail={one('sheetfail') === '1'}
      slow={one('slow') === '1'}
      writeFail={one('writefail') === '1'}
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
          tally={liveBuildTally(liveTally, (_v, _g, drawn) => drawn)}
          liveTally={liveTally}
          bookedCount={booked}
          shortlistSlot={<InspectorLayout paramKey="inspect" hasSelection={false} master={bench} inspector={null} />}
          buildSlot={<p className="py-10 text-sm text-ink/55">Build — not drawn in this lab.</p>}
          teamSlot={<p className="py-10 text-sm text-ink/55">Booked — not drawn in this lab.</p>}
        />
      </section>
    </SuppliersLabStage>
  );
}
