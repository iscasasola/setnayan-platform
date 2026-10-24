import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronRight, Eye, ListChecks, Mail, PenLine, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { GlanceDot, GlanceMeter } from '@/app/_components/service-glance';
import { EVENT_MENU_ICONS } from '@/lib/customer-menu';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { ServiceMood } from '@/lib/service-glance';
import {
  BUDGET_MAX_PAY_FACES,
  HOME_CONTROL_PAGE,
  dueWords,
  homeControlTiles,
  nextHubStage,
  paymentsToSettle,
  shortDay,
  type HomeControlInput,
  type HomeControlKey,
  type HomeTileModel,
} from './home-control-faces';
import { HomeTile, HubViewLink } from './home-tile';
import { HomeLater, HomeReload } from './home-parts';

/**
 * 🎛 HOME'S CONTROL ROW — the six upper widgets (owner-approved 2026-10-24, "ok": `home_control_center_2026-10-24_fable
 * .html`, corpus 10067d39). THE UPPER PARTS OPEN THEIR PAGE (owner: *"the upper parts are the ones that open to another
 * page. the lower parts are the ones that expand"*): a widget never grows; a tap opens its ONE page at the exact item.
 *
 *   COMPACT — below 768 px (owner: compact on the phone, no toggle): a 2-column grid of small tiles, like phone
 *             home-screen widgets — Countdown / Guests · Event Hub / Suppliers · Checklist / Budget — each one figure,
 *             one short line, at most one tiny action; the multi-face tiles rotate (`home-tile.tsx`).
 *   DETAIL  — from `md` up: the same widgets as cards (the shipped card's head · dot · status · acts, no grow) in two
 *             columns, read column by column: Countdown · Event Hub · Budget | Guests · Suppliers · Checklist.
 *
 * ONE DATA SHAPE (`home-control-faces.ts`), drawn twice; the same doors in both. Details live inside each card's ⓘ
 * (title + one short line visible). A failed read is ONE "Couldn't load" line with ⟳ Reload — never 0, never ₱0.
 */
export function HomeControlRow({ input }: { input: HomeControlInput }) {
  const { tiles } = homeControlTiles(input);
  let rotating = 0;
  return (
    <>
      <div className="hc-grid md:hidden" data-home-control="compact" data-tour="home-tiles">
        {tiles.map((t) => {
          const stagger = t.faces.length > 1 && !t.failed ? rotating++ : 0;
          return <HomeTile key={t.key} model={t} eventId={input.eventId} stagger={stagger} />;
        })}
      </div>
      <div className="hc-two hidden md:grid" data-home-control="detail">
        <div className="hc-col">
          {(['count', 'hub', 'budget'] as const).map((k) => (
            <DetailCard key={k} k={k} input={input} tile={tiles.find((t) => t.key === k) ?? null} />
          ))}
        </div>
        <div className="hc-col">
          {(['guests', 'sup', 'plan'] as const).map((k) => (
            <DetailCard key={k} k={k} input={input} tile={tiles.find((t) => t.key === k) ?? null} />
          ))}
        </div>
      </div>
    </>
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
  plan: 'Checklist',
};

/** What each card's ⓘ says — the detail lives here, not on the card (owner 2026-10-23: details go inside the ⓘ). */
const INFO: Record<HomeControlKey, string> = {
  count: 'Counts down to your date. This card is the one door to your date, place and time.',
  guests: 'Who said yes, who has not replied, who has no invitation yet — and the one thing to do about it.',
  hub: 'Which of the four pages your guests see now, and what comes next. Edit in Maker opens the Event Hub Maker; the card and View Event Hub open the page your guests see.',
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
  children,
}: {
  k: HomeControlKey;
  door: string;
  external?: boolean;
  brand?: string | null;
  today: boolean;
  failed?: boolean;
  children: ReactNode;
}) {
  const label = `Open ${HOME_CONTROL_PAGE[k]}`;
  return (
    <article className={`sg-row hc-card${failed ? ' hc-card-bad' : ''}`} data-home-card-key={k} data-mood={failed ? 'gone' : 'plain'}>
      {/* THE DOOR — the whole card is its ONE page; the buttons inside sit above it (never a link in a link). */}
      {external ? (
        <HubViewLink url={door} className="hc-card-door" label={label} marker="card">
          {null}
        </HubViewLink>
      ) : (
        <Link href={door} className="hc-card-door" aria-label={label} data-home-card-door={k} />
      )}
      <span className="sg-head">
        <span className="sg-mark" aria-hidden>
          {MARK[k]}
        </span>
        <span className="min-w-0">
          <span className="hc-card-name">
            <InfoTip label={NAME[k]} labelClassName="sg-name" align="start">
              {INFO[k]}
            </InfoTip>
            {today ? <span className="hc-chip hc-chip-inline">Today</span> : null}
          </span>
          {brand ? <span className="sg-brand block truncate">{brand}</span> : null}
        </span>
        <ChevronRight aria-hidden className="sg-arrow h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
      {children}
    </article>
  );
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
      <div className="sg-acts hc-above">
        <HomeReload />
      </div>
    </>
  );
}

