import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  BarChart3,
  CalendarDays,
  CalendarX,
  ClipboardList,
  Check,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  ImagePlus,
  MessageSquare,
  ScanLine,
  Settings,
  Star,
  Store,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import type { ShopPill, SupplierNextTarget, TodayNeed, TodayRowIcon } from '@/lib/supplier-today';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import { customerLandingHref } from '@/app/vendor-dashboard/customers/anchors';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { EventsYouRunRows } from './events-you-run-rows';
import type { EventYouRun } from '@/lib/events-you-run';
import { EVENTS_YOU_RUN_HREF } from '@/lib/events-you-run-words';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from '@/lib/inspiration-library-entry';

/**
 * Where a Next button (or an Also-waiting door) goes. Written as `href:`
 * literals ON PURPOSE — the port-controls scan (`scripts/port-controls.mjs`)
 * only sees an `href` followed by a literal, which is why the host's `nextHref`
 * is shaped the same way.
 *
 * The three Customers-hub doors (quote · contract · payday) are the exception:
 * they come from the anchors module so each lands ON its own fold, opened and in
 * view — never the bare stub that reloads the roster.
 */
export function nextHref(t: SupplierNextTarget): string {
  switch (t.to) {
    case 'thread': {
      const href = `/vendor-dashboard/messages/${t.threadId}`;
      return href;
    }
    case 'card': {
      // THE ONE BUILD integration: every door into a client is built by ONE function (`customerCardHref`).
      const href = customerCardHref(t.eventId, t.tab);
      return href;
    }
    case 'review': {
      const href = `/vendor-dashboard/website#reply_${t.reviewId}`;
      return href;
    }
    case 'proposals': {
      const href = customerLandingHref('proposals');
      return href;
    }
    case 'contracts': {
      const href = customerLandingHref('contracts');
      return href;
    }
    case 'event-hub': {
      const href = '/vendor-dashboard/on-the-day';
      return href;
    }
    case 'fee':
      return vendorBookingFeePayPath(t.orderId);
    case 'payday': {
      const href = customerLandingHref('payday');
      return href;
    }
    case 'customers': {
      const href = '/vendor-dashboard/customers';
      return href;
    }
    case 'dates': {
      // "See the month" — Customers › Dates (S-PR3), the month and its days.
      const href = '/vendor-dashboard/customers?seg=dates';
      return href;
    }
    case 'day': {
      const href = `/vendor-dashboard/customers?seg=dates&day=${t.date}`;
      return href;
    }
    case 'today': {
      // The answers given on this page sit under "Also waiting" (the id is the
      // one every older link already names).
      const href = '/vendor-dashboard#whats-new';
      return href;
    }
    case 'given':
      return t.href;
  }
}

/* ── 🔵 THE ROW'S ROUND ICON (prototype `.row .ico`: a 36 px circle on the soft gold wash, the icon in ink) ─────── */
const ROW_ICONS: Record<TodayRowIcon, LucideIcon> = {
  // 🗂 An event this supplier runs as the hosts' coordinator (owner 2026-10-28) — the Events tab's own glyph.
  run: ClipboardList,
  chat: MessageSquare,
  calendar: CalendarDays,
  calx: CalendarX,
  peso: Wallet,
  clock: Clock,
  file: FileText,
  star: Star,
  help: HelpCircle,
  shop: Store,
  chart: BarChart3,
  scan: ScanLine,
  people: Users,
  check: Check,
  remove: Trash2,
  gear: Settings,
  image: ImagePlus,
};

/** A list row's mark — decorative (the row's words name it), so hidden from the reader. */
export function RowIcon({ name }: { name: TodayRowIcon }) {
  const I = ROW_ICONS[name];
  return (
    <span
      aria-hidden
      data-row-icon={name}
      className="grid h-9 w-9 flex-none place-items-center rounded-full text-ink"
      style={{ background: 'color-mix(in srgb, rgb(var(--color-gild)) 16%, transparent)' }}
    >
      <I className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </span>
  );
}

/*
  🏷 A STATE ON A ROW ("Live" · "2 d") is the shared `Badge` (`chips.tsx`, kind 11): soft fill, no border, its
  word always (owner 2026-10-12, look call 7). This file draws no pill of its own.

  ➜ The small mark that says "you can tap this" — a row's arrow, a list's door, the mark under a number — is the
  app's accent (`text-sn-accent`), never grey (INTERACTION_RULES § 9, owner 2026-10-08 on a grey arrow:
  *"teracota?"*; 2026-10-12 look call 8: lists are hairline rows with a terracotta arrow).
*/

