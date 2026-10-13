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
 * THE BOOKED BODY (`booked-fixtures.ts` — the real rows on fixture facts):
 *   ?mode=booked        open on Booked
 *   &lines=0            the booked venue has an agreed total but no dated payments
 *   &fail=money         the ledger's supplier read is refused
 *   &fail=team          the team read is refused
 *   &fail=orders        the Setnayan-orders read is refused
 *   &target=0           no budget set
 *   &room=sent|unread   the ceremony venue's room size is stated / could not be read
 *   &datechange=1       an open date change (one supplier deciding, one can move)
 *   &payfail=1          the Pay sheet's one request fails (press Pay)
 *   &payslow=1          …or takes 2.5 s
 *   &money=…            Bituin's reservation in the money loop — due · waiting ·
 *                       received · refused (`money-pair.ts`; the supplier's end
 *                       of the same booking is `/dev/customer-money-lab?s=…`)
 *   &booked=0           nobody asked, nobody booked
 *   &seed=proto|asked   only the prototype's own rows (for a side-by-side)
 *
 * THE DATE AND PLACE SHEETS (PR5 — `fact-sheet-fixtures.ts`; press the date or the place on the line):
 *   ?sheet=date|help|place   open one on load (help = the date sheet on Help me choose)
 *   &help=none|unread|nomonth  no Saturday fits every priced pick · the calendars fail · no month yet
 *   &cal=notset         Hiraya and Lumina never set a calendar — the card says "Calendar not set", Help me choose "confirm"
 *   &change=1           a date change is asked of Seda (the line says "· change asked")
 *   &drafted=1          the date waits in the Event Hub draft (the line says "in your draft")
 *   &venues=none        nobody booked: the place sheet types its own venue (name + pin)
 *   &factfail=read|write  the sheet's one read fails · its writes are refused
 *   (picking Sat, Dec 5 is refused by the draft door: Seda is booked that day — the shipped clash note)
 *
 * Run with `NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=true` — the one-screen page is
 * behind that flag, and a client bundle reads it at build time.
 */
import { notFound } from 'next/navigation';
import { InspectorLayout } from '@/app/_components/inspector/inspector-column';
import { DatePlaceLine } from '@/app/dashboard/[eventId]/vendors/_components/date-place-line';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { popularTilesFor } from '@/lib/supplier-find';
import { resolveBenchRing } from '@/lib/explore-in-plan';
import { type LiveTallyBase } from '@/lib/suppliers-shell';
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
import { BookedBody } from '@/app/dashboard/[eventId]/vendors/_components/booked-body';
import { LabBookedStandIns } from './lab-booked';
import { labBookedBudget, labBookedMoney, labBookedView, type LabBookedOptions } from './booked-fixtures';
import { BookedBudgetSection } from '@/app/dashboard/[eventId]/vendors/_components/booked-budget';
import { moneyStageOf } from './money-pair';
import { LabFactSheets } from './lab-fact-sheets';
import type { LabFactOptions } from './fact-sheet-fixtures';
import type { DateFit } from '@/lib/calendar-truth';

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

  const factOptions: LabFactOptions = {
    help: one('help') === 'none' || one('help') === 'unread' || one('help') === 'nomonth' ? (one('help') as 'none' | 'unread' | 'nomonth') : 'ok',
    notSet: one('cal') === 'notset',
    change: one('change') === '1',
    drafted: one('drafted') === '1',
    venues: one('venues') === 'none' ? 'none' : 'booked',
  };
  const sheetParam = one('sheet');
  const folders = buildShortlistFolders({
    vendorRows: rows,
    enrichmentByVendorId: LAB_ENRICHMENT,
    // P5 calendar truth on the bench card: Bituin booked that day, Hiraya free — or "Calendar not set" (&cal=notset).
    dateFitByVendorId: new Map<string, DateFit>([
      ['v-bituin', 'booked'],
      ['v-hiraya', factOptions.notSet ? 'not_set' : 'free'],
      ['v-lola', 'free'],
      ['v-lumina', factOptions.notSet ? 'not_set' : 'free'],
    ]),
    eventType: 'wedding',
    faithSet: new Set(),
    eventId: LAB_EVENT,
    lockHandshakeEnabled: true,
  });

  // The Booked body — its own fixtures, through the real derivations.
  const bookedFail = one('fail');
  const bookedOpts: LabBookedOptions = {
    lines: one('lines') !== '0',
    fail: bookedFail === 'money' || bookedFail === 'team' || bookedFail === 'orders' ? bookedFail : null,
    target: one('target') !== '0',
    room: one('room') === 'sent' ? 'sent' : one('room') === 'unread' ? 'unread' : 'not_sent',
    dateChange: one('datechange') === '1',
    booked: one('booked') !== '0',
    seed: one('seed') === 'proto' || one('seed') === 'asked' ? (one('seed') as 'proto' | 'asked') : null,
    money: moneyStageOf(one('money')),
  };
  const bookedMoney = labBookedMoney(bookedOpts);
  const bookedLabView = labBookedView(bookedOpts, bookedMoney);
  const booked = bookedLabView.booked.length;
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
          initialTab={one('mode') === 'booked' ? 'budget' : one('tab') === 'build' ? 'build' : one('tab') === 'budget' ? 'budget' : 'shortlist'}
          factsSlot={
            <LabFactSheets
              options={factOptions}
              open={sheetParam === 'date' || sheetParam === 'help' || sheetParam === 'place' ? sheetParam : null}
              readFail={one('factfail') === 'read'}
              writeFail={one('factfail') === 'write'}
            >
              <DatePlaceLine
                eventId={LAB_EVENT}
                facts={{
                  date: { text: factOptions.drafted ? 'Sat, Dec 19, 2026' : 'Sat, Dec 12, 2026', open: false },
                  place:
                    factOptions.venues === 'booked'
                      ? { text: 'Seda Vertis North, Quezon City', open: false }
                      : { text: 'Quezon City', open: true },
                }}
                drafted={factOptions.drafted}
                changeAsked={factOptions.change}
                priced={['v-seda', 'v-bituin', 'v-lumina']}
              />
            </LabFactSheets>
          }
          // Batch 5 join: on Find the shell counts Build N/M live from the Find fixtures (b3fix, main); on the Build tab
          // the lab shell's own Build-body view is the count (`lab-build.tsx`), so the live base is not handed over there.
          liveTally={one('tab') === 'build' ? null : liveTally}
          bookedCount={booked}
          shortlistSlot={<InspectorLayout paramKey="inspect" hasSelection={false} master={bench} inspector={null} />}
          bookedSlot={
            <LabBookedStandIns payFail={one('payfail') === '1'} paySlow={one('payslow') === '1'} money={bookedOpts.money}>
              <BookedBody
                eventId={LAB_EVENT}
                state={
                  bookedOpts.fail === 'team'
                    ? { kind: 'unreadable', retryHref: '/dev/suppliers-lab?mode=booked' }
                    : { kind: 'view', view: bookedLabView }
                }
              >
                <BookedBudgetSection eventId={LAB_EVENT} budget={labBookedBudget(bookedOpts, bookedMoney)} />
              </BookedBody>
            </LabBookedStandIns>
          }
        />
      </section>
    </SuppliersLabStage>
  );
}
