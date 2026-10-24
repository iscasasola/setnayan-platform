/**
 * /dev/home-lab — the phone Home's first screen (owner-APPROVED 2026-10-01,
 * "THE SIMPLE PHONE APP — APPROVED", frame 1) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route, the same kill-switch as
 * `/dev/details-lab`. It draws the REAL `HomeFirstScreen` with the REAL picker
 * and glance formatters, so what it shows is what the Home shows.
 *
 *   ?next=guide|date|guests|invite|papic|ai|plan   which Next card (default: guide)
 *   ?unread=1 (or ?fail=1)           every read failed — said so, with ⟳ Reload (H3)
 *   ?hidden=1                        the budget is not shared with this viewer
 *   ?proto=1                         the prototype's own figures (Cale & Ice, 72 days, 7 coming…)
 *   ?store=1                         the App Store / Play shell (no Your services row)
 *   ?view=papic                      🎨 the Papic page's TOP BAND instead of Home, in the same
 *                                    ?papic= state (the real PapicTopBand; the Buy more sheet
 *                                    on the prototype's ladder seed — no database)
 *   ?view=early&early=1|0&shots=N    🖼 an invited guest's Invitation before the day with the host's
 *                                    "Let guests shoot now" on/off (owner 2026-10-14): the REAL
 *                                    resolver + bar (`resolveSiteNav`, `SiteMenuBar`) and the REAL
 *                                    "Your shots" (empty → "Take your first photo"; N sample shots)
 *   ?needs=simple|open|list|full     🚪 what the event needs (owner 2026-10-08, Level 1 —
 *                                    `lib/event-needs.ts`): the Home drops what the preset leaves
 *                                    off (the bar's own drop is held by its test), the One QR card and ONE
 *                                    "Switch on more" row (prototype frame 2, a hangout after)
 *   ?store=1&apple=1[&live=on]       🍎 the iPhone app where Apple sells (owner 2026-10-18): Your
 *                                    services carries Papic · Buy more and Live Watch · Activate
 *                                    (or "On"). Prices come from StoreKit — in a browser there is
 *                                    none, so a walk injects a stand-in `window.Capacitor`.
 *     [&bought=web|app] [&v11=1]     🍎 1.1: where Live Watch was bought ("On · bought on the web / in the app"),
 *                                    and the 1.1 doors — the Papic row opens its page, an owned Live Watch has Go live
 *   ?view=papic&apple=1              🍎 the Papic page's band in that app — Buy more is Apple's sheet
 *   ?view=papic&need=1               🧮 the sheet reads its sizes AND "How many do I need?" on the tap, as the page does
 *                                    (`papicBuySizes`) — against whatever the lab's Supabase URL answers (a walk's stub)
 *   ?view=pro                        💎 what Event Hub Pro includes (owner 2026-10-22, Host 5): the REAL
 *                                    controller offer (`resolveHubProOffer` → `HubProOffer`) and the REAL
 *                                    editor lock (`ProLockPanel`), both reading `WEBSITE_PRO_ITEMS`. No price
 *                                    (the app reads the catalogue; a lab has none, so the figure is omitted).
 *   ?view=apply&screen=none|silent|cancelled|failed|refused|pending|on  🍎 the REAL Apply sheet
 *                                    selling Event Hub Pro through Apple, in each outcome
 *   ?for=shop|person                 🏷 "For <name>" under the name (owner 22 Oct 2026): the REAL
 *                                    `homeCoverWords` with a subject — SetnaProd (its logo) or Lola Nena (initials)
 *   ?view=board[&for=1][&one=1]      🏷 the Events board's Planning posters (owner 22 Oct 2026): the REAL
 *                                    `CollectionCard` + `EventPoster` + `StanceChip`, fixture facts; `for=1`
 *                                    puts "For SetnaProd" / "For Lola Nena" in the stance slot (prototype
 *                                    for_tag_on_event_cards_2026-10-22.html); `one=1` the one-card row
 *   ?order=a|b                       🔀 the header over "Claire & Indalecio" (a) or "Indalecio & Claire" (b), stored
 *   ?paid=cale|none|mix|pending|unread   🧾 every paid service + Event Hub Pro (owner 2026-10-14):
 *                                    cale = all on (cale-ice, an internal host, measured 2026-10-20) ·
 *                                    none = nothing added (slim lines) · mix = Planner + Pro on, the rest
 *                                    not added · pending = payments waiting · unread = the reads failed
 *   ?view=day                        📷 the EVENT-DAY console (owner 22 Oct 2026, "Fix both"): the REAL
 *                                    `DayOfModeGrid` with Home › Your services' own Papic row beside the Live
 *                                    photo wall (`DayPapicRow`, face from `dayPapicFace`)
 *     [&face=off|none|failed]        Papic switched off · not on yet · the credits read failed
 *     [&store=1]                     the App Store / Play shell — no Papic row, as Your services
 *     [&before=1]                    the console as `main` drew it before 22 Oct (no Papic; with &shell=1,
 *                                    main's bar rule too — `/dev/bar-lab`'s `was=1`)
 *     [&shell=1&type=…&needs=…]      the REAL event bar for that type (`/dev/bar-lab`'s gates), phase dayof
 *   ?papic=before|on|low|stopped|empty|lowday  🎨 the approved prototype's states (owner
 *                                    2026-10-14): before the window · on · running low ·
 *                                    stopped (Next card) · no photos yet (Next card) · low on the day
 */
