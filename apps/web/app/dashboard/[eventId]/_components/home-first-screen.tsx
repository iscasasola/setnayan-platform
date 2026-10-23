import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Camera, CalendarDays, Check, ChevronDown, Clapperboard, Gem, ListChecks, Mail, Music, Plus, QrCode, Radio, Sparkles, UserPlus, type LucideIcon } from 'lucide-react';
import { NextCard } from '@/app/_components/next-card';
import { PapicHomeWidget } from './papic-home-widget';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import { dayPapicView, type DayPapicFace, type HomeNext, type HomeNextKind, type HomeService, type HomeServiceKey, type PaidRow, type PapicRowDoors } from '@/lib/home-first-screen';
import type { HomeFigures } from '@/lib/home-facts';
import type { HomeCover } from '@/lib/home-cover';
import type { HomeCoverWords } from '@/lib/home-cover-words';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { completeTour } from '@/lib/tour-actions';
import { HUB_SETUP_OFFER_TOUR } from '@/lib/tours';
import { HomeDoorways, HomeLater, HomeReload, HomeWhatsNext } from './home-parts';
import { HomeCoverBand } from './home-cover-band';
import { PapicBuySheet } from '../studio/papic/_components/papic-buy-sheet';
import { IapPapicSheet } from '@/app/_components/iap/iap-papic-sheet';
import { IapLiveWatchSheet } from '@/app/_components/iap/iap-live-watch-sheet';
import { SERVICE_NAMES } from '@/lib/service-names';
import { PapicSeePhotos } from '../studio/papic/_components/papic-see-photos';
import { ServiceGlanceRow } from '@/app/_components/service-glance';
import { seePhotosWord } from '@/lib/papic-glance';
import type { PoolRung } from '@/lib/papic-pool-rungs';
import { SWITCH_ON_LABEL, type SwitchOnNeed } from '@/lib/event-needs';
import { switchOnNeed } from '../switch-on-actions';

/**
 * Where each Next card goes. Written as `href:` literals ON PURPOSE: the
 * port-controls scan (`scripts/port-controls.mjs` HREF_RE) only sees an
 * `href`/`href:` followed by a literal, so a `switch` returning strings made
 * the guided flow's door read as "lost".
 */
function nextHref(kind: HomeNextKind, eventId: string): string {
  const doors: ReadonlyArray<{ kind: HomeNextKind; href: string }> = [
    { kind: 'guide', href: `/dashboard/${eventId}/launch?tool=details&guide=1` },
    { kind: 'date', href: `/dashboard/${eventId}/date-selection` },
    { kind: 'unread', href: `/dashboard/${eventId}` },
    { kind: 'guests', href: `/dashboard/${eventId}/guests` },
    { kind: 'invite', href: `/dashboard/${eventId}/guests/send` },
    { kind: 'papic', href: `/dashboard/${eventId}/studio/papic` },
    { kind: 'ai', href: `/dashboard/${eventId}/studio/setnayan-ai` },
    { kind: 'plan', href: `/dashboard/${eventId}/checklist` },
  ];
  return doors.find((d) => d.kind === kind)?.href ?? `/dashboard/${eventId}/checklist`;
}

/** Where each service in the "Your services" row goes — `href:` literals, for the same scan. */
function serviceHref(key: HomeServiceKey, eventId: string): string {
  const doors: ReadonlyArray<{ key: HomeServiceKey; href: string }> = [
    { key: 'papic', href: `/dashboard/${eventId}/studio/papic` },
    { key: 'ai', href: `/dashboard/${eventId}/studio/setnayan-ai` },
    { key: 'nikah', href: `/dashboard/${eventId}/nikah` },
  ];
  return doors.find((d) => d.key === key)?.href ?? `/dashboard/${eventId}`;
}

