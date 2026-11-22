import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Eye, ListChecks, Mail, PenLine, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Count } from '@/components/count';
import { ReplyArrives } from '@/app/_components/signature/reply-arrives';
import { GlanceDot, GlanceMeter } from '@/app/_components/service-glance';
import { EVENT_MENU_ICONS } from '@/lib/customer-menu';
import { planningTodoHref } from '@/lib/checklist-anchor';
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { ServiceMood } from '@/lib/service-glance';
import {
  BUDGET_MAX_PAY_FACES,
  HOME_CONTROL_PAGE,
  dueWords,
  homeControlTiles,
  homeWidgetFramed,
  nextHubStage,
  paymentsToSettle,
  paysHeldByToday,
  shortDay,
  type HomeControlInput,
  type HomeControlKey,
  type HomeFace,
  type HomeTileModel,
} from './home-control-faces';
import { HomeTile, HomeTileCountKey, HubViewLink } from './home-tile';
import { HubPickButton } from './home-cards/hub-pick-button';
import type { HomeHubPickRead } from './home-cards/hub-pick-types';
import { HomeLater, HomeReload } from './home-parts';
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { budgetPageHref } from '@/lib/pillar-parts';

/**
 * 🎛 HOME'S WIDGETS IN THE WEBSITE LOOK (owner 23 Nov 2026, *"Yes, approve"* — specs DECISION_LOG "EVENT SERVICES v5
 * (WEBSITE TEMPLATE) APPROVED, WITH THE TODAY DOOR", drawing `prototypes/buy_event_services_one_place_2026-11-23/
 * strip-v5-today.jpg`): Guests · Budget · Schedule · Suppliers · Event Hub are SECTIONS on a white page at every
 * width — "Title  See all →", one grey line, chips, quiet pills, rows split by hairlines (HOUSE_DESIGN_STANDARD
 * Part H). They are the 1280 board's own cards, drawn once: the phone's rotating compact tiles and the tablet's second
 * copy are retired (the drawing replaces them; owner's pick in the build, 23 Nov). The Countdown rides the event card
 * and To do is the list, so neither is drawn here. THE UPPER PARTS OPEN THEIR PAGE (owner 2026-10-24): a section never
 * grows; a tap opens its ONE page at the exact item. A failed read is ONE "Couldn't load" line with ⟳ Reload.
 */

/**
 * 🖥 THE 1280 BOARD — one of Home's three columns from `xl` (owner-approved 16 Nov 2026, event dashboard drawing v13,
 * `event_dashboard_clean_2026-11-16_fable.html` · clean look screen 2b): the event card, Next and To do | Guests ·
 * Budget · Schedule | Suppliers · Event Hub, then Prints · Your services · Memories. Below 1280 the same two columns
 * stack under the list in that order (Guests · Budget · Schedule · Suppliers · Event Hub — the v5 drawing's order), so
 * the board is the ONE copy at every width. Each column is its own stack, so the eye and the Tab key read it column by
 * column (the-home-grid-reads-in-order.test.ts). The Countdown rides the event card and To do is the list in the first
 * column, so the board draws neither card.
 */
export const HOME_BOARD_COLUMNS = {
  middle: ['guests', 'budget', 'sched'],
  right: ['sup', 'hub'],
} as const satisfies Record<string, readonly (HomeControlKey | 'sched')[]>;

export function HomeControlBoardColumn({
  input,
  side,
  hubPick = null,
}: {
  input: HomeControlInput;
  side: keyof typeof HOME_BOARD_COLUMNS;
  hubPick?: HomeHubPickRead | null;
}) {
  const { tiles } = homeControlTiles(input);
  return (
    <div
      className="hc-bcol mx-auto flex w-full min-w-0 max-w-xl flex-col md:max-w-none xl:mx-0"
      data-home-control="board"
      data-home-board={side}
      /* 🧭 The welcome tour's "Start here" ring (lib/tours.ts, anchor `home-tiles`) — the board is what shows from 1280. */
      data-tour={side === 'middle' ? 'home-tiles' : undefined}
    >
      {HOME_BOARD_COLUMNS[side].map((k) => {
        if (k === 'sched') {
          const sched = tiles.find((t) => t.key === 'sched') ?? null;
          return sched ? (
            <HomeTileCountKey key={k} value="-board">
              <HomeTile model={sched} eventId={input.eventId} stagger={0} />
            </HomeTileCountKey>
          ) : null;
        }
        return <DetailCard key={k} k={k} input={input} tile={tiles.find((t) => t.key === k) ?? null} hubPick={k === 'hub' ? hubPick : null} countKey="-board" />;
      })}
    </div>
  );
}