import { PapicCardStripView } from '@/app/dashboard/[eventId]/_components/papic-card-strip';
import { PapicBuySheet } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-buy-sheet';
import { PapicCameraSettings, PapicSwitch } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings';
import { papicCardPhase, papicCoverageWords } from '@/lib/papic-home-card';
import type { PapicCardInput } from '@/app/dashboard/[eventId]/_components/home-first-screen';
import { LabShell } from '@/app/dev/_components/lab-shell';
import { labEventBar } from '@/app/dev/bar-lab/lab-event';
import { DayOfModeGrid } from '@/app/dashboard/[eventId]/_components/day-of-mode/grid';
import { LabSpotlight } from './lab-spotlight';
import { TOURS } from '@/lib/tours';
import { coupleNameColumns } from '@/lib/typed-names';
import { homeCoverWords } from '@/lib/home-cover-words';
import { CollectionCard, CollectionGrid } from '@/app/_components/collection-card';
import { EventPoster } from '@/app/_components/event-poster';
import { StanceChip } from '@/app/dashboard/(launcher)/_components/stance-chip';
import type { EventPosterFacts } from '@/lib/event-poster';
import type { ForTag } from '@/lib/for-tag';
import { notFound } from 'next/navigation';
import { NEED_PRESETS, needsColumns, needsForPreset, readEventNeeds, switchOnRows, type NeedPreset } from '@/lib/event-needs';
import { DayPapicRow, HomeFirstScreen, YourServices } from '@/app/dashboard/[eventId]/_components/home-first-screen';
import { fixtureControl, fixtureControlUnread, fixturePays } from '@/lib/home-control-fixture';
import { resolveSiteNav } from '@/app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '@/app/[slug]/_lib/stage-bar';
import { SiteMenuBar } from '@/app/[slug]/_components/site-menu-bar';
import { YourShotsGallery } from '@/app/[slug]/_components/your-shots-gallery';
import { papicGlance, papicRowDoubled } from '@/lib/papic-glance';
import { resolveStoredWindow } from '@/lib/papic-window';
import { PapicTopBand } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-top-band';
import { ApplyProSheetLab } from './apply-pro-sheet-lab';
import { resolveHubProOffer } from '@/lib/event-hub-pro';
import { HubProOffer } from '@/app/dashboard/[eventId]/launch/_components/hub-pro-offer';
import { ProLockPanel } from '@/app/dashboard/[eventId]/website/editor/_components/pro-panels';
import { liveWatchHomeStatus } from '@/lib/iap/where-bought';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { formatPhp } from '@/lib/php';
import { homePaidFacts, type HomeSkuRead } from '@/lib/home-paid-services';
import {
  HOME_PAID_SKU,
  aiStatus,
  dayPapicFace,
  glanceDays,
  homeServices,
  pickHomeNext,
  type HomeNextInput,
} from '@/lib/home-first-screen';

