/**
 * THE ONE BOOKING-FEE SENTENCE, RENDERED. Two components, no logic:
 *
 *   · `BookingFeeNotice`  — a `FeeDisclosure` (what the fee WOULD be, or what
 *     joining costs). Shown before the supplier owes anything.
 *   · `BookingFeeBillRow` — a bill that EXISTS, with the door to pay it.
 *
 * Deliberately dumb. Every word and every peso figure is decided by
 * `lib/booking-fee-disclosure.ts` and handed in as a prop, so a surface cannot
 * quietly reword the money or round it — the defect that titled a ₱837.50 bill
 * "₱838" lived in a formatter, one layer below the sentence.
 *
 * Shape and tokens are lifted from `PayoutMethodNudge` (S19) on purpose: the
 * supplier already reads that row in these exact places, so this is the same
 * design language rather than a second one.
 *
 * Server components with no hooks and no directive — they render inside the
 * Today page, the client page, the chat card and the client-side quote composer
 * alike.
 */
import Link from 'next/link';
import { AlertTriangle, BadgeCheck, ChevronRight, Info, Receipt, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { FeeDisclosure, DueFeeBill, WaivedFeeCharge } from '@/lib/booking-fee-disclosure';
import { feeIntroducedLine, waivedFeeCopy } from '@/lib/booking-fee-disclosure';
import { Badge } from '@/app/_components/badge';
import { VENDOR_BOOKING_FEES_PATH, vendorBookingFeePayPath } from '@/lib/vendor-booking-fees';

/** Border / accent per tone. `good` is the free-booking and no-fee case. */
const TONE = {
  good: { accent: 'var(--sn-success, #1f7a4d)', Icon: BadgeCheck },
  info: { accent: 'var(--sn-gold-700)', Icon: Info },
  due: { accent: 'var(--sn-gold-700)', Icon: Receipt },
  overdue: { accent: 'var(--m-blush-deep)', Icon: AlertTriangle },
} as const;

export function BookingFeeNotice({
  disclosure,
  cta,
  framed = true,
  testId = 'booking-fee-notice',
}: {
  /** `null` ⇒ render NOTHING. Silence is the honest rendering of "no fee here". */
  disclosure: FeeDisclosure | null;
  cta?: { href: string; label: string };
  /**
   * FALSE when this row sits INSIDE a shared `rows` container, which owns the
   * border and the corner radius and separates its children with a hairline.
   *
   * 🔑 The prototype draws ONE bordered box with rows in it, not a stack of
   * bordered cards with gaps. A row that carries its own border cannot be put
   * in a container without drawing a box inside a box — which is what the
   * composer showed the owner: four separate cards where he expected one.
   * Default TRUE so every standalone mount is unchanged.
   */
  framed?: boolean;
  /**
   * This row's own name, so a surface that mounts the shape TWICE can be
   * counted per LINE rather than per file. Both quote composers do: the fee,
   * and the exclusive Papic deal beside it (`papic-quote-notice`). A file-level
   * match cannot say which of two survived an edit.
   */
  testId?: string;
}) {
  if (!disclosure) return null;
  const { accent, Icon } = TONE[disclosure.tone];
  return (
    <div
      role="note"
      data-testid={testId}
      className={
        framed
          ? 'mt-3 flex items-center gap-2.5 rounded-2xl border px-3 py-2.5'
          : 'flex items-center gap-2.5 px-3 py-2.5'
      }
      style={
        framed
          ? { borderColor: 'var(--sn-line)', background: 'var(--sn-surface, #fff)' }
          : undefined
      }
    >
      <Icon
        aria-hidden
        className="h-4 w-4 shrink-0"
        strokeWidth={1.75}
        style={{ color: accent }}
      />
      {/*
        THE LEFT CELL. `flex-col` is the row's whole structure, not decoration:
        the sentence and its sub-line are ONE cell that stacks, which is what
        makes the thing beside it read as a value rather than a third line.
        `min-w-0` lets the cell shrink so a long sentence wraps inside it instead
        of pushing the right cell off the row.
      */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">{disclosure.headline}</span>
        <span className="text-xs text-ink/70">{disclosure.detail}</span>
      </span>
      {/*
        THE RIGHT CELL. `ml-auto shrink-0` is what puts it on the right and keeps
        it there; without both, a long headline pushes it down into a third line
        and the row silently becomes the stack this replaced.
      */}
      {cta ? (
        <Link
          href={cta.href}
          className="ml-auto shrink-0 text-sm font-semibold text-ink underline underline-offset-2"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * ONE UNPAID BILL, with the door to pay it.
 *
 * 🔑 THE DOOR IS THE POINT. The bill was already correct in the database and
 * already rendered on `/vendor-dashboard/booking-fees`; what did not exist was
 * any way to arrive there from where the supplier actually stands. A row
 * without `Pay now` would reproduce the original defect with better wording.
 */
export function BookingFeeBillRow({
  bill,
  copy,
  line = false,
  compact = false,
  today = false,
}: {
  bill: DueFeeBill;
  /** `feeDueCopy(bill, phToday())` — the escalation is decided, not styled. */
  copy: FeeDisclosure;
  /**
   * 📋 A HAIRLINE ROW, NOT A BOX (owner 2026-10-12, "APPROVE ALL" look call 8: supplier lists are hairline rows,
   * "not framed boxes"). For a surface whose bills sit in a list of rows — the supplier's Today, under Also
   * waiting. The same words, the same icon in the same colour, the same door; only the box is gone, and Pay now
   * is the row's main button (terracotta, look call 1). Absent → the boxed row exactly as it was.
   */
  line?: boolean;
  /**
   * 📋 ONE HAIRLINE ROW (Customers › Money, S-PR4; frames 05 · 30: "Booking fee · Cruz wedding · due Oct 10 · ₱2,500
   * · Pay"). The headline alone — the bill's own sentence, amount and date in it — and Pay at the right. Pay is NOT
   * the screen's main (owner 2026-10-12/13: ONE terracotta main per screen; on Money that is Log a payment): a
   * neutral button that opens the pay page, which is the confirm + pay step (look call 11). The longer sentence and
   * every bill's history live one tap on, on the pay page and the Booking fees page.
   */
  compact?: boolean;
  /**
   * 📋 THE SIMPLER TODAY'S ROW (owner APPROVE 2026-10-14, `supplier_easy_dashboard_2026-10-14_fable.html`
   * `feeBillRows`): the round icon · "Booking fee · <couple>" · one line ("₱4,250 · due Tue 20 Oct · Setnayan
   * introduced this couple to you on …") · a grey Pay. The words are the caller's `copy` (headline → the label,
   * detail → the line); the introduced line is added here, as on every bill. Pay is grey: the screen's one
   * terracotta main is its Next card (look call 11). The lock sentence is said ONCE under the bills, by the page.
   */
  today?: boolean;
}) {
  const { accent, Icon } = TONE[copy.tone];
  if (today) {
    const introduced = feeIntroducedLine(bill);
    return (
      <div role="note" data-testid="booking-fee-bill" data-fee-bill-today="" className="grid min-h-11 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-ink/10 py-2.5">
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-full text-ink"
          style={{ background: 'color-mix(in srgb, rgb(var(--color-gild)) 16%, transparent)' }}
        >
          <Wallet className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium leading-tight text-ink">{copy.headline}</span>
          <span className="block text-[13px] leading-snug" style={{ color: copy.tone === 'overdue' ? 'rgb(var(--color-danger))' : 'rgb(var(--color-warn))' }}>
            {copy.detail}
            {introduced ? <span className="text-ink/60" data-fee-introduced=""> · {introduced.replace(/\.$/, '')}</span> : null}
          </span>
        </span>
        <ActionButton
          tone="neutral"
          icon={<Wallet aria-hidden strokeWidth={1.9} />}
          label="Pay"
          name={`Pay — ${copy.headline}`}
          href={vendorBookingFeePayPath(bill.orderId)}
          className="min-h-11 shrink-0"
        />
      </div>
    );
  }
  if (compact) {
    return (
      <div role="note" data-testid="booking-fee-bill" data-fee-bill-compact="" className="flex min-h-[60px] items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0">
        <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: accent }} />
        <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-ink">{copy.headline}</p>
        <ActionButton
          tone="neutral"
          icon={<Wallet aria-hidden strokeWidth={1.9} />}
          label="Pay"
          name={`Pay — ${copy.headline}`}
          href={vendorBookingFeePayPath(bill.orderId)}
          className="min-h-11 shrink-0"
        />
      </div>
    );
  }
  if (line) {
    return (
      <div role="note" data-testid="booking-fee-bill" data-fee-bill-line="" className="flex items-start gap-2.5 border-t border-ink/10 py-3">
        <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: accent }} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[15px] font-medium leading-tight text-ink">{copy.headline}</p>
          <p className="text-[13px] text-ink/60">{copy.detail}</p>
          {/* The supplier's bill says why a couple's own record carries a fee (owner 2026-10-12, answer 11) — on the
              row as on the box (batch 5 join: #6494's line + #6497's hairline row). */}
          {feeIntroducedLine(bill) ? (
            <p className="text-[13px] text-ink/60" data-fee-introduced="">
              {feeIntroducedLine(bill)}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <ActionButton
              tone="brand"
              main
              icon={<Wallet aria-hidden strokeWidth={1.9} />}
              label="Pay now"
              href={vendorBookingFeePayPath(bill.orderId)}
              className="min-h-11"
            />
            <Link href={VENDOR_BOOKING_FEES_PATH} className="inline-flex min-h-11 items-center gap-0.5 text-[13px] font-medium text-sn-accent">
              All booking fees
              <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      role="note"
      data-testid="booking-fee-bill"
      className="mt-3 flex items-start gap-2.5 rounded-xl border p-3"
      style={{ borderColor: accent, background: 'var(--sn-surface, #fff)' }}
    >
      <Icon
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0"
        strokeWidth={1.75}
        style={{ color: accent }}
      />
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-semibold text-ink">{copy.headline}</p>
        <p className="text-sm text-ink/70">{copy.detail}</p>
        {/* Why a booking the couple typed in carries a fee — the supplier's bill
            only (owner 2026-10-12, answer 11; the couple is never told). */}
        {feeIntroducedLine(bill) ? (
          <p className="text-sm text-ink/70" data-fee-introduced="">
            {feeIntroducedLine(bill)}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={vendorBookingFeePayPath(bill.orderId)}
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            Pay now
          </Link>
          <Link
            href={VENDOR_BOOKING_FEES_PATH}
            className="inline-flex text-sm font-semibold text-ink underline underline-offset-2"
          >
            All booking fees
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Every due bill for one surface, already filtered by `billsForSurface`.
 * Renders nothing for an empty list — the "no pending fee sees none of it"
 * property is a consequence of the filter, not of a second `if` here.
 */
export function BookingFeeBills({
  bills,
  copyFor,
  rows = false,
  compact = false,
  today = false,
}: {
  bills: readonly DueFeeBill[];
  copyFor: (bill: DueFeeBill) => FeeDisclosure;
  /** The simpler Today's rows — `BookingFeeBillRow`'s `today`. */
  today?: boolean;
  /** Hairline rows instead of boxes — `BookingFeeBillRow`'s `line` (the supplier's Today). */
  rows?: boolean;
  /** One hairline row per bill — `BookingFeeBillRow`'s `compact` (Customers › Money). */
  compact?: boolean;
}) {
  if (bills.length === 0) return null;
  return (
    <>
      {bills.map((b) => (
        <BookingFeeBillRow key={b.orderId} bill={b} copy={copyFor(b)} line={rows} compact={compact} today={today} />
      ))}
    </>
  );
}

/**
 * THE FREE BOOKINGS, NAMED AND PRICED.
 *
 * 🔴 Owner, 2026-09-20: *"still tell them that there should be a booking fee.
 * but this will be considered free."* A waived charge previously appeared on NO
 * supplier surface — it mints no `orders` row, and every fee surface read
 * orders — so a shop learned "free" only from silence, and the sixth booking
 * arrived as a surprise bill.
 *
 * Quieter than {@link BookingFeeBillRow} on purpose: nothing is owed, so there
 * is no CTA. But the AMOUNT is stated, every time — `waivedFeeCopy` refuses to
 * render a bare "Free".
 */
export function WaivedFeeRows({
  charges,
  compact = false,
}: {
  charges: readonly WaivedFeeCharge[];
  /**
   * ONE HAIRLINE ROW each (Customers › Money, frame 30: "Booking fee · Cruz wedding · free · launch offer"): the
   * headline — which names the amount it would have cost — and a "Waived" badge (kind 11, a state, never pressed).
   * Nothing to pay, so no button. Absent → the boxed rows exactly as they were.
   */
  compact?: boolean;
}) {
  if (charges.length === 0) return null;
  return (
    <>
      {charges.map((c) => {
        const copy = waivedFeeCopy(c);
        if (compact) {
          return (
            <div key={c.chargeId} role="note" data-testid="booking-fee-waived" data-fee-waived-compact="" className="flex min-h-[60px] items-center gap-3 border-t border-ink/10 py-2.5 first:border-t-0">
              <BadgeCheck aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: TONE.good.accent }} />
              <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-ink">{copy.headline}</p>
              <Badge tone="ok" data="fee-waived">
                Waived
              </Badge>
            </div>
          );
        }
        return (
          <div
            key={c.chargeId}
            role="note"
            data-testid="booking-fee-waived"
            className="mt-3 flex items-start gap-2.5 rounded-xl border p-3"
            style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-surface, #fff)' }}
          >
            <BadgeCheck
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
              style={{ color: TONE.good.accent }}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-ink">{copy.headline}</p>
              <p className="text-sm text-ink/70">{copy.detail}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}
