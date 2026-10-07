import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, Camera, CalendarDays, Check, Info, ListChecks, Mail, Sparkles, UserPlus, type LucideIcon } from 'lucide-react';
import { NextCard } from '@/app/_components/next-card';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import type { HomeNext, HomeNextKind, HomeService, HomeServiceKey } from '@/lib/home-first-screen';
import type { HomeFigures } from '@/lib/home-facts';
import type { HomeCover } from '@/lib/home-cover';
import type { NavIconDescriptor } from '@/lib/nav-registry-types';
import { completeTour } from '@/lib/tour-actions';
import { HUB_SETUP_OFFER_TOUR } from '@/lib/tours';
import { HomeDoorways, HomeLater, HomeReload, HomeWhatsNext, type HomeDoorKey } from './home-parts';

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

const SERVICE_ICON: Record<HomeServiceKey, LucideIcon> = { papic: Camera, ai: Sparkles, nikah: BookOpen };

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
  /** 🧭 The bottom bar's registry icon for the three doorway tabs (`getNavSlotMap`). */
  doorIcons?: Record<HomeDoorKey, NavIconDescriptor | null>;
  /** 📋 What's next — the decisions, unfolding in place (`EventDashboard only="whatsnext"`). */
  whatsNext?: ReactNode;
};

const NO_DOOR_ICONS: Record<HomeDoorKey, NavIconDescriptor | null> = { guests: null, explore: null, launch: null };

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
  doorIcons = NO_DOOR_ICONS,
  whatsNext,
}: HomeFirstScreenProps) {
  const guestsUnread = figures ? figures.coming === null : coming === '—';
  const moneyUnread = figures ? figures.money === 'unread' : money !== null && money.paid === '—';
  const m = figures && figures.money && figures.money !== 'unread' ? figures.money : null;
  const paidPct = m && m.paid + m.owing > 0 ? Math.round((m.paid / (m.paid + m.owing)) * 100) : null;
  const nb = NEXT_BUTTON[next.kind];
  const nextMain =
    next.kind === 'unread' ? (
      <HomeReload main />
    ) : (
      <ActionButton tone={nb.tone} main icon={nb.icon} label={next.action} href={nextHref(next.kind, eventId)} />
    );
  return (
    <section
      data-home-first-screen
      aria-label="Home"
      className="mx-auto flex w-full max-w-xl flex-col gap-3 lg:max-w-3xl"
    >
      {/* 📋 EVENT DETAILS sits beside the name, on the cover (owner 2026-10-01,
          "EVENT DETAILS LIVES ON EVENT HOME") — the one information-only sheet. */}
      {/* 🖼 …and it wears the Event Hub's main background (owner 2026-10-07, #6394), the
          words in the hub's own measured ink over its veil (`lib/home-cover.ts`). */}
      <div
        data-home-cover={ground?.kind ?? 'colour'}
        className={`relative flex items-end justify-between gap-3 overflow-hidden rounded-2xl px-4 py-[18px] ${ground ? '' : 'bg-mulberry text-cream'}`}
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
          <p className={`text-[12px] uppercase tracking-[0.12em] ${ground ? 'opacity-85' : 'text-cream/85'}`}>{cover.eyebrow}</p>
          <p aria-hidden className="text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">{cover.name}</p>
        </div>
        <span className="relative shrink-0" data-home-event-details="">
          <ActionButton tone="neutral" icon={Info} label="Event Details" href={`/dashboard/${eventId}/details`} className="home-cover-ab" />
        </span>
      </div>

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
                <ActionButton type="submit" tone="neutral" icon={CalendarDays} label="Later" data-testid="home-next-later" />
              </form>
            ) : next.kind !== 'unread' ? (
              <HomeLater eventId={eventId} kind={next.kind} />
            ) : null}
          </>
        }
      />

      {/* ② THE THREE DOORS (owner 2026-10-07: "maybe add the 3 buttons. Edit your
          Gueslist, Edit your Suppliers, Edit your Event Hub") — the bottom bar's icons. */}
      <HomeDoorways eventId={eventId} icons={doorIcons} />

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
            <div className="font-semibold" style={{ color: 'rgb(var(--color-danger))' }}>
              Guest counts couldn&rsquo;t load
            </div>
            <div className="home-s mb-1.5">Not zero — unread.</div>
            <HomeReload />
          </div>
        ) : (
          <>
            <Link href={`/dashboard/${eventId}/guests`} className="home-tile">
              <div className="home-v">
                <Figure n={figures?.coming} word={coming} id="home-coming" />
              </div>
              <div className="home-k">coming</div>
            </Link>
            <Link href={`/dashboard/${eventId}/guests`} className="home-tile">
              <div className="home-v" style={noReplyWaiting ? { color: 'rgb(var(--color-warn))' } : undefined}>
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
            <div className="home-s mb-1.5">Paid and still owing are unread — not ₱0.</div>
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
              opens your budget in Suppliers
            </div>
          </Link>
        )
      ) : null}

      {/* ⑤ WHAT'S NEXT — the one row; it unfolds in place (H7), no sheet. */}
      {whatsNext ?? <HomeWhatsNext open={null} rows={[]} checklist={{ href: `/dashboard/${eventId}/checklist`, pct: null }} />}

      {/* ⑥ YOUR SERVICES — compact, one line each; never the one that is Next. */}
      {services.length > 0 ? (
        <nav aria-label="Your services" data-home-services className="flex flex-col">
          <p className="home-k2 !mt-1">Your services</p>
          <div className="home-svc">
            {services.map((svc) => {
              const Icon = SERVICE_ICON[svc.key];
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
      ) : null}
    </section>
  );
}