export const dynamic = 'force-dynamic';

/*
  🧾 The paid rows' fixtures — sample amounts for a lab with no database (the live
  `platform_retail_catalog_v2` rows as read on 2026-10-20), formatted the way the Home formats a catalogue
  amount. The Home itself reads the table; no price is typed as a peso string here.
*/
const LAB_PRICES = new Map<string, string>([
  [HOME_PAID_SKU.ai, formatPhp(2499)],
  [HOME_PAID_SKU.live, formatPhp(2500)],
  [HOME_PAID_SKU.music, formatPhp(2500)],
  [HOME_PAID_SKU.booth, `${formatPhp(1500)} / day`],
  [HOME_PAID_SKU.hub, formatPhp(5000)],
]);
const ON: HomeSkuRead = { active: true, pending: false };
const OFF: HomeSkuRead = { active: false, pending: false };
const WAIT: HomeSkuRead = { active: false, pending: true };
const FAILED: HomeSkuRead = { active: null, pending: null };
function labPaid(state: string | undefined, eventId: string) {
  if (!state) return null;
  const all = (r: HomeSkuRead) => Object.fromEntries(Object.values(HOME_PAID_SKU).map((sku) => [sku, r]));
  const reads =
    state === 'cale'
      ? all(ON)
      : state === 'pending'
        ? all(WAIT)
        : state === 'unread'
          ? all(FAILED)
          : state === 'mix'
            ? { ...all(OFF), [HOME_PAID_SKU.ai]: ON, [HOME_PAID_SKU.hub]: ON }
            : all(OFF);
  return homePaidFacts({
    eventId,
    catalogue: ADD_ONS,
    reads,
    prices: state === 'cale' ? new Map() : LAB_PRICES,
    offered: () => true,
    sellableNow: () => true,
    aiSellable: true,
    refusesPath: () => false,
  });
}

/** Sample shots for the early-shots lab — the repo's own portraits, nothing real. */
const LAB_PHOTOS = ['isabel-mendoza.avif', 'andres-delgado.avif', 'isabella-reyes.avif', 'miguel-santos-garden.avif'];
const DONE_GUESTS = { total: 96, unsent: 0 };
const STATES: Record<string, HomeNextInput> = {
  guide: {
    guide: { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 },
    hasDate: true,
    guests: DONE_GUESTS,
    noun: 'wedding',
    papicReady: true,
    aiOffer: true,
  },
  date: { guide: null, hasDate: false, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: true },
  guests: { guide: null, hasDate: true, guests: { total: 0, unsent: 0 }, noun: 'wedding', papicReady: true, aiOffer: true },
  invite: { guide: null, hasDate: true, guests: { total: 96, unsent: 58 }, noun: 'wedding', papicReady: true, aiOffer: true },
  papic: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: true, aiOffer: true },
  ai: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: true },
  plan: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: false },
};

/* 📷 PAPIC'S CARD (owner 2026-10-23, "expanding opens the rest of the settings under it") — `?card=1[&cardphase=before|live|after]`:
   the REAL card and coverage words on fixture dates, a strip of fixture frames (the real view), and the REAL camera
   settings (in a lab with no database they say "couldn't load" — the failed-read state, drawn as it ships). */