function DetailCard({ k, input, tile }: { k: HomeControlKey; input: HomeControlInput; tile: HomeTileModel | null }) {
  if (!tile) return null;
  const e = input.eventId;
  const today = tile.today;
  switch (k) {
    case 'count': {
      const c = input.countdown;
      return (
        <Shell k="count" door={`/dashboard/${e}/details`} brand={[c.long, c.placeLine].filter(Boolean).join(' · ') || null} today={today}>
          {c.hasDate ? (
            <>
              <Dot mood="ok">Date set{c.placeLine ? ` · ${c.placeLine}` : ''}</Dot>
              <span className="sg-status" data-glance-status="">
                <span>
                  <b>{c.value}</b> {c.label}
                </span>
              </span>
            </>
          ) : (
            <>
              <Dot mood="wait">No date yet</Dot>
              <div className="sg-acts hc-above">
                <ActionButton tone="brand" main={today} icon={<CalendarDays aria-hidden="true" strokeWidth={1.9} />} label="Set your date" href={`/dashboard/${e}/date-selection`} />
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
      return (
        <Shell k="guests" door={`/dashboard/${e}/guests`} brand={`${formatCount(g.total)} on the list`} today={today}>
          <Dot mood={g.total === 0 || g.toInvite > 0 ? 'wait' : 'ok'}>
            {g.total === 0
              ? 'Your guest list is empty'
              : g.toInvite > 0
                ? `${formatCount(g.toInvite)} ${g.toInvite === 1 ? 'guest has' : 'guests have'} no invitation yet`
                : 'Everyone has an invitation'}
          </Dot>
          {g.total > 0 ? (
            <span className="sg-status hc-figs" data-glance-status="">
              {/* The faces, side by side — each opens the exact list it counts. */}
              <Link href={`/dashboard/${e}/guests?q=coming`} className="hc-fig">
                <b>{formatCount(g.coming)}</b> coming
              </Link>
              <span aria-hidden className="hc-sep">·</span>
              <Link href={`/dashboard/${e}/guests?q=no+reply`} className="hc-fig">
                <b>{formatCount(g.noReply)}</b> no reply
              </Link>
              <span aria-hidden className="hc-sep">·</span>
              <Link href={`/dashboard/${e}/guests?q=declined`} className="hc-fig">
                <b>{formatCount(g.declined)}</b> can’t come
              </Link>
            </span>
          ) : null}
          {invite || g.total === 0 ? (
            <div className="sg-acts hc-above">
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
        <Shell k="hub" door={h.publicUrl ?? `/dashboard/${e}/launch`} external={Boolean(h.publicUrl)} brand={h.where} today={today}>
          <Dot mood={h.stage && h.publicUrl ? 'ok' : 'plain'} marker="stage">
            {h.stage ? (
              <>
                <b className="font-medium">{PUBLIC_STAGE_LABELS[h.stage]} is live</b> · {h.publicUrl ? 'guests see it now' : 'not shared yet'}
              </>
            ) : (
              'No page is live yet · pick your date to place it'
            )}
          </Dot>
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
          <div className="sg-acts hc-above">
            <ActionButton tone="brand" main icon={<PenLine aria-hidden="true" strokeWidth={1.9} />} label="Edit in Maker" href={`/dashboard/${e}/launch`} />
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
      return (
        <Shell k="sup" door={`/dashboard/${e}/vendors`} brand={`${formatCount(s.booked)} of ${formatCount(s.of)} booked`} today={today}>
          <Dot mood={first ? 'wait' : s.booked >= s.of ? 'ok' : 'plain'}>
            {first
              ? `${formatCount(s.toDecide.length)} ${s.toDecide.length === 1 ? 'quote' : 'quotes'} to decide · ${first.name}`
              : s.of > s.booked
                ? `${formatCount(s.of - s.booked)} still to book`
                : 'Everything is booked'}
          </Dot>
          {s.replied > 0 ? (
            <span className="sg-status" data-glance-status="">
              <Link href={`/dashboard/${e}/vendors?tab=shortlist`} className="hc-fig hc-above">
                <b>{formatCount(s.replied)}</b> replied · waiting on you
              </Link>
            </span>
          ) : null}
          {decide ? (
            <div className="sg-acts hc-above">
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
          <Shell k="budget" door={`/dashboard/${e}/vendors?part=budget`} today={today} failed>
            <Failed words="Money couldn’t load · paid and owing are unread, not zero" />
          </Shell>
        );
      }
      const agreed = b.paidPhp + b.owingPhp;
      const pct = agreed > 0 ? Math.round((b.paidPhp / agreed) * 100) : null;
      const pays = b.pays === 'unread' ? null : paymentsToSettle(b.pays);
      const listed = pays ? (pays.length > BUDGET_MAX_PAY_FACES ? pays.slice(0, BUDGET_MAX_PAY_FACES - 1) : pays) : [];
      const suppliers = pays ? new Set(pays.map((p) => p.vendorId ?? p.who)).size : 0;
      const payFace = (id: string) => tile.faces.find((f) => f.id === `pay-${id}`);
      return (
        <Shell
          k="budget"
          door={`/dashboard/${e}/vendors?part=budget`}
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
            <div className="hc-pays hc-above">
              {listed.map((p) => {
                const late = p.state === 'overdue' || (p.days !== null && p.days < 0);
                const href = payFace(p.id)?.action?.href ?? `/dashboard/${e}/vendors?part=budget`;
                return (
                  <div key={p.id} className={`hc-pay${late ? ' hc-late' : ''}`} data-home-pay={p.id}>
                    <span className="min-w-0 flex-1">
                      <b className="block">
                        {formatPhp(p.owedPhp)} <span className="hc-due">· {dueWords(p, true)}</span>
                      </b>
                      <span className="hc-pay-s">
                        {p.who} · {p.what}
                      </span>
                    </span>
                    <ActionButton tone={late ? 'brand' : 'ok'} main={late} icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />} label="Pay" name={`Pay ${formatPhp(p.owedPhp)} to ${p.who}`} href={href} />
                  </div>
                );
              })}
              {pays && pays.length > listed.length ? (
                <Link href={`/dashboard/${e}/vendors?part=budget`} className="hc-pay hc-more">
                  +{formatCount(pays.length - listed.length)} more to settle
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="home-money mt-2">
            <div>
              <div className="home-k">Paid</div>
              <div className="home-v">{formatPhp(b.paidPhp)}</div>
            </div>
            <div className="text-right">
              <div className="home-k">Still owing</div>
              <div className="home-v">{formatPhp(b.owingPhp)}</div>
            </div>
          </div>
          {pct !== null ? <GlanceMeter mood="ok" pct={pct} label="Paid" /> : null}
          <Dot mood="ok">
            {pct !== null ? (
              <>
                <b className="font-medium">{formatCount(pct)}% paid</b> · of {formatPhp(agreed)} agreed
              </>
            ) : (
              'Nothing agreed yet'
            )}
          </Dot>
        </Shell>
      );
    }
    case 'plan': {
      const c = input.checklist;
      if (c === null) return null;
      if (c === 'unread') {
        return (
          <Shell k="plan" door={`/dashboard/${e}/checklist`} today={today} failed>
            <Failed words="Your checklist couldn’t load · not zero, unread" />
          </Shell>
        );
      }
      const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : null;
      const calm = input.next.kind === 'plan';
      return (
        <Shell k="plan" door={`/dashboard/${e}/checklist`} brand={pct !== null ? `Your checklist · ${formatCount(pct)}% done` : 'Your checklist'} today={today}>
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
                <li key={t.id} className="hc-li" data-home-task={t.id}>
                  <span className="hc-tick" aria-hidden />
                  <span className="hc-li-t">{t.title}</span>
                  {t.dueDate ? <span className={`hc-li-due${t.daysUntilDue !== null && t.daysUntilDue <= 7 ? ' soon' : ''}`}>{shortDay(t.dueDate)}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Shell>
      );
    }
  }
}
