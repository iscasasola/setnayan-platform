// ============================================================================
// VendorItemizationCard — shared per-vendor budget itemization
//
// Extracted from /dashboard/[eventId]/budget/page.tsx 2026-05-22 (owner
// directive: "the per-vendor budget itemization should also embed inside the
// Payments card on the dedicated vendor page when expanded — same data, same
// controls, just rendered inside the workspace page so the host doesn't have
// to bounce between Budget and Vendor pages to see the breakdown.")
//
// Why a server component:
//   - All data (lineItems · payments · vendorControlledItems · priceSource)
//     is already fetched server-side by callers via fetchBudgetSnapshot()
//     (budget page) or a focused per-vendor query (workspace page). The card
//     just renders the data + form `action=` bindings to server actions —
//     no client interactivity inside the card itself.
//   - Form actions are imported as server-action references (addLineItem,
//     deleteLineItem, logPayment, deletePayment from budget/actions.ts).
//     They already revalidate `/budget` and now ALSO revalidate the
//     workspace path so the embedded card stays in lock-step on both
//     surfaces (PR 2026-05-22 extends budget/actions.ts).
//   - Two render modes via the `variant` prop:
//       'card'   — Used by budget/page.tsx. Wraps content in an <article>
//                  with the vendor's name header + status pill (full card
//                  shell). Has its own border + bg-cream.
//       'embed'  — Used by workspace/page.tsx Payments section. Drops the
//                  outer chrome (no name header, no status pill) because
//                  the workspace page already has its own vendor identity
//                  block above. Renders just the Money summary strip +
//                  LineItemSection + PaymentSection.
//
// Component shape mirrors the original budget/page.tsx VendorBudgetCard +
// LineItemSection + PaymentSection 1:1 — no behavioral changes. The only
// new bit is the conditional outer chrome + the optional `eventVendorId`
// (matches the workspace param naming) accepted as an alias for `vendorId`.
//
// Entry points (orphan-prevention per feedback_setnayan_orphan_prevention):
//   - budget/page.tsx — renders <VendorItemizationCard variant="card" />
//     for every finalized vendor.
//   - vendors/[eventVendorId]/workspace/page.tsx — renders
//     <VendorItemizationCard variant="embed" /> inside the Payments section
//     when the per-vendor VendorBudgetSummary loads.
// ============================================================================

import Link from 'next/link';
import {
  Plus,
  Calendar,
  ChevronDown,
  Receipt,
  MessageCircle,
  PencilLine,
  ArrowUpRight,
} from 'lucide-react';
import {
  describeSupplierBalance,
  type LineItemRow,
  type PaymentRow,
  type VendorBudgetSummary,
  type VendorControlledLineItem,
  type VendorPriceSource,
} from '@/lib/budget';
import { formatPhp } from '@/lib/orders';
import {
  VENDOR_CATEGORY_LABEL,
  VENDOR_STATUS_LABEL,
  type EventVendorRow,
  type VendorStatus,
} from '@/lib/vendors';
import { ContactShortlistVendorButton } from '../vendors/_components/contact-shortlist-vendor-button';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';
import type { PlanInstance } from '@/lib/vendor-service-payment-schedules';
import { SubmitButton } from '@/app/_components/submit-button';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { PostedPick } from './posted-pick';
import { ConfirmSwipe } from './confirm-swipe';
import { FileUpload } from '@/app/_components/file-upload';
import { VendorDirectPay } from '@/app/dashboard/[eventId]/_components/vendor-direct-pay';
import { SuggestMilestonesButton } from '@/app/dashboard/[eventId]/budget/_components/suggest-milestones-button';
import { splitVendorLines } from '@/lib/agreed-total-and-its-changes';
import { pesoLabel } from '@/lib/proposal-amendments';
import {
  lineItemsPanelLead,
  pesoFromCentavos,
  type PaymentDoor,
  type QuoteLine,
} from '@/lib/accepted-quote-terms';
import { depositStepHref } from '@/lib/deposit-pay-step';
import {
  addLineItem,
  deleteLineItem,
  deletePayment,
  logPayment,
} from '@/app/dashboard/[eventId]/budget/actions';

