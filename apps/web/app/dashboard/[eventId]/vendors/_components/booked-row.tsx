'use client';

/**
 * One row of the Booked body — a supplier who is booked, or one the couple has
 * asked and who has not answered (owner 2026-10-07; the prototype's Booked
 * mode, `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 *   ( SV )  Seda Vertis North                                   ▾
 *           Reception · added by you
 *           Next: first payment · ₱528,000 · by Oct 5
 *           [ Booked ]
 *           ── a tap on the row opens (ONE row open at a time — `BookedRowList`) ──
 *   ⏱ Call time 8:00 AM · Ingress & setup · from your Schedule
 *   PAYMENT PLAN   ✓ First payment · Paid Oct 20      ₱90,000
 *                  ○ Balance · Due Dec 11              ₱90,000
 *   Used across your event:  [Event Hub · venue & city] [Schedule]
 *   [ Pay ][ Chat ][ Workspace ][ Cancel ]     ← ONE row of equal tiles
 *
 * The approved final Suppliers design (owner 2026-10-30, `carry-2026-10-29/suppliers-final-proto/`, its `teamFold`):
 * the call time is the Schedule's moment (`earliestTaggedBlock`), the plan rows are the Pay sheet's own rows
 * (`readBookedPlans`), and the verbs are ONE row of equal tiles — *"i was hoping this would be a single row"*.
 *
 * Every word and which verbs appear is decided in `lib/booked-rows.ts`; this
 * file draws it and wires each verb to the door that ALREADY ships:
 *
 *   Pay · Payments   the Pay sheet, in place (`pay-sheet.tsx`): the shipped
 *                    payment card on ONE request — never a link away
 *   Set price        a supplier the couple added → their own record, in place;
 *                    a supplier on Setnayan → their workspace
 *   Your record      `loadSelfAddedSupplier` → `NewManualVendorModal` (edit) —
 *                    the same sheet a Find card opens
 *   Chat             the one conversation with them
 *   Nudge            `contactShortlistVendor` (its nudge branch — one follow-up)
 *   Withdraw         `WithdrawAskButton` → `withdrawVendorLockRequest`
 *   Cancel booking   `CancelBookingButton` → `cancelBookingAsHost` (its own
 *                    confirm; a hard delete only before any payment)
 *
 * No second writer of anything: a verb here calls the action the Find card and
 * the workspace already call.
 */
import { useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BellRing,
  Check,
  ChevronDown,
  Clock,
  CreditCard,
  FolderOpen,
  MessageCircle,
  Pencil,
  Star,
} from 'lucide-react';
import { ActionButton, actionButtonClass, useFitRow } from '@/components/action-button';
import { useIsDesktop } from '@/lib/use-responsive';
import { formatPhp } from '@/lib/php';
import { shortDate } from '@/lib/budget-page-view';
import {
  NEXT_SET_PRICE,
  WAITING_PILL,
  WAITING_UNTIL,
  type BookedCallTime,
  type BookedPlan,
  type BookedRow,
  type BookedVerb,
  type WaitingRow,
} from '@/lib/booked-rows';
import type { TeamRowTone } from '@/lib/your-team-rows';
import { NewManualVendorModal } from '@/app/dashboard/[eventId]/_components/new-manual-vendor-modal';
import { contactShortlistVendor } from '../_actions/contact-shortlist-vendor';
import { loadSelfAddedSupplier, type SelfAddedSupplierPrefill } from '../actions';
import { BookedRoomLine } from './booked-room-line';
import { CancelBookingButton } from './cancel-booking-button';
import { WithdrawAskButton } from './withdraw-ask-button';

import { BookedStandInCtx } from './booked-stand-ins';

export { BookedStandInCtx, type BookedStandIns } from './booked-stand-ins';

// The Pay sheet — the payment card, the pay-methods sheet, the proof upload —
// is loaded on the first press of Pay, never with the page.
const PaySheet = dynamic(() => import('./pay-sheet').then((m) => m.PaySheet), { ssr: false });