function labPapicCard(eventId: string, phase: string | undefined, failed: boolean): PapicCardInput {
  const startIso = '2026-12-10T16:00:00.000Z';
  const endIso = '2026-12-13T04:00:00.000Z';
  const now = phase === 'after' ? Date.parse('2026-12-14T02:00:00Z') : phase === 'live' ? Date.parse('2026-12-12T06:00:00Z') : Date.parse('2026-10-23T02:00:00Z');
  const ph = papicCardPhase(startIso, endIso, now);
  const tones = [['#D7B77C', '#9A7A3C'], ['#B9856A', '#6F4A33'], ['#E2D59C', '#A7A14B'], ['#6E8296', '#2E3F50'], ['#B8788D', '#6D3F50']];
  const frames = tones.map(([a, b], i) => ({
    id: `f${i}`,
    url:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/></svg>`),
  }));
  return {
    coverage: papicCoverageWords({ startIso, endIso, now }),
    phase: ph,
    strip: <PapicCardStripView eventId={eventId} frames={failed ? null : ph === 'before' ? [] : frames} total={failed ? null : ph === 'before' ? 0 : 1284} phase={ph} />,
    thankYouHref: '#thank-you',
    headControl: <PapicSwitch eventId={eventId} saved />,
    settings: (
      <PapicCameraSettings
        eventId={eventId}
        seat="home"
        credits={{ total: failed ? null : 2000, left: failed ? null : 1240 }}
        buy={<PapicBuySheet eventId={eventId} left={failed ? null : 1240} tone="brand" main label="Add more" />}
      />
    ),
  };
}

export default async function HomeLab({
  searchParams,
}: {
  searchParams: Promise<{ bought?: string; v11?: string; proto?: string; next?: string; unread?: string; fail?: string; hidden?: string; store?: string; papic?: string; view?: string; early?: string; shots?: string; needs?: string; apple?: string; live?: string; screen?: string; shell?: string; paid?: string; order?: string; spot?: string; face?: string; before?: string; type?: string; phase?: string; for?: string; one?: string; card?: string; cardphase?: string; open?: string; need?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const unread = q.unread === '1' || q.fail === '1';
  const proto = q.proto === '1';
  /* The prototype's own figures, for the side-by-side (prototypes/home_and_guests_2026-10-07_fable.html). */
  const F0 = proto
    ? { eyebrow: 'Wedding · Fri, Dec 18, 2026', name: 'Cale & Ice', days: 72, coming: 7, noReply: 2, paid: 0, owing: 1056000 }
    : { eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel', days: 163, coming: 96, noReply: 35, paid: 120000, owing: 45000 };
  /* 🔀 `?order=a|b` — the owner's couple, its event name stored either way round (owner 2026-10-21): the header is
     the REAL `homeCoverWords` over that stored name, as the dashboard draws it. */
  const F =
    q.order === 'a' || q.order === 'b'
      ? {
          ...F0,
          ...homeCoverWords({
            event_type: 'wedding',
            event_date: '2026-12-18',
            display_name: coupleNameColumns({ first: 'Claire', last: '' }, { first: 'Indalecio', last: '' }, q.order === 'b' ? 'b-first' : 'a-first').display_name,
          }),
        }
      : q.for === 'shop' || q.for === 'person'
        ? {
            ...F0,
            ...homeCoverWords({
              event_type: q.for === 'shop' ? 'gala_night' : 'birthday',
              event_date: q.for === 'shop' ? '2027-03-07' : '2027-05-09',
              display_name: q.for === 'shop' ? 'Year-End Gala' : 'Lola Nena',
              for_tag: q.for === 'shop' ? LAB_SHOP_TAG : LAB_PERSON_TAG,
            }),
          }
        : F0;
  const labForWho: ForTag | undefined = 'forWho' in F ? (F.forWho as ForTag | undefined) : undefined;
  // 🏷 The Events board's Planning posters (owner 22 Oct 2026) — the real card parts on fixture facts.
  if (q.view === 'board') return <LabBoard tagged={q.for === '1'} one={q.one === '1'} />;
  const picked = proto
    ? { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding' as const, papicReady: false, aiOffer: false }
    : STATES[q.next ?? 'guide'] ?? STATES.guide!;
  const E = '00000000-0000-4000-8000-000000000000';
  // 💎 Host 5 — far from the lab's Papic ladder seed, whose figures are not Event Hub Pro's.
  if (q.view === 'pro') {
    const offer = resolveHubProOffer({ channel: 'save_the_date', phase: 'plan', ownsPro: false });
    return (
      <div className="mx-auto w-full max-w-md px-4 py-4" data-lab-pro-list="">
        {offer ? <HubProOffer offer={offer} channelName="Save-the-Date" priceLabel={null} base={`/dashboard/${E}`} /> : null}
        <div className="mt-4">
          <ProLockPanel featureName="Background music" unlockHref={`/dashboard/${E}/studio/website-pro`} priceLabel={null} />
        </div>
      </div>
    );
  }
  /* 🎨 Papic's row and band — the REAL glance over the approved prototype's own sample
     (papic_easy_home_and_band_2026-10-14_fable.html: Maria & Jose, 2,000 credits bought),
     the REAL default window. `lowday` = running low ON the event day (owner call 1). */
  const papicState = q.papic ?? null;
  const dayMs = 86_400_000;
  const iso = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
  const PAPIC: Record<string, { left: number; photos: number; days: number }> = {
    before: { left: 2000, photos: 0, days: 234 },
    on: { left: 1240, photos: 86, days: 66 },
    low: { left: 140, photos: 1860, days: 66 },
    stopped: { left: 0, photos: 2000, days: 66 },
    empty: { left: 2000, photos: 0, days: 66 },
    lowday: { left: 140, photos: 1860, days: 0 },
  };
  const ps = papicState ? PAPIC[papicState] ?? PAPIC.on! : null;
  const papicEventDate = iso(Date.now() + (ps?.days ?? 40) * dayMs);
  const papicWin = resolveStoredWindow({ windowStart: null, windowEnd: null, eventDate: papicEventDate });
  const papicNow = papicGlance({
    permitted: true,
    tile: unread
      ? 'failed'
      : ps
        ? { shotsLeft: ps.left, shotsTotal: 2000, photosGathered: ps.photos }
        : proto
          ? { shotsLeft: 50, shotsTotal: 50, photosGathered: 0 }
          : { shotsLeft: 1240, shotsTotal: 1500, photosGathered: 12 },
    window: { startDate: papicWin.startDate, endIso: papicWin.endIso },
    eventDate: papicEventDate,
    papicOn: true,
  });
  /* The prototype's ladder seed — for the lab's sheet only; the app reads the catalog. */
  const LAB_SIZES = [
    { serviceCode: 'LAB_100', points: 100, pricePhp: 70, discountPercent: 30 },
    { serviceCode: 'LAB_300', points: 300, pricePhp: 210, discountPercent: 30 },
    { serviceCode: 'LAB_500', points: 500, pricePhp: 350, discountPercent: 30 },
    { serviceCode: 'LAB_1000', points: 1000, pricePhp: 700, discountPercent: 30 },
    { serviceCode: 'LAB_3000', points: 3000, pricePhp: 1680, discountPercent: 44 },
  ];
  if (q.view === 'apply') {
    return <ApplyProSheetLab screen={q.screen ?? 'none'} />;
  }
  if (q.view === 'early') {
    const early = q.early !== '0';
    const n = Math.max(0, Number(q.shots ?? 0) || 0);
    const bar = resolveSiteNav({
      viewer: { kind: 'guest' },
      phase: 'before',
      stageSlots: STAGE_BAR.rsvp.slots,
      hostAllowsCamera: true,
      anyChapterPublic: false,
      hasStory: true,
      liveBroadcast: false,
      earlyOwnShots: early,
      destinations: { camera: '/papic/guest?from=lab' },
    });
    return (
      <div className="min-h-screen bg-cream px-4 pb-28 pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <p className="sn-eye text-ink/70">Memories · before the day</p>
          {early ? (
            <YourShotsGallery
              shots={{ shots: Array.from({ length: n }, (_, i) => ({ id: `lab-${i}`, url: '/portraits/' + LAB_PHOTOS[i % LAB_PHOTOS.length]!, capturedAt: null })), total: n }}
              qrToken={null}
              cameraOn
              everyoneHref={null}
              cameraHref="/papic/guest?from=lab"
            />
          ) : (
            <p className="text-sm text-ink/60">(Early shooting off — the bar keeps its four; there are no Memories before the day.)</p>
          )}
        </div>
        <SiteMenuBar slots={bar} />
      </div>
    );
  }
  if (q.view === 'papic') {
    const band = (
      <div className="min-h-screen bg-cream px-4 pb-6 pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-7">
          <PapicTopBand eventId={E} glance={papicNow} canBuy sizes={q.need === '1' ? undefined : LAB_SIZES} apple={q.apple === '1'} />
        </div>
      </div>
    );
    return q.shell === '1' ? <LabShell eventId={E} gutter={false}>{band}</LabShell> : band;
  }
  if (q.view === 'day') {
    /* The event day: the page's own wiring — `homeServices` builds Your services, the console draws its Papic entry. */
    const store = q.store === '1';
    const face = q.face;
    const dayGlance =
      face === 'failed' || face === 'none'
        ? papicGlance({ permitted: true, tile: face === 'failed' ? 'failed' : null, window: { startDate: null, endIso: null }, papicOn: true })
        : papicNow;
    const dayServices = homeServices({
      next: 'plan',
      storeShell: store,
      papic: dayGlance.status,
      papicDoors: { glance: dayGlance, line: dayGlance.line, buy: dayGlance.buy, whileNext: papicRowDoubled(null) },
      ai: aiStatus(false),
      eventId: E,
      paid: store ? null : labPaid(q.paid ?? 'none', E),
    });
    const svc = dayServices.find((x) => x.key === 'papic');
    const now = Date.now();
    const at = (min: number) => new Date(now + min * 60_000).toISOString();
    const blocks = [
      { block_id: 'b1', label: 'Ceremony', start_at: at(-90), end_at: at(-30), location: 'Garden' },
      { block_id: 'b2', label: 'Cocktails', start_at: at(-30), end_at: at(30), location: 'Terrace' },
      { block_id: 'b3', label: 'Dinner & toasts', start_at: at(30), end_at: at(150), location: 'Main hall' },
    ];
    const day = (
      <div className="mx-auto min-h-screen w-full bg-cream px-4 pb-28 pt-3 sm:px-6 sm:pt-6 lg:px-8" data-lab-day="">
        <DayOfModeGrid
          eventId={E}
          blocks={blocks}
          headTable={null}
          nearbyTables={[]}
          liveWallActive={!store}
          papic={
            q.before === '1' ? null : (
              <DayPapicRow
                eventId={E}
                face={dayPapicFace({ svc, papicOn: face === 'off' ? false : true, permitted: true, tile: face === 'failed' ? 'failed' : face === 'none' ? null : {} })}
                svc={svc}
                left={dayGlance.count}
                sizes={LAB_SIZES}
              />
            )
          }
        />
        {/* The rest of Your services on the day (More left the bar, owner 22 Oct 2026) — as the page draws it. */}
        {q.before === '1' ? null : (
          <div className="mt-4">
            <YourServices eventId={E} services={dayServices.filter((x) => x.key !== 'papic')} papicLeft={dayGlance.count} />
          </div>
        )}
      </div>
    );
    return q.shell === '1' ? (
      <LabShell eventId={E} gutter={false} eventBar={labEventBar({ type: q.type, needs: q.needs, phase: q.phase ?? 'dayof', store: q.store, was: q.before })}>
        {day}
      </LabShell>
    ) : (
      day
    );
  }
  /* An unread guest list reaches the picker as `null` — exactly as the page hands it. */
  const base: HomeNextInput = ps
    ? {
        ...picked,
        guide: null,
        papicReady: false,
        papic: papicNow.moment && papicNow.count !== null && papicNow.total !== null
          ? { moment: papicNow.moment, left: papicNow.count, total: papicNow.total }
          : null,
      }
    : picked;
  // 🚪 What the event needs — a preset's needs read back exactly as the dashboard reads the columns.
  const labNeeds =
    q.needs && (NEED_PRESETS as readonly string[]).includes(q.needs)
      ? readEventNeeds(needsColumns(needsForPreset(q.needs as NeedPreset, { marketplace: true })))
      : null;
  const input0: HomeNextInput = unread ? { ...base, guide: null, guests: null } : base;
  const input: HomeNextInput = labNeeds ? { ...input0, needs: labNeeds } : input0;
  const next = pickHomeNext(input);
  /* 🎛 The control row on the prototype's own sample (`lib/home-control-fixture.ts`, the guards' own fixture) — with
     the unread states the page hands over when its reads fail, and the lab's own days / coming / no reply / money. */
  const days = glanceDays(F.days);
  const labControl = (unread ? fixtureControlUnread : fixtureControl)(E, {
    next,
    countdown: { value: days.value, label: days.label, days: F.days ?? null, hasDate: days.value !== '—', long: 'Saturday, December 12, 2026', placeLine: 'Tagaytay' },
    ...(labNeeds?.guestList === false ? { guests: null } : unread ? {} : { guests: { coming: F.coming, noReply: F.noReply, toInvite: 35, declined: 4, total: 131 } }),
    ...(q.hidden === '1' ? { budget: null } : unread ? {} : { budget: { paidPhp: F.paid, owingPhp: F.owing, pays: fixturePays() } }),
  });
  const home = (
    /* The EVENT LAYOUT's own gutter (`app/dashboard/[eventId]/layout.tsx` — px-4 · sm:px-6 · lg:px-8, pt-3 ·
       sm:pt-6): the cover band cancels exactly that gutter to run edge to edge, so a lab that pads by less draws
       a band that overflows (sweep 2026-10-19 C13: 16 px past the right edge at 1280 — the lab's, not the Home's).
       Held by `lib/the-home-cover-band-fits-its-gutter.test.ts`. */
    <div className="mx-auto min-h-screen w-full bg-cream px-4 pb-6 pt-3 sm:px-6 sm:pt-6 lg:px-8">
      <HomeFirstScreen
        eventId={E}
        cover={{ eyebrow: F.eyebrow, name: F.name, ...(labForWho ? { forWho: labForWho } : {}) }}
        next={next}
        control={labControl}
        needs={labNeeds ? { ...labNeeds, switchOn: switchOnRows(labNeeds, { marketplace: true }) } : null}
        papicLeft={papicNow.count}
        papicSizes={LAB_SIZES}
        papicCard={q.card === '1' ? labPapicCard(E, q.cardphase, q.fail === '1' || q.unread === '1') : null}
        apple={
          q.store === '1' && q.apple === '1'
            ? {
                papic: { status: papicNow.status, buy: true, open: q.v11 === '1' ? `/dashboard/${E}/studio/papic` : null },
                liveWatch:
                  q.live === 'on'
                    ? {
                        status: liveWatchHomeStatus({
                          active: true,
                          owned: true,
                          where: q.bought === 'web' ? 'web' : q.bought === 'app' ? 'app' : null,
                        }),
                        owned: true,
                        askReady: false,
                        goLive: q.v11 === '1' ? `/panood/control/${E}` : null,
                      }
                    : { status: 'Not on yet · one camera is free', owned: false, askReady: true },
              }
            : null
        }
        services={homeServices({
          next: next.kind,
          storeShell: q.store === '1',
          papic: papicNow.status,
          papicDoors: {
            glance: papicNow,
            line: papicNow.line,
            buy: papicNow.buy,
            whileNext: papicRowDoubled(next.kind === 'papic' ? next.papicMoment ?? null : null),
          },
          ai: aiStatus(unread ? null : false),
          eventId: E,
          paid: q.store === '1' ? null : labPaid(q.paid, E),
        })}
      />
    </div>
  );
  /* `&spot=1` — 👋 the host spotlight's first run over this Home: the once-only welcome, then the shipped steps. */
  const lit = q.spot === '1' ? (
    <>
      {home}
      {TOURS.host_spotlight_v1.spotlight ? <LabSpotlight name="Isabel" script={TOURS.host_spotlight_v1.spotlight} /> : null}
    </>
  ) : (
    home
  );
  /* `&shell=1` — the REAL One Shell (rail + bar, `boundary="tab"`); the Home draws the layout's gutter itself. */
  /* The REAL event bar (`labEventBar` — five tabs since 23 Oct 2026, Memories after Hub), Home lit. */
  return q.shell === '1' ? (
    <LabShell eventId={E} gutter={false} eventBar={labEventBar({ type: q.type, needs: q.needs, phase: q.phase, store: q.store })} homeAt="/dev/home-lab">
      {lit}
    </LabShell>
  ) : (
    lit
  );
}

/* 🏷 "For <name>" fixtures (prototype for_tag_on_event_cards_2026-10-22.html): the shop's round
   logo is a drawn stand-in (no R2 in a lab); a loved one has no photo, so initials. */
const LAB_LOGO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%231F3A5F'/><circle cx='32' cy='32' r='24' fill='none' stroke='%23CBA766' stroke-width='3'/><text x='32' y='43' text-anchor='middle' font-family='Georgia,serif' font-size='30' fill='%23FBFAF7'>S</text></svg>";
const LAB_SHOP_TAG: ForTag = { name: 'SetnaProd', markUrl: LAB_LOGO };
const LAB_PERSON_TAG: ForTag = { name: 'Lola Nena', markUrl: null };

function labPoster(over: Partial<EventPosterFacts>): EventPosterFacts {
  return {
    kind: 'deep', accent: null, capiz: false, dark: true, names: { first: '', second: null },
    weekday: null, date: null, eyebrow: null, line: null, venue: null, photoSrc: null, ground: null, legibility: null,
    ...over,
  };
}

function LabBoard({ tagged, one }: { tagged: boolean; one: boolean }) {
  const cards = one
    ? [
        {
          id: 'lola', title: 'Lola Nena', badge: 'Birthday', tag: LAB_PERSON_TAG, days: '199 days to go', pct: 12, attention: undefined,
          poster: labPoster({ kind: 'moon', accent: '#6b7a3a', names: { first: 'Lola Nena', second: null }, weekday: 'Sunday', date: '9 May 2027' }),
          mark: 'LN',
        },
      ]
    : [
        {
          id: 'gala', title: 'Year-End Gala', badge: 'Gala Night', tag: LAB_SHOP_TAG, days: '136 days to go', pct: 41,
          attention: { count: 3, label: '3 tasks overdue' },
          poster: labPoster({ kind: 'deep', accent: '#1f3a5f', names: { first: 'Year-End Gala', second: null }, weekday: 'Saturday', date: '7 March 2027' }),
          mark: 'S',
        },
        {
          id: 'mj', title: 'Maria & Jose', badge: 'Wedding', tag: null, days: '226 days to go', pct: 62,
          attention: { count: 17, label: '17 tasks overdue' },
          poster: labPoster({ kind: 'photo', names: { first: 'Maria', second: 'Jose' }, weekday: 'Saturday', date: '5 June 2027', photoSrc: '/event-types/wedding.webp', ground: 'hero', legibility: { '--hub-ink': '#FBFAF7', '--hub-heading': '#FBFAF7', '--hub-accent-text': '#E6D3A8', '--hub-scrim': 'rgba(20,14,10,.62)' } }),
          mark: 'M & J',
        },
      ];
  return (
    <div className="mx-auto w-full max-w-md bg-cream px-4 py-3" data-lab-board="">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/45">Planning</p>
      <CollectionGrid layout="poster">
        {cards.map((c, i) => {
          const forTag = tagged ? c.tag : null;
          return (
            <div key={c.id} className="relative">
              <CollectionCard
                href="#"
                layout="poster"
                coverTone={c.poster.dark ? 'dark' : 'light'}
                index={i}
                reserveMenuCorner
                cover={<EventPoster poster={c.poster} markText={c.mark} />}
                kicker={[c.badge, <StanceChip stance="organiser" forTag={forTag} key="stance" />]}
                title={c.title}
                meta={`${c.badge}, ${forTag ? `for ${forTag.name}` : 'You organise this'}`}
                attention={c.attention}
                progress={{ pct: c.pct, remainder: c.days, srLabel: 'planned' }}
              />
            </div>
          );
        })}
      </CollectionGrid>
    </div>
  );
}
