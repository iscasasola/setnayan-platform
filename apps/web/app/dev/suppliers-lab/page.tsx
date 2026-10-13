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
 *   &added=1            "Add your own": the row the walk leaves under Catering
 *   &links=fail         …and the claim-link read fails (the rows must say so)
 *   ?tab=build          open on Build — the REAL Build body on fixtures
 *   &build=garden       …with "Garden build" in use · &build=none (nothing yet)
 *                       · &build=unread (the saved builds could not be read)
 *
 * Run with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true` — the one-screen page is
 * behind that flag, and a client bundle reads it at build time.
 */
import { notFound } from 'next/navigation';
import { InspectorLayout } from '@/app/_components/inspector/inspector-column';
import { DatePlaceLine } from '@/app/dashboard/[eventId]/vendors/_components/date-place-line';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { popularTilesFor } from '@/lib/supplier-find';
import { SuppliersLabStage } from './lab-stage';
import { LabBench } from './lab-bench';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  LAB_ADDED_ROW,
  LAB_CARDS,
  LAB_CLAIM_URL,
  LAB_ENRICHMENT,
  LAB_EVENT,
  LAB_ROWS,
  LAB_STANDINGS,
  labInviteStatuses,
} from './fixtures';
import { LabSuppliersShell } from './lab-build';

export default async function SuppliersLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const empty = one('empty') === '1';
  const rows = empty ? [] : one('added') === '1' ? [...LAB_ROWS, LAB_ADDED_ROW] : LAB_ROWS;
  const claimQrSvg = await renderUrlQrSvg(LAB_CLAIM_URL);

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
      writeFail={one('writefail') === '1'}
      folders={folders}
      eventId={LAB_EVENT}
      standings={LAB_STANDINGS}
      initialOpenTile={one('open')}
      starterTiles={[...popularTilesFor('wedding')]}
      serviceCardByVendorId={LAB_CARDS}
      payHrefByVendorId={{ 'v-seda': `/dev/suppliers-lab?open=reception` }}
      inviteStatusByVendorId={one('links') === 'fail' ? null : labInviteStatuses(Date.now())}
      claimQrSvg={claimQrSvg}
      unread={{ pairs: [['t-lola', 2]], measured: true }}
    />
  );

  return (
    <SuppliersLabStage>
      <section className="sn-col max-w-none" data-lab-suppliers="">
        <LabSuppliersShell
          start={one('build')}
          answer={one('answer')}
          eventId={LAB_EVENT}
          initialTab={one('tab') === 'build' ? 'build' : one('tab') === 'budget' ? 'budget' : 'shortlist'}
          factsSlot={
            <DatePlaceLine
              eventId={LAB_EVENT}
              facts={{ date: { text: 'Sat, Dec 12, 2026', open: false }, place: { text: 'Pick the place', open: true } }}
            />
          }
          bookedCount={booked}
          shortlistSlot={<InspectorLayout paramKey="inspect" hasSelection={false} master={bench} inspector={null} />}
          teamSlot={<p className="py-10 text-sm text-ink/55">Booked — not drawn in this lab.</p>}
        />
      </section>
    </SuppliersLabStage>
  );
}