/** The small capitals over a list, with one optional door on the right. */
export function TodayEyebrow({ children, door }: { children: ReactNode; door?: { label: string; href: string } }) {
  return (
    <p className="home-k2 flex items-center gap-2">
      {children}
      {door ? (
        <Link href={door.href} className="ml-auto inline-flex min-h-11 items-center gap-0.5 text-[12.5px] font-medium normal-case tracking-normal text-sn-accent">
          {door.label}
          <ChevronRight aria-hidden className="h-3.5 w-3.5 text-sn-accent" strokeWidth={2} />
        </Link>
      ) : null}
    </p>
  );
}

const LINE_TONE: Record<'warn' | 'danger', string> = {
  warn: 'rgb(var(--color-warn))',
  danger: 'rgb(var(--color-danger))',
};

/** One hairline row — (its round icon) · label · one line · (a pill) · the chevron. No box. */
export function TodayRow({ href, label, line, pill, lineTone, marker, rowIcon, attrs }: {
  href: string;
  label: string;
  line: string | null;
  pill?: ReactNode;
  lineTone?: 'warn' | 'danger' | null;
  marker?: string;
  rowIcon?: TodayRowIcon;
  /** Data hooks for the page's own narrowing (Needs you today's search + Show: `data-today-need`, `…-kind`). */
  attrs?: Record<`data-${string}`, string>;
}) {
  return (
    <Link href={href} className={`home-row min-h-11${rowIcon ? ' !grid-cols-[36px_minmax(0,1fr)_auto]' : ''}`} {...(marker ? { 'data-today-row': marker } : {})} {...attrs}>
      {rowIcon ? <RowIcon name={rowIcon} /> : null}
      <span className="min-w-0">
        <span className="home-t block truncate text-[15px] leading-tight text-ink">{label}</span>
        {line ? (
          <span className="block truncate text-[13px] text-ink/60" style={lineTone ? { color: LINE_TONE[lineTone] } : undefined}>
            {line}
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-2">
        {pill}
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
      </span>
    </Link>
  );
}

/** A row that only SAYS something (no door) — a fact before Agree: "Hall A is booked that day · Taken". */
export function TodayNoteRow({ label, line, pill, rowIcon, marker }: {
  label: string;
  line: string | null;
  pill?: ReactNode;
  rowIcon: TodayRowIcon;
  marker?: string;
}) {
  return (
    <div role="note" className="home-row min-h-11 !grid-cols-[36px_minmax(0,1fr)_auto]" {...(marker ? { 'data-today-note': marker } : {})}>
      <RowIcon name={rowIcon} />
      <span className="min-w-0">
        <span className="home-t block text-[15px] leading-tight text-ink">{label}</span>
        {line ? <span className="block text-[13px] text-ink/60">{line}</span> : null}
      </span>
      <span className="flex items-center gap-2">{pill}</span>
    </div>
  );
}

/** One Coming-up row, already worded by the page ("Sat 17 Oct · Reyes debut" / "Main team · from outside"). */
export type TodayComingUpRow = {
  id: string;
  href: string;
  label: string;
  line: string | null;
  outside?: boolean;
};

/** The status line after an answer — the shipped sentence, and its door when it asks for one (fee held → Pay). */
export type TodayOutcome = { text: string; tone: 'ok' | 'note' | 'bad'; door?: { label: string; href: string } | null };

export type SupplierTodayFirstScreenProps = {
  /** 👋 The cover (`TodayCover`) — a running shop only; a new shop's six steps take the top instead. */
  cover?: ReactNode;
  /** 📸 Next events (`TodayNextEvents`). */
  nextEvents?: ReactNode;
  /** 📊 The five stats (`TodayStats`). */
  stats?: ReactNode;
  /** 📋 Needs you today — every row, in order; each JUMPS (`nextHref(row.target)`). */
  needs: readonly TodayNeed[];
  /** "N · 12 MN – 12 MN" — the same count as the cover's chip (null = the desk could not be read and shows nothing). */
  needsCount: number | null;
  /** The outcome of an answer given elsewhere that redirected here (a booking ask · a date change · a payment). */
  outcome?: TodayOutcome | null;
  /** "Also today" on an event day — the day's schedule and the Event Hub's tools. */
  alsoToday?: ReadonlyArray<{ id: string; label: string; line: string | null; href: string; icon: TodayRowIcon }>;
  /** The next three booked events, Setnayan and outside, already worded. */
  comingUp: readonly TodayComingUpRow[];
  /** 🗂 "Events you run" — empty for everyone but a coordinator. */
  eventsYouRun?: readonly EventYouRun[];
  /** 💸 The unpaid booking fees (`<BookingFeeBills today>`), drawn by the page; counted in `needsCount`. */
  bills?: ReactNode;
  hasBills?: boolean;
  /** The one Shop row: the shop's name, its state in a few words, and the pill (Checking · Live · Not yet). */
  shop: { name: string; line: string; pill: ShopPill };
  /** "How is business" — "312 looked · 14 asked", or null when it was not read. */
  business?: { line: string | null } | null;
  /** 🌱🖼 "Add to the inspiration library" — only when the shop's trades supply a part. */
  library?: boolean;
  /** 🧰 A new shop's six steps, done in place (`SupplierSetupScreen`) — the top of Today while the shop is not live. */
  setup?: ReactNode;
  /** 🔍 The thumb row (`TodayThumbRow`: Search today · Show ▾) — drawn by the page. */
  thumb?: ReactNode;
};

const PILL_TONE: Record<ShopPill, BadgeTone> = { Checking: 'wait', Live: 'ok', 'Not yet': 'wait' };

/**
 * 📱 THE SUPPLIER'S TODAY — THE ONE BUILD (owner 8 Nov 2026, *"Approved suuplier dashboard"*; contract prototype
 * `supplier-menu-r2.v113.html`, Today; spec A2 part A):
 *
 *   the cover ("Good morning, <Shop>" · date · N tasks · ⚙) → Next events → the five stats (each a link) → Needs you
 *   today (one row per thing waiting, each JUMPING to its page) → the sections with no ruled place, unchanged: Also
 *   today (an event day) · Events you run · Coming up · the Shop row · How is business · the inspiration library.
 *
 * Retired here (v103): the Next card (its order is the row order; its doors are rows), the counts row that filtered in
 * place (A5 — the stats jump instead), and every answer given in place (A7 — owner v112 *"Jump"*). The date-change and
 * delete-request answers moved to the client's Details (`ClientDayAnswers`, A8).
 *
 * A server component: every figure arrives already read and already worded. A failed read never reads as success —
 * an unread desk is a "Some answers couldn’t load" row, an unread stat says "couldn’t load".
 * 🔒 app/vendor-dashboard/_components/today-rows-jump.test.ts
 */
export function SupplierTodayFirstScreen({
  cover = null,
  nextEvents = null,
  stats = null,
  needs,
  needsCount,
  outcome = null,
  alsoToday = [],
  comingUp,
  eventsYouRun = [],
  bills = null,
  hasBills = false,
  shop,
  business = null,
  library = false,
  setup = null,
  thumb = null,
}: SupplierTodayFirstScreenProps) {
  const nothing = needs.length === 0 && !hasBills;
  return (
    <section data-today-first-screen aria-label="Today" className="mx-auto flex w-full max-w-xl tab:max-w-none flex-col">
      {/* 🧰 A NEW SHOP: the six steps, done in place — the top of Today (owner 2026-10-28; no cover row, as shipped). */}
      {setup}
      {setup ? null : cover}
      {setup ? null : nextEvents}
      {setup ? null : stats}

      {/* THE ANSWER'S STATUS LINE — the whole sentence of an answer that redirected here, with the door it asks for. */}
      {outcome ? (
        <div
          role="status"
          data-supplier-outcome={outcome.tone}
          className={`mb-1 flex items-center gap-3 py-2.5 text-[13.5px] leading-snug ${outcome.tone === 'bad' ? 'text-[rgb(var(--color-danger))]' : 'text-ink/80'}`}
        >
          <span className="min-w-0 flex-1">{outcome.text}</span>
          {outcome.door ? (
            <ActionButton tone="neutral" icon={<Wallet aria-hidden="true" strokeWidth={1.9} />} label={outcome.door.label} href={outcome.door.href} className="min-h-11 shrink-0" />
          ) : null}
        </div>
      ) : null}

      {/* 📋 NEEDS YOU TODAY — one row per thing waiting, in the app's words; EVERY row is ONE link to its page. */}
      <div data-today-needs="" data-tour="today-needs" id="whats-new">
        {/* 🔦 `today-next`: the app-wide supplier tour's Today stop (it lit the retired Next card); `today-needs` (the
            section) is Today's own page tour's. */}
        <p className="hc-k2" data-tour="today-next">
          <span>Needs you today</span>
          <em data-today-needs-count="">{needsCount === null ? '12 MN – 12 MN' : `${formatCount(needsCount)} · 12 MN – 12 MN`}</em>
        </p>
        <div className="[&>*:first-child]:border-t-0" data-today-needs-rows="">
          {needs.map((n) => (
            <TodayRow
              key={n.key}
              href={nextHref(n.target)}
              label={n.label}
              line={n.line}
              lineTone={n.lineTone ?? null}
              rowIcon={n.icon}
              marker={n.key}
              attrs={{ 'data-today-need': n.key, 'data-today-need-kind': n.kind ?? 'other' }}
              pill={n.pill ? <Badge tone={n.pill.tone} data="today-need">{n.pill.word}</Badge> : undefined}
            />
          ))}
          {hasBills ? (
            /* 💸 Every unpaid booking fee, each with its own Pay (owner 2026-09-20: "i never saw the payment screen to
               pay us") — the shipped rows, kind "Payments" for Show. */
            <div data-today-need-bills="" data-today-need-kind="payments" className="[&>div]:border-t [&>div]:border-ink/10">
              {bills}
            </div>
          ) : null}
          {nothing ? (
            <TodayNoteRow label="Nothing waiting on you" line="New asks land here first" rowIcon="check" marker="waiting-empty" />
          ) : null}
        </div>
        <p hidden data-today-needs-none="" className="py-4 text-center text-[13.5px] text-ink/60">
          Nothing waiting matches that search
        </p>
      </div>

      {/* 🌑 ALSO TODAY — on an event day, the day's own rows (Schedule · the Event Hub's tools). */}
      {alsoToday.length > 0 ? (
        <div data-today-also-today>
          <TodayEyebrow>Also today</TodayEyebrow>
          <div className="[&>a:first-child]:border-t-0">
            {alsoToday.map((r) => (
              <TodayRow key={r.id} href={r.href} label={r.label} line={r.line} rowIcon={r.icon} marker={`today-${r.id}`} />
            ))}
          </div>
        </div>
      ) : null}

      {/* 🗂 EVENTS YOU RUN — only for a supplier the hosts made their coordinator, while that access is live. */}
      {eventsYouRun.length > 0 ? (
        <div data-today-events-you-run>
          <TodayEyebrow door={{ label: 'All', href: EVENTS_YOU_RUN_HREF }}>Events you run</TodayEyebrow>
          <EventsYouRunRows events={eventsYouRun.slice(0, 3)} where="today" />
        </div>
      ) : null}

      {/* ③ COMING UP — the next three booked events (Setnayan and outside), each opening its day. */}
      <div data-today-coming-up data-tour="today-coming-up">
        <TodayEyebrow door={{ label: 'All dates', href: '/vendor-dashboard/customers?seg=dates' }}>Coming up</TodayEyebrow>
        {comingUp.length === 0 ? (
          <div className="[&>a:first-child]:border-t-0">
            <TodayRow href="/vendor-dashboard/customers?add=outside" label="No bookings yet" line="Add the ones you already have" rowIcon="calendar" marker="coming-up-empty" />
          </div>
        ) : (
          <div className="[&>a:first-child]:border-t-0">
            {comingUp.map((row) => (
              <TodayRow key={row.id} href={row.href} label={row.label} line={row.line} rowIcon="calendar" marker={row.outside ? 'coming-up-outside' : 'coming-up'} />
            ))}
          </div>
        )}
      </div>

      {/* ⑤ THE SHOP ROW — its state (Checking · Live · Not yet) — and how business is doing. */}
      <div data-today-shop data-tour="today-shop">
        <TodayEyebrow door={{ label: 'Open', href: '/vendor-dashboard/shop' }}>Shop</TodayEyebrow>
        <div className="[&>a:first-child]:border-t-0">
          <TodayRow
            href="/vendor-dashboard/shop"
            label={shop.name}
            line={shop.line}
            pill={
              <Badge tone={PILL_TONE[shop.pill]} data="shop">
                {shop.pill}
              </Badge>
            }
            marker="shop"
            rowIcon="shop"
          />
          <TodayRow href="/vendor-dashboard/performance" label="How is business" line={business?.line ?? 'Views, asks and bookings'} marker="business" rowIcon="chart" />
          {library ? (
            <TodayRow
              href={INSPIRATION_LIBRARY_HREF}
              label={INSPIRATION_LIBRARY_ROW.label}
              line={INSPIRATION_LIBRARY_ROW.line}
              marker="inspiration-library"
              rowIcon="image"
            />
          ) : null}
        </div>
      </div>

      {thumb}
    </section>
  );
}