/* ─── The detail card — the shipped card's shape, no grow ─────────────────── */

/** The bar's own glyphs (`EVENT_MENU_ICONS`) — one vocabulary, never a private icon map. */
function menuMark(name: 'guests' | 'hub' | 'team' | 'budget' | 'schedule'): ReactNode {
  const I = EVENT_MENU_ICONS[name];
  return <I aria-hidden strokeWidth={1.9} />;
}
const MARK: Record<HomeControlKey, ReactNode> = {
  count: menuMark('schedule'),
  guests: menuMark('guests'),
  hub: menuMark('hub'),
  sup: menuMark('team'),
  budget: menuMark('budget'),
  plan: <ListChecks aria-hidden strokeWidth={1.9} />,
};

const NAME: Record<HomeControlKey, string> = {
  count: 'Countdown',
  guests: 'Guests',
  hub: 'Event Hub',
  sup: 'Suppliers',
  budget: 'Budget',
  plan: 'To do',
};

/** What each card's ⓘ says — the detail lives here, not on the card (owner 2026-10-23: details go inside the ⓘ). */
const INFO: Record<HomeControlKey, string> = {
  count: 'Counts down to your date. This card is the one door to your date, place and time.',
  guests: 'Who said yes, who has not replied, who has no invitation yet — and the one thing to do about it.',
  hub: 'The page your guests see now, and what comes next. Pick what shows changes the page; Edit in Maker changes how it looks.',
  sup: 'How many of your plan’s categories are booked, and what waits on you: a quote to decide, suppliers who replied.',
  budget: 'Every payment still to settle, soonest first; then what you have paid and what is still owing.',
  plan: 'Only the plan: how far along you are and the next three dated tasks, soonest first. Guests, suppliers and money live on their own cards.',
};

function Shell({
  k,
  door,
  external = false,
  brand,
  today,
  failed = false,
  example = null,
  children,
}: {
  k: HomeControlKey;
  door: string;
  external?: boolean;
  brand?: string | null;
  today: boolean;
  failed?: boolean;
  /** 👻 The tile's sample face (`HomeFace.example`) — set by home-control-faces.ts only on a read that ANSWERED empty. */
  example?: HomeFace['example'] | null;
  children: ReactNode;
}) {
  const label = `Open ${HOME_CONTROL_PAGE[k]}`;
  return (
    <article
      /* 🧱 Frames only where you act (owner 2026-11-01) — the same list the phone's tiles read. */
      className={`sg-row hc-card${homeWidgetFramed(k) ? '' : ' hc-plain'}${failed ? ' hc-card-bad' : ''}`}
      data-home-card-key={k}
      /* 🎴 What Now names — marked, not chipped: Now rides the event card and is never repeated (Home redraw 2026-11-02). */
      data-home-now={today ? '' : undefined}
      data-mood={failed ? 'gone' : 'plain'}
      /* 💾 Money is never kept as last-seen data (lib/last-seen) — the Budget card is dropped from the snapshot. */
      data-money={k === 'budget' ? '' : undefined}
    >
      {/* THE DOOR — the whole card is its ONE page; the buttons inside sit above it (never a link in a link). */}
      {external ? (
        <HubViewLink url={door} className="hc-card-door" label={label} marker="card">
          {null}
        </HubViewLink>
      ) : (
        <Link href={door} className="hc-card-door" aria-label={label} data-home-card-door={k} />
      )}
      {/* 🌐 The website's section head (Part H, "Title  See all →"): the name with its ⓘ, then the door's own words.
          The whole section stays the door (`hc-card-door` above); "See all →" says so, as the website's heads do. */}
      <span className="sg-head">
        <span className="sg-mark" aria-hidden>
          {MARK[k]}
        </span>
        <span className="hc-card-name">
          <InfoTip label={NAME[k]} labelClassName="sg-name" align="start">
            {INFO[k]}
          </InfoTip>
        </span>
        <span aria-hidden className="hc-see-all">
          See all
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
      </span>
      {/* The section's one grey line (its first status joins it, after a ·). */}
      {brand ? <span className="sg-brand">{brand}</span> : null}
      {children}
      {/* 👻 THE EMPTY LOOK AT DESKTOP WIDTHS (Build 5 Lane H leftover): the phone tile's own sample face, drawn in this
          card's own lines under "Example" — the same gate, the same fixture, so phone and desktop show one sample.
          Never on a failed card (its read was refused). */}
      {example && !failed ? <DetailExample face={example} /> : null}
    </article>
  );
}

