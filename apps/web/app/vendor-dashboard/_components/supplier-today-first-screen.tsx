import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Eye,
  LogOut,
  MessageSquare,
  Play,
  RotateCw,
  Send,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NextCard } from '@/app/_components/next-card';
import { Badge } from '@/app/_components/chips';
import { ActionButton } from '@/components/action-button';
import { Count } from '@/components/count';
import type {
  SupplierIcon,
  SupplierNext,
  SupplierNextSecond,
  SupplierNextTarget,
  SupplierTone,
  SupplierWaitingDoor,
} from '@/lib/supplier-today';
import type { UpcomingEventRow, WhatsNewCard } from '@/lib/vendor-overview';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import { customerLandingHref } from '@/app/vendor-dashboard/customers/anchors';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { SupplierSubmit } from './supplier-submit';

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
      const href = `/vendor-dashboard/clients/${t.eventId}?tab=${t.tab}`;
      return href;
    }
    case 'review': {
      const href = `/vendor-dashboard/reviews#reply_${t.reviewId}`;
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

/** "Sat 3" for a Coming-up row, read in Manila like every date on this page. */
function dayWord(iso: string): string {
  const d = new Date(`${iso}T00:00:00+08:00`);
  const weekday = d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short' });
  const day = d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', day: 'numeric' });
  return `${weekday} ${day}`;
}

const ICONS: Record<SupplierIcon, LucideIcon> = {
  reply: MessageSquare,
  check: Check,
  play: Play,
  send: Send,
  calendar: CalendarDays,
  wallet: Wallet,
  retry: RotateCw,
  forward: ArrowRight,
  people: Users,
  eye: Eye,
};

/*
  🛑 A SERVER COMPONENT HANDS `ActionButton` (a client component) AN ELEMENT,
  NEVER A COMPONENT — a function does not cross to the client and the whole
  Today render fails (the couple's Home learned this on 2026-10-07).
*/
function icon(name: SupplierIcon): ReactElement {
  const I = ICONS[name];
  return <I aria-hidden="true" strokeWidth={1.9} />;
}

/*
  🏷 A STATE ON A ROW ("Live" · "2 of 3") is the shared `Badge` (`chips.tsx`, kind 11): soft fill, no border, its
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
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      ) : null}
    </p>
  );
}

/** One hairline row — label · one line · (a pill) · the chevron. No box. */
export function TodayRow({ href, label, line, pill, lineTone, marker }: {
  href: string;
  label: string;
  line: string | null;
  pill?: ReactNode;
  lineTone?: 'warn';
  marker?: string;
}) {
  return (
    <Link href={href} className="home-row min-h-11" {...(marker ? { 'data-today-row': marker } : {})}>
      <span className="min-w-0">
        <span className="home-t block truncate text-[15px] leading-tight text-ink">{label}</span>
        {line ? (
          <span
            className="block truncate text-[13px] text-ink/60"
            style={lineTone === 'warn' ? { color: 'rgb(var(--color-warn))' } : undefined}
          >
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

export type SupplierTodayNumbers = {
  /** Answers owed to customers — already worded ("3", "2+"), or null when the desk could not be read. */
  waiting: string | null;
  /** True when at least one is waiting — the number wears the waiting colour. */
  waitingNow: boolean;
  /** Booked events in the next seven days — already worded ("2", "5+"). */
  thisWeek: string;
  /** Still to come in from booked customers — already worded ("₱48K"), or null when payday could not be read. */
  toComeIn: string | null;
};

export type SupplierTodayFirstScreenProps = {
  next: SupplierNext;
  /** The Next card's main button — colour and icon (`nextLook`). */
  look: { tone: SupplierTone; icon: SupplierIcon };
  /** The second, grey button, or null (`nextSecond`). */
  second: SupplierNextSecond | null;
  /** "1 of 3", or null. */
  counter: string | null;
  /** A few words after the eyebrow ("Waiting 2 h"), or null. */
  meta: string | null;
  /**
   * 🗓 The Next card IS a date-change request: it carries the two answers
   * itself (prototype frame 31). The shipped action, the shipped hidden
   * fields — the same form the desk row below keeps.
   */
  dateChange?: {
    card: Extract<WhatsNewCard, { kind: 'date_change' }>;
    answer: (formData: FormData) => void | Promise<void>;
  } | null;
  numbers: SupplierTodayNumbers;
  /** The next three booked events (already sliced). */
  comingUp: readonly UpcomingEventRow[];
  /** "Also waiting" — the desk's remaining asks, drawn by the page (they post server actions). */
  alsoWaiting?: ReactNode;
  /**
   * True when `alsoWaiting` draws its own "Also waiting" heading (there is an
   * ask row, or the desk could not be read). When it does not, the doors below
   * carry the heading themselves — a row is never drawn under the wrong one.
   */
  alsoWaitingHeaded?: boolean;
  /** The rules that are not a customer's ask, each a door (`supplierWaiting().doors`). */
  doors?: readonly SupplierWaitingDoor[];
  /** The one Shop row: the shop's name, and its state in a few words. */
  shop: { name: string; line: string; live: boolean };
};

/**
 * 📱 THE SUPPLIER'S TODAY — redrawn 2026-10-08 to the owner-approved redesign
 * (corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Today" + § 3;
 * prototype `prototypes/supplier_dashboard_2026-10-08_fable.html` frames 01 ·
 * 02 · 15 · 31). The first screen approved on 2026-10-01 is kept; what was
 * "See everything" under it is now part of the same column:
 *
 *   ONE Next card (its main verb + a grey second; "1 of 3") → three numbers →
 *   Coming up (3) → Also waiting (the rest of the queue) → one Shop row.
 *
 * A server component: every figure arrives already read and already worded.
 *
 * 🔘 Every control is an `ActionButton` — the main verb terracotta (`brand`,
 * owner 2026-10-12: the meaning colours ended for main buttons), the second
 * grey — or, where it posts a form, a `SupplierSubmit`. 44 px tall each.
 *
 * 🌑 On an event day the card goes ink (`day`), its title is the event, and
 * its button is **Run the day**.
 *
 * 🔴 A failed read never reads as success: an unread desk says "Some answers
 * couldn't load" on the Next card (the danger wash) and "couldn't load" on its
 * number; an unread payday says "couldn't load" where the money would be —
 * never ₱0, and never a number that quietly is not there.
 *
 * 🔒 THE NEXT CARD IS THE FIRST THING YOU CAN TAP. Nothing tappable is drawn
 * above it; `the-today-page-speaks-to-every-supplier.test.ts` renders this and
 * fails if a link or button comes before the Next card's own.
 */
export function SupplierTodayFirstScreen({
  next,
  look,
  second,
  counter,
  meta,
  dateChange = null,
  numbers,
  comingUp,
  alsoWaiting,
  alsoWaitingHeaded = false,
  doors = [],
  shop,
}: SupplierTodayFirstScreenProps) {
  const day = next.kind === 'run_day';
  const unread = next.kind === 'unread';
  const greyClass = day ? 'home-cover-ab' : undefined;

  const actions = dateChange ? (
    /* 🗓 Move · Unlock — the request's own two answers, ON the card (frame 31).
       `contents` keeps both forms in the card's one button row. */
    <>
      <form action={dateChange.answer} className="contents" data-date-change-next={dateChange.card.eventVendorId}>
        <input type="hidden" name="vendor_id" value={dateChange.card.eventVendorId} />
        <input type="hidden" name="answer" value="moved" />
        <SupplierSubmit tone="brand" main icon={<Check aria-hidden="true" strokeWidth={1.9} />} label="Move" pendingLabel="Saving…" />
      </form>
      <form action={dateChange.answer} className="contents">
        <input type="hidden" name="vendor_id" value={dateChange.card.eventVendorId} />
        <input type="hidden" name="answer" value="unlocked" />
        <SupplierSubmit tone="neutral" icon={<LogOut aria-hidden="true" strokeWidth={1.9} />} label="Unlock" pendingLabel="Releasing…" />
      </form>
    </>
  ) : (
    <>
      <ActionButton tone={look.tone} main icon={icon(look.icon)} label={next.action} href={unread ? '/vendor-dashboard' : nextHref(next.target)} className="min-h-11" />
      {second ? (
        <ActionButton
          tone="neutral"
          icon={icon(second.label === 'Chat' ? 'reply' : 'eye')}
          label={second.label}
          href={second.to === 'card' ? customerCardHref(second.eventId, 'details') : second.href}
          className={`min-h-11${greyClass ? ` ${greyClass}` : ''}`}
        />
      ) : null}
    </>
  );

  return (
    <section data-today-first-screen aria-label="Today" className="mx-auto flex w-full max-w-xl flex-col">
      {/* ① THE ONE NEXT CARD — the shared card, drawn with the button rule's row. */}
      <NextCard
        marker="data-today-next"
        kind={next.kind}
        title={next.title}
        body={next.body}
        action={next.action}
        href={nextHref(next.target)}
        bad={unread}
        day={day}
        soft
        counter={counter}
        meta={meta}
        actions={actions}
        note={
          dateChange
            ? 'Unlocking releases this booking. Any payment is settled by the cancellation terms on the booking — Setnayan never decides a refund.'
            : undefined
        }
      />

      {/* ② THREE NUMBERS — each goes to the list it counts. A read that failed
          says so in words, in the number's own place — never 0, never ₱0. */}
      <div className="mt-3 grid grid-cols-3 gap-1 border-y border-ink/10 py-3" data-today-numbers>
        <Link href="/vendor-dashboard/customers?lane=waiting#customers" className="grid gap-0.5 text-center" data-today-number="waiting">
          {numbers.waiting === null ? (
            <Unread />
          ) : (
            <>
              {/* Something waits → the number wears the app's accent (the token, never a colour written here). */}
              <span className={`block text-[26px] font-semibold leading-none tabular-nums ${numbers.waitingNow ? 'text-sn-accent' : 'text-ink'}`}>
                <Figure word={numbers.waiting} id="today-waiting" />
              </span>
              <span className="block text-[11.5px] text-ink/60">waiting on you</span>
            </>
          )}
          <TapMark />
        </Link>
        <Link href="/vendor-dashboard/calendar" className="grid gap-0.5 text-center" data-today-number="week">
          <span className="block text-[26px] font-semibold leading-none tabular-nums text-ink">
            <Figure word={numbers.thisWeek} id="today-week" />
          </span>
          <span className="block text-[11.5px] text-ink/60">events this week</span>
          <TapMark />
        </Link>
        <Link href={customerLandingHref('payday')} className="grid gap-0.5 text-center" data-today-number="money" data-money="">
          {numbers.toComeIn === null ? (
            <Unread />
          ) : (
            <>
              <span className="block text-[26px] font-semibold leading-none tabular-nums text-ink">{numbers.toComeIn}</span>
              <span className="block text-[11.5px] text-ink/60">to come in</span>
            </>
          )}
          <TapMark />
        </Link>
      </div>

      {/* ③ COMING UP — the next three booked events, each opening its customer. */}
      <div data-today-coming-up>
        <TodayEyebrow door={{ label: 'All dates', href: '/vendor-dashboard/calendar' }}>Coming up</TodayEyebrow>
        {comingUp.length === 0 ? (
          <p className="py-2 text-sm text-ink/60">No booked events yet.</p>
        ) : (
          <div className="[&>a:first-child]:border-t-0">
            {comingUp.map((row) => (
              <TodayRow key={row.id} href={row.href} label={`${dayWord(row.date)} · ${row.eventName}`} line={row.place} marker="coming-up" />
            ))}
          </div>
        )}
      </div>

      {/* ④ ALSO WAITING — the rest of the queue: the asks (answered in place),
          then the rules that are not a customer's ask, each a door. */}
      {alsoWaiting}
      {doors.length > 0 ? (
        <div data-today-doors className={alsoWaitingHeaded ? undefined : '[&>a:first-of-type]:border-t-0'}>
          {alsoWaitingHeaded ? null : <TodayEyebrow>Also waiting</TodayEyebrow>}
          {doors.map((d) => (
            <TodayRow key={d.id} href={nextHref(d.target)} label={d.label} line={d.line} lineTone="warn" marker={d.id} />
          ))}
        </div>
      ) : null}

      {/* ⑤ THE ONE SHOP ROW — what the shop line at the top used to say. */}
      <div data-today-shop>
        <TodayEyebrow door={{ label: 'Open', href: '/vendor-dashboard/shop' }}>Shop</TodayEyebrow>
        <div className="[&>a:first-child]:border-t-0">
          <TodayRow
            href="/vendor-dashboard/shop"
            label={shop.name}
            line={shop.line}
            pill={shop.live ? <Badge tone="ok" data="shop">Live</Badge> : undefined}
            marker="shop"
          />
        </div>
      </div>
    </section>
  );
}

/**
 * ➜ THE SMALL MARK UNDER A NUMBER — each of the three numbers is a door to the list it counts, and says so the way
 * every other door on the page does: a small terracotta arrow (owner 2026-10-12: the numbers stay tappable "with a
 * small terracotta mark under each"). Decorative — the link's words already name it.
 */
function TapMark() {
  return <ChevronRight aria-hidden data-today-tapmark="" className="mx-auto mt-0.5 h-3.5 w-3.5 text-sn-accent" strokeWidth={2.2} />;
}

/** A number counts to its value (`Count`); a word ("5+", "2+") is shown as it is. */
function Figure({ word, id }: { word: string; id: string }) {
  const n = /^\d+$/.test(word) ? Number(word) : null;
  return n === null ? <>{word}</> : <Count value={n} id={id} />;
}

/** The read did not happen — said in the number's own place. */
function Unread() {
  return (
    <>
      <span className="block text-[26px] font-semibold leading-none" style={{ color: 'rgb(var(--color-warn))' }} aria-hidden>
        —
      </span>
      <span className="block text-[11.5px] text-ink/60" data-today-unread="">
        couldn&rsquo;t load
      </span>
    </>
  );
}