/**
 * The status pill — a soft fill, NO border (owner 2026-10-12, look call 7), in
 * flipping tokens only: the old `bg-success-100` / `bg-warn-50` washes are fixed
 * hexes with no dark value, so they glared on the dark page (the 2026-10-12 look
 * sweep's own table, `team-rows.tsx` before this file replaced it).
 */
const PILL_TONE: Record<TeamRowTone, string> = {
  ok: 'bg-[rgb(var(--color-ok)_/_0.12)] text-[rgb(var(--color-ok))]',
  warn: 'bg-[rgb(var(--color-warn)_/_0.12)] text-[rgb(var(--color-warn))]',
  soft: 'bg-ink/5 text-ink/70',
  no: 'bg-[rgb(var(--color-danger)_/_0.12)] text-[rgb(var(--color-danger))]',
};
const PILL = 'shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] leading-none';
/** A ref that never holds a row — the tiles run no fit pass (`useFitRow` is a hook, so it is always called). */
const NO_ROW = { current: null };
/** The line a press came back with, under the verb row. */
const SAID = 'text-[12px] leading-snug';

function Logo({ url, initials }: { url: string | null; initials: string }) {
  return (
    <span
      aria-hidden
      className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-ink/10 bg-cream text-[12px] tracking-[0.06em] text-ink/60"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials
      )}
    </span>
  );
}