/** The detail card's own lines (dot · meter · status) on the tile's sample face — greyed through the ONE slot. */
function DetailExample({ face }: { face: NonNullable<HomeFace['example']> }) {
  return (
    <ExamplePreview className="hc-example">
      {face.rows ? (
        face.rows.map((r, i) => (
          <span key={i} className="sg-status">
            <span>
              <b className="font-medium">{r.k}</b>
              {r.v ? ` · ${r.v}` : ''}
            </span>
          </span>
        ))
      ) : (
        <>
          <Dot mood="ok">
            <b className="font-medium">
              {face.big}
              {face.unit ? ` ${face.unit}` : ''}
            </b>
          </Dot>
          {typeof face.meter === 'number' ? <GlanceMeter mood="ok" pct={face.meter} label="Example" /> : null}
          {face.sm ? (
            <span className="sg-status">
              <span>{face.sm}</span>
            </span>
          ) : null}
        </>
      )}
    </ExamplePreview>
  );
}

/** The tile's sample face, when one of its faces carries it (home-control-faces.ts decides — this only reads). */
function exampleOf(tile: HomeTileModel): HomeFace['example'] | null {
  return tile.failed ? null : (tile.faces.find((f) => f.example)?.example ?? null);
}

function Dot({ mood, children, marker }: { mood: ServiceMood; children: ReactNode; marker?: string }) {
  return (
    <span className="sg-status hc-dotline" data-mood={mood} data-home-card-dot={marker ?? ''}>
      <GlanceDot mood={mood} />
      <span>{children}</span>
    </span>
  );
}

/** A read that failed: ONE red line and ⟳ Reload — nothing else of the card is drawn (never 0, never ₱0). */
function Failed({ words }: { words: string }) {
  return (
    <>
      <Dot mood="gone" marker="failed">
        <b className="font-medium">{words}</b>
      </Dot>
      <div className="sg-acts">
        <HomeReload />
      </div>
    </>
  );
}