export type VendorItemizationCardProps = {
  summary: VendorBudgetSummary;
  eventId: string;
  /**
   * 'card'  — full chrome (header + status pill + Money strip + sections)
   *           used on /budget.
   * 'embed' — minimal (Money strip + sections only) used on the workspace
   *           page where the surrounding chrome carries the vendor identity.
   */
  variant?: 'card' | 'embed';
  /**
   * The vendor's PUBLISHED off-platform payment destinations, fetched
   * server-side by the caller via fetchPublishedMethodsForCouple (couples
   * pay vendors directly; Setnayan never holds the money). Defaults to []
   * — for off-platform/manual vendors the helper returns [] and the
   * VendorDirectPay block renders a quiet "coordinate in chat" hint.
   */
  directPayMethods?: CoupleFacingMethod[];
  /**
   * The booking's frozen PAYMENT PLAN installments (Phase 2 PR-B/PR-C),
   * fetched server-side by the caller from event_vendor_payment_plan. When
   * present + non-empty, the log-payment form surfaces an optional "which
   * installment?" dropdown (label · amount · due) that sets
   * schedule_instance_seq. null/[] = no plan → the dropdown is hidden and the
   * host logs a generic payment, exactly as before.
   */
  installments?: PlanInstance[] | null;
  /**
   * The ACCEPTED quote's priced lines (`acceptedQuoteTerms(...).lines`). When
   * present they lead the LINE ITEMS panel — read-only, the supplier's own
   * figures — in place of the catalogue and the "hasn't shared pricing" empty
   * state (`lineItemsPanelLead`). Display only: the money strip's totals are
   * unchanged. null = not loaded / no accepted quote.
   */
  acceptedQuoteLines?: QuoteLine[] | null;
  /** The accepted quote's total, shown under its lines. null = none / not loaded. */
  acceptedQuoteTotalCentavos?: number | null;
  /**
   * Which door "+ Log a payment" is (`paymentDoor`, lib/accepted-quote-terms.ts).
   * 'amount_to_pay' points at the one "Amount to pay" card instead of being a
   * second way to record the same money. Default 'log' — the
   * caller that cannot tell keeps today's behaviour, and `logPayment` enforces
   * the same rule on the server either way.
   */
  paymentDoor?: PaymentDoor;
};