/** The verb row: one line, one fit state (icon + word → word → icon). */
function VerbRow({
  eventId,
  vendorId,
  vendorName,
  service,
  own,
  verbs,
  threadId,
  payVersion,
  tiles = false,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  service: string | null;
  own: boolean;
  verbs: readonly BookedVerb[];
  threadId: string | null;
  /** This supplier's money as the page holds it — when it changes, an open Pay sheet asks again. */
  payVersion: string;
  /**
   * ONE ROW OF EQUAL TILES (owner 2026-10-30, "i was hoping this would be a single row"): icon over word, every tile
   * the same width, never wrapped. A grid of equal columns cannot overflow, so no fit pass runs.
   */
  tiles?: boolean;
}) {
  const standIn = useContext(BookedStandInCtx);
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(tiles ? NO_ROW : rowRef);
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [record, setRecord] = useState<SelfAddedSupplierPrefill | null>(null);
  const [paying, setPaying] = useState(false);

  const workspaceHref = `/dashboard/${eventId}/vendors/${vendorId}/workspace`;
  const threadHref = threadId ? `/dashboard/${eventId}/messages/${threadId}` : null;

  /** The couple's own record of a supplier they added — the Find card's door. */
  const openRecord = () => {
    if (pending) return;
    start(async () => {
      setSaid(null);
      if (standIn.loadRecord) {
        const prefill = await standIn.loadRecord(vendorId);
        if (prefill) setRecord(prefill);
        else setSaid({ tone: 'error', text: 'Your record could not be opened. Nothing changed.' });
        return;
      }
      const res = await loadSelfAddedSupplier(eventId, vendorId);
      if (res.status === 'ok') setRecord(res.prefill);
      // Could not load it here — the full page still holds the record.
      else router.push(workspaceHref);
    });
  };

  const nudge = () => {
    if (!threadId || pending) return;
    start(async () => {
      setSaid(null);
      if (standIn.nudge) {
        const res = await standIn.nudge(vendorId);
        setSaid(res.ok ? { tone: 'ok', text: `Nudged ${vendorName}.` } : { tone: 'error', text: res.message ?? 'That did not send. Nothing changed.' });
        return;
      }
      const res = await contactShortlistVendor({ eventId, vendorId, nudgeThreadId: threadId });
      if (res.status === 'nudged') setSaid({ tone: 'ok', text: `Nudged ${vendorName}.` });
      else setSaid({ tone: 'error', text: res.status === 'error' ? res.message : 'That did not send. Nothing changed.' });
    });
  };

  const draw = (v: BookedVerb): ReactNode => {
    // `key` is passed on its own — React refuses one that arrives inside a spread.
    // A main verb that asks nothing of the couple ("Payments" with nothing due)
    // keeps its word and its place, but not the fill — `bk-soft`, the
    // prototype's `.main.quiet`. (`ActionButton` ignores `quiet` on a main verb.)
    const common = {
      tone: v.tone,
      main: v.main,
      // A tile says its short word ("Cancel", "Report"); the button is still named in full.
      label: tiles && v.tile ? v.tile : v.label,
      name: v.label,
      className: v.main && v.quiet ? 'bk-soft' : undefined,
    } as const;
    switch (v.key) {
      case 'pay':
      case 'payments':
        // One door for both: the Pay sheet states what is due, or that nothing is.
        return <ActionButton key={v.key} {...common} icon={CreditCard} aria-haspopup="dialog" onClick={() => setPaying(true)} />;
      case 'set_price':
        // Theirs to type when the couple added the supplier; otherwise the
        // price comes from the supplier, in their workspace.
        return own ? (
          <ActionButton key={v.key} {...common} icon={Pencil} disabled={pending} onClick={openRecord} />
        ) : (
          <ActionButton key={v.key} {...common} icon={Pencil} href={workspaceHref} prefetch={false} />
        );
      case 'record':
        return <ActionButton key={v.key} {...common} icon={Pencil} disabled={pending} onClick={openRecord} />;
      case 'chat':
        return threadHref ? <ActionButton key={v.key} {...common} icon={MessageCircle} href={threadHref} prefetch={false} /> : null;
      case 'workspace':
        return <ActionButton key={v.key} {...common} icon={FolderOpen} href={workspaceHref} prefetch={false} />;
      case 'review':
        return <ActionButton key={v.key} {...common} icon={Star} href={`/dashboard/${eventId}/vendors/${vendorId}/review`} prefetch={false} />;
      case 'nudge':
        return <ActionButton key={v.key} {...common} icon={BellRing} disabled={pending} onClick={nudge} />;
      case 'withdraw':
        return (
          <WithdrawAskButton
            key={v.key}
            vendorId={vendorId}
            vendorName={vendorName}
            label={v.label}
            className={actionButtonClass(v.tone)}
            wrapperClassName="bk-slot"
            errorClassName={`bk-said ${SAID} text-[rgb(var(--color-danger))]`}
          />
        );
      case 'cancel':
        return (
          <span key={v.key} className="bk-slot">
            <CancelBookingButton
              eventId={eventId}
              vendorId={vendorId}
              vendorName={vendorName}
              triggerClass={actionButtonClass(v.tone)}
              triggerWord={tiles ? v.tile : undefined}
            />
          </span>
        );
      case 'dispute':
        return <ActionButton key={v.key} {...common} icon={AlertTriangle} href={`/dashboard/${eventId}/disputes`} prefetch={false} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div ref={rowRef} className={tiles ? 'bk-tiles' : 'bk-verbs'} data-booked-verbs={verbs.map((v) => v.key).join(' ')}>
        {verbs.map(draw)}
      </div>
      {said ? (
        <p className={`${SAID} ${said.tone === 'error' ? 'text-[rgb(var(--color-danger))]' : 'text-ink/60'}`} role="status">
          {said.text}
        </p>
      ) : null}
      {paying ? (
        <PaySheet
          eventId={eventId}
          vendorId={vendorId}
          vendorName={vendorName}
          version={payVersion}
          onClose={() => setPaying(false)}
        />
      ) : null}
      {record ? (
        <NewManualVendorModal
          eventId={eventId}
          category={record.category}
          categoryLabel={service ?? vendorName}
          edit={record}
          onClose={() => setRecord(null)}
          onCreated={() => {
            setRecord(null);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * "Pay ›" on the Budget block's Next line — the SAME Pay sheet the row's own
 * Pay opens (one door, never a link away), drawn as the Budget page's quiet
 * `.go` word.
 */
export function NextPayButton({
  eventId,
  vendorId,
  vendorName,
  className,
  version,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  className: string;
  /** The Next line's own figures — when they change, an open sheet asks again. */
  version: string;
}) {
  const [paying, setPaying] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-label={`Pay ${vendorName}`}
        data-budget-next-pay=""
        onClick={() => setPaying(true)}
      >
        Pay ›
      </button>
      {paying ? (
        <PaySheet eventId={eventId} vendorId={vendorId} vendorName={vendorName} version={version} onClose={() => setPaying(false)} />
      ) : null}
    </>
  );
}

/**
 * THE TEAM — every booked supplier is ONE collapsed row, and ONE is open at a time (owner 2026-10-30, the approved
 * final Suppliers design: *"Booked does not collapse"*). Opening another closes the one before; the fold animates
 * (`.bk-exp`'s grid track, `booked-body.tsx`).
 */
export function BookedRowList({ eventId, rows, firstOpen = null }: { eventId: string; rows: readonly BookedRow[]; firstOpen?: string | null }) {
  const [openId, setOpenId] = useState<string | null>(firstOpen);
  // 🖥 From a tablet (768) the list sits left and the opened supplier on the right (the prototype's wide Team, "from
  // 820 wide: … list left, the opened item right" — "Tap a supplier to see their payments, call time and tools
  // here"), so a wide screen is never a stretched phone row. Below it the fold opens in place. One fold component
  // either way (`BookedFold`) — never two copies of its verbs on screen.
  const wide = useIsDesktop('md');
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const list = (
    <ul className="bk-rows mt-2">
      {rows.map((r) => (
        <BookedRowItem
          key={r.vendorId}
          eventId={eventId}
          row={r}
          open={openId === r.vendorId}
          onToggle={() => toggle(r.vendorId)}
          foldInline={!wide}
        />
      ))}
    </ul>
  );
  if (!wide) return list;
  const openRow = rows.find((r) => r.vendorId === openId) ?? null;
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-8"
      data-booked-wide=""
    >
      {list}
      <aside
        className="sticky top-[calc(var(--stick-h,150px)+12px)] mt-2 min-w-0 border-l border-ink/10 pl-6 lg:pl-8"
        aria-label={openRow ? openRow.name : 'Your team'}
        data-booked-detail={openRow?.vendorId ?? ''}
      >
        {openRow ? (
          <>
            <p className="flex items-baseline gap-3 border-b border-ink/10 pb-3">
              <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-ink">{openRow.name}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-ink/55">
                {[openRow.service, openRow.money ? formatPhp(openRow.money.agreedPhp) : null].filter(Boolean).join(' · ')}
              </span>
            </p>
            <BookedFold eventId={eventId} row={openRow} />
          </>
        ) : (
          <p className="pt-2 text-[14px] text-ink/55">Tap a supplier to see their call time, payments and tools here.</p>
        )}
      </aside>
    </div>
  );
}

/** "Call time 8:00 AM · Ingress & setup · from your Schedule" — the Schedule's moment, never a copy. */
function CallTimeLine({ line }: { line: BookedCallTime }) {
  return (
    <p className="flex items-start gap-2 text-[13.5px] leading-snug" data-booked-call-time={line.kind}>
      <Clock aria-hidden strokeWidth={1.9} className="mt-px h-4 w-4 shrink-0 text-ink/55" />
      {line.kind === 'set' ? (
        <span>
          <span className="text-ink">Call time </span>
          <b className="font-semibold text-ink tabular-nums">{line.clock}</b>
          <span className="text-[12.5px] text-ink/55"> · {line.moment} · from your Schedule</span>
        </span>
      ) : line.kind === 'none' ? (
        <span className="text-[12.5px] text-ink/55">No call time yet — tag them on a Schedule moment</span>
      ) : (
        <span className="text-[12.5px] text-ink/55">We couldn’t check your Schedule for their call time.</span>
      )}
    </p>
  );
}

/** The payment plan's rows — the same rows the Pay sheet opens on. */
function PlanRows({ plan, own }: { plan: NonNullable<BookedPlan>; own: boolean }) {
  if (plan.kind === 'unread') {
    return (
      <p className="text-[12.5px] text-ink/55" data-booked-plan="unread">
        We couldn’t load the payment plan. Pay opens it again.
      </p>
    );
  }
  // A supplier the couple added: the plan IS their record (the prototype's "Payment plan · your record").
  const head =
    plan.kind === 'ledger'
      ? own
        ? 'Payment plan · your record'
        : 'Payments'
      : `Payment plan${own ? ' · your record' : plan.estimated ? ' · estimated' : ''}`;
  return (
    <div data-booked-plan={plan.kind}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink/55">{head}</p>
      <ul className="mt-0.5">
        {plan.rows.map((r, i) => (
          <li
            key={`${i}-${r.label}`}
            className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-ink/10 py-2 text-[14px]"
            data-plan-row={r.state}
            data-plan-next={r.next ? '' : undefined}
          >
            <span
              aria-hidden
              className={`grid h-5 w-5 place-items-center rounded-full border ${
                r.state === 'paid'
                  ? 'border-[rgb(var(--color-ok))] bg-[rgb(var(--color-ok))] text-white'
                  : r.next
                    ? 'border-sn-accent'
                    : 'border-ink/20'
              }`}
            >
              {r.state === 'paid' ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-ink">{r.label}</span>
              <span className={`block text-[12px] ${r.late ? 'text-[rgb(var(--color-danger))]' : 'text-ink/55'}`}>
                {r.state === 'paid'
                  ? 'Paid'
                  : r.state === 'pending'
                    ? 'Recorded · waiting for their confirmation'
                    : r.dueDate
                      ? `${r.late ? 'Was due' : 'Due'} ${shortDate(r.dueDate)}`
                      : 'No date yet'}
              </span>
            </span>
            <b
              className={`whitespace-nowrap font-semibold tabular-nums ${
                r.state === 'paid' ? 'text-ink/70' : r.next ? 'text-sn-accent' : 'text-ink'
              }`}
            >
              {r.amountPhp !== null ? formatPhp(r.amountPhp) : '—'}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A booked supplier. The row is the tap target; its details fold open under it. */
export function BookedRowItem({
  eventId,
  row,
  defaultOpen = false,
  open: openProp,
  onToggle,
  foldInline = true,
}: {
  eventId: string;
  row: BookedRow;
  defaultOpen?: boolean;
  /** Held by `BookedRowList` (one open at a time). Absent → the row holds its own. */
  open?: boolean;
  onToggle?: () => void;
  /** The fold opens under the row (a phone); false = the list's right column holds it (from 768). */
  foldInline?: boolean;
}) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const toggle = onToggle ?? (() => setOwnOpen((v) => !v));
  const n = row.next;
  return (
    <li className="bk-row" data-booked-row={row.vendorId} data-open={open ? '' : undefined}>
      <button
        type="button"
        className="grid w-full grid-cols-[44px_minmax(0,1fr)_20px] items-center gap-x-3 gap-y-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sn-accent"
        aria-expanded={open}
        onClick={toggle}
      >
        <Logo url={row.logoUrl} initials={row.initials} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-ink">{row.name}</span>
          <span className="block truncate text-[13px] text-ink/55">
            {[row.service, row.own ? 'added by you' : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        {/* A list row is a hairline row with a terracotta arrow (owner 2026-10-12,
            look call 8); this one unfolds in place, so it points down and turns. */}
        <ChevronDown
          aria-hidden
          strokeWidth={2}
          className={`h-5 w-5 text-sn-accent transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
        <span className="col-span-2 col-start-2 flex flex-wrap items-baseline gap-x-2 text-[14px]" data-booked-next={n.kind}>
          {n.kind === 'paid_in_full' ? (
            <>
              <span className="text-ink/55">Paid in full</span>
              <span className="tabular-nums text-ink">{formatPhp(n.paidPhp)}</span>
            </>
          ) : (
            <>
              <span className="text-ink/55">Next:</span>
              {n.kind === 'set_price' ? (
                <span className="text-sn-accent">{NEXT_SET_PRICE}</span>
              ) : n.kind === 'due' ? (
                <span className="tabular-nums text-sn-accent" data-booked-late={n.late ? '' : undefined}>
                  {[n.label.toLowerCase(), n.amountPhp !== null ? formatPhp(n.amountPhp) : null].filter(Boolean).join(' · ')}
                  {n.dueDate ? (
                    // Late is said the way the Pay sheet says it ("Was due Oct 5", in the danger colour) — never "by" a past day.
                    n.late ? (
                      <> · <span className="text-[rgb(var(--color-danger))]">was due {shortDate(n.dueDate)}</span></>
                    ) : (
                      ` · by ${shortDate(n.dueDate)}`
                    )
                  ) : null}
                </span>
              ) : (
                <span className={n.needsYou ? 'text-sn-accent' : 'text-ink/80'}>{n.text}</span>
              )}
            </>
          )}
        </span>
        <span className={`col-start-2 justify-self-start ${PILL} ${PILL_TONE[row.pill.tone]}`}>{row.pill.text}</span>
      </button>
      {row.dateAsk ? (
        <p className="ml-14 mt-1 text-[13px] text-ink/70" data-booked-date-ask={row.dateAsk.waiting ? 'waiting' : 'answered'}>
          Date change to {row.dateAsk.when}:{' '}
          <span className={row.dateAsk.waiting ? 'text-sn-accent' : 'text-ink'}>{row.dateAsk.line}</span>
        </p>
      ) : null}
      {foldInline ? (
        <div className="bk-exp" inert={!open}>
          <div>
            <BookedFold eventId={eventId} row={row} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * WHAT AN OPENED TEAM ROW SHOWS — call time · payment plan · room size · "Used across your event" · ONE row of equal
 * tiles (the prototype's `teamFold`). Drawn under the row on a phone, in the right column from 768.
 */
function BookedFold({ eventId, row }: { eventId: string; row: BookedRow }) {
  return (
    <div className="grid min-w-0 gap-2.5 pb-1 pt-3 text-[14px]" data-booked-fold={row.vendorId}>
      {row.callTime ? <CallTimeLine line={row.callTime} /> : null}
      {row.plan ? <PlanRows plan={row.plan} own={row.own} /> : null}
      {row.room ? <BookedRoomLine line={row.room} threadId={row.threadId} /> : null}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px]" data-booked-feeds="">
        <span className="text-ink/55">Used across your event:</span>
        {row.feeds.map((u) => (
          <span key={u} className={`${PILL} bg-ink/5 text-ink/70`}>
            {u}
          </span>
        ))}
      </p>
      <VerbRow
        eventId={eventId}
        vendorId={row.vendorId}
        vendorName={row.name}
        service={row.service}
        own={row.own}
        verbs={row.verbs}
        threadId={row.threadId}
        payVersion={JSON.stringify([row.next, row.money])}
        tiles
      />
    </div>
  );
}

/** Asked, not answered. Always open: the only things to do are in the row. */
export function WaitingRowItem({ eventId, row }: { eventId: string; row: WaitingRow }) {
  return (
    <li className="bk-row" data-waiting-row={row.vendorId}>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
        <Logo url={row.logoUrl} initials={row.initials} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium text-ink">{row.name}</span>
          {/* 💸 carries a price, so it wraps — never cut (the-page-never-scrolls-sideways.spec.ts) */}
          <span className="block break-words text-[13px] tabular-nums text-ink/55">
            {[row.service, row.pricePhp != null ? formatPhp(row.pricePhp) : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className={`${PILL} bg-sn-accent/10 text-sn-accent`}>{WAITING_PILL}</span>
      </div>
      <p className="ml-14 mt-1 flex items-baseline gap-2 text-[14px]">
        <span className="shrink-0 text-ink/55">Until they say yes:</span>
        <span className="text-sn-accent">{WAITING_UNTIL}</span>
      </p>
      {row.fuse ? <p className="ml-14 mt-0.5 text-[12px] text-ink/55">{row.fuse}</p> : null}
      <div className="grid min-w-0 gap-2 pb-1 pl-14 pt-2">
        <VerbRow
          eventId={eventId}
          vendorId={row.vendorId}
          vendorName={row.name}
          service={row.service}
          own={false}
          verbs={row.verbs}
          threadId={row.threadId}
          payVersion=""
        />
      </div>
    </li>
  );
}