function DetailCard({
  k,
  input,
  tile,
  hubPick = null,
  countKey = '',
}: {
  k: HomeControlKey;
  input: HomeControlInput;
  tile: HomeTileModel | null;
  hubPick?: HomeHubPickRead | null;
  /**
   * 🔢 The count-up's id suffix. Each `<Count id>` remembers the last value it showed and plays once per id
   * (components/count.tsx): the 1280 board draws these cards a second time while the tablet copy is hidden, so with
   * the same id the hidden copy used the animation up. The board's copies count under their own ids.
   */
  countKey?: string;
}) {
  if (!tile) return null;
  const e = input.eventId;
  const today = tile.today;
  switch (k) {
    case 'count': {
      const c = input.countdown;
      return (
        <Shell k="count" door={tile.door} brand={[c.long, c.placeLine].filter(Boolean).join(' · ') || null} today={today}>
          {c.hasDate ? (
            <>
              <Dot mood="ok">Date set{c.placeLine ? ` · ${c.placeLine}` : ''}</Dot>
              <span className="sg-status" data-glance-status="">
                <span>
                  <b>{c.days !== null ? <Count value={c.days} id={`home-count${countKey}`} /> : c.value}</b> {c.label}
                </span>
              </span>
            </>
          ) : (
            <>
              <Dot mood="wait">No date yet</Dot>
              <div className="sg-acts">
                <ActionButton tone="brand" main={today} icon={<CalendarDays aria-hidden="true" strokeWidth={1.9} />} label="Set your date" href={tile.faces[0]?.action?.href ?? tile.door} />
              </div>
            </>
          )}
        </Shell>
      );
    }
    case 'guests': {
      const g = input.guests;
      if (g === null) return null;
      if (g === 'unread') {
        return (
          <Shell k="guests" door={`/dashboard/${e}/guests`} today={today} failed>
            <Failed words="Guest counts couldn’t load · not zero, unread" />
          </Shell>
        );
      }
      const invite = input.next.kind === 'invite' && g.toInvite > 0;
      const seats = tile.faces.find((f) => f.id === 'guests-unseated' || f.id === 'guests-seats-unread');
      return (
        <Shell example={exampleOf(tile)} k="guests" door={`/dashboard/${e}/guests`} brand={`${formatCount(g.total)} on the list`} today={today}>
          <Dot mood={g.total === 0 || g.toInvite > 0 ? 'wait' : 'ok'}>
            {g.total === 0
              ? 'Your guest list is empty'
              : g.toInvite > 0
                ? `${formatCount(g.toInvite)} ${g.toInvite === 1 ? 'guest has' : 'guests have'} no invitation yet`
                : 'Everyone has an invitation'}
          </Dot>
          {g.total > 0 ? (
            <span className="sg-status hc-figs" data-glance-status="" data-tour="home-faces">
              {/* The faces, side by side — each opens the exact list it counts. */}
              <Link href={`/dashboard/${e}/guests?q=coming`} className="hc-fig sn-hit">
                {/* 🕯 Reply arrives (motion standard § 9 ④) — new "coming" replies since the last look; once per visit. */}
                <b><ReplyArrives eventId={`${e}${countKey}`} coming={g.coming}><Count value={g.coming} id={`home-guests-coming${countKey}`} /></ReplyArrives></b> coming
              </Link>
              <span aria-hidden className="hc-sep">·</span>
              <Link href={`/dashboard/${e}/guests?q=no+reply`} className="hc-fig sn-hit">
                <b><Count value={g.noReply} id={`home-guests-noreply${countKey}`} /></b> no reply
              </Link>
              <span aria-hidden className="hc-sep">·</span>
              <Link href={`/dashboard/${e}/guests?q=declined`} className="hc-fig sn-hit">
                <b><Count value={g.declined} id={`home-guests-declined${countKey}`} /></b> can’t come
              </Link>
              {/* 🪑 Seats (R4 → Guests › Seats) — the phone tile's own face, so both draw one fact. */}
              {seats ? (
                <>
                  <span aria-hidden className="hc-sep">·</span>
                  <Link href={seats.href} className="hc-fig sn-hit" data-home-fig={seats.id}>
                    <b>{seats.big}</b> {seats.id === 'guests-seats-unread' ? 'seats · couldn’t load' : seats.unit}
                  </Link>
                </>
              ) : null}
            </span>
          ) : null}
          {invite || g.total === 0 ? (
            <div className="sg-acts">
              {g.total === 0 ? (
                <ActionButton tone="brand" main icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Add guests" href={`/dashboard/${e}/guests`} />
              ) : (
                <>
                  <ActionButton tone="info" main icon={<Mail aria-hidden="true" strokeWidth={1.9} />} label="Send the invitations" href={`/dashboard/${e}/guests/send`} />
                  <HomeLater />
                </>
              )}
            </div>
          ) : null}
        </Shell>
      );
    }
    case 'hub': {
      const h = input.hub;
      if (h === null) return null;
      if (h === 'unread') {
        return (
          <Shell k="hub" door={`/dashboard/${e}/launch`} today={today} failed>
            <Failed words="Your Event Hub couldn’t load · unread, not private" />
          </Shell>
        );
      }
      const after = nextHubStage(h.stage);
      const at = h.stage ? PUBLIC_STAGE_ORDER.indexOf(h.stage) : -1;
      const fill = after && h.guide && h.guide.stageTitle === PUBLIC_STAGE_LABELS[after] && h.guide.left > 0 ? `${formatCount(h.guide.left)} parts to fill` : null;
      return (
        <Shell example={exampleOf(tile)} k="hub" door={h.publicUrl ?? `/dashboard/${e}/launch`} external={Boolean(h.publicUrl)} brand={h.where} today={today}>
          <Dot mood={h.stage && h.publicUrl ? 'ok' : 'plain'} marker="stage">
            {h.stage ? (
              <>
                <b className="font-medium">{PUBLIC_STAGE_LABELS[h.stage]} is live</b> · {h.publicUrl ? 'guests see it now' : 'not shared yet'}
              </>
            ) : (
              'No page is live yet · pick your date to place it'
            )}
          </Dot>
          {h.guide && input.next.kind === 'guide' ? (
            <Dot mood="wait" marker="setup">
              {formatCount(h.guide.done)} of {formatCount(h.guide.total)} parts set up
            </Dot>
          ) : null}
          {after ? (
            <span className="sg-status" data-glance-status="">
              <span>
                Next · <b>{PUBLIC_STAGE_LABELS[after]}</b>
                {[fill, after === 'event' ? h.dayShort : null].filter(Boolean).map((w) => ` · ${w}`).join('')}
              </span>
            </span>
          ) : null}
          {h.stage ? (
            <span className="hc-rail" aria-hidden>
              {PUBLIC_STAGE_ORDER.map((s, i) => (
                <span key={s} className={i < at ? 'done' : i === at ? 'live' : ''} />
              ))}
            </span>
          ) : null}
          {h.stage ? (
            <span className="hc-railw" aria-hidden>
              {PUBLIC_STAGE_ORDER.map((s, i) => (
                <span key={s} className={i === at ? 'live' : ''}>
                  {PUBLIC_STAGE_LABELS[s]}
                </span>
              ))}
            </span>
          ) : null}
          <div className="sg-acts">
            <ActionButton tone="brand" main icon={<PenLine aria-hidden="true" strokeWidth={1.9} />} label="Edit in Maker" href={tile.side?.find((a) => a.icon === 'pen')?.href ?? `/dashboard/${e}/launch`} />
            {/* 🎛 The tile's "Pick what shows", with its word (owner 2026-10-24) — the same sheet in place. */}
            <HubPickButton eventId={e} look="button" preset={hubPick} />
            {h.publicUrl ? (
              <HubViewLink url={h.publicUrl} className="ab ab-neutral" label="View Event Hub" marker="card-button">
                <Eye aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
                <span className="lbl">View Event Hub</span>
              </HubViewLink>
            ) : null}
          </div>
        </Shell>
      );
    }
    case 'sup': {
      const s = input.suppliers;
      if (s === null) return null;
      if (s === 'unread') {
        return (
          <Shell k="sup" door={`/dashboard/${e}/vendors`} today={today} failed>
            <Failed words="Suppliers couldn’t load · not zero, unread" />
          </Shell>
        );
      }
      const first = s.toDecide[0];
      const decide = tile.faces.find((f) => f.id === 'sup-decide');
      const board = tile.faces.find((f) => f.id === 'sup-inspiration' || f.id === 'sup-inspiration-unread');
      return (
        <Shell example={exampleOf(tile)} k="sup" door={`/dashboard/${e}/vendors`} brand={`${formatCount(s.booked)} of ${formatCount(s.of)} booked`} today={today}>
          <Dot mood={first ? 'wait' : s.booked >= s.of ? 'ok' : 'plain'}>
            {first
              ? `${formatCount(s.toDecide.length)} ${s.toDecide.length === 1 ? 'quote' : 'quotes'} to decide · ${first.name}`
              : s.of > s.booked
                ? `${formatCount(s.of - s.booked)} still to book`
                : 'Everything is booked'}
          </Dot>
          {s.replied > 0 ? (
            <span className="sg-status" data-glance-status="">
              <Link href={`/dashboard/${e}/vendors?tab=shortlist`} className="hc-fig sn-hit">
                <b>{formatCount(s.replied)}</b> replied · waiting on you
              </Link>
            </span>
          ) : null}
          {/* 💡 The inspiration board (R5 → Suppliers › Find) — the phone tile's own face. */}
          {board ? (
            <span className="sg-status" data-glance-status="">
              <Link href={board.href} className="hc-fig sn-hit" data-home-fig={board.id}>
                <b>{board.big}</b> {board.unit} · {board.sm}
              </Link>
            </span>
          ) : null}
          {decide ? (
            <div className="sg-acts">
              <ActionButton tone="neutral" icon={<Check aria-hidden="true" strokeWidth={1.9} />} label="Decide the quote" href={decide.href} />
            </div>
          ) : null}
        </Shell>
      );
    }
    case 'budget': {
      const b = input.budget;
      if (b === null) return null;
      if (b === 'unread') {
        return (
          <Shell k="budget" door={budgetPageHref(e)} today={today} failed>
            <Failed words="Money couldn’t load · paid and owing are unread, not zero" />
          </Shell>
        );
      }
      const agreed = b.paidPhp + b.owingPhp;
      const pct = agreed > 0 ? Math.round((b.paidPhp / agreed) * 100) : null;
      // 🔁 NOW NEVER REPEATS BELOW, here too (Event Today drawing v3, part C · 3): the payment the card's strip holds and
      // every payment Today's list shows as a red row leave this card's list — the same rule as its tile (`budgetTile`).
      const held = new Set(paysHeldByToday(b.pays, homeControlTiles(input).today.holds?.pay));
      const pays = b.pays === 'unread' ? null : paymentsToSettle(b.pays).filter((p) => !held.has(p.id));
      const listed = pays ? (pays.length > BUDGET_MAX_PAY_FACES ? pays.slice(0, BUDGET_MAX_PAY_FACES - 1) : pays) : [];
      const suppliers = pays ? new Set(pays.map((p) => p.vendorId ?? p.who)).size : 0;
      const payFace = (id: string) => tile.faces.find((f) => f.id === `pay-${id}`);
      return (
        <Shell
          k="budget"
          door={budgetPageHref(e)}
          example={exampleOf(tile)}
          brand={
            pays === null
              ? 'Payments couldn’t load'
              : pays.length > 0
                ? `${formatCount(pays.length)} ${pays.length === 1 ? 'payment' : 'payments'} to settle · ${formatCount(suppliers)} ${suppliers === 1 ? 'supplier' : 'suppliers'}`
                : 'Nothing to settle'
          }
          today={today}
        >
          {listed.length > 0 ? (
            <div className="hc-pays">
              {listed.map((p) => {
                const late = p.state === 'overdue' || (p.days !== null && p.days < 0);
                const href = payFace(p.id)?.action?.href ?? budgetPageHref(e);
                return (
                  <div key={p.id} className={`hc-pay${late ? ' hc-late' : ''}`} data-home-pay={p.id}>
                    {/* 🌐 The website's plan row (Part H): who and their line on the left, the amount right, then Pay. */}
                    <span className="min-w-0 flex-1">
                      <b className="block">{p.who}</b>
                      <span className="hc-pay-s">
                        {p.what} <span className="hc-due">· {dueWords(p, true)}</span>
                      </span>
                    </span>
                    <b className="hc-pay-amt">
                      <Count value={p.owedPhp} format="peso" id={`home-pay-${p.id}${countKey}`} />
                    </b>
                    <ActionButton tone={late ? 'brand' : 'ok'} main={late} icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />} label="Pay" name={`Pay ${formatPhpRounded(p.owedPhp)} to ${p.who}`} href={href} />
                  </div>
                );
              })}
              {pays && pays.length > listed.length ? (
                <Link href={budgetPageHref(e)} className="hc-pay hc-more">
                  +{formatCount(pays.length - listed.length)} more to settle
                </Link>
              ) : null}
            </div>
          ) : null}
          {/* 🌐 Paid · still owing · the share paid, as the section's ONE fine line (the v5 drawing) — the same readers. */}
          <span className="sg-status hc-money-line" data-home-money="">
            <span>
              Paid <Count value={b.paidPhp} format="peso" id={`home-paid${countKey}`} /> · still owing <Count value={b.owingPhp} format="peso" id={`home-owing${countKey}`} />
              {' · '}
              {pct !== null ? (
                <>
                  <Count value={pct} format="pct" id={`home-paid-pct${countKey}`} /> paid of {formatPhpRounded(agreed)} agreed
                </>
              ) : (
                'Nothing agreed yet'
              )}
            </span>
          </span>
        </Shell>
      );
    }
    case 'plan': {
      const c = input.checklist;
      if (c === null) return null;
      if (c === 'unread') {
        return (
          <Shell k="plan" door={planningTodoHref(e)} today={today} failed>
            <Failed words="Your to do list couldn’t load · not zero, unread" />
          </Shell>
        );
      }
      const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : null;
      const calm = input.next.kind === 'plan';
      return (
        <Shell example={exampleOf(tile)} k="plan" door={planningTodoHref(e)} brand={pct !== null ? `To do · ${formatCount(pct)}% done` : 'To do'} today={today}>
          <Dot mood={calm || c.open === 0 ? 'ok' : 'wait'}>
            {c.open === 0
              ? 'Everything is done'
              : calm
                ? `On track · ${formatCount(c.open)} ${c.open === 1 ? 'task' : 'tasks'} ahead`
                : `${formatCount(c.open)} open${c.dueThisWeek > 0 ? ` · ${formatCount(c.dueThisWeek)} due this week` : ''}`}
          </Dot>
          {c.next.length > 0 ? (
            <ul className="hc-list">
              {c.next.map((t) => (
                <li key={t.id} data-home-task={t.id}>
                  {/* Each task opens itself in Planning Stage's To do filter (`#task-<id>`). */}
                  <Link href={planningTodoHref(e, t.id)} className="hc-li">
                    <span className="hc-tick" aria-hidden />
                    <span className="hc-li-t">{t.title}</span>
                    {t.dueDate ? <span className={`hc-li-due${t.daysUntilDue !== null && t.daysUntilDue <= 7 ? ' soon' : ''}`}>{shortDay(t.dueDate)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Shell>
      );
    }
  }
}
