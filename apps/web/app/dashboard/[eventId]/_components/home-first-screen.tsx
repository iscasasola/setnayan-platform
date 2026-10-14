import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  Clapperboard,
  Diamond,
  Images,
  Info,
  ListChecks,
  ListMusic,
  Mail,
  Music,
  Play,
  Radio,
  Sparkles,
  UserPlus,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { NextCard } from '@/app/_components/next-card';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import type { HomeNext, HomeNextKind, HomeService, HomeServiceKey, PapicRowDoors } from '@/lib/home-first-screen';
import type { HomeFigures } from '@/lib/home-facts';
import type { HomeCover } from '@/lib/home-cover';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { completeTour } from '@/lib/tour-actions';
import { HUB_SETUP_OFFER_TOUR } from '@/lib/tours';
import { HomeDoorways, HomeLater, HomeReload, HomeWhatsNext, SongHeardSwap } from './home-parts';
import { HearYourSong } from '@/app/_components/hear-your-song';
import { ServiceBuySheet } from './service-buy-sheet';
import { doorBuys, type ServiceDoor, type ServiceRowGlance } from '@/lib/services-glance';
import { offerForDoor } from '@/lib/service-offers';
import { PapicBuySheet } from '../studio/papic/_components/papic-buy-sheet';
import { PapicSeePhotos } from '../studio/papic/_components/papic-see-photos';
import { ServiceGlanceRow, ServiceSlimRow } from '@/app/_components/service-glance';
import { seePhotosWord } from '@/lib/papic-glance';
import type { PoolRung } from '@/lib/papic-pool-rungs';

/**
 * Where each Next card goes. Written as `href:` literals ON PURPOSE: the
 * port-controls scan (`scripts/port-controls.mjs` HREF_RE) only sees an
 * `href`/`href:` followed by a literal, so a `switch` returning strings made
 * the guided flow's door read as "lost".
 */
function nextHref(kind: HomeNextKind, eventId: string): string {
  const doors: ReadonlyArray<{ kind: HomeNextKind; href: string }> = [
    { kind: 'live', href: `/panood/control/${eventId}` },
    { kind: 'music', href: `/dashboard/${eventId}/studio/pakanta#song` },
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
    { key: 'live', href: `/dashboard/${eventId}/studio/live-studio-control` },
    { key: 'music', href: `/dashboard/${eventId}/studio/pakanta` },
    { key: 'booth', href: `/dashboard/${eventId}/studio/patiktok` },
    { key: 'hub', href: `/dashboard/${eventId}/studio/website-pro` },
    { key: 'nikah', href: `/dashboard/${eventId}/nikah` },
  ];
  return doors.find((d) => d.key === key)?.href ?? `/dashboard/${eventId}`;
}

/** Where each door on a service row goes — `href:` literals, for the same scan. */
function serviceDoorHref(kind: ServiceDoor['kind'], eventId: string): string {
  const doors: ReadonlyArray<{ kind: ServiceDoor['kind']; href: string }> = [
    { kind: 'shortlist', href: `/dashboard/${eventId}/vendors` },
    { kind: 'controller', href: `/panood/control/${eventId}` },
    /* The recording is collected in the controller (its "Recordings" card). */
    { kind: 'recording', href: `/panood/control/${eventId}` },
    { kind: 'hear', href: `/dashboard/${eventId}/studio/pakanta#song` },
    { kind: 'brief', href: `/dashboard/${eventId}/studio/pakanta#brief` },
    { kind: 'booth', href: `/dashboard/${eventId}/studio/patiktok/booth` },
    { kind: 'reels', href: `/dashboard/${eventId}/studio/patiktok#reels` },
    { kind: 'maker', href: `/dashboard/${eventId}/launch` },
  ];
  return doors.find((d) => d.kind === kind)?.href ?? `/dashboard/${eventId}`;
}