/**
 * 📱 THE HOME'S FIRST SCREEN — owner-APPROVED 2026-10-01 ("THE SIMPLE PHONE APP
 * — APPROVED", frame 1 "Home"). A server component, and deliberately nothing
 * else: every figure arrives already read and already worded
 * (`lib/home-first-screen.ts`), so this file adds no client weight and no read.
 *
 *   ONE Next card (one button) → the Event Hub door (always) → days to go ·
 *   coming · no reply → Paid / Still owing → Your services (Papic · Setnayan
 *   AI, owner 2026-10-01; a Muslim wedding adds its Nikah essentials line); the one
 *   "What's next" row (a sheet: decisions, then Coming up) sits above the services.
 *
 * 🔒 THIS IS THE WHOLE HOME (owner 2026-10-02, DECISION_LOG "HOME IS THE FIRST
 * SCREEN ONLY"): there is no "rest of Home" under it, no "See all" and no
 * second, wider section. Phone and desktop draw the same single column; from
 * `lg` up it is simply wider (`lg:max-w-3xl`).
 *
 * ⚠ `money === null` means the viewer may not see the budget (a delegate
 * without budget access): the line is ABSENT, not "—". A money read that
 * failed arrives as the string "—" and is drawn.
 */
/**
 * 🔘 Each Next kind's main button — icon + word, toned by meaning (BUTTON_RULE,
 * owner 2026-10-07): sending an invitation is messaging (info); the forward
 * steps are brand; the checklist is a confirm (ok); Reload is neutral.
 */
/*
  🛑 A SERVER COMPONENT HANDS `ActionButton` (a client component) AN ELEMENT, NEVER A
  COMPONENT. `icon={Info}` passes a function across the RSC boundary — "Functions cannot
  be passed directly to Client Components" — and the whole Home render fails (preview
  2026-10-07: the page fell back to its last-seen snapshot). Always `icon={<Info … />}`.
  Held by `home-hands-the-client-no-functions.test.ts`.
*/
const NEXT_BUTTON: Record<HomeNextKind, { icon: LucideIcon; tone: ActionTone }> = {
  guide: { icon: Sparkles, tone: 'brand' },
  date: { icon: CalendarDays, tone: 'brand' },
  unread: { icon: Check, tone: 'neutral' },
  guests: { icon: UserPlus, tone: 'brand' },
  invite: { icon: Mail, tone: 'info' },
  papic: { icon: Camera, tone: 'brand' },
  ai: { icon: Sparkles, tone: 'brand' },
  plan: { icon: ListChecks, tone: 'ok' },
};

/* The menu's own glyphs for each service (`lib/customer-menu.ts` EVENT_MENU_ICONS); ◆ Pro wears the gem. */
const SERVICE_ICON: Record<HomeServiceKey, LucideIcon> = {
  papic: Camera,
  ai: Sparkles,
  live: Radio,
  music: Music,
  booth: Clapperboard,
  hub: Gem,
  nikah: BookOpen,
};

/**
 * 📱 THE HOME'S FIRST SCREEN — owner-APPROVED 2026-10-01 ("THE SIMPLE PHONE APP
 * — APPROVED", frame 1 "Home"), REDRAWN 2026-10-07 to
 * `prototypes/home_and_guests_2026-10-07_fable.html?frame=1&page=home`
 * (`HOME_AND_GUESTS_CHECK_2026-10-07_fable.md` H1–H8, Maker PR 4e). The data,
 * the reads and the order are the ones that shipped; the skin and the controls
 * are the prototype's.
 *
 *   cover (ⓘ Event Details) → ONE Next card (its main verb + 📅 Later) → the
 *   three doorway buttons (Guest list · Suppliers · Event Hub, the bottom bar's
 *   own icons) → days to go · coming · no reply → Paid / Still owing + the paid
 *   meter (opens the budget in Suppliers) → What's next (unfolds in place) →
 *   Your services.
 *
 * 🔘 Every control is a button with icon + word (`ActionButton`); every number
 * counts (`Count`) and the meter grows (`Fill`) — on load and on change.
 * 🔴 A failed read never reads as success (H3): an unread guest list is said on
 * the Next card and on the numbers with ⟳ Reload; an unread money read is said
 * on the money tile (never hidden like "not shared", never ₱0).
 *
 * 🔒 THIS IS THE WHOLE HOME (owner 2026-10-02, DECISION_LOG "HOME IS THE FIRST
 * SCREEN ONLY"). Phone and desktop draw the same single column; from `lg` up it
 * is simply wider (`lg:max-w-3xl`).
 *
 * ⚠ `money === null` means the viewer may not see the budget (a delegate
 * without budget access): the tile is ABSENT. A money read that failed is SAID.
 */