export function VendorItemizationCard({
  summary,
  eventId,
  variant = 'card',
  directPayMethods = [],
  installments = null,
  acceptedQuoteLines = null,
  acceptedQuoteTotalCentavos = null,
  paymentDoor = 'log',
}: VendorItemizationCardProps) {
  const {
    vendor,
    lineItems,
    payments,
    itemizedTotal,
    agreedBeforeChanges,
    paidTotal,
    priceSource,
    vendorControlledItems,
    paymentsMeasured,
    lineItemsMeasured,
  } = summary;

  /**
   * The ledger ROW — what the archetype shows without being asked: the money,
   * and the notice when a read was refused. On /budget this is the summary of
   * a collapsed card; in the workspace embed it simply leads, as before.
   */
  /**
   * The refused-read alert. It used to live inside `ledgerRow`, which on
   * /budget put a paragraph of error prose INSIDE the `<summary>` — and a
   * `<summary>` is announced as one control whose name is everything inside
   * it, so a screen-reader user heard the failure notice read out as part of
   * the button's label before they could act on it. It is an alert ABOUT the
   * card, not part of the row, so it now sits above the disclosure on both
   * variants: still always visible, no longer part of a control's name.
   *
   * A refused read must never render as a money figure. `paidTotal` of 0 makes
   * `remaining` the FULL total, so an unmeasured payments read does not merely
   * hide what you paid — it bills you for it again. Both figures derive from
   * that one read, so both go together; "Budget" is kept because it survives on
   * the headline figure, and flagged when its own line-items read was refused.
   */
  const balance = describeSupplierBalance({
    itemizedTotal,
    paidTotal,
    paymentsMeasured,
    lineItemsMeasured,
  });

  const refusedReadNotice = paymentsMeasured ? null : (
    <div role="status" className="py-2 text-sm text-warn-800">
      We couldn&rsquo;t load your payments for this supplier, so what
      you&rsquo;ve paid and what&rsquo;s left aren&rsquo;t shown. Nothing has
      changed &mdash; refresh to try again.
    </div>
  );

  const ledgerRow = (
    <>
      {/* 🏷 A REAL <dl>. These are term/figure pairs and always were, but the
          <dt>/<dd> sat inside a plain <div>, which leaves them orphaned: with
          no <dl> ancestor the description-list semantics are dropped entirely
          and assistive tech reads six unrelated fragments instead of three
          labelled amounts. `dl > div > dt + dd` is the valid grouping form, so
          Money's own wrapper is unchanged. (Repo-wide this shape appears in
          three files; the other two are outside this screen and are reported,
          not touched.) */}
      <dl className="grid grid-cols-3 gap-x-4 py-3">
        <Money
          label={lineItemsMeasured ? 'Budget' : 'Budget (partly loaded)'}
          value={formatPhp(itemizedTotal)}
        />
        <Money label="Paid" value={paymentsMeasured ? formatPhp(paidTotal) : '—'} tone="muted" />
        {/* 🚨 AN OVERPAID SUPPLIER IS NOT A SETTLED ONE. `remaining` is clamped
            at zero, so paying ₱450,000 against a ₱400,000 supplier rendered
            "Remaining ₱0.00" in success green — identical to an account that
            balances, with no signal that ₱50,000 went out beyond the agreed
            figure. The strip at the top of this same screen already says "Over
            target" in the warning tone for its own version of this. The claim
            needs BOTH reads: see describeSupplierBalance. */}
        <Money
          label={
            balance.state === 'overpaid'
              ? 'Overpaid by'
              : 'Remaining'
          }
          value={balance.state === 'unknown' ? '—' : formatPhp(balance.amountPhp)}
          tone={
            balance.state === 'owing' || balance.state === 'overpaid' ? 'warn' : 'good'
          }
        />
      </dl>
    </>
  );

  /**
   * The HISTORY — line items and the dated payment log. "Summary first, history
   * on demand" (Ledger archetype, designer's note 3), so on /budget this lives
   * behind the row rather than beside it.
   */
  const workingSections = (
    <div className="border-t border-ink/10">
        <LineItemSection
          priceSource={priceSource}
          vendorControlledItems={vendorControlledItems}
          lineItems={lineItems}
          eventId={eventId}
          vendorId={vendor.vendor_id}
          suggestTotalPhp={itemizedTotal}
          agreedBeforeChangesPhp={agreedBeforeChanges}
          acceptedQuoteLines={acceptedQuoteLines}
          acceptedQuoteTotalCentavos={acceptedQuoteTotalCentavos}
        />
        <PaymentSection
          payments={payments}
          lineItems={lineItems}
          vendorControlledItems={vendorControlledItems}
          eventId={eventId}
          vendorId={vendor.vendor_id}
          vendorName={vendor.vendor_name}
          directPayMethods={directPayMethods}
          installments={installments}
          paymentDoor={paymentDoor}
        />
    </div>
  );

  // 🔗 REACHABLE ON EVERY LINE, regardless of pricing state. Rendered OUTSIDE
  // `<details>`/`<summary>` — a nested `<a>` inside a `<summary>` fights the
  // disclosure's own click-to-toggle behavior, so this row sits above the
  // fold and stays visible whether the ledger row is collapsed or open.
  const reachLinks = <SupplierReachLinks eventId={eventId} vendor={vendor} variant={variant} />;

  // 'embed' variant — no outer <article>, no header, no status pill. The
  // workspace page wraps this in its own Payments <section>.
  if (variant === 'embed') {
    return (
      // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 4 · 5 · 6 · 12 · 13 · 14): no card around the ledger — the
      // three figures between hairlines, line items and payments as sections of plain rows, one column on every screen.
      <div>
        {refusedReadNotice}
        {reachLinks}
        {ledgerRow}
        {workingSections}
      </div>
    );
  }

  // 'card' variant — full shell used on /budget.
  //
  // 🪧 THE ANCHOR SERVES NOBODY YET, AND THAT IS NOW SAID OUT LOUD. A comment
  // here claimed the workspace page's "Add milestone" CTA deep-links to
  // `/budget#vendor-${vendor_id}`. Grepped: there is exactly ONE occurrence of
  // that URL shape in the repo and it was the comment itself — no caller has
  // ever existed. The id + `scroll-mt-24` are kept because they are the right
  // landing spot if one is ever built, but whoever builds it must know the
  // card is now COLLAPSED on arrival: point the fragment at something INSIDE
  // the <details> (browsers open the ancestor disclosure for a fragment target)
  // rather than at the <article>, or the visitor lands on a shut row.
  //
  // 📖 SUMMARY FIRST, HISTORY ON DEMAND (Ledger archetype, designer's note 3:
  // "Each row expands to its dated payments and receipts; collapsed, the ledger
  // stays one screen of truth"). The card used to hold every supplier's full
  // line-item table and payment log open at once, so a couple with eight
  // suppliers scrolled past eight open ledgers to reach the eighth. Collapsed,
  // the row still carries everything the archetype puts on a row — who, what
  // kind, where the booking stands, and Budget / Paid / Remaining — and the
  // history opens on a tap.
  //
  // ⚠ NOT a client component and deliberately so: `<details>` is the browser's
  // own disclosure, so this stays a server component, keeps working with no
  // JavaScript, and announces its own expanded state. The forms inside it are
  // the same server actions, unmoved.
  //
  // ⚠ THE GROUP IS NAMED, AND IT HAS TO BE. A bare `className="group"` here
  // becomes an ancestor `.group` for the whole card, and `group-hover:` matches
  // ANY `.group` ancestor rather than the nearest — so hovering the header lit
  // up a `group-hover:` chevron three components deep in vendor-direct-pay, as
  // if that button were under the cursor. `group/ledger` + `group-open/ledger:`
  // keeps this disclosure's state to itself.
  //
  // ⚠ 'embed' NEVER COLLAPSES — and the reason first written here was FALSE.
  // It said the workspace page already wraps this card in a Payments
  // disclosure. It does not: that page contains zero `<details>` of any kind.
  // The true reason is simpler — the workspace IS the page for one supplier,
  // reached by choosing that supplier, and folding away the only thing it
  // exists to show is a door in front of the room you asked for. On /budget the
  // fold earns its keep because there are N suppliers to scroll past; there,
  // there is one.
  return (
    <article
      id={`vendor-${vendor.vendor_id}`}
      className="scroll-mt-24 border-t border-ink/10"
    >
      {refusedReadNotice}
      {reachLinks}
      <details className="group/ledger">
        <summary className="cursor-pointer list-none pb-1 pt-4 [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[15px] font-semibold text-ink">
                  {vendor.vendor_name}
                </h2>
                <PriceSourceChip priceSource={priceSource} />
              </div>
              <p className="text-[13px] text-ink/70">
                {VENDOR_CATEGORY_LABEL[vendor.category]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={STATUS_BADGE[vendor.status]}>{VENDOR_STATUS_LABEL[vendor.status]}</Badge>
              {/* Decoration: a <summary> already carries its own expanded
                  state, so these words would otherwise be read out as part of
                  the control's name for no gain. */}
              <span
                aria-hidden
                className="text-[13px] font-semibold text-sn-accent group-open/ledger:hidden"
              >
                Open
              </span>
              <span
                aria-hidden
                className="hidden text-[13px] font-semibold text-sn-accent group-open/ledger:inline"
              >
                Close
              </span>
              <ChevronDown
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink/70 transition-transform group-open/ledger:rotate-180"
                strokeWidth={2}
              />
            </div>
          </div>

          {ledgerRow}
        </summary>

        {workingSections}
      </details>
    </article>
  );
}

// ----------------------------------------------------------------------------
// Internal sub-components — pulled directly from the prior budget/page.tsx
// inline definitions. Behavior preserved 1:1; only the location changes.
// ----------------------------------------------------------------------------

/**
 * Two ways to reach this supplier, rendered unconditionally — never gated on
 * `priceSource`. Before this, the ONLY outbound link in this file lived
 * inside `LineItemSection` and rendered exclusively while
 * `priceSource === 'pending' && !hasVendorControlled` — once a vendor HAD
 * pricing, "message the vendor in chat" was plain text with no link, and an
 * off-platform supplier (`marketplace_vendor_id` is NULL) built a bare
 * `?vendor=` with nothing after it, which the messages page never even reads
 * (it reads `prefill_vendor_email`, not `vendor`).
 *
 * The message link prefills from `event_vendors.contact_email` only for an
 * OFF-platform supplier (a Setnayan shop's copied address is never pre-filled,
 * 2026-09-10 — see `prefillEmail` below), and degrades to the plain messages index when they don't
 * — `contact_email` is nullable with no default (see
 * `20260513100000_iteration_0006_vendors.sql`), and measured live on
 * 2026-09-02 every one of the 45 `event_vendors` rows in production has it
 * NULL or blank. So today this link reaches nobody via prefill; the fallback
 * is deliberate, not a bug, and the workspace link (keyed on `vendor_id`,
 * which every row has) reaches the supplier's own page regardless. Suppliers
 * shipping with no contact_email is a separate, upstream defect — not fixed
 * here.
 */
function SupplierReachLinks({
  eventId,
  vendor,
  variant,
}: {
  eventId: string;
  vendor: EventVendorRow;
  /** 'card' is the budget page; 'embed' is inside the supplier's workspace. */
  variant: 'card' | 'embed';
}) {
  /* 🔴 "MESSAGE" NEVER OPENED THE CONVERSATION. Both branches land on the
     conversation LIST — one with an email pre-filled into a "start a new
     thread" form that still needs submitting, one bare — even when the couple
     has been talking to this supplier for weeks. The prefill also keys on
     `contact_email`, which most marketplace paths never write, so for exactly
     the suppliers who CAN be messaged it usually took the bare branch.

     ⚠ ONLY ON THE BUDGET CARD. The 'embed' variant renders inside the
     supplier's own workspace, which already ships a thread deep-link AND the
     conversation itself — a second opener there is duplication, not a fix.

     ⚠ AND ONLY FOR A SUPPLIER ON SETNAYAN. The shipped button gates on the
     marketplace id; an off-platform row a couple typed in by hand cannot be
     messaged here at all, and offering it would return "This vendor can't be
     messaged here". That row keeps the plain link. */
  /* 🚪 THE PREFILL IS ONLY EVER THE ADDRESS THE COUPLE TYPED for a supplier who
     is NOT on Setnayan (owner 2026-09-10: "our goal is to let them integrate
     their event with the vendor they find. not to let them communicate outside
     the app"). A package lock COPIES a Setnayan shop's own email into
     `event_vendors` (vendors/packages/actions.ts), and the Messages page prints
     a prefill in plain sight as the value of its "start a thread" box — so
     keying on `contact_email` alone handed the couple the shop's address. A
     shop on Setnayan is reached through its conversation instead (the Message
     button below, or its workspace). Same predicate as `canOpenThread`, and as
     the LineItemSection prop above; written inline because the reach test
     evaluates this body as-is. */
  const prefillEmail = vendor.marketplace_vendor_id ? null : vendor.contact_email?.trim() || null;
  const messagesHref = prefillEmail
    ? `/dashboard/${eventId}/messages?prefill_vendor_email=${encodeURIComponent(prefillEmail)}`
    : `/dashboard/${eventId}/messages`;
  const canOpenThread = variant === 'card' && vendor.marketplace_vendor_id != null;
  const workspaceHref = `/dashboard/${eventId}/vendors/${vendor.vendor_id}/workspace`;
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {canOpenThread ? (
        <ContactShortlistVendorButton
          eventId={eventId}
          vendorId={vendor.vendor_id}
          label="Message"
          pendingLabel="Opening…"
          className="ab ab-info inline-flex min-h-11 items-center justify-center gap-1.5"
        />
      ) : (
        <Link href={messagesHref} className="ab ab-info inline-flex min-h-11 items-center justify-center gap-1.5">
          <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Message
        </Link>
      )}
      <Link href={workspaceHref} className="ab ab-neutral inline-flex min-h-11 items-center justify-center gap-1.5">
        <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Open workspace
      </Link>
    </div>
  );
}