/**
 * 📱 THE HOME'S FIRST SCREEN — owner-APPROVED 2026-10-01 ("THE SIMPLE PHONE APP
 * — APPROVED", frame 1 "Home"). A server component, and deliberately nothing
 * else: every figure arrives already read and already worded
 * (`lib/home-first-screen.ts`), so this file adds no client weight and no read.
 *
 *   ONE Next card (one button) → Edit your Event Hub (always) → days to go ·
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
  live: { icon: Radio, tone: 'brand' },
  music: { icon: Play, tone: 'brand' },
  guide: { icon: Sparkles, tone: 'brand' },
  date: { icon: CalendarDays, tone: 'brand' },
  unread: { icon: Check, tone: 'neutral' },
  guests: { icon: UserPlus, tone: 'brand' },
  invite: { icon: Mail, tone: 'info' },
  papic: { icon: Camera, tone: 'brand' },
  ai: { icon: Sparkles, tone: 'brand' },
  plan: { icon: ListChecks, tone: 'ok' },
};

const SERVICE_ICON: Record<HomeServiceKey, LucideIcon> = {
  papic: Camera,
  ai: Sparkles,
  live: Video,
  music: Music,
  booth: Clapperboard,
  hub: Diamond,
  nikah: BookOpen,
};

/** Each service door's icon — the prototype's (`ICO`). */
const DOOR_ICON: Record<ServiceDoor['kind'], LucideIcon> = {
  shortlist: ListChecks,
  controller: Radio,
  recording: Play,
  hear: Play,
  brief: ListMusic,
  booth: Clapperboard,
  reels: Images,
  maker: Diamond,
  add: Sparkles,
  'more-screen': Sparkles,
  'more-song': Sparkles,
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
  cover: { eyebrow: string; name: string };
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
  /**
   * ✅ The step UNDER a moment card — drawn hidden, shown once the moment passes
   * (the song "once, until heard": `SongHeardSwap`). Null when the card is a step.
   */
  nextAfter?: HomeNext | null;
  /** 🔒 The iPhone app: rows are status only — no doors to web-only pages, no buy button. */
  storeShell?: boolean;
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
  nextAfter = null,
  storeShell = false,
}: HomeFirstScreenProps) {
  const guestsUnread = figures ? figures.coming === null : coming === '—';
  const moneyUnread = figures ? figures.money === 'unread' : money !== null && money.paid === '—';
  const m = figures && figures.money && figures.money !== 'unread' ? figures.money : null;
  const paidPct = m && m.paid + m.owing > 0 ? Math.round((m.paid / (m.paid + m.owing)) * 100) : null;
  const nb = NEXT_BUTTON[next.kind];
  const AfterIcon = nextAfter ? NEXT_BUTTON[nextAfter.kind].icon : Sparkles;
  const nextMain =
    next.kind === 'unread' ? (
      <HomeReload main />
    ) : next.kind === 'papic' && (next.papicMoment === 'stopped' || next.papicMoment === 'low-today') ? (
      /* 🎨 The card's Buy more opens the same sheet as the row (owner 2026-10-14). */
      <PapicBuySheet eventId={eventId} left={papicLeft} tone="brand" main sizes={papicSizes} />
    ) : next.kind === 'music' ? (
      /* ✅ Hearing it hands the card back (`lib/song-heard.ts`). */
      <HearYourSong eventId={eventId} href={nextHref('music', eventId)} main />
    ) : (
      <ActionButton tone={nb.tone} main icon={<nb.icon aria-hidden="true" strokeWidth={1.9} />} label={next.action} href={nextHref(next.kind, eventId)} />
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
      <div
        data-home-cover={ground?.kind ?? 'colour'}
        /* Full-bleed on a phone, under the top bar (the prototype's `.cover{margin:0 -16px}` —
           the event layout's gutter is px-4 / pt-3); a rounded band from `sm` up. */
        /* 📐 A FULL-WIDTH BAND AT EVERY WIDTH (owner 2026-10-07: "i thought this will be
           changed to full width"): it cancels the event layout's own gutter (px-4 · sm:px-6 ·
           lg:px-8, pt-3 · sm:pt-6) and pads by the same amount, so it runs edge to edge of
           the content area, square-edged, with its words on the page's gutter. The cards
           below keep their column (`data-home-column`). */
        className={`relative -mx-4 -mt-3 flex items-end justify-between gap-3 overflow-hidden px-4 pb-[18px] pt-[22px] sm:-mx-6 sm:-mt-6 sm:px-6 lg:-mx-8 lg:px-8 ${ground ? '' : 'bg-mulberry text-cream'}`}
        style={ground ? { background: ground.kind === 'paper' ? ground.background : undefined, color: ground.ink } : undefined}
      >
        {ground?.kind === 'image' ? (
          <span aria-hidden className="absolute inset-0 block">
            {/* A presigned R2 URL or the theme's public still — a plain <img>: the signing host is not in the next/image allowlist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ground.src} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute inset-0 block" style={{ background: ground.scrim }} />
          </span>
        ) : null}
        <div className="relative min-w-0">
          {/* The page's one h1. Screen-reader only: the name is drawn once, below, for the eye — and
              BEFORE the eyebrow, so `lint-page-masthead` does not read a label-over-h1. */}
          <h1 className="sr-only">{cover.name}</h1>
          <p className={`truncate text-[12px] uppercase tracking-[0.12em] ${ground ? 'opacity-85' : 'text-cream/85'}`}>{cover.eyebrow}</p>
          <p aria-hidden className="text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">{cover.name}</p>
        </div>
        <span className="relative shrink-0" data-home-event-details="">
          <ActionButton href={`/dashboard/${eventId}/details`} tone="neutral" icon={<Info aria-hidden="true" strokeWidth={1.9} />} label="Event Details" className="home-cover-ab" />
        </span>
      </div>

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

        {next.kind === 'music' && nextAfter ? (
          /* ✅ ONCE, UNTIL HEARD — the step under the song card, shown when this device has heard it. */
          <div data-home-next-after="" className="contents">
            <NextCard
              marker="data-home-next"
              kind={nextAfter.kind}
              title={nextAfter.title}
              body={nextAfter.body}
              action={nextAfter.action}
              href={nextHref(nextAfter.kind, eventId)}
              hidden
              actions={
                <>
                  <ActionButton
                    tone={NEXT_BUTTON[nextAfter.kind].tone}
                    main
                    icon={<AfterIcon aria-hidden="true" strokeWidth={1.9} />}
                    label={nextAfter.action}
                    href={nextHref(nextAfter.kind, eventId)}
                  />
                  <HomeLater eventId={eventId} kind={nextAfter.kind} />
                </>
              }
            />
            <SongHeardSwap eventId={eventId} />
          </div>
        ) : null}

        {/* ② THE THREE DOORS (owner 2026-10-07: "maybe add the 3 buttons. Edit your
            Gueslist, Edit your Suppliers, Edit your Event Hub") — the bottom bar's icons. */}
        <HomeDoorways eventId={eventId} navSlots={doorSlots(navSlots)} />

        {/* ③ THREE NUMBERS — counted (`Count`); "—" when unread, never 0. */}
        <div className="home-nums" data-home-numbers>
          <Link href={`/dashboard/${eventId}/details`} className="home-tile" data-home-days="">
            <div className={`home-v${typeof figures?.days === 'number' || /^[\d,—]+$/.test(days.value) ? '' : ' home-v-word'}`}>
              <Figure n={figures?.days} word={days.value} id="home-days" />
            </div>
            <div className="home-k">{days.label}</div>
          </Link>
          {guestsUnread ? (
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
        {money ? (
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

        {/* ⑥ YOUR SERVICES — the paid services + Event Hub Pro (owner 2026-10-14 🧾 ✅): owned rows
            full size first, then the ones not added yet, slim. Free tools are never rows. */}
        {services.length > 0 ? (
          <nav aria-label="Your services" data-home-services className="flex flex-col">
            <p className="home-k2 !mt-1">Your services</p>
            <div className="home-svc">
              {services
                .filter((svc) => svc.size !== 'slim')
                .map((svc) => {
                  const Icon = SERVICE_ICON[svc.key];
                  if (svc.key === 'papic' && svc.papic) {
                    return <PapicServiceRow key={svc.key} eventId={eventId} svc={svc} doors={svc.papic} left={papicLeft} sizes={papicSizes} storeShell={storeShell} />;
                  }
                  if (svc.glance && svc.key !== 'nikah') {
                    return <ServiceFullRow key={svc.key} eventId={eventId} svc={svc} glance={svc.glance} storeShell={storeShell} />;
                  }
                  const plain = (
                    <>
                      <span className="home-t">
                        <Icon aria-hidden strokeWidth={1.9} />
                        <span className="truncate">{svc.name}</span>
                      </span>
                      {/* The Setnayan name, small under the plain one (owner d17). */}
                      {svc.brand ? <span className="block truncate text-[11px] text-ink/50">{svc.brand}</span> : null}
                      <span className="block truncate text-[12.5px] text-ink/60">{svc.status}</span>
                    </>
                  );
                  /* 🔒 In the iPhone app a paid service's page is web-only — its row is status, not a door. */
                  return storeShell && svc.key !== 'nikah' ? (
                    <div key={svc.key} data-home-service={svc.key} className="home-tile">
                      {plain}
                    </div>
                  ) : (
                    <Link key={svc.key} href={serviceHref(svc.key, eventId)} data-home-service={svc.key} className="home-tile">
                      {plain}
                    </Link>
                  );
                })}
            </div>
            {services.some((svc) => svc.size === 'slim') ? (
              <>
                <p className="home-k2 flex items-center" data-home-not-added="">
                  Not added
                  <span className="home-k2-r">
                    {services.filter((svc) => svc.size === 'slim').length === 1 ? 'tap to see what it gives' : 'one line each · tap to see what each gives'}
                  </span>
                </p>
                <div className="home-svc">
                  {services
                    .filter((svc) => svc.size === 'slim' && svc.glance && svc.key !== 'nikah' && svc.key !== 'papic')
                    .map((svc) => (
                      <ServiceSlim key={svc.key} eventId={eventId} svc={svc} glance={svc.glance!} storeShell={storeShell} />
                    ))}
                </div>
              </>
            ) : null}
          </nav>
        ) : null}
      </div>
    </section>
  );
}


/**
 * 🎨 PAPIC'S ROW — the service glance at Home size (owner "approve all",
 * 2026-10-14; prototype `renderHome()`): name · the status line with its dot ·
 * the meter · Buy more (the sheet) · See N photos (opens the gallery directly).
 * The row's words and its "Buy more" are already trimmed by NEVER TWICE when
 * Papic holds the Next card — and only while that card is on screen (`papicRowDoubled`,
 * `[data-while-next]`): a "Later" brings the row's own Buy more straight back (walk-b6 F1).
 */
function PapicServiceRow({
  eventId,
  svc,
  doors,
  left,
  sizes,
  storeShell = false,
}: {
  eventId: string;
  svc: HomeService;
  doors: PapicRowDoors;
  left: number | null;
  sizes: PoolRung[] | null;
  storeShell?: boolean;
}) {
  const photos = typeof doors.glance.result === 'number' && doors.glance.result > 0 ? doors.glance.result : null;
  const acts = storeShell
    ? null
    : doors.buy || photos ? (
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
        {photos ? <PapicSeePhotos tone="neutral" label={seePhotosWord(photos)} href={`/dashboard/${eventId}/studio/papic?gallery=open`} /> : null}
      </>
    ) : null;
  return (
    <ServiceGlanceRow
      href={storeShell ? null : `/dashboard/${eventId}/studio/papic`}
      name={svc.name}
      brand={svc.brand}
      icon={<Camera aria-hidden strokeWidth={1.9} />}
      mood={doors.glance.mood}
      pct={doors.glance.pct}
      line={doors.whileNext?.tail ? { ...doors.line, tailWhileNext: true } : doors.line}
      meterLabel="Credits left"
      actions={acts}
      marker={{ 'data-home-service': 'papic' }}
    />
  );
}


/** One door on a service row — opens its page, plays the song, or opens the Add sheet. */
function ServiceDoorButton({
  eventId,
  row,
  door,
  price,
  tone,
}: {
  eventId: string;
  row: ServiceRowGlance['key'];
  door: ServiceDoor;
  price: number | null;
  tone: ActionTone;
}) {
  if (door.kind === 'add' || door.kind === 'more-screen' || door.kind === 'more-song') {
    return <ServiceBuySheet eventId={eventId} kind={offerForDoor(row, door.kind)} price={price} label={door.label} tone="brand" />;
  }
  if (door.kind === 'hear') return <HearYourSong eventId={eventId} href={serviceDoorHref('hear', eventId)} tone={tone} />;
  const Icon = DOOR_ICON[door.kind];
  return <ActionButton tone={tone} icon={<Icon aria-hidden="true" strokeWidth={1.9} />} label={door.label} href={serviceDoorHref(door.kind, eventId)} />;
}

/**
 * ✅ AN OWNED SERVICE'S ROW (owner "approve all", 2026-10-14 — prototype `rowFull`):
 * mark · plain name with the brand under · the status line (its dot + words, the
 * count bold) · one quiet line · at most two doors. No meter — only Papic has a
 * true total. The doors the Next card already offers are drawn, marked
 * `data-while-next="<moment>"`, and stand down only while that card shows.
 */
function ServiceFullRow({ eventId, svc, glance, storeShell }: { eventId: string; svc: HomeService; glance: ServiceRowGlance; storeShell: boolean }) {
  const Icon = SERVICE_ICON[svc.key];
  const doors = storeShell ? [] : glance.doors;
  const drawn = doors.map((d) => (
    <ServiceDoorButton
      key={d.kind}
      eventId={eventId}
      row={glance.key}
      door={d}
      price={d.kind === 'add' ? glance.price : glance.morePrice}
      tone={doorBuys(d) ? 'brand' : 'neutral'}
    />
  ));
  const acts =
    drawn.length === 0 ? null : svc.whileNext && glance.moment ? (
      <span data-while-next={glance.moment === 'song-ready' ? 'music' : 'live'} className="contents">
        {drawn}
      </span>
    ) : (
      drawn
    );
  return (
    <ServiceGlanceRow
      href={storeShell ? null : serviceHref(svc.key, eventId)}
      name={svc.name}
      brand={svc.brand}
      icon={<Icon aria-hidden strokeWidth={1.9} />}
      mood={glance.mood}
      pct={0}
      meter={false}
      line={glance.line}
      say={glance.say}
      meterLabel=""
      actions={acts}
      pending={glance.ownership === 'waiting'}
      marker={{ 'data-home-service': svc.key, 'data-ownership': glance.ownership }}
    />
  );
}

/**
 * ✅ A SERVICE NOT ADDED YET — or bought and waiting for payment (prototype
 * `rowSlim`): the price under the name, Add on the right; the name opens the
 * page (what it gives). The iPhone app never reaches here with a sale
 * (`homeServices` keeps only what is owned there).
 */
function ServiceSlim({ eventId, svc, glance, storeShell }: { eventId: string; svc: HomeService; glance: ServiceRowGlance; storeShell: boolean }) {
  const Icon = SERVICE_ICON[svc.key];
  const add = glance.doors.find((d) => d.kind === 'add');
  return (
    <ServiceSlimRow
      href={storeShell ? null : serviceHref(svc.key, eventId)}
      name={svc.name}
      brand={svc.brand}
      icon={<Icon aria-hidden strokeWidth={1.9} />}
      lead={glance.slim?.lead ?? null}
      price={glance.slim?.price ?? null}
      tail={glance.slim?.tail ?? ''}
      add={add && !storeShell ? <ServiceBuySheet eventId={eventId} kind={offerForDoor(glance.key, 'add')} price={glance.price} label="Add" tone="brand" /> : null}
      pending={glance.ownership === 'waiting'}
      marker={{ 'data-home-service': svc.key, 'data-ownership': glance.ownership }}
    />
  );
}
