import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { PapicHomeCard } from './papic-home-card';
import { HomeHubCard } from './home-cards/home-hub-card';
import { HomeLiveCard } from './home-cards/home-live-card';
import { HomeMusicCard } from './home-cards/home-music-card';
import { HomeBoothCard } from './home-cards/home-booth-card';
import { HomePlannerCard } from './home-cards/home-planner-card';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import type { PapicCardPhase } from '@/lib/papic-home-card';

import { ArrowRight, BookOpen, Camera, ChevronDown, Clapperboard, Gem, Music, Plus, QrCode, Radio, Sparkles, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { dayPapicView, type DayPapicFace, type HomeNext, type HomeService, type HomeServiceKey, type PaidRow, type PapicRowDoors } from '@/lib/home-first-screen';
import type { HomeCover } from '@/lib/home-cover';
import type { HomeCoverWords } from '@/lib/home-cover-words';
import { HomeToday, HomeTodayFold } from './home-parts';
import { HomeCoverBand } from './home-cover-band';
import { HomeControlRow } from './home-control-row';
import type { HomeHubPickRead } from './home-cards/hub-pick-types';
import { homeToday, type HomeControlInput } from './home-control-faces';
import { PapicBuySheet } from '../studio/papic/_components/papic-buy-sheet';
import { IapPapicSheet } from '@/app/_components/iap/iap-papic-sheet';
import { IapLiveWatchSheet } from '@/app/_components/iap/iap-live-watch-sheet';
import { SERVICE_NAMES } from '@/lib/service-names';
import { PapicSeePhotos } from '../studio/papic/_components/papic-see-photos';
import { ServiceGlanceRow } from '@/app/_components/service-glance';
import { seePhotosWord } from '@/lib/papic-glance';
import { formatCount } from '@/lib/format-number';
import type { PoolRung } from '@/lib/papic-pool-rungs';
import { SWITCH_ON_LABEL, type SwitchOnNeed } from '@/lib/event-needs';
import { switchOnNeed } from '../switch-on-actions';

/** 📷 What Home hands Papic's card: its two new lines, and the camera settings it opens under itself. */
export type PapicCardInput = {
  coverage: string | null;
  phase: PapicCardPhase | null;
  /** The latest five (`PapicCardStrip`, a streamed server slot). */
  strip: ReactNode;
  thankYouHref: string | null;
  settings: ReactNode;
  /** The Papic main switch, in the card's head beside the ⌄ (owner 2026-10-24). */
  headControl?: ReactNode;
};

/** Where each service in the "Your services" row goes — `href:` literals, for the port-controls scan. */
function serviceHref(key: HomeServiceKey, eventId: string): string {
  const doors: ReadonlyArray<{ key: HomeServiceKey; href: string }> = [
    { key: 'papic', href: `/dashboard/${eventId}/studio/papic` },
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
 *   → ① Countdown · ② Guests · ③ Event Hub · ④ Suppliers · ⑤ Budget · ⑥ Checklist      — THE UPPER PARTS OPEN THEIR PAGE
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
  /** Papic · Setnayan AI · … with their status — already filtered (store shell). */
  services: HomeService[];
  /** 🖼 The Event Hub's main background under the name (`lib/home-cover.ts`); null = today's colour. */
  ground?: HomeCover | null;
  /** 🎨 Papic's credits left, for the Buy more sheet's "You have N" and "After this". */
  papicLeft?: number | null;
  /** The credit ladder, ONLY when a dev lab already holds it — Home reads it on the tap. */
  papicSizes?: PoolRung[] | null;
  /**
   * 📷 PAPIC'S CARD (owner 2026-10-23, "a smaller widget on home. Then we can expand it" · "expanding opens the rest
   * of the settings under it"): the coverage line, the latest five, and the camera settings it opens under itself.
   * Absent = the shipped row (a lab, the app).
   */
  papicCard?: PapicCardInput | null;
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
  apple?: {
    papic: { status: string; buy: boolean; open?: string | null } | null;
    liveWatch: { status: string; owned: boolean; askReady: boolean; goLive?: string | null } | null;
  } | null;
};

export function HomeFirstScreen({
  eventId,
  cover,
  next,
  control,
  services,
  ground = null,
  papicLeft = null,
  papicSizes = null,
  papicCard = null,
  serviceCards = false,
  needs = null,
  apple = null,
  hubPick = null,
}: HomeFirstScreenProps) {
  const noList = needs?.guestList === false;
  const today = homeToday(next, control.guests);
  return (
    <section data-home-first-screen aria-label="Home" className="flex w-full flex-col gap-3">
      {/* 🖼 The cover wears the Event Hub's main background (owner 2026-10-07, #6394), the words in the hub's own
          measured ink over its veil (`lib/home-cover.ts`). */}
      <HomeCoverBand cover={cover} ground={ground} />

      {/* 📅 "Later" beside the verb folds the Today line for today, on this device (owner 2026-10-23). */}
      <HomeTodayFold eventId={eventId} kind={next.kind}>
        <div data-home-column className="mx-auto flex w-full max-w-xl flex-col gap-3 md:max-w-none">
          {/* ☀ TODAY — one line, on top: the shipped picker's ONE thing (`pickHomeNext`), and where it lives. */}
          <HomeToday target={today.target} words={today.words} tail={today.tail} calm={today.calm} />

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

          {/* 🎛 THE CONTROL ROW — Countdown · Guests · Event Hub · Suppliers · Budget · Checklist; each opens its ONE page. */}
          <HomeControlRow input={control} hubPick={hubPick} />

          {/* YOUR SERVICES — each grows in place with its quick controls; the Event Hub rose into the control row. */}
          <YourServices
            eventId={eventId}
            services={services.filter((s) => s.key !== 'hub')}
            apple={apple}
            papicLeft={papicLeft}
            papicSizes={papicSizes}
            papicCard={papicCard}
            cards={serviceCards}
          />

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
      </HomeTodayFold>
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
  papicCard = null,
  cards = false,
}: {
  eventId: string;
  services: HomeService[];
  apple?: HomeFirstScreenProps['apple'];
  papicLeft: number | null;
  papicSizes?: PoolRung[] | null;
  papicCard?: PapicCardInput | null;
  /**
   * 🧩 EVERY SERVICE AS A WIDGET (owner 2026-10-23, `home_service_widgets_2026-10-23.html`): each row becomes the card
   * that grows in place, drawn by the server behind the row it replaces (streamed — the first paint is today's row).
   * The couple's alone (the controls write as the couple); a coordinator and the app keep the rows.
   */
  cards?: boolean;
}) {
  if (!(services.length > 0 || apple?.papic || apple?.liveWatch)) return null;
  return (
    <nav aria-label="Your services" id="your-services" data-home-services className="flex flex-col">
      <p className="home-k2 !mt-1" data-tour="home-services">Your services</p>
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
            return <PapicServiceRow key={svc.key} eventId={eventId} svc={svc} doors={svc.papic} left={papicLeft} sizes={papicSizes} card={papicCard} />;
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
  card = null,
}: {
  eventId: string;
  svc: HomeService;
  doors: PapicRowDoors;
  left: number | null;
  sizes: PoolRung[] | null;
  card?: PapicCardInput | null;
}) {
  // 📷 The card's own strip carries "See all ›" (→ Memories), so the card draws no second photos door (contract
  // 2026-10-24: quick view = coverage · credits · the latest five with See all · Add more). The plain row keeps it.
  const photos = !card && typeof doors.glance.result === 'number' && doors.glance.result > 0 ? doors.glance.result : null;
  const acts =
    doors.buy || photos ? (
      <>
        {doors.buy ? (
          doors.whileNext?.buy ? (
            /* NEVER TWICE, only while the card that offers it is on screen (walk-b6 F1). */
            <span data-while-next="" className="contents">
              <PapicBuySheet eventId={eventId} left={left} tone="brand" sizes={sizes} label={card ? 'Add more' : undefined} />
            </span>
          ) : (
            <PapicBuySheet eventId={eventId} left={left} tone="brand" sizes={sizes} label={card ? 'Add more' : undefined} />
          )
        ) : null}
        {/* The photos live on the event bar's Memories tab now (owner 2026-10-23) — the door opens it. */}
        {photos ? <PapicSeePhotos tone="neutral" label={seePhotosWord(photos)} href={`/dashboard/${eventId}/memories`} /> : null}
      </>
    ) : null;
  const line = doors.whileNext?.tail ? { ...doors.line, tailWhileNext: true } : doors.line;
  // 📷 THE CARD THAT OPENS UNDER ITSELF (owner 2026-10-23) — nothing on Home navigates to the Papic page now.
  if (card) {
    return (
      <PapicHomeCard
        name={svc.name}
        brand={svc.brand}
        icon={<Camera aria-hidden strokeWidth={1.9} />}
        mood={doors.glance.mood}
        pct={doors.glance.pct}
        line={line}
        meterLabel="Credits left"
        coverage={card.coverage}
        phase={card.phase}
        strip={card.strip}
        actions={acts}
        thankYouHref={card.thankYouHref}
        settings={card.settings}
        headControl={card.headControl ?? null}
        marker={{ 'data-home-service': 'papic' }}
        /* 📱 The phone's closed face (owner-approved 2026-10-24): credits left · the coverage · Add more. */
        tile={{
          label: svc.brand,
          big: typeof doors.glance.count === 'number' ? formatCount(doors.glance.count) : '—',
          unit: 'credits left',
          sm: card.coverage ?? '',
          meter: typeof doors.glance.count === 'number' ? doors.glance.pct : null,
          span: true,
          action: doors.buy ? <PapicBuySheet eventId={eventId} left={left} tone="brand" sizes={sizes} label="Add more" /> : null,
        }}
      />
    );
  }
  return (
    <ServiceGlanceRow
      href={`/dashboard/${eventId}/studio/papic`}
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
  card = null,
}: {
  eventId: string;
  face: DayPapicFace;
  svc: HomeService | undefined;
  left: number | null;
  sizes?: PoolRung[] | null;
  card?: PapicCardInput | null;
}) {
  const view = dayPapicView(face, svc, eventId);
  if (view.kind === 'hidden' || !svc) return null;
  const body =
    view.kind === 'row' ? (
      <PapicServiceRow eventId={eventId} svc={svc} doors={view.doors} left={left} sizes={sizes} card={card} />
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