export type HomeFirstScreenProps = {
  eventId: string;
  cover: HomeCoverWords;
  next: HomeNext;
  days: { value: string; label: string };
  coming: string;
  noReply: string;
  /** True when the no-reply figure is a measured number above zero. */
  noReplyWaiting: boolean;
  money: { paid: string; owing: string } | null;
  /** 🔢 The same facts as numbers, for `Count` / `Fill` (`homeFacts().figures`). */
  figures?: HomeFigures;
  /** Papic · Setnayan AI with their status — already filtered (store shell, the Next card). */
  services: HomeService[];
  /** 🖼 The Event Hub's main background under the name (`lib/home-cover.ts`); null = today's colour. */
  ground?: HomeCover | null;
  /** 🧭 The bottom bar's registry slots — the doorways read their tabs' icons from them (`getNavSlotMap`). */
  navSlots?: Record<string, NavSlotLite> | null;
  /** 📋 What's next — the decisions, unfolding in place (`EventDashboard only="whatsnext"`). */
  whatsNext?: ReactNode;
  /** 🎨 Papic's credits left, for the Buy more sheet's "You have N" and "After this". */
  papicLeft?: number | null;
  /** The credit ladder, ONLY when a dev lab already holds it — Home reads it on the tap. */
  papicSizes?: PoolRung[] | null;
  /** 📷 The Papic widget's slots (owner 2026-10-23) — the row then opens IN PLACE. Absent = the plain row. */
  papicWidget?: PapicWidgetSlots | null;
  /**
   * 🚪 WHAT THIS EVENT NEEDS (owner 2026-10-08, Level 1 — `lib/event-needs.ts`). Absent = every need on
   * (yesterday's Home, byte-identical). A need that is off is ABSENT, never greyed: no guest list → no
   * Guests door, no coming / no-reply tiles, and the One QR card in their place; no suppliers → no
   * Suppliers door, no money. `switchOn` = the needs that are off, for the ONE "Switch on more" row.
   */
  needs?: { guestList: boolean; suppliers: boolean; hubDetails: boolean; switchOn: SwitchOnNeed[] } | null;
  /**
   * 🍎 THE IPHONE APP SELLS THROUGH APPLE HERE (owner 2026-10-18; prototype
   * `in_app_purchase_screens_2026-10-17_fable.html` frames 2 · 11). Set ONLY
   * when the page's `getIapGate().iap` is true — the store shell, a StoreKit
   * build, the owner's switch. Then "Your services" carries Papic (Buy more →
   * Apple) and Live Watch (Activate → Apple, or "On" once owned, whichever side
   * paid). No row links to a controller the app still sends to /web-only.
   *
   * 🍎 Version 1.1 (`IAP_OPENED_ROUTE`, lib/store-shell.ts): the two control pages open in that app, so the Papic
   * row opens the Papic page (`open`) and an owned Live Watch carries its Go live door (`goLive`, the controller).
   * Absent / null = the row as #6637 shipped it.
   */
  apple?: {
    papic: { status: string; buy: boolean; open?: string | null } | null;
    liveWatch: { status: string; owned: boolean; askReady: boolean; goLive?: string | null } | null;
  } | null;
};

/** Only the three slots the doorways read cross to the client — not the whole registry. */
function doorSlots(all: Record<string, NavSlotLite> | null): Record<string, NavSlotLite> | null {
  if (!all) return null;
  const out: Record<string, NavSlotLite> = {};
  for (const k of ['guests', 'explore', 'launch']) {
    const slot = all[`customer.bottom-nav.${k}`];
    if (slot) out[`customer.bottom-nav.${k}`] = slot;
  }
  return out;
}

/** A number the Home counts, or its word ("—", "Today") when it is not a number. */
function Figure({ n, word, id }: { n: number | null | undefined; word: string; id: string }) {
  return typeof n === 'number' ? <Count value={n} id={id} /> : <>{word}</>;
}