/** Where the booking stands, as the shared chip — green once money or work has moved, amber waiting, grey otherwise (rule 5). */
const STATUS_BADGE: Record<VendorStatus, BadgeTone> = {
  considering: 'quiet',
  shortlisted: 'wait',
  contracted: 'quiet',
  deposit_paid: 'ok',
  delivered: 'ok',
  complete: 'ok',
};

function PriceSourceChip({ priceSource }: { priceSource: VendorPriceSource }) {
  if (priceSource === 'manual') return null;
  if (priceSource === 'package' || priceSource === 'service') {
    return (
      <span title="The supplier publishes this pricing in their catalog. Message them to adjust.">
        <Badge tone="quiet">From supplier</Badge>
      </span>
    );
  }
  // 'pending' — vendor hasn't sent pricing yet.
  return (
    <span title="The supplier hasn't published pricing yet. Ask them in chat.">
      <Badge tone="wait">Awaiting pricing</Badge>
    </span>
  );
}

/**
 * One ledger cell — a money figure under its own micro-label.
 *
 * 🔤 THE FIGURE IS STILL IN THE MONO FACE — on purpose, and only for now. The design template (14 Nov 2026, rule 13)
 * wants money in the body face, but `app/tour/budget/the-tour-copy-does-not-drift.test.ts` pins this cell and its
 * public-tour fork (`tour/budget/_components/tour-vendor-itemization.tsx`, template batch T30) to ONE face: "fix both,
 * or neither". T10 does not own the fork, so both move together in T30 (or one follow-up). No box: the three cells
 * sit between hairlines.
 */
