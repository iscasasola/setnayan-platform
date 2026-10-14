import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarX,
  Check,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  Play,
  Plus,
  RotateCw,
  ScanLine,
  Send,
  Settings,
  Star,
  Store,
  Trash2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NextCard } from '@/app/_components/next-card';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ActionButton } from '@/components/action-button';
import { Count } from '@/components/count';
import type {
  ShopPill,
  SupplierIcon,
  SupplierNext,
  SupplierNextTarget,
  SupplierTone,
  SupplierWaitingDoor,
  TodayNextSecond,
  TodayRowIcon,
} from '@/lib/supplier-today';
import type { WhatsNewCard } from '@/lib/vendor-overview';
import { vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';
import { customerLandingHref } from '@/app/vendor-dashboard/customers/anchors';
import { customerCardHref } from '@/lib/upcoming-schedule-door';
import { SupplierSubmit } from './supplier-submit';
import { TodayFigure } from './today-figure';

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

/* ── 🔵 THE ROW'S ROUND ICON (prototype `.row .ico`: a 36 px circle on the soft gold wash, the icon in ink) ─────── */
const ROW_ICONS: Record<TodayRowIcon, LucideIcon> = {
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
export function TodayRow({ href, label, line, pill, lineTone, marker, rowIcon }: {
  href: string;
  label: string;
  line: string | null;
  pill?: ReactNode;
  lineTone?: 'warn' | 'danger' | null;
  marker?: string;
  rowIcon?: TodayRowIcon;
}) {
  return (
    <Link href={href} className={`home-row min-h-11${rowIcon ? ' !grid-cols-[36px_minmax(0,1fr)_auto]' : ''}`} {...(marker ? { 'data-today-row': marker } : {})}>
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

export type SupplierTodayNumbers = {
  /** Answers owed to customers — already worded ("3", "2+"), or null when the desk could not be read. */
  waiting: string | null;
  /** True when at least one is waiting — the number wears the waiting colour. */
  waitingNow: boolean;
  /** Booked events in the next seven days, Setnayan and outside — already worded ("2", "5+"). */
  thisWeek: string;
  /** Still to come in from booked customers — already worded ("₱48K"), or null when payday could not be read. */
  toComeIn: string | null;
  /**
   * 🌑 ON AN EVENT DAY the last two numbers become the day's own (prototype moment "Event day"): the next moment
   * ("3:30") and how many checked in ("118"). Each opens the Event Hub. Null → the normal three.
   */
  day?: { next: string | null; checkedIn: string | null } | null;
};

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
  next: SupplierNext;
  /** The Next card's main button — colour and icon (`nextLook`). */
  look: { tone: SupplierTone; icon: SupplierIcon };
  /** The second, grey button, or null (`todayNextSecond`). */
  second: TodayNextSecond | null;
  /** "1 of 3", or null. */
  counter: string | null;
  /** A few words after the eyebrow ("Waiting 2 h"), or null. */
  meta: string | null;
  /** The couple's initials, in the circle before the title ("RC"), or null (`nextWho`). */
  who?: string | null;
  /** The eyebrow, when it is not "Your next step" — an event day says "Today · live since 12:00". */
  eyebrow?: string | null;
  /**
   * 🗓 The Next card IS a date-change request: it carries the two answers
   * itself (prototype frame 31). The shipped action, the shipped hidden
   * fields — the same form the desk row below keeps.
   */
  dateChange?: {
    card: Extract<WhatsNewCard, { kind: 'date_change' }>;
    answer: (formData: FormData) => void | Promise<void>;
  } | null;
  /**
   * ✅ The Next card IS a couple's booking ask: the answer is ON the card (prototype moment "The couple asks to
   * book") — the booking fee named above Agree, Agree to this booking, Turn it down — drawn by the page with the
   * SHIPPED answer (`LockRequestAnswer`, `vendorAgreeToLock` / `vendorDeclineLock`), never a second form.
   */
  answerOnCard?: ReactNode;
  /** The outcome of an answer, drawn right under the Next card (the prototype's status line), with its door. */
  outcome?: TodayOutcome | null;
  /** One line under the Next card's buttons, said BEFORE the press (a booking fee's lock, when the card is the fee). */
  nextNote?: string | null;
  numbers: SupplierTodayNumbers;
  /** "Also today" on an event day — the day's schedule and the Event Hub's tools. */
  alsoToday?: ReadonlyArray<{ id: string; label: string; line: string | null; href: string; icon: TodayRowIcon }>;
  /** The next three booked events, Setnayan and outside, already worded. */
  comingUp: readonly TodayComingUpRow[];
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
  /**
   * 💸 The unpaid booking fees, as hairline rows (`<BookingFeeBills today>`), drawn by the page — LAST under Also
   * waiting. `hasBills` says whether it draws anything: when nothing above carries the "Also waiting" heading (no ask
   * row, no door), the bills carry it themselves — a bill is never drawn under "Coming up" (found on the 375 walk,
   * 2026-10-12: two fee rows sat under the last Coming-up row with no heading of their own).
   */
  bills?: ReactNode;
  hasBills?: boolean;
  /** The one Shop row: the shop's name, its state in a few words, and the pill (Checking · Live · Not yet). */
  shop: { name: string; line: string; pill: ShopPill };
  /** "How is business" — "312 looked · 14 asked", or null when it was not read (the row then shows no number). */
  business?: { line: string | null } | null;
};

const DOOR_ICON: Record<SupplierWaitingDoor['id'], TodayRowIcon> = {
  setup: 'check',
  findable: 'shop',
  credit: 'clock',
  payout: 'peso',
};

const PILL_TONE: Record<ShopPill, BadgeTone> = { Checking: 'wait', Live: 'ok', 'Not yet': 'wait' };

/**
 * 📱 THE SUPPLIER'S TODAY — the simpler dashboard (owner APPROVE 2026-10-14; prototype
 * `Setnayan/prototypes/supplier_easy_dashboard_2026-10-14_fable.html`, SCREENS.today), built on the 2026-10-08
 * redesign it replaces in look only:
 *
 *   ONE Next card (the couple's initials · its main verb + a grey second · "1 of 3") → the answer's status line →
 *   three numbers that count up → (event day: Also today) → Coming up (3, with the bookings from outside) → Also
 *   waiting (the rest of the queue, each row with its icon) → the Shop row → How is business.
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
  who = null,
  eyebrow = null,
  dateChange = null,
  answerOnCard = null,
  outcome = null,
  nextNote = null,
  numbers,
  alsoToday = [],
  comingUp,
  alsoWaiting,
  alsoWaitingHeaded = false,
  doors = [],
  bills = null,
  hasBills = false,
  shop,
  business = null,
}: SupplierTodayFirstScreenProps) {
  const day = next.kind === 'run_day';
  const unread = next.kind === 'unread';
  const greyClass = day ? 'home-cover-ab' : undefined;

  const secondButton = second ? (
    <ActionButton
      tone="neutral"
      icon={icon(second.label === 'Chat' ? 'reply' : second.label === 'See the day' ? 'calendar' : 'eye')}
      label={second.label}
      href={second.to === 'card' ? customerCardHref(second.eventId, 'details') : second.href}
      className={`min-h-11${greyClass ? ` ${greyClass}` : ''}`}
    />
  ) : null;

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
        <SupplierSubmit tone="neutral" icon={<LogOut aria-hidden="true" strokeWidth={1.9} />} label="Unlock my service" pendingLabel="Releasing…" />
      </form>
    </>
  ) : answerOnCard ? (
    /* ✅ The booking ask answers ON the card — the page's `LockRequestAnswer` holds Agree and Turn it down; the
       card's own row keeps only the grey Chat. */
    secondButton
  ) : (
    <>
      <ActionButton tone={look.tone} main icon={icon(look.icon)} label={next.action} href={unread ? '/vendor-dashboard' : nextHref(next.target)} className="min-h-11" />
      {secondButton}
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
        who={who}
        eyebrow={eyebrow}
        rows={answerOnCard}
        actions={actions}
        note={
          dateChange
            ? 'Unlocking releases this booking. Any payment is settled by the cancellation terms on the booking — Setnayan never decides a refund.'
            : (nextNote ?? undefined)
        }
      />

      {/* THE ANSWER'S STATUS LINE — the whole sentence, under the card it answered (the prototype's place), with the
          door it asks for: after an Agree whose couple's news waits on the fee, "Pay the booking fee". */}
      {outcome ? (
        <div
          role="status"
          data-supplier-outcome={outcome.tone}
          className={`mb-1 flex items-center gap-3 border-t border-ink/10 py-2.5 text-[13.5px] leading-snug ${outcome.tone === 'bad' ? 'text-[rgb(var(--color-danger))]' : 'text-ink/80'}`}
        >
          <span className="min-w-0 flex-1">{outcome.text}</span>
          {outcome.door ? (
            <ActionButton
              tone="neutral"
              icon={<Wallet aria-hidden="true" strokeWidth={1.9} />}
              label={outcome.door.label}
              href={outcome.door.href}
              className="min-h-11 shrink-0"
            />
          ) : null}
        </div>
      ) : null}

      {/* ② THREE NUMBERS — each goes to the list it counts, and counts up to it. A read that failed says so in words,
          in the number's own place — never 0, never ₱0. On an event day: waiting · next moment · checked in. */}
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
        {numbers.day ? (
          <>
            <Link href="/vendor-dashboard/on-the-day" className="grid gap-0.5 text-center" data-today-number="next-moment">
              <span className="block text-[26px] font-semibold leading-none tabular-nums text-ink">{numbers.day.next ?? '—'}</span>
              <span className="block text-[11.5px] text-ink/60">next moment</span>
              <TapMark />
            </Link>
            <Link href="/vendor-dashboard/on-the-day" className="grid gap-0.5 text-center" data-today-number="checked-in">
              <span className="block text-[26px] font-semibold leading-none tabular-nums text-ink">
                {numbers.day.checkedIn === null ? '—' : <Figure word={numbers.day.checkedIn} id="today-checked-in" />}
              </span>
              <span className="block text-[11.5px] text-ink/60">checked in</span>
              <TapMark />
            </Link>
          </>
        ) : (
          <>
            <Link href="/vendor-dashboard/customers?seg=dates" className="grid gap-0.5 text-center" data-today-number="week">
              <span className="block text-[26px] font-semibold leading-none tabular-nums text-ink">
                <Figure word={numbers.thisWeek} id="today-week" />
              </span>
              <span className="block text-[11.5px] text-ink/60">this week</span>
              <TapMark />
            </Link>
            <Link href={customerLandingHref('payday')} className="grid gap-0.5 text-center" data-today-number="money" data-money="">
              {numbers.toComeIn === null ? (
                <Unread />
              ) : (
                <>
                  <span className="block text-[26px] font-semibold leading-none tabular-nums text-ink">
                    <Figure word={numbers.toComeIn} id="today-money" />
                  </span>
                  <span className="block text-[11.5px] text-ink/60">to come in</span>
                </>
              )}
              <TapMark />
            </Link>
          </>
        )}
      </div>

      {/* 🌑 ALSO TODAY — on an event day, the day's own rows (prototype: Schedule · the Event Hub's tools). */}
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

      {/* ③ COMING UP — the next three booked events (Setnayan and outside), each opening its day. */}
      <div data-today-coming-up>
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

      {/* ④ ALSO WAITING — the rest of the queue: the asks (answered in place),
          then the rules that are not a customer's ask, each a door. */}
      {alsoWaiting}
      {doors.length > 0 ? (
        <div data-today-doors className={alsoWaitingHeaded ? undefined : '[&>*:first-of-type]:border-t-0'}>
          {alsoWaitingHeaded ? null : <TodayEyebrow>Also waiting</TodayEyebrow>}
          {doors.map((d) =>
            d.button ? (
              /* A door with its own small grey button (prototype "Where couples pay you · Set up"). */
              <div key={d.id} data-today-row={d.id} className="home-row !grid-cols-[36px_minmax(0,1fr)_auto] min-h-11">
                <RowIcon name={DOOR_ICON[d.id]} />
                <span className="min-w-0">
                  <span className="home-t block truncate text-[15px] leading-tight text-ink">{d.label}</span>
                  <span className="block truncate text-[13px]" style={{ color: LINE_TONE.warn }}>
                    {d.line}
                  </span>
                </span>
                <ActionButton tone="neutral" icon={<Plus aria-hidden="true" strokeWidth={1.9} />} label={d.button} name={`${d.button} — ${d.label}`} href={nextHref(d.target)} className="min-h-11 shrink-0" />
              </div>
            ) : (
              <TodayRow key={d.id} href={nextHref(d.target)} label={d.label} line={d.line} lineTone="warn" marker={d.id} rowIcon={DOOR_ICON[d.id]} />
            ),
          )}
        </div>
      ) : null}

      {hasBills ? (
        <div data-today-bills className={alsoWaitingHeaded || doors.length > 0 ? undefined : '[&>div:first-of-type]:border-t-0'}>
          {alsoWaitingHeaded || doors.length > 0 ? null : <TodayEyebrow>Also waiting</TodayEyebrow>}
          {bills}
        </div>
      ) : null}

      {/* ⑤ THE SHOP ROW — its state (Checking · Live · Not yet) — and how business is doing. */}
      <div data-today-shop>
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

/**
 * A number counts up to its value (the prototype's `countUp`): a bare count through `Count`, a worded figure
 * ("₱48K", "5+") through `TodayFigure`, which counts the digits inside the word and keeps its ends.
 */
function Figure({ word, id }: { word: string; id: string }) {
  const n = /^\d+$/.test(word) ? Number(word) : null;
  return n === null ? <TodayFigure word={word} id={id} /> : <Count value={n} id={id} />;
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