export function HomeFirstScreen({
  eventId,
  cover,
  next,
  days,
  coming,
  noReply,
  noReplyWaiting,
  money,
  figures,
  services,
  ground = null,
  navSlots = null,
  whatsNext,
  papicLeft = null,
  papicSizes = null,
  papicWidget = null,
  needs = null,
  apple = null,
}: HomeFirstScreenProps) {
  const noList = needs?.guestList === false;
  const noSuppliers = needs?.suppliers === false;
  const doorsHidden = [...(noList ? ['guests'] : []), ...(noSuppliers ? ['explore'] : [])];
  const guestsUnread = figures ? figures.coming === null : coming === '—';
  const moneyUnread = figures ? figures.money === 'unread' : money !== null && money.paid === '—';
  const m = figures && figures.money && figures.money !== 'unread' ? figures.money : null;
  const paidPct = m && m.paid + m.owing > 0 ? Math.round((m.paid / (m.paid + m.owing)) * 100) : null;
  const nb = NEXT_BUTTON[next.kind];
  const nextMain =
    next.kind === 'unread' ? (
      <HomeReload main />
    ) : next.kind === 'papic' && (next.papicMoment === 'stopped' || next.papicMoment === 'low-today') ? (
      /* 🎨 The card's Buy more opens the same sheet as the row (owner 2026-10-14). */
      <PapicBuySheet eventId={eventId} left={papicLeft} tone="brand" main sizes={papicSizes} />
    ) : (
      <ActionButton tone={nb.tone} main icon={<nb.icon aria-hidden="true" strokeWidth={1.9} />} label={next.action} href={nextHref(next.kind, eventId)} tour="home-next" />
    );
  return (
    <section
      data-home-first-screen
      aria-label="Home"
      className="flex w-full flex-col gap-3"
    >
      {/* 📋 EVENT DETAILS sits beside the name, on the cover (owner 2026-10-01,
          "EVENT DETAILS LIVES ON EVENT HOME") — the one information-only sheet. */}
      {/* 🖼 …and it wears the Event Hub's main background (owner 2026-10-07, #6394), the
          words in the hub's own measured ink over its veil (`lib/home-cover.ts`). */}
      <HomeCoverBand eventId={eventId} cover={cover} ground={ground} />

      <div data-home-column className="mx-auto flex w-full max-w-xl flex-col gap-3 lg:max-w-3xl">

        {/* ① THE ONE NEXT CARD — the shared `NextCard`, drawn with the button rule's row:
            the main verb (+ 📅 Later). An unread guest list is SAID here, with ⟳ Reload (H3). */}
        <NextCard
          marker="data-home-next"
          kind={next.kind}
          title={next.title}
          body={next.body}
          action={next.action}
          href={nextHref(next.kind, eventId)}
          bad={next.kind === 'unread'}
          actions={
            <>
              {nextMain}
              {next.offer ? (
                /* 🧭 The once-offer's Later answers it — the shipped tour action, no new one. */
                <form action={completeTour.bind(null, HUB_SETUP_OFFER_TOUR)} className="contents">
                  <ActionButton type="submit" tone="neutral" icon={<CalendarDays aria-hidden="true" strokeWidth={1.9} />} label="Later" data-testid="home-next-later" />
                </form>
              ) : next.kind !== 'unread' ? (
                <HomeLater eventId={eventId} kind={next.kind} />
              ) : null}
            </>
          }
        />

        {/* ② THE THREE DOORS (owner 2026-10-07: "maybe add the 3 buttons") — the bottom bar's icons,
            named Guests · Suppliers · Event Hub (owner 2026-10-22, `HOME_DOOR_LABELS`). */}
        <HomeDoorways eventId={eventId} navSlots={doorSlots(navSlots)} hide={doorsHidden} />

        {/* 🚪 ONE QR FOR EVERYONE — where an event has no guest list, the QR IS the way in
            (owner 2026-10-08; prototype frame 2, its words). Opens the event's QR page. */}
        {noList ? (
          <Link href={`/dashboard/${eventId}/event-qr`} className="home-card flex items-center gap-3" data-home-one-qr="">
            <QrCode aria-hidden className="h-12 w-12 shrink-0 text-ink" strokeWidth={1.5} />
            <span className="min-w-0">
              <span className="block font-semibold">One QR for everyone</span>
              <span className="home-s block">Anyone with the link gets in. Share it, print it, stick it on the door.</span>
            </span>
          </Link>
        ) : null}

        {/* ③ THREE NUMBERS — counted (`Count`); "—" when unread, never 0. */}
        <div className="home-nums" data-home-numbers>
          <Link href={`/dashboard/${eventId}/details`} className={`home-tile${noList ? ' col-span-3' : ''}`} data-home-days="">
            <div className={`home-v${typeof figures?.days === 'number' || /^[\d,—]+$/.test(days.value) ? '' : ' home-v-word'}`}>
              <Figure n={figures?.days} word={days.value} id="home-days" />
            </div>
            <div className="home-k">{days.label}</div>
          </Link>
          {noList ? null : guestsUnread ? (
            <div className="home-tile home-tile-bad col-span-2" data-home-guests-unread="">
              <div className="text-[14.5px] font-semibold leading-snug" style={{ color: 'rgb(var(--color-danger))' }}>
                Guest counts couldn&rsquo;t load
              </div>
              <div className="home-s mb-1.5">Not zero — unread.</div>
              <HomeReload />
            </div>
          ) : (
            <>
              <Link href={`/dashboard/${eventId}/guests?q=coming`} className="home-tile" data-home-tile="coming">
                <div className="home-v">
                  <Figure n={figures?.coming} word={coming} id="home-coming" />
                </div>
                <div className="home-k">coming</div>
              </Link>
              <Link href={`/dashboard/${eventId}/guests?q=no+reply`} className="home-tile" data-home-tile="no-reply">
                {/* Plain ink, as the prototype draws it — the count speaks; no alarm colour. */}
                <div className="home-v" data-waiting={noReplyWaiting ? '' : undefined}>
                  <Figure n={figures?.noReply} word={noReply} id="home-noreply" />
                </div>
                <div className="home-k">no reply</div>
              </Link>
            </>
          )}
        </div>

        {/* ④ THE MONEY — opens the budget, which lives in Suppliers now (owner 2026-10-07, H6).
            Absent only when not shared; an unread read is SAID (H3). */}
        {money && !noSuppliers ? (
          moneyUnread ? (
            <div className="home-card home-card-bad" data-home-money="" data-money="">
              <div className="font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
                Money couldn&rsquo;t load
              </div>
              <div className="home-s mb-1.5">Paid and still owing are unread — not zero.</div>
              <HomeReload />
            </div>
          ) : (
            <Link
              href={`/dashboard/${eventId}/vendors?part=budget`}
              data-home-money
              /* 💾 Money is never kept as last-seen data (lib/last-seen). */
              data-money=""
              className="home-card block"
            >
              <div className="home-money">
                <div>
                  <div className="home-k">Paid</div>
                  <div className="home-v">{m ? <Count value={m.paid} format="peso" id="home-paid" /> : money.paid}</div>
                </div>
                <div className="text-right">
                  <div className="home-k">Still owing</div>
                  <div className="home-v">{m ? <Count value={m.owing} format="peso" id="home-owing" /> : money.owing}</div>
                </div>
              </div>
              <div className="home-meter">
                <Fill value={paidPct ?? 0} id="home-paid" />
              </div>
              <div className="home-s mt-1.5 text-[12.5px]">
                {paidPct !== null ? (
                  <>
                    <Count value={paidPct} format="pct" id="home-paid-pct" /> paid ·{' '}
                  </>
                ) : null}
                Budget ›
              </div>
            </Link>
          )
        ) : null}

        {/* ⑤ WHAT'S NEXT — the one row; it unfolds in place (H7), no sheet. */}
        {whatsNext ?? <HomeWhatsNext open={null} rows={[]} checklist={{ href: `/dashboard/${eventId}/checklist`, pct: null }} />}

        {/* ⑥ YOUR SERVICES — compact, one line each; never the one that is Next. */}
        <YourServices eventId={eventId} services={services} apple={apple} papicLeft={papicLeft} papicSizes={papicSizes} papicWidget={papicWidget} />

        {/* 🚪 SWITCH ON MORE — the ONE row that keeps what this event left off (owner 2026-10-08:
            "the rest stays off but can be switched on later from Home's quick setup"). It unfolds in
            place; each switch writes its need and lands on the shipped setup for it. */}
        {needs && needs.switchOn.length > 0 ? (
          <details className="home-card group" data-home-switch-on="">
            <summary className="flex cursor-pointer list-none items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Switch on more</span>
                <span className="home-s block">{needs.switchOn.map((k) => SWITCH_ON_LABEL[k]).join(' · ')}</span>
              </span>
              <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-ink/50 transition-transform group-open:rotate-180" strokeWidth={1.9} />
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {needs.switchOn.map((k) => (
                <form key={k} action={switchOnNeed.bind(null, eventId, k)} className="contents">
                  <ActionButton
                    type="submit"
                    tone="neutral"
                    icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
                    label={SWITCH_ON_LABEL[k]}
                    data-testid={`home-switch-on-${k}`}
                  />
                </form>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}


/**
 * ⑥ YOUR SERVICES — compact, one line each; never the one that is Next. Its own component since More
 * left the event bar (owner 22 Oct 2026, "Yes remove more"): the services live HERE, so Home draws this
 * list in every phase — the first screen, the event-day console and after the day — never a second copy.
 * `id="your-services"` is the address a "your services" door scrolls to.
 */
export function YourServices({
  eventId,
  services,
  apple = null,
  papicLeft,
  papicSizes = null,
  papicWidget = null,
}: {
  eventId: string;
  services: HomeService[];
  apple?: HomeFirstScreenProps['apple'];
  papicLeft: number | null;
  papicSizes?: PoolRung[] | null;
  /** 📷 Papic's row opens in place on Home (owner 2026-10-23). */
  papicWidget?: PapicWidgetSlots | null;
}) {
  if (!(services.length > 0 || apple?.papic || apple?.liveWatch)) return null;
  return (
    <nav aria-label="Your services" id="your-services" data-home-services className="flex flex-col">
      <p className="home-k2 !mt-1">Your services</p>
      <div className="home-svc">
        {apple?.papic ? (
          <AppleServiceRow
            marker="papic"
            name={SERVICE_NAMES.papic.plain}
            brand={SERVICE_NAMES.papic.brand}
            icon={<Camera aria-hidden strokeWidth={1.9} />}
            status={apple.papic.status}
            href={apple.papic.open ?? null}
            action={apple.papic.buy ? <IapPapicSheet eventId={eventId} left={papicLeft} /> : null}
          />
        ) : null}
        {apple?.liveWatch ? (
          <AppleServiceRow
            marker="live-watch"
            name={SERVICE_NAMES['live-studio'].plain}
            brand={SERVICE_NAMES['live-studio'].brand}
            icon={<Radio aria-hidden strokeWidth={1.9} />}
            status={apple.liveWatch.status}
            action={
              apple.liveWatch.owned ? (
                apple.liveWatch.goLive ? (
                  <ActionButton tone="neutral" icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />} label="Go live" href={apple.liveWatch.goLive} />
                ) : null
              ) : (
                <IapLiveWatchSheet eventId={eventId} askReady={apple.liveWatch.askReady} />
              )
            }
          />
        ) : null}
        {services.map((svc, i) => {
          const Icon = SERVICE_ICON[svc.key];
          if (svc.key === 'papic' && svc.papic) {
            return <PapicServiceRow key={svc.key} eventId={eventId} svc={svc} doors={svc.papic} left={papicLeft} sizes={papicSizes} widget={papicWidget} />;
          }
          if (svc.paid) {
            /* 🧾 "Not added" heads the slim lines once (prototype: owned rows, then Not added). */
            const firstSlim = svc.paid.state === 'add' && services[i - 1]?.paid?.state !== 'add';
            return (
              <PaidServiceRow
                key={svc.key}
                svc={svc}
                row={svc.paid}
                glyph={Icon}
                heading={firstSlim}
              />
            );
          }
          return (
            <Link key={svc.key} href={serviceHref(svc.key, eventId)} data-home-service={svc.key} className="home-tile">
              <span className="home-t">
                <Icon aria-hidden strokeWidth={1.9} />
                <span className="truncate">{svc.name}</span>
              </span>
              {/* The Setnayan name, small under the plain one (owner d17). */}
              {svc.brand ? <span className="block truncate text-[11px] text-ink/50">{svc.brand}</span> : null}
              <span className="block truncate text-[12.5px] text-ink/60">{svc.status}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * 🎨 PAPIC'S ROW — the service glance at Home size (owner "approve all",
 * 2026-10-14; prototype `renderHome()`): name · the status line with its dot ·
 * the meter · Buy more (the sheet) · See N photos (opens the event's Memories tab, 2026-10-23).
 * The row's words and its "Buy more" are already trimmed by NEVER TWICE when
 * Papic holds the Next card — and only while that card is on screen (`papicRowDoubled`,
 * `[data-while-next]`): a "Later" brings the row's own Buy more straight back (walk-b6 F1).
 */
/**
 * 📷 THE PAPIC WIDGET'S SLOTS (owner 2026-10-23) — what Home hands the row so it opens IN PLACE: the one coverage
 * line, the latest-five strip, and the expanded camera settings (null for a viewer who may not change them).
 */
export type PapicWidgetSlots = { coverage: string | null; strip: ReactNode; settings: ReactNode };

function PapicServiceRow({
  eventId,
  svc,
  doors,
  left,
  sizes,
  widget = null,
}: {
  eventId: string;
  svc: HomeService;
  doors: PapicRowDoors;
  left: number | null;
  sizes: PoolRung[] | null;
  widget?: PapicWidgetSlots | null;
}) {
  const photos = typeof doors.glance.result === 'number' && doors.glance.result > 0 ? doors.glance.result : null;
  const acts =
    doors.buy || photos ? (
      <>
        {doors.buy ? (
          doors.whileNext?.buy ? (
            /* NEVER TWICE, only while the card that offers it is on screen (walk-b6 F1). */
            <span data-while-next="" className="contents">
              <PapicBuySheet eventId={eventId} left={left} tone="brand" sizes={sizes} />
            </span>
          ) : (
            <PapicBuySheet eventId={eventId} left={left} tone="brand" sizes={sizes} />
          )
        ) : null}
        {/* The photos live on the event bar's Memories tab now (owner 2026-10-23) — the door opens it. */}
        {photos ? <PapicSeePhotos tone="neutral" label={seePhotosWord(photos)} href={`/dashboard/${eventId}/memories`} /> : null}
      </>
    ) : null;
  const row = (
    <ServiceGlanceRow
      href={`/dashboard/${eventId}/studio/papic`}
      name={svc.name}
      brand={svc.brand}
      icon={<Camera aria-hidden strokeWidth={1.9} />}
      mood={doors.glance.mood}
      pct={doors.glance.pct}
      line={doors.whileNext?.tail ? { ...doors.line, tailWhileNext: true } : doors.line}
      meterLabel="Credits left"
      actions={acts}
      marker={{ 'data-home-service': 'papic' }}
      toggle={Boolean(widget?.settings)}
    />
  );
  /* 📷 THE WIDGET (owner 2026-10-23): the same row, the coverage line and the latest five — a tap grows the card in
     place into the camera settings. */
  return widget ? <PapicHomeWidget row={row} coverage={widget.coverage} strip={widget.strip} settings={widget.settings} /> : row;
}

/**
 * 📷 PAPIC ON THE EVENT DAY (owner 22 Oct 2026, "Fix both") — Home › Your services' OWN Papic row on
 * the event-day console, beside the Live photo wall card. Not a new card: the face is picked by
 * `dayPapicFace` (lib/home-first-screen.ts) and the row is `PapicServiceRow` / the same plain door
 * Your services draws. In the store shell `homeServices` builds no Papic entry, so this draws nothing
 * there — exactly as Your services (the iPhone app shows no paid row, App Review 3.1.1).
 */
export function DayPapicRow({
  eventId,
  face,
  svc,
  left,
  sizes = null,
  widget = null,
}: {
  eventId: string;
  face: DayPapicFace;
  svc: HomeService | undefined;
  left: number | null;
  sizes?: PoolRung[] | null;
  /** 📷 On the day the same widget opens in place (owner 2026-10-23). */
  widget?: PapicWidgetSlots | null;
}) {
  const view = dayPapicView(face, svc, eventId);
  if (view.kind === 'hidden' || !svc) return null;
  const body =
    view.kind === 'row' ? (
      <PapicServiceRow eventId={eventId} svc={svc} doors={view.doors} left={left} sizes={sizes} widget={widget} />
    ) : view.kind === 'say' ? (
      <ServiceGlanceRow
        href={view.href}
        name={svc.name}
        brand={svc.brand}
        icon={<Camera aria-hidden strokeWidth={1.9} />}
        mood="plain"
        pct={0}
        meter={view.meter}
        line={{ lead: view.words }}
        meterLabel=""
        actions={
          view.door ? (
            <ActionButton tone="brand" icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label={view.door.label} href={view.door.href} />
          ) : undefined
        }
        marker={{ 'data-home-service': 'papic', 'data-day-papic-face': view.face }}
      />
    ) : (
      <Link href={view.href} data-home-service="papic" data-day-papic-face="plain" className="home-tile">
        <span className="home-t">
          <Camera aria-hidden strokeWidth={1.9} />
          <span className="truncate">{svc.name}</span>
        </span>
        {svc.brand ? <span className="block truncate text-[11px] text-ink/50">{svc.brand}</span> : null}
        <span className="block truncate text-[12.5px] text-ink/60">{view.status}</span>
      </Link>
    );
  return (
    <nav aria-label={svc.name} data-day-papic="" className="home-svc">
      {body}
    </nav>
  );
}

/**
 * 🧾 A PAID ROW (owner 2026-10-14 🧾 + ✅; prototype `rowFull` / `rowSlim`) — the shipped service
 * glance, never a new card. Owned: name · brand · "On" (Event Hub Pro: "Pro on · …") and the
 * main door where it is another page; waiting for approval: the dashed words; not added: the SLIM
 * line — its catalogue price under the name and **Add**, which opens the service's own page,
 * where the shipped purchase already lives. No meter: only Papic has a true total.
 */
function PaidServiceRow({ svc, row, glyph: Glyph, heading }: { svc: HomeService; row: PaidRow; glyph: LucideIcon; heading: boolean }) {
  const marker = { 'data-home-service': svc.key, 'data-home-paid': row.state };
  if (row.state === 'add') {
    return (
      <>
        {heading ? <p className="home-k2 home-svc-k">Not added</p> : null}
        <ServiceGlanceRow
          href={row.href}
          name={svc.name}
          brand={svc.brand}
          icon={<Glyph aria-hidden strokeWidth={1.9} />}
          mood="plain"
          pct={0}
          line={row.line}
          meterLabel=""
          slim={row.price ?? ''}
          actions={<ActionButton tone="brand" icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Add" href={row.href} />}
          marker={marker}
        />
      </>
    );
  }
  const mood = row.state === 'owned' ? 'ok' : row.state === 'pending' ? 'wait' : 'plain';
  return (
    <ServiceGlanceRow
      href={row.href}
      name={svc.name}
      brand={svc.brand}
      icon={<Glyph aria-hidden strokeWidth={1.9} />}
      mood={mood}
      pct={0}
      meter={false}
      line={row.line}
      meterLabel=""
      actions={row.door ? <ActionButton tone="neutral" icon={<ArrowRight aria-hidden="true" strokeWidth={1.9} />} label={row.door.label} href={row.door.href} /> : undefined}
      marker={marker}
    />
  );
}

/**
 * 🍎 A service row in the iPhone app when Apple sells it — the plain tile's
 * words (name · brand · status) with its ONE control in place (prototype frame
 * 2), and no link: the controller pages are still web-only in the app.
 */
function AppleServiceRow({
  marker,
  name,
  brand,
  icon,
  status,
  action,
  href = null,
}: {
  marker: string;
  name: string;
  brand: string;
  icon: ReactNode;
  status: string;
  action: ReactNode;
  /** 🍎 The service's own page, where the app opens it (version 1.1) — the words open it; the button stays beside. */
  href?: string | null;
}) {
  const words = (
    <>
      <span className="home-t">
        {icon}
        <span className="truncate">{name}</span>
      </span>
      <span className="block truncate text-[11px] text-ink/50">{brand}</span>
      <span className="block truncate text-[12.5px] text-ink/60">{status}</span>
    </>
  );
  return (
    <div data-home-service={marker} data-home-apple-row="" className="home-tile flex items-center gap-3">
      {href ? (
        <Link href={href} data-home-apple-open="" className="min-w-0 flex-1 self-stretch py-1">
          {words}
        </Link>
      ) : (
        <span className="min-w-0 flex-1">{words}</span>
      )}
      {action}
    </div>
  );
}
