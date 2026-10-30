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
 *   &planned=1          HMUA and Florist are "in your plan" with nobody yet (the row's state word)
 *   &covers=1           Seda's row also covers Cake and Catering ("Also covers") — the venue's name
 *                       then shows, locked, under those two rows as well (the owner's 2026-10-21 report),
 *                       "· with Reception" — on Find's rows and on Build's lines (?tab=build&covers=1)
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
 *   &paidbyhand=1       + "The Wedding Planner", added by hand, filed Shortlisted, with
 *                       a recorded payment — booked by the payment (owner 2026-10-20)
 *   &seed=proto|asked   only the prototype's own rows (for a side-by-side)
 *   &date=set|conflict  the date banner under "Cover your event": a settled date (the calm header draws NO banner for it
 *                       — owner 2026-10-26; "free that day" is in the ⓘ) · a build with no shared day (still a banner)
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
import { buildShortlistFolders, categoryKeyForAdd } from '@/lib/shortlist-taxonomy';
import { WEDDING_TILES_BY_PARENT } from '@/lib/taxonomy';
import { buildFindList, FIND_GROUP_OF_TILE, popularTilesFor } from '@/lib/supplier-find';
import { homeTileForRow, LOCKED_VENDOR_STATUSES } from '@/lib/shortlist-taxonomy';
import { FindCategoryList } from '@/app/dashboard/[eventId]/vendors/_components/find-category-list';
import { resolveBenchRing } from '@/lib/explore-in-plan';
import { type LiveTallyBase } from '@/lib/suppliers-shell';
import { SuppliersLabStage } from './lab-stage';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { LabBench } from './lab-bench';
import { labSupplierShare } from '../lab-supplier-share';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  LAB_ADDED_ROW,
  LAB_CARDS,
  LAB_CLAIM_URL,
  LAB_ENRICHMENT,
  LAB_EVENT,
  LAB_FIND_COUNTS,
  LAB_ROWS,
  LAB_STANDINGS,
  labDunkinRow,
  labInviteStatuses,
  labOwnRow,
} from './fixtures';
import { LabSuppliersShell } from './lab-build';
import { BookedBody } from '@/app/dashboard/[eventId]/vendors/_components/booked-body';
import { LabBookedStandIns } from './lab-booked';
import { LAB_SCHEDULE_TAGS, labBookedBudget, labBookedMoney, labBookedNow, labBookedView, type LabBookedOptions } from './booked-fixtures';
import { BookedPartRow } from '@/app/dashboard/[eventId]/vendors/_components/booked-part-row';
import { BudgetScreen } from '@/app/dashboard/[eventId]/budget/_components/budget-screen';
import { buildBudgetList, pickNextPayment } from '@/lib/budget-page-view';
import { knownMoneyTotals } from '@/lib/budget-truth';
import { costCategoryOptions } from '@/lib/event-costs';
import type { PillarPart } from '@/lib/pillar-parts';
import { LabBookedSchedule } from './lab-booked-schedule';
import { SEEDS } from '../schedule-lab/lab-moments';
import { priceToday } from '@/lib/price-summary';
import { BookedBudgetSection } from '@/app/dashboard/[eventId]/vendors/_components/booked-budget';
import { moneyStageOf } from './money-pair';
import { LabFactSheets } from './lab-fact-sheets';
import type { LabFactOptions } from './fact-sheet-fixtures';
import type { DateFit } from '@/lib/calendar-truth';
import { SuppliersSettingsRows } from '@/app/dashboard/[eventId]/vendors/_components/suppliers-settings-rows';
import type { SuppliersSettingsView } from '@/lib/suppliers-settings';
import { formatPhp } from '@/lib/php';

const LAB_SUPPLIERS_SETTINGS: SuppliersSettingsView = {
  costs: { mode: 'realtime', deadline: '2026-11-20' },
  payments: [
    { id: 'p1', when: 'Nov 3', words: `Kusina ni Lola · First payment ${formatPhp(25000)}` },
    { id: 'p2', when: 'Nov 18', words: `Lumina Studio · Second payment ${formatPhp(18000)}` },
  ],
  photos: [
    { vendorRowId: 'v-lumina', name: 'Lumina Studio', hidden: false },
    { vendorRowId: 'v-seda', name: 'Seda Films', hidden: true },
  ],
  photosRead: true,
};

export default async function SuppliersLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
  const empty = one('empty') === '1';
  const dunkin =
    one('dunkin') === 'before' || one('dunkin') === 'after' || one('dunkin') === 'moved'
      ? (one('dunkin') as 'before' | 'after' | 'moved')
      : null;
  // `&own=` — the supplier the walk's Add just posted (lab stand-in), kept the way the real insert keeps it.
  const ownParts = (one('own') ?? '').split('~');
  const drawnTiles = new Set<string>(Object.values(WEDDING_TILES_BY_PARENT).flat() as string[]);
  const own =
    ownParts.length === 3 && ownParts[0]
      ? labOwnRow(ownParts[0], categoryKeyForAdd(ownParts[0], ownParts[1], (t) => drawnTiles.has(t)), ownParts[2] ?? '')
      : null;
  const covers = one('covers') === '1';
  const rows = empty
    ? []
    : [
        ...(one('added') === '1' ? [...LAB_ROWS, LAB_ADDED_ROW] : LAB_ROWS).map((r) =>
          covers && r.vendor_id === 'v-seda' ? { ...r, covers_plan_groups: ['cake', 'catering'] } : r,
        ),
        ...(dunkin ? [labDunkinRow(dunkin)] : []),
        ...(own ? [own] : []),
      ];
  const claimQrSvg = await renderUrlQrSvg(LAB_CLAIM_URL);
  // The self-added supplier's Share (Find → a card added by hand): the real message and card, on Tita's sample facts.
  const supplierShare = await labSupplierShare(
    {
      shopName: "Tita Baby's Catering",
      contactPerson: 'Maria Santos',
      eventWord: 'wedding',
      eventDate: '2026-12-18',
      datePrecision: 'day',
      service: 'Catering',
      hostsName: 'Ana & Paolo',
      services: ['Catering'],
    },
    LAB_CLAIM_URL,
  );

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
    plannedTiles: one('planned') === '1' ? new Set(['hmua', 'florist']) : undefined,
  });

  // The Booked body — its own fixtures, through the real derivations.
  const bookedFail = one('fail');
  const bookedOpts: LabBookedOptions = {
    lines: one('lines') !== '0',
    fail: bookedFail === 'money' || bookedFail === 'team' || bookedFail === 'orders' ? bookedFail : null,
    target: one('target') !== '0',
    room: one('room') === 'sent' ? 'sent' : one('room') === 'unread' ? 'unread' : 'not_sent',
    dateChange: one('datechange') === '1',
    paidByHand: one('paidbyhand') === '1',
    booked: one('booked') !== '0',
    seed: one('seed') === 'proto' || one('seed') === 'asked' ? (one('seed') as 'proto' | 'asked') : null,
    money: moneyStageOf(one('money')),
    today: one('today') ?? null,
    callTimesFail: one('calltimes') === 'fail',
  };
  const bookedMoney = labBookedMoney(bookedOpts);
  /* Booked = Team · Budget · Schedule (owner 2026-10-29): `&part=budget|schedule` draws that part on fixtures — the
     REAL Budget screen over this lab's money, the REAL Event Day rail over the Schedule lab's day. `&bkopen=<id>`
     opens one Team row on load. */
  const bookedPartParam = one('part') === 'budget' || one('part') === 'schedule' ? (one('part') as 'budget' | 'schedule') : 'team';
  const labBookedParts: PillarPart[] = [
    { key: 'team', label: 'Team', href: '/dev/suppliers-lab?mode=booked' },
    { key: 'budget', label: 'Budget', href: '/dev/suppliers-lab?mode=booked&part=budget' },
    { key: 'schedule', label: 'Schedule', href: '/dev/suppliers-lab?mode=booked&part=schedule' },
  ];
  const labList = buildBudgetList(bookedMoney);
  const labKnown = knownMoneyTotals(bookedMoney);
  const labMoments = SEEDS.filter((x) => !x[6]?.parent_block_id).length;
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
  // The bottom search's empty state — the Find page's own list (`FindCategoryList`) on the lab's scope:
  // the bench folders with no rows (as `readFindList` builds them), booked = the fixtures' locked rows.
  // `&findfail=1` — the booked read was refused (no row may say "Booked ✓").
  const findBooked = one('findfail') === '1'
    ? null
    : new Set(
        rows
          .filter((r) => LOCKED_VENDOR_STATUSES.includes(r.status ?? ''))
          .map((r) => homeTileForRow({ category: r.category }))
          .filter((t): t is NonNullable<typeof t> => t != null),
      );
  const findList = buildFindList({
    // No database here, so no Admin › Scope categories: drop a wake's own services the way a wedding's scope does.
    folders: buildShortlistFolders({ vendorRows: [], eventType: 'wedding', faithSet: new Set(), eventId: LAB_EVENT }).map((f) => ({
      ...f,
      tiles: f.tiles.filter((t) => (FIND_GROUP_OF_TILE as Record<string, string>)[t.tile] !== 'farewell'),
    })),
    eventType: 'wedding',
    solemn: false,
    booked: findBooked,
    counts: LAB_FIND_COUNTS,
  });
  const findPanel = (
    <FindCategoryList eventId={LAB_EVENT} list={findList} bookedMeasured={findBooked !== null} eventType="wedding" solemn={false} />
  );
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
      supplierShare={supplierShare}
      unread={{ pairs: [['t-lola', 2]], measured: true }}
      findPanel={findPanel}
      convergence={
        one('date') === 'set'
          ? { tone: 'anchored', headline: 'Your date is set: Sat, Dec 12, 2026', detail: 'Every card below shows whether that supplier is free that day.' }
          : one('date') === 'conflict'
            ? {
                tone: 'conflict',
                headline: 'No single date works — swap one',
                detail: 'Kusina ni Lola and Lumina Studio share no free day in the dates you are considering. Drop one of them from your build and the rest of your suppliers line up again.',
              }
            : null
      }
    />
  );

  const body = (
      <section className="sn-col max-w-none" data-lab-suppliers="">
        <LabSuppliersShell
          // ⚙ Suppliers ⚙ (2026-10-27) — the REAL sheet over a fixture; `&settings=1` opens it.
          settingsSlot={<SuppliersSettingsRows eventId={LAB_EVENT} view={LAB_SUPPLIERS_SETTINGS} />}
          settingsOpenAtFirst={one('settings') === '1'}
          start={one('build')}
          answer={one('answer')}
          covers={covers}
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
          bookedPart={bookedPartParam}
          bookedParts={labBookedParts}
          shortlistSlot={<InspectorLayout paramKey="inspect" hasSelection={false} master={bench} inspector={null} />}
          bookedSlot={
            <LabBookedStandIns payFail={one('payfail') === '1'} paySlow={one('payslow') === '1'} money={bookedOpts.money} today={priceToday(labBookedNow(bookedOpts))}>
              {bookedPartParam === 'budget' ? (
                <div className="space-y-6" data-lab-booked-part="budget">
                  <BookedPartRow
                    parts={labBookedParts}
                    current="budget"
                    line={`${labKnown.agreedPhp === null ? '—' : formatPhp(labKnown.agreedPhp)} agreed · ${labKnown.paidPhp === null ? '—' : formatPhp(labKnown.paidPhp)} paid`}
                  />
                  <BudgetScreen
                    eventId={LAB_EVENT}
                    canEdit
                    summary={{
                      targetPhp: bookedOpts.target ? 2_250_000 : null,
                      agreedPhp: labKnown.agreedPhp,
                      paidPhp: labKnown.paidPhp,
                      owedPhp: labKnown.partial ? null : labKnown.owedAtLeastPhp,
                      partial: labKnown.partial,
                      next: labKnown.partial ? null : pickNextPayment(bookedMoney.lines),
                    }}
                    list={labList}
                    supplierExtras={{}}
                    categories={costCategoryOptions('wedding')}
                    supplierOpens="plan"
                  />
                </div>
              ) : bookedPartParam === 'schedule' ? (
                <div className="space-y-5" data-lab-booked-part="schedule">
                  <BookedPartRow parts={labBookedParts} current="schedule" line={`${labMoments} moments`} />
                  <LabBookedSchedule tags={LAB_SCHEDULE_TAGS} />
                </div>
              ) : (
                <BookedBody
                  eventId={LAB_EVENT}
                  parts={labBookedParts}
                  firstOpen={one('bkopen') ?? null}
                  state={
                    bookedOpts.fail === 'team'
                      ? { kind: 'unreadable', retryHref: '/dev/suppliers-lab?mode=booked' }
                      : { kind: 'view', view: bookedLabView }
                  }
                >
                  {one('budgetblock') === '1' ? (
                    <BookedBudgetSection eventId={LAB_EVENT} budget={labBookedBudget(bookedOpts, bookedMoney)} />
                  ) : null}
                </BookedBody>
              )}
            </LabBookedStandIns>
          }
        />
      </section>
  );
  /* `&shell=1` — the REAL One Shell (rail + bar, `boundary="tab"`) instead of the stand-ins. */
  if (one('shell') === '1') return <LabShell eventId={LAB_EVENT}>{body}</LabShell>;
  return <SuppliersLabStage>{body}</SuppliersLabStage>;
}