function Money({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'warn' | 'good';
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">{label}</dt>
      <dd
        className={`mt-0.5 font-mono text-[17px] font-bold tabular-nums ${
          tone === 'warn'
            ? 'text-warn-800'
            : tone === 'good'
              ? 'text-[rgb(var(--color-ok))]'
              : 'text-ink'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function LineItemSection({
  priceSource,
  vendorControlledItems,
  lineItems,
  eventId,
  vendorId,
  suggestTotalPhp,
  agreedBeforeChangesPhp,
  acceptedQuoteLines = null,
  acceptedQuoteTotalCentavos = null,
}: {
  acceptedQuoteLines?: QuoteLine[] | null;
  acceptedQuoteTotalCentavos?: number | null;
  priceSource: VendorPriceSource;
  vendorControlledItems: VendorControlledLineItem[];
  lineItems: LineItemRow[];
  eventId: string;
  vendorId: string;
  /** The supplier's agreed total NOW — `itemizedTotal`, changes included. */
  suggestTotalPhp: number;
  /** The agreed price before any change — `agreedBeforeChanges`. */
  agreedBeforeChangesPhp: number;
}) {
  const lead = lineItemsPanelLead({
    priceSource,
    hasVendorControlled: vendorControlledItems.length > 0,
    quoteLines: acceptedQuoteLines,
  });
  // The catalogue block keeps its old meaning ("vendor-controlled lines are on
  // screen") for the manual-lines subheading below; with a quote leading, the
  // quote's lines are the vendor-controlled lines on screen.
  const hasVendorControlled = lead === 'catalogue' || lead === 'quote';
  // ── A CHANGE IS SHOWN SEPARATELY (owner 2026-09-09) ──────────────────────
  // "Both, shown separately" — the agreed total updates AND the change stays
  // visible as its own line. A settled change-order delta shares this table
  // with the couple's own itemisation and means the opposite thing, so it gets
  // its own heading rather than sitting unlabelled among "Your own additions"
  // where nothing says the supplier agreed to it.
  const { breakdown: manualLines, changes: changeLines } = splitVendorLines(lineItems);
  const hasManual = manualLines.length > 0;
  const hasChanges = changeLines.length > 0;
  return (
    <section className="space-y-3 py-2">
      <header className="mt-[18px] flex items-center gap-2">
        <Receipt aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          Line items
        </h3>
      </header>

      {lead === 'quote' && acceptedQuoteLines ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
            From the quote you accepted
          </p>
          <ul className="divide-y divide-ink/10">
            {acceptedQuoteLines.map((line, i) => (
              <li
                key={`${i}-${line.label}`}
                className="flex min-h-14 items-center justify-between gap-2 py-2.5 text-[15px]"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-ink">{line.label}</p>
                  {line.detail ? <p className="text-[13px] text-ink/70">{line.detail}</p> : null}
                </div>
                <span className="text-[15px] font-bold tabular-nums text-ink">
                  {pesoFromCentavos(line.amountCentavos)}
                </span>
              </li>
            ))}
          </ul>
          {acceptedQuoteTotalCentavos != null && acceptedQuoteTotalCentavos > 0 ? (
            <p className="flex min-h-11 items-center justify-between border-t border-ink/10 pt-2 text-sm text-ink/70">
              <span>Quote total</span>
              <span className="font-bold tabular-nums text-ink">
                {pesoFromCentavos(acceptedQuoteTotalCentavos)}
              </span>
            </p>
          ) : null}
          <p className="text-[13px] text-ink/70">
            To change these, ask the supplier to send an updated quote.
          </p>
        </div>
      ) : null}

      {lead === 'catalogue' ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
            From the supplier&rsquo;s catalog
          </p>
          <ul className="divide-y divide-ink/10">
            {vendorControlledItems.map((item) => (
              <li
                key={item.source_id}
                className="flex min-h-14 items-center justify-between gap-2 py-2.5 text-[15px]"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-ink">{item.label}</p>
                  <p className="text-[13px] text-ink/70">
                    {item.source_kind === 'package' ? 'Package item' : 'Starting price'}
                    {' · '}
                    {item.vendor_business_name}
                  </p>
                </div>
                <span className="text-[15px] font-bold tabular-nums text-ink">
                  {formatPhp(item.amount_php)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-ink/70">
            To adjust pricing, message the supplier in chat. They&rsquo;ll update their
            catalog and these line items will refresh.
          </p>
        </div>
      ) : null}

      {lead === 'pending' ? (
        <div className="space-y-2 py-1 text-sm">
          <p className="text-ink/70">
            This supplier hasn&rsquo;t shared pricing yet. Their catalog will appear
            here once they publish it.
          </p>
          {/* 💬 "ASK THEM" OPENS THE CONVERSATION WITH THEM (2026-09-11). It used to
              be a link to the Messages LIST — prefilled with the supplier's
              address only if the couple had typed one. This box renders only for
              'pending', which is only ever a supplier ON Setnayan, and since
              2026-09-10 such a supplier's copied address is never prefilled, so
              the link could never reach them: it dropped the couple on a list
              and left them to find the thread. The shipped thread opener (the
              same one as "Message" above) opens or resumes THIS supplier's
              conversation for this event, deduped server-side, so a tap can
              never start a second thread. */}
          <ContactShortlistVendorButton
            eventId={eventId}
            vendorId={vendorId}
            label="Ask them for pricing"
            pendingLabel="Opening…"
            wrapperClassName=""
            className="ab ab-info inline-flex min-h-11 items-center justify-center gap-1.5"
          />
        </div>
      ) : null}

      {hasManual ? (
        <div className="space-y-2">
          {hasVendorControlled ? (
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
              Your own additions
            </p>
          ) : null}
          <ul className="divide-y divide-ink/10">
            {manualLines.map((li) => (
              /* 👈 Your own line's Delete is its swipe (owner 2026-11-03) — the same ask, then Undo. */
              <ConfirmSwipe
                key={li.line_item_id}
                action={deleteLineItem}
                fields={{ event_id: eventId, line_item_id: li.line_item_id }}
                title="Delete this line item?"
                message="It’s removed from this supplier’s budget — you can add it back anytime."
                confirmLabel="Delete"
                label={`Delete ${li.label}`}
                undoLabel={`“${li.label}” deleted`}
                className="flex min-h-14 items-center justify-between gap-2 py-2.5 text-[15px]"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-ink">{li.label}</p>
                  {li.due_date ? (
                    <p className="inline-flex items-center gap-1 text-[13px] text-ink/70">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Due {li.due_date}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold tabular-nums text-ink">
                    {formatPhp(li.amount_php)}
                  </span>
                </div>
              </ConfirmSwipe>
            ))}
          </ul>
        </div>
      ) : null}

      {hasChanges ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
            Changes you both agreed
          </p>
          {/* 🔢 BOTH NUMBERS, AND THE SUM BETWEEN THEM (owner 2026-09-09, "Both,
              shown separately"). The price they agreed first, each change on its
              own line, and what it is now — so ₱100,000, −₱15,000, ₱85,000 reads
              as arithmetic on one screen instead of a number that silently moved.
              Both ends come from `resolveAgreedTotal` (basePart and agreed), so
              the three rows cannot disagree with the Budget figure above. */}
          <div className="flex min-h-11 items-center justify-between gap-2 text-[15px] text-ink/70">
            <span>Agreed price before changes</span>
            <span className="text-[15px] font-bold tabular-nums text-ink/70">
              {formatPhp(agreedBeforeChangesPhp)}
            </span>
          </div>
          <ul className="divide-y divide-ink/10">
            {changeLines.map((li) => (
              <li
                key={li.line_item_id}
                className="flex min-h-14 items-center justify-between gap-2 py-2.5 text-[15px]"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-ink">{li.label}</p>
                  {li.due_date ? (
                    <p className="inline-flex items-center gap-1 text-[13px] text-ink/70">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Due {li.due_date}
                    </p>
                  ) : null}
                </div>
                {/* NO DELETE CONTROL, DELIBERATELY. A line the couple typed is
                    theirs to remove; a change order is a record of something the
                    SUPPLIER also agreed to. Letting one side delete it would put
                    the budget and the change-order trail — which keeps saying
                    "accepted" — back into disagreement, which is the whole
                    defect. The way to undo a change is another change. */}
                <span className="text-[15px] font-bold tabular-nums text-ink">
                  {pesoLabel(Number(li.amount_php))}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex min-h-11 items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[15px]">
            <span className="font-semibold text-ink">Agreed total now</span>
            <span className="text-[15px] font-bold tabular-nums text-ink">
              {formatPhp(suggestTotalPhp)}
            </span>
          </div>
        </div>
      ) : null}

      {priceSource === 'manual' ? (
        <>
          {!hasManual ? (
            <div className="space-y-2">
              <p className="py-2 text-sm text-ink/70">
                No line items yet — add a First payment, Balance, or Tip below.
              </p>
              {/* One-click split — only when there's a total to divide. Seeds an
                  editable Deposit 50% + Balance 50% so the live "next payments"
                  list + .ics export populate without typing each milestone. */}
              {suggestTotalPhp > 0 ? (
                <SuggestMilestonesButton eventId={eventId} vendorId={vendorId} />
              ) : null}
            </div>
          ) : null}
          <form
            action={addLineItem}
            className="grid grid-cols-2 gap-2 border-t border-ink/10 pt-3 sm:grid-cols-4"
          >
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={vendorId} />
            <input
              name="label"
              required
              maxLength={64}
              placeholder="Label (e.g. First payment)"
              className="input-field col-span-2 min-h-12 text-[15px]"
            />
            <input
              name="amount_php"
              type="number"
              min={0.01}
              step="0.01"
              required
              placeholder="Amount"
              className="input-field min-h-12 text-[15px]"
            />
            <input
              name="due_date"
              type="date"
              placeholder="Due date"
              className="input-field min-h-12 text-[15px]"
            />
            <SubmitButton
              className="ab ab-brand col-span-2 inline-flex min-h-11 items-center justify-center gap-1 sm:col-span-4"
              pendingLabel="Adding…"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Add line item
            </SubmitButton>
          </form>
        </>
      ) : (
        // Vendor-controlled / pending — quiet "add an extra" path for
        // ad-hoc cash tips or off-catalog add-ons the vendor doesn't
        // itemize. Keeps manual entry alive without competing with the
        // vendor's own pricing surface.
        <details className="group border-t border-ink/10 pt-3">
          <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-sn-accent">
            <PencilLine aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Add an extra not on the supplier&rsquo;s catalog
          </summary>
          <form action={addLineItem} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={vendorId} />
            <input
              name="label"
              required
              maxLength={64}
              placeholder="Label (e.g. Tip)"
              className="input-field col-span-2 min-h-12 text-[15px]"
            />
            <input
              name="amount_php"
              type="number"
              min={0.01}
              step="0.01"
              required
              placeholder="Amount"
              className="input-field min-h-12 text-[15px]"
            />
            <input
              name="due_date"
              type="date"
              placeholder="Due date"
              className="input-field min-h-12 text-[15px]"
            />
            <SubmitButton
              className="ab ab-brand col-span-2 inline-flex min-h-11 items-center justify-center gap-1 sm:col-span-4"
              pendingLabel="Adding…"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Add extra
            </SubmitButton>
          </form>
        </details>
      )}
    </section>
  );
}

function PaymentSection({
  payments,
  lineItems,
  vendorControlledItems,
  eventId,
  vendorId,
  vendorName,
  directPayMethods,
  installments,
  paymentDoor = 'log',
}: {
  payments: PaymentRow[];
  lineItems: LineItemRow[];
  vendorControlledItems: VendorControlledLineItem[];
  eventId: string;
  vendorId: string;
  vendorName: string;
  directPayMethods: CoupleFacingMethod[];
  installments?: PlanInstance[] | null;
  paymentDoor?: PaymentDoor;
}) {
  const hasVendorControlled = vendorControlledItems.length > 0;
  const planInstallments = installments ?? [];
  const hasInstallments = planInstallments.length > 0;
  return (
    <section className="space-y-3 py-2">
      {/* Off-platform direct-pay surface — the vendor's published payment
          destinations + the always-on "Setnayan doesn't hold this money"
          disclosure. Rendered just above the payment log so the host sees
          HOW to pay before they record THAT they paid. Methods are fetched
          server-side via the secure helper (see budget/page.tsx). */}
      <VendorDirectPay vendorName={vendorName} methods={directPayMethods} />

      <header className="mt-[18px] flex items-center gap-2">
        <Receipt aria-hidden className="h-4 w-4 text-success-700" strokeWidth={1.75} />
        <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70">
          Payments
        </h3>
      </header>
      {payments.length === 0 ? (
        <p className="py-2 text-sm text-ink/70">
          No payments logged yet — record one below as soon as money moves.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {payments.map((p) => {
            const line = lineItems.find((li) => li.line_item_id === p.line_item_id);
            const fallbackLabel =
              !line && p.notes && p.notes.length > 0 ? p.notes : 'Generic payment';
            return (
              /* 👈 A logged payment's Delete is its swipe (owner 2026-11-03) — the same ask, then Undo. */
              <ConfirmSwipe
                key={p.payment_id}
                action={deletePayment}
                fields={{ event_id: eventId, payment_id: p.payment_id }}
                title="Remove this logged payment?"
                message="The running total updates — log it again if you remove it by mistake."
                confirmLabel="Delete"
                label={`Delete the payment ${line ? line.label : fallbackLabel}`}
                undoLabel="Payment removed"
                className="flex min-h-14 items-start justify-between gap-2 py-2.5 text-[15px]"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-semibold text-ink">
                    {line ? line.label : fallbackLabel}
                  </p>
                  <p className="text-[13px] text-ink/70">
                    {p.paid_at}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.reference ? ` · ref ${p.reference}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold tabular-nums text-[rgb(var(--color-ok))]">
                    {formatPhp(p.amount_php)}
                  </span>
                </div>
              </ConfirmSwipe>
            );
          })}
        </ul>
      )}

      {/* ONE VISIBLE DOOR (owner, 2026-09-20). A Setnayan supplier's payments go
          through the "Amount to pay" card — it names which payment is due,
          takes the first through `recordDeposit` (date held, supplier asked to
          confirm) and later ones through `logPayment`. Logging here as well was
          a second door: a first payment logged here counted as Paid, held
          nothing, and left the first payment still owed. */}
      {paymentDoor === 'amount_to_pay' ? (
        <div className="space-y-1.5 border-t border-ink/10 pt-3 text-sm text-ink/70">
          <p>
            Payments to {vendorName} are recorded under Amount to pay, which shows
            which payment is due next and lets them confirm it.
          </p>
          <Link
            href={depositStepHref(eventId, vendorId)}
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-sn-accent"
          >
            Amount to pay
            <ArrowUpRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      ) : paymentDoor === 'unknown' ? (
        <p role="status" className="border-t border-ink/10 pt-3 text-sm text-warn-800">
          We couldn&rsquo;t check whether your payment to {vendorName} is
          recorded, so logging a payment is paused. Refresh to try again.
        </p>
      ) : (
      /* Default-then-disclose: the 5-field log stays out of the way until the
          host actually has a payment to record (it's the page's busiest form). */
      <details className="group border-t border-ink/10 pt-3">
        <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-sn-accent">
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Log a payment
        </summary>
        <form
          action={logPayment}
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="vendor_id" value={vendorId} />
        {/* Optional installment attribution (Phase 2 PR-C). Only shown when the
            booking has a frozen payment plan — sets schedule_instance_seq so the
            vendor sees WHICH installment this payment is for when they confirm.
            "Not tied to an installment" = leave NULL (a generic payment). */}
        {hasInstallments ? (
          <PostedPick
            name="schedule_instance_seq"
            label="Which payment?"
            className="col-span-2 sm:col-span-4"
            options={[
              { key: '', label: 'Not tied to a payment' },
              ...planInstallments.map((inst) => ({
                key: String(inst.seq),
                label: `${inst.label}${inst.amount_php != null ? ` · ${formatPhp(inst.amount_php)}` : ''}${inst.due_date ? ` · due ${inst.due_date}` : ''}`,
              })),
            ]}
          />
        ) : null}
        {/* Synthetic `vc:` value for a catalog item — see logPayment in budget/actions.ts. Stores the label in notes;
            writes line_item_id=NULL because vendor-controlled items have no FK target. */}
        <PostedPick
          name="line_item_id"
          label="Against which line item?"
          className="col-span-2"
          options={[
            { key: '', label: 'Against any line item' },
            ...(hasVendorControlled
              ? vendorControlledItems.map((item) => ({
                  key: `vc:${item.label}`,
                  label: `${item.label} · ${formatPhp(item.amount_php)}`,
                  group: 'From the supplier’s catalog',
                }))
              : []),
            ...lineItems.map((li) => ({
              key: li.line_item_id,
              label: `${li.label} · ${formatPhp(li.amount_php)}`,
              group: 'Your own additions',
            })),
          ]}
        />
        <input
          name="amount_php"
          type="number"
          min={0.01}
          step="0.01"
          required
          placeholder="Amount paid"
          className="input-field min-h-12 text-[15px]"
        />
        <input
          name="paid_at"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="input-field min-h-12 text-[15px]"
        />
        <input
          name="method"
          placeholder="Method (cash, BDO, GCash)"
          className="input-field col-span-2 min-h-12 text-[15px]"
        />
        <input
          name="reference"
          placeholder="Reference #"
          className="input-field min-h-12 text-[15px]"
        />
        {/* Optional receipt screenshot — couples pay vendors off-platform, so
            this is their own record of the transfer (not a Setnayan-verified
            proof). Emits an `r2://thread-files/…` ref via a hidden input that
            logPayment reads as `proof_r2_key`.

            🔒 PRIVATE BUCKET, deliberately. This wrote to `media` until
            2026-07-30 — the one publicly-served bucket (`PUBLIC_MEDIA_BUCKET`
            in lib/booth-studio.ts, fetched unsigned). These are bank-transfer
            screenshots carrying reference numbers, partial account numbers and
            names: the same PII class as Setnayan-checkout proofs, which already
            route to `thread-files` via bucketForPrefix(). "The host's own
            record" describes whose data it is, not how exposed it may be.

            ⚠ "There is currently NO reader" was true when written and is NOT
            true now — `lib/vendor-service-payment-schedules.server.ts` has read
            this since 2026-06-20 and renders it on three live vendor routes. It
            resolves through `displayUrlForStoredAsset()` (lib/uploads.ts), which
            signs a short-lived GET; never interpolate the key into a public URL.
            The reader existed while the upload was refused outright, so the
            vendor's screen had a slot for a receipt that could never arrive. */}
        <div className="col-span-2 sm:col-span-4">
          <FileUpload
            name="proof_r2_key"
            unsavedHint="press Log below"
            bucket="thread-files"
            pathPrefix={`payment-proof/events/${eventId}`}
            maxSizeMB={5}
            acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
            label="Attach receipt (optional)"
            variant="wide"
            /* A receipt is checked by LOOKING at it, never by its filename —
               owner, live, 2026-09-20. See the prop in file-upload.tsx. */
            bigPreview
          />
        </div>
        <SubmitButton
          className="ab ab-ok col-span-2 inline-flex min-h-11 items-center justify-center gap-1 sm:col-span-4"
          pendingLabel="Logging…"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Log
        </SubmitButton>
        </form>
      </details>
      )}
    </section>
  );
}
