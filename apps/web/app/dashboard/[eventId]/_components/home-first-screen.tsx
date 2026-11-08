import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { PapicHomeCard } from './papic-home-card';
import { HomeHubCard } from './home-cards/home-hub-card';
import { HomeLiveCard } from './home-cards/home-live-card';
import { HomeMusicCard } from './home-cards/home-music-card';
import { HomeBoothCard } from './home-cards/home-booth-card';
import { HomePlannerCard } from './home-cards/home-planner-card';
import { HomePrintsLine } from './home-prints-line';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import type { PapicCardPhase } from '@/lib/papic-home-card';

import { ArrowRight, BookOpen, Camera, ChevronDown, Clapperboard, Gem, Music, Plus, QrCode, Radio, Sparkles, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { dayPapicView, type DayPapicFace, type HomeNext, type HomeService, type HomeServiceKey, type PaidRow, type PapicRowDoors } from '@/lib/home-first-screen';
import type { HomeCover } from '@/lib/home-cover';
import type { HomeCoverWords } from '@/lib/home-cover-words';
import { HomeToday, HomeTodayFold } from './home-parts';
import { HomeCoverBand, type HomeSettingsLink } from './home-cover-band';
import { HomeControlRow } from './home-control-row';
import { HomeDateFinder } from './home-date-finder';
import type { HomeHubPickRead } from './home-cards/hub-pick-types';
import { countdownDoor, homeNowAction, homeToday, homeWaiting, type HomeControlInput } from './home-control-faces';
import { HomeMemoriesLine, HomeTodoList } from './home-todo-list';
import { PapicBuySheet } from '../studio/papic/_components/papic-buy-sheet';
import { IapPapicSheet } from '@/app/_components/iap/iap-papic-sheet';
import { IapLiveWatchSheet } from '@/app/_components/iap/iap-live-watch-sheet';
import { SERVICE_NAMES } from '@/lib/service-names';
import { OUR_SERVICE_PARTS } from '@/lib/our-services';
import { PapicSeePhotos } from '../studio/papic/_components/papic-see-photos';
import { ServiceGlanceRow } from '@/app/_components/service-glance';
import { seePhotosWord } from '@/lib/papic-glance';
import type { PoolRung } from '@/lib/papic-pool-rungs';
import { SWITCH_ON_LABEL, type SwitchOnNeed } from '@/lib/event-needs';
import { switchOnNeed } from '../switch-on-actions';

/** 📷 What Home hands Papic's card: its head switch, and the camera settings it opens under itself (owner 2026-10-26). */
export type PapicCardInput = {
  phase: PapicCardPhase | null;
  thankYouHref: string | null;
  settings: ReactNode;
  /** The head switch beside the › — closed and open (owner 2026-10-26): Papic on/off, or "Let everybody shoot now" once Papic is on (owner 2026-10-30, `PapicHeadControl`). */
  headControl?: ReactNode;
  /** The line under the card's title (owner 2026-10-30: what "Let everybody shoot now" has saved); null = the brand line. */
  headLine?: ReactNode;
  /** 🔢 Total · Taken · Remaining on the card's face (owner 2026-10-26) — the pot Home already read. */
  counts?: { total: number | null; left: number | null } | null;
  /** "Add more" on the face — the one buy sheet for this platform; null = not offered. */
  buy?: ReactNode;
  /** Open on arrival — a save's outcome or a purchase error is said inside the open card. */
  defaultOpen?: boolean;
  /** 📷 The chapter Papic shoots into (owner 2026-11-01) — `PapicChapterRow`, under the counts; null = not drawn. */
  chapter?: ReactNode;
};

/** Where each service in the "Your services" row goes — `href:` literals, for the port-controls scan. */
function serviceHref(key: HomeServiceKey, eventId: string): string {
  const doors: ReadonlyArray<{ key: HomeServiceKey; href: string }> = [
    // A viewer with no Papic card (the couple's card is on Today): Papic's photos, in Memories (the page is gone).
    { key: 'papic', href: `/dashboard/${eventId}/memories` },
    { key: 'ai', href: `/dashboard/${eventId}/studio/setnayan-ai` },
    { key: 'nikah', href: `/dashboard/${eventId}/nikah` },
  ];
  return doors.find((d) => d.key === key)?.href ?? `/dashboard/${eventId}`;
}

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
 * 🎛 THE HOME — A CONTROL CENTER FOR THE WHOLE EVENT (owner-approved 2026-10-24, "ok":
 * `Setnayan/prototypes/home_control_center_2026-10-24_fable.html`, corpus 10067d39). Owner: *"our home page handles the
 * full overview and quick access to the different parts of the event. It is basically a control center for the whole
 * event."* Top to bottom, read as the event in time:
 *
 *   the cover → TODAY (one line, the shipped picker's one thing to do — a pointer, not a door)
 *   → ① Countdown · 📅 Schedule · ② Guests · ③ Event Hub · ④ Suppliers · ⑥ To do · ⑤ Budget — THE UPPER PARTS OPEN THEIR PAGE
 *   → Papic · Who's here · Prints
 *
 * 🧱 FRAMES ONLY WHERE YOU ACT (owner 2026-11-01, approved `home_frames_where_you_act_2026-11-01/`): only the Schedule,
 * the Budget and Papic are cards; Countdown, the glance row (Guests · Event Hub · Suppliers · To do, closed by a
 * divider), Who's here, Prints and Your services sit on the page (`HOME_FRAMED_WIDGETS`, `hc-plain`).
 *   → Your services (Papic · Setnayan AI · Live stream · Music · Video booth)             — THE LOWER PARTS GROW IN PLACE
 *
 * One widget per page, and no page appears twice. REMOVED (owner): the "Your next step" card (its verb now sits on the
 * widget it is about, the Today line names it), the aggregate "What's next" (it became the Checklist widget — the plan
 * only), the separate coming / no-reply tiles (merged into Guests), the cover's Settings pill (the Countdown is Event
 * Details' one door). The Event Hub rose out of Your services into the control row.
 *
 * 📱 COMPACT ON THE PHONE, DETAIL FROM `md` (owner: *"we also want the compact version"* → no toggle): below 768 px a
 * 2-column grid of small tiles whose faces rotate; from 768 px the same widgets as cards in two columns. The column
 * fills the body from `md` up (`md:max-w-none` — moved down from `lg` so the tablet gets the two columns).
 *
 * 🔴 A failed read always says so on its widget, with ⟳ Reload — never 0, never ₱0 (`home-control-faces.ts`).
 *
 * ⚠ `control.budget === null` means the viewer may not see the budget (a delegate without budget access): the widget
 * is ABSENT, not "—". A money read that failed arrives as 'unread' and is SAID.
 */
export type HomeFirstScreenProps = {
  eventId: string;
  cover: HomeCoverWords;
  /** The shipped picker's ONE thing to do (`pickHomeNext`) — the Today line names it. */
  next: HomeNext;
  /** 🎛 Every upper widget's facts, already read (`home-control-faces.ts` words them). */
  control: HomeControlInput;
  /**
   * ☀ THE TODAY ASKS (owner 2026-10-29: *"The popup for the access and other popups above the header can be presented
   * better"*) — every prompt that waits on the hosts, as `HomeTodayItem` lines, drawn FIRST in the Today list under the
   * cover; each self-hides. Nothing renders above the cover: the cover is the top of Home. Absent = none (a lab).
   */
  asks?: ReactNode;
  /** Papic · Setnayan AI · … with their status — already filtered (store shell). */
  services: HomeService[];
  /**
   * ⚙ EVENT SETTINGS ON THE COVER (owner 2026-10-29, *"keep it there"*): the band ends with Home's ⚙, at rest and pinned.
   * Only the couple (they change the event's own facts); absent = none (a helper, the labs that do not ask for it).
   */
  eventSettings?: boolean;
  /**
   * 🪪 A HELPER'S ⚙ (owner 2026-10-31, DECISION_LOG "A HELPER SEES THEIR OWN ACCESS AS THE FIRST ROW OF HOME ⚙ EVENT
   * SETTINGS"): a coordinator or limited helper gets the same ⚙, whose sheet holds only "Your access", read-only. Never
   * the Date Finder (the date is the hosts' to change). Ignored when `eventSettings` is on.
   */
  helperSettings?: boolean;
  /** The Home lab's Event Settings rows, already drawn on its fixture (`/dev/home-lab`); absent = read at the press. */
  eventSettingsRows?: ReactNode;
  /** 🔗 `?settings=1` — the address opens the Event Settings sheet with the page (`HomeSettingsLink`). */
  eventSettingsLink?: HomeSettingsLink;
  /** 📅 `?date=find` — the address opens the Date Finder with the page (the Countdown's door from elsewhere). */
  dateFinderOpen?: boolean;
  /** 🖼 The Event Hub's main background under the name (`lib/home-cover.ts`); null = today's colour. */
  ground?: HomeCover | null;
  /** 🎨 Papic's credits left, for the Buy more sheet's "You have N" and "After this". */
  papicLeft?: number | null;
  /** The credit ladder, ONLY when a dev lab already holds it — Home reads it on the tap. */
  papicSizes?: PoolRung[] | null;
  /**
   * 📷 PAPIC'S CARD IS IN MEMORIES (THE ONE BUILD, 2026-11-08 — it was Today's from 2026-10-26). True where Memories
   * draws it (the couple's, on the web, and in the app where Apple sells): Today then draws no Papic row either — one
   * Papic, never two. False = the shipped row (a coordinator, a lab, the bare app).
   */
  papicInMemories?: boolean;
  /** 👀 Who's here (owner 2026-10-29) — the team on the dashboard now and the guests viewing the Event Hub. */
  whosHere?: ReactNode;
  /** 🧩 Every service as a card that grows in place (the couple's, on the web) — `YourServices` `cards`. */
  serviceCards?: boolean;
  /**
   * 🚪 WHAT THIS EVENT NEEDS (owner 2026-10-08, Level 1 — `lib/event-needs.ts`). Absent = every need on. A need that is
   * off is ABSENT, never greyed: no guest list → no Guests widget and the One QR card in its place; no suppliers → no
   * Suppliers and no Budget. `switchOn` = the needs that are off, for the ONE "Switch on more" row.
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
  /** 🎛 The Event Hub tile's "Pick what shows" read, ONLY when a dev lab already holds it — Home reads it on the tap. */
  hubPick?: HomeHubPickRead | null;
  /**
   * 🖨 THE PRINTS LINE (R8, owner 2026-10-27 "PRINTS LEAVES STUDIO"): drawn where the viewer has Prints to make — the
   * couple, with an Event Hub, on an event that needs its details (as the Studio tile was offered). Home holds the door
   * (`HomePrintsLine`); the tool is the Prints page. Absent / false = no line.
   */
  prints?: boolean;
  /** ✨ The Memories line's state words (round 3) — what Home already read; null = no line (a lab that leaves it out). */
  memories?: string | null;
  apple?: {
    papic: { status: string; buy: boolean; open?: string | null } | null;
    liveWatch: { status: string; owned: boolean; askReady: boolean; goLive?: string | null } | null;
    /** 🍎 The Thank-You Video (owner 2026-10-23) — its page opens here and its one pay step is Apple's sheet. */
    thankYou?: { status: string; owned: boolean; open: string } | null;
  } | null;
};

export function HomeFirstScreen({
  eventId,
  cover,
  next,
  control,
  asks = null,
  services,
  eventSettings = false,
  helperSettings = false,
  eventSettingsRows,
  eventSettingsLink,
  dateFinderOpen = false,
  ground = null,
  papicLeft = null,
  papicSizes = null,
  papicInMemories = false,
  whosHere = null,
  serviceCards = false,
  needs = null,
  apple = null,
  hubPick = null,
  prints = false,
  memories = null,
}: HomeFirstScreenProps) {
  const noList = needs?.guestList === false;
  const today = homeToday(next, control.guests, homeWaiting(control));
  const nowAction = homeNowAction(today, control);
  const c = control.countdown;
  return (
    /* 📅 "Later" beside a widget's verb folds Now for today, on this device (owner 2026-10-23). */
    <HomeTodayFold eventId={eventId} kind={next.kind}>
    <section data-home-first-screen aria-label="Today" className="flex w-full flex-col gap-3">
      {/* 🎴 THE EVENT CARD (owner-approved Home redraw 2026-11-02, round 3 — the GCash balance-card shape): the name, the
          countdown (the Date Finder's door) and NOW, the ONE thing to do with its verb. It still wears the Event Hub's
          main background (owner 2026-10-07, #6394) and still pins as one line. */}
      <HomeCoverBand cover={cover} ground={ground} settingsFor={eventSettings || helperSettings ? eventId : undefined} settingsHelper={!eventSettings && helperSettings} settingsRows={eventSettingsRows} settingsLink={eventSettingsLink}
        countdown={{
          value: c.hasDate ? c.value : '—',
          days: c.hasDate && /^\d/.test(c.value) ? c.days : null,
          label: c.hasDate ? c.label : 'No date yet',
          line: [c.long, c.placeLine].filter(Boolean).join(' · ') || null,
          href: c.door ?? countdownDoor(eventId),
        }}
        now={<HomeToday target={today.target} words={today.words} tail={today.tail} calm={today.calm} action={nowAction} eventId={eventId} />}
      />

        <div data-home-column className="mx-auto flex w-full max-w-xl flex-col gap-3 md:max-w-none">
          {/* ✅ THE ONE TO DO — under the card: the three soonest tasks with their tick, then the plan's state (round 3).
              The task Now holds is not repeated. */}
          <HomeTodoList eventId={eventId} checklist={control.checklist} holds={today.holds?.task ?? null} />

          {/* ☀ WHAT WAITS ON THE HOSTS — the access and date asks, each its own line (they join the Requests card next). */}
          <div className="contents" data-home-today-asks="">
            {asks}
          </div>

          {/* 🎛 YOUR EVENT — the widgets; tap a name to open its page. */}
          <p className="hc-k2" data-home-your-event="">
            <span className="hc-k2-name">Your event</span>
            <em>tap a name to open it</em>
          </p>

          {/* 🚪 ONE QR FOR EVERYONE — where an event has no guest list, the QR IS the way in
              (owner 2026-10-08; prototype frame 2, its words). Opens the GUESTS' one link + QR (Guests › Invite,
              `ShareLinkPanel`) — never `/event-qr`, which is the CREW's device-pairing code (`setnayan://crew-pair`).
              Held by `lib/dashboard-doors-resolve.test.ts`. */}
          {noList ? (
            <Link href={`/dashboard/${eventId}/guests/invite`} className="home-card flex items-center gap-3" data-home-one-qr="">
              <QrCode aria-hidden className="h-12 w-12 shrink-0 text-ink" strokeWidth={1.5} />
              <span className="min-w-0">
                <span className="block font-semibold">One QR for everyone</span>
                <span className="home-s block">Anyone with the link gets in. Share it, print it, stick it on the door.</span>
              </span>
            </Link>
          ) : null}

          {/* 🎛 THE CONTROL ROW — Countdown · Guests · Event Hub · Suppliers · Budget · Checklist; each opens its ONE page. */}
          <HomeControlRow input={control} hubPick={hubPick} />
          {/* 📅 The Countdown's Date Finder, in place — the couple's (who change the date); a helper's Countdown opens Event Details. */}
          {eventSettings ? <HomeDateFinder eventId={eventId} openAtFirst={dateFinderOpen} /> : null}

          {/* 📷 PAPIC — its ONE card moved to Memories (THE ONE BUILD, 2026-11-08); Today draws none. */}

          {/* 👀 WHO'S HERE — after Papic, before Your services (owner 2026-10-29): who of the team is on the dashboard
              now, and which guests are viewing the Event Hub. */}
          {whosHere}


          {/* 🖨 PRINTS — one line that opens its own page (owner 2026-10-27: "Home gets a Prints line that opens it").
              A row on the page, a divider above it (owner 2026-11-01: frames only where you act). */}
          {prints ? (
            <div className="hc-ruled">
              <HomePrintsLine eventId={eventId} />
            </div>
          ) : null}

          {/* YOUR SERVICES — each grows in place with its quick controls; the Event Hub rose into the control row. */}
          <YourServices
            eventId={eventId}
            services={services.filter((s) => s.key !== 'hub' && !(papicInMemories && s.key === 'papic'))}
            apple={apple}
            papicLeft={papicLeft}
            papicSizes={papicSizes}
            cards={serviceCards}
          />

          {/* ✨ MEMORIES — one slim line of its own, after the widgets (round 3): everything from the day, in one place. */}
          {memories ? <HomeMemoriesLine eventId={eventId} line={memories} /> : null}

          {/* 🚪 SWITCH ON MORE — the ONE row that keeps what this event left off (owner 2026-10-08:
              "the rest stays off but can be switched on later from Home's quick setup"). It unfolds in
              place; each switch writes its need and lands on the shipped setup for it. */}
          {needs && needs.switchOn.length > 0 ? (
            <details className="home-card group" data-home-switch-on="" data-tour="home-switch-on">
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
    </HomeTodayFold>
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
  cards = false,
}: {
  eventId: string;
  services: HomeService[];
  apple?: HomeFirstScreenProps['apple'];
  papicLeft: number | null;
  papicSizes?: PoolRung[] | null;
  /**
   * 🧩 EVERY SERVICE AS A WIDGET (owner 2026-10-23, `home_service_widgets_2026-10-23.html`): each row becomes the card
   * that grows in place, drawn by the server behind the row it replaces (streamed — the first paint is today's row).
   * The couple's alone (the controls write as the couple); a coordinator and the app keep the rows.
   */
  cards?: boolean;
}) {
  if (!(services.length > 0 || apple?.papic || apple?.liveWatch || apple?.thankYou)) return null;
  /* 🧱 Frames only where you act (owner 2026-11-01): Your services is a heading plus plain rows with dividers — the
     row's own control is its frame — closed off from what is above by a divider. */
  return (
    <nav aria-label="Your services" id="your-services" data-home-services className="hc-ruled flex flex-col">
      <p className="home-k2 !mt-1" data-tour="home-services">Your services</p>
      <div className="home-svc hc-plain-list">
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
        {apple?.thankYou ? (
          <AppleServiceRow
            marker="thank-you"
            name={OUR_SERVICE_PARTS.papic?.name ?? ''}
            brand={SERVICE_NAMES.papic.plain}
            icon={<Clapperboard aria-hidden strokeWidth={1.9} />}
            status={apple.thankYou.status}
            href={apple.thankYou.open}
            action={
              apple.thankYou.owned ? null : (
                <ActionButton tone="brand" icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Add" href={apple.thankYou.open} />
              )
            }
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
            return <PapicServiceRow key={svc.key} eventId={eventId} svc={svc} doors={svc.papic} left={papicLeft} sizes={papicSizes} />;
          }
          if (svc.key === 'hub' && svc.hub) {
            /* 💎 The Event Hub, right after Papic — its Pro folded in as the card's ◆ line (owner 2026-10-23). */
            const row = (
              <ServiceGlanceRow
                href={`/dashboard/${eventId}/launch`}
                name={svc.name}
                icon={<Icon aria-hidden strokeWidth={1.9} />}
                mood="plain"
                pct={0}
                meter={false}
                line={{ lead: svc.status }}
                meterLabel=""
                marker={{ 'data-home-service': 'hub' }}
              />
            );
            return cards ? (
              <Suspense key={svc.key} fallback={row}>
                <HomeHubCard eventId={eventId} name={svc.name} pro={svc.hub.pro} />
              </Suspense>
            ) : (
              <span key={svc.key} className="contents">
                {row}
              </span>
            );
          }
          if (svc.paid) {
            /* 🧾 "Not added" heads the slim lines once (prototype: owned rows, then Not added). */
            const firstSlim = svc.paid.state === 'add' && services[i - 1]?.paid?.state !== 'add';
            const row = (
              <PaidServiceRow
                key={svc.key}
                svc={svc}
                row={svc.paid}
                glyph={Icon}
                heading={firstSlim}
              />
            );
            /* ✨ Setnayan AI not added, on a phone (owner-approved 2026-10-24): a half tile — "Not added · Try it" — that
               opens its page; the slim line from md up. */
            if (cards && svc.key === 'ai' && svc.paid.state === 'add') {
              return (
                <span key={svc.key} className="contents">
                  <div className="hc-svc-wrap md:hidden" data-home-service-tile="ai">
                    <Link href={svc.paid.href} className="hc-tile hc-svc-tile" data-home-service="ai" data-home-paid="add">
                      <span className="hc-lab">{svc.brand ?? svc.name}</span>
                      <span className="hc-big">
                        <small>Not added</small>
                      </span>
                      <span className="hc-sm">Try it</span>
                    </Link>
                    <span className="hc-tiny-slot">
                      <ActionButton tone="brand" icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label="Try it" href={svc.paid.href} />
                    </span>
                  </div>
                  <div className="hidden md:contents">{row}</div>
                </span>
              );
            }
            /* 🧩 The service's own card, streamed behind its row (the row is the first paint). */
            const card = cards ? paidCard(eventId, svc, svc.paid) : null;
            return card ? (
              <Suspense key={svc.key} fallback={row}>
                {card}
              </Suspense>
            ) : (
              row
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
 * 📷 THE ONE PAPIC CARD (owner 2026-10-26) — Today draws it before the day, the console's Papic slot on the day, Your
 * services after it: one component, so the three can never say two things about one pot.
 */
/**
 * 📷 THE ONE PAPIC CARD, wherever it is drawn — Memories since 2026-11-08 (THE ONE BUILD: *"Papic + Thank You into
 * Memories"*), under the keepsake row. The same `PapicHomeCard` Today drew, unchanged; only the seat moved.
 */
export function PapicCard({
  card,
  name = SERVICE_NAMES.papic.plain,
  brand = SERVICE_NAMES.papic.brand,
  marker = { 'data-memories-papic': '' },
}: {
  card: PapicCardInput;
  name?: string;
  brand?: string;
  marker?: Record<string, string>;
}) {
  return (
    <PapicHomeCard
      name={name}
      brand={brand}
      icon={<Camera aria-hidden strokeWidth={1.9} />}
      phase={card.phase}
      thankYouHref={card.thankYouHref}
      settings={card.settings}
      headControl={card.headControl ?? null}
      headLine={card.headLine ?? null}
      counts={card.counts ?? null}
      buy={card.buy ?? null}
      chapter={card.chapter ?? null}
      defaultOpen={card.defaultOpen ?? false}
      marker={marker}
    />
  );
}

/**
 * 🎨 PAPIC'S ROW — the service glance at Home size (owner "approve all",
 * 2026-10-14; prototype `renderHome()`): name · the status line with its dot ·
 * the meter · Buy more (the sheet) · See N photos (opens the event's Memories tab, 2026-10-23).
 * (NEVER TWICE retired with the Next card, owner-approved 2026-10-24: the Today line only points, so the plan Home sets
 * no `whileNext` and Buy more always shows; the lab still draws the old mark.)
 */
function PapicServiceRow({
  eventId,
  svc,
  doors,
  left,
  sizes,
  cardHref = null,
}: {
  eventId: string;
  svc: HomeService;
  doors: PapicRowDoors;
  left: number | null;
  sizes: PoolRung[] | null;
  /** 📷 Where the couple's Papic CARD is (Memories, `papicCardHref`) — the row then opens it; null = Memories' grid. */
  cardHref?: string | null;
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
  const line = doors.whileNext?.tail ? { ...doors.line, tailWhileNext: true } : doors.line;
  return (
    <ServiceGlanceRow
      // The couple's row on the day opens their Papic card in Memories (`cardHref`, 2026-11-08); a coordinator's (no
      // card — the settings write as the couple): Papic's photos, in Memories. The Papic page is gone (2026-10-26).
      href={cardHref ?? `/dashboard/${eventId}/memories`}
      name={svc.name}
      brand={svc.brand}
      icon={<Camera aria-hidden strokeWidth={1.9} />}
      mood={doors.glance.mood}
      pct={doors.glance.pct}
      line={line}
      meterLabel="Credits left"
      actions={acts}
      marker={{ 'data-home-service': 'papic' }}
    />
  );
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
  cardHref = null,
}: {
  eventId: string;
  face: DayPapicFace;
  svc: HomeService | undefined;
  left: number | null;
  sizes?: PoolRung[] | null;
  /** 📷 The couple's Papic card in Memories (`papicCardHref`) — the day's Papic line jumps to it (2026-11-08). */
  cardHref?: string | null;
}) {
  const view = dayPapicView(face, svc, eventId);
  if (view.kind === 'hidden' || !svc) return null;
  const body =
    view.kind === 'row' ? (
      <PapicServiceRow eventId={eventId} svc={svc} doors={view.doors} left={left} sizes={sizes} cardHref={cardHref} />
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
 * 🧩 WHICH PAID SERVICE GROWS INTO A CARD (owner 2026-10-23, `home_service_widgets_2026-10-23.html`): the ones that
 * are the couple's — Planner, Live stream (where the controller exists), Music — and the Video booth, which also
 * records free. "Payment sent" and "Not added" stay the shipped rows (nothing to control yet).
 */
function paidCard(eventId: string, svc: HomeService, row: PaidRow): ReactNode {
  const named = { eventId, name: svc.name, brand: svc.brand };
  if (svc.key === 'ai' && row.state === 'owned') return <HomePlannerCard {...named} />;
  if (svc.key === 'live' && row.state === 'owned' && liveStudioRoamEnabled()) return <HomeLiveCard {...named} />;
  if (svc.key === 'music' && row.state === 'owned') return <HomeMusicCard {...named} />;
  if (svc.key === 'booth' && (row.state === 'owned' || row.state === 'open')) return <HomeBoothCard {...named} owned={row.state === 'owned'} />;
  return null;
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
          actions={<ActionButton tone="brand" icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label={svc.key === 'ai' ? 'Try it' : 'Add'} href={row.href} />}
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
