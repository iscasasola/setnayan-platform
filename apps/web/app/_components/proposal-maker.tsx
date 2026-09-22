'use client';

import {
  previewGiftForTotal,
  giftQuoteCopy,
  type GiftQuoteBasis,
} from '@/lib/setnayan-gift';
import {
  bookingFeeForecast,
  feePesos,
  type BookingFeeStanding,
} from '@/lib/booking-fee-disclosure';
import { bookingFeePhp } from '@/lib/booking-fee';
import { formatGiftPhotos } from '@/lib/setnayan-gift';
import { BookingFeeNotice } from '@/app/_components/booking-fee-notice';
import {
  papicTopUpForQuote,
  type PapicQuoteStanding,
} from '@/lib/papic-on-a-quote';

import { useMemo, useState, useTransition } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  resolvePackageLine,
  crewChargeCentavos,
  crewCreditCentavos,
  transportChargeCentavos,
  type PackageLinePricingRow,
} from '@/lib/package-line-pricing';
import { formatCentavos, type ProposalLineItem } from '@/lib/vendor-proposals';
import {
  resolveSchedule,
  type InstallmentDraft,
  type InstallmentDue,
  type AutoBalanceMeta,
} from '@/lib/proposal-payment-schedule';
import {
  sendCustomProposalFromChat,
  loadPackageLinesForQuote,
  loadServiceCardLinesForQuote,
  type QuoteSeedLine,
} from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';
import { applyCardSeedToDraft, type QuoteSeedWarning } from '@/lib/quote-from-service-card';
import {
  QUOTE_STAGES,
  nextStage,
  openingStage,
  stageStates,
  stageSummaries,
  type QuoteStageId,
} from '@/lib/quote-stages';
import type { QuoteRevisionSeed } from '@/lib/quote-revision-seed';

/**
 * Vendor Proposal Maker — the in-thread quote editor.
 *
 * Translates prototypes/vendor_proposal_maker_2026-07-10.html into React:
 * per-line pricing bases (Flat / Per pax / Per hour) resolved against the
 * event's pax + coverage hours, freebies (₱0 → "Complimentary"), 6-dot
 * drag-reorder, crew meal (Included / Charge / Offset-credit) + transportation,
 * a discount, and a live total. On send it composes a flat ProposalLineItem[]
 * (centavos) + persists a real vendor_proposals row + posts the in-thread card
 * (sendCustomProposalCore).
 *
 * The line-item / crew / transport money flows through the pure resolver in
 * lib/package-line-pricing.ts; the self-balancing PAYMENT SCHEDULE (§ 8) flows
 * through lib/proposal-payment-schedule.ts — the same pure resolver the server
 * re-runs on send. This component only converts peso-facing inputs to centavos
 * and formats the results.
 *
 * The self-balancing schedule (§ 8) + payment-methods pick (§ 9) — deferred by
 * the first editor PR — ship here: seq-0 = the downpayment/lock, an auto "Final
 * balance" row always pays the plan to ₱0 against the quote total, the crew-meal
 * credit comes off the final first (downpayment protected), and the vendor picks
 * which published payment rails the couple sees. Both persist on the proposal.
 */

type Basis = 'flat' | 'per_pax' | 'per_hour';
type CrewMode = 'included' | 'charge' | 'offset';
type TransportMode = 'included' | 'flat' | 'distance';

type Line = {
  key: string;
  label: string;
  basis: Basis;
  free: boolean;
  flatPhp: number;
  ratePhp: number;
  minPax: number;
  basePhp: number;
  inclHours: number;
  extraPhp: number;
};

type Crew = { mode: CrewMode; size: number; perHeadPhp: number };
type Transport = { mode: TransportMode; flatPhp: number };

/** A vendor's published payment method, as the picker (§ 9) shows it. */
export type ProposalPaymentMethodOption = {
  id: string;
  label: string;
  methodType: 'bank' | 'qr' | 'link';
  provider: string | null;
  /** Approved + shown → publishable by default; else the vendor can still pick it but it's flagged. */
  publishable: boolean;
};

/**
 * ONE OF THE SHOP'S SERVICE CARDS, as the "Your cards" picker offers it
 * (owner 2026-09-22: *"load 1 or multiple service cards combined"*). The
 * label is the card's title or its kind in the shop's own words — resolved
 * on the server through `cardKindLabeller`, never the raw key.
 */
export type QuoteCardOption = {
  id: string;
  label: string;
  /** "from ₱X" as the card advertises it, or null when unpriced. */
  fromPhp: number | null;
  /** Priced extras on the card; ticking one adds it as a line. */
  addons: { id: number; label: string; fromPhp: number | null }[];
  /** "Comes with" — the kinds this card bundles, as the wizard's links name them. */
  comesWith: string[];
  /** The card's Setnayan-gift switch — shown, not yet a control on the quote (slice G). */
  giftOn: boolean;
};

/** One manual installment row in the editor (peso/percent-facing). */
type SchedRow = InstallmentDraft & { key: string };

/* ── Pure helpers (peso-facing UI ⇄ centavos resolver) ───────────────────── */

/** Peso → whole centavos. */
const toCentavos = (php: number): number => Math.round((Number(php) || 0) * 100);

/**
 * Centavos → pesos for an INSTALLMENT FIELD, keeping the centavos.
 *
 * ⛔ NOT `Math.round(centavos / 100)`. Both places this is used materialise a
 * resolved centavos figure into a `fixed` installment the couple is later asked
 * to pay, and the value is sent, re-resolved and stored — so rounding here is
 * not a display choice, it is a different amount of money. One named helper
 * rather than the expression twice: a guard can execute a helper, and the app
 * has already shipped a fix to one of two identical inline spellings while the
 * other kept the defect.
 */
const centavosToPesos = (centavos: number): number => Math.round(centavos) / 100;

let keySeq = 0;
const nextKey = () => `ln_${Date.now().toString(36)}_${keySeq++}`;

function newLine(free: boolean): Line {
  return {
    key: nextKey(),
    label: free ? 'Freebie' : 'New feature',
    basis: 'flat',
    free,
    flatPhp: free ? 0 : 5000,
    ratePhp: 200,
    minPax: 100,
    basePhp: 20000,
    inclHours: 6,
    extraPhp: 2500,
  };
}

/** Map a Line to the resolver's centavos-denominated row shape. */
function lineToRow(l: Line): PackageLinePricingRow {
  return {
    pricing_basis: l.basis === 'flat' ? 'fixed' : l.basis,
    replacement_value_centavos: toCentavos(l.flatPhp),
    per_pax_price_centavos: toCentavos(l.ratePhp),
    min_pax: l.minPax > 0 ? Math.round(l.minPax) : null,
    hour_base_centavos: toCentavos(l.basePhp),
    min_hours: l.inclHours > 0 ? Math.round(l.inclHours) : null,
    extra_hour_centavos: toCentavos(l.extraPhp),
  };
}

function resolveLineCentavos(l: Line, pax: number, hours: number): number {
  if (l.free) return 0;
  return resolvePackageLine(lineToRow(l), { pax, hours });
}

/** The small "₱X × N pax" / "₱X + Nh extra" caption under a line (prototype capText). */
function basisDetail(l: Line, pax: number, hours: number): string | null {
  if (l.free) return 'Complimentary';
  if (l.basis === 'per_pax') {
    const billable = Math.max(pax, l.minPax || 0);
    return `${formatCentavos(toCentavos(l.ratePhp))} × ${billable} pax`;
  }
  if (l.basis === 'per_hour') {
    const extra = Math.max(0, hours - (l.inclHours || 0));
    return `${formatCentavos(toCentavos(l.basePhp))} + ${extra}h extra`;
  }
  return null;
}

/* ── One step of the five (owner 2026-09-22: "evident separation … a clean continuity") ── */

/**
 * A STEP ON THE SPINE. Draws only what `lib/quote-stages.ts` decided: its
 * number, title and state, the one-line summary when folded, and the Next band
 * that ends every step but the last. The body is HIDDEN, not unmounted, when
 * the step is folded — every input keeps its state and every existing mount
 * guard keeps counting one of each control.
 */
function QuoteStage({
  id,
  state,
  summary,
  onOpen,
  onNext,
  children,
}: {
  id: QuoteStageId;
  state: 'done' | 'cur' | 'later';
  summary: string;
  onOpen: () => void;
  onNext: (() => void) | null;
  children: React.ReactNode;
}) {
  const def = QUOTE_STAGES.find((d) => d.id === id)!;
  const isCur = state === 'cur';
  return (
    <section
      data-stage={id}
      data-state={state}
      aria-label={`Step ${def.n} of ${QUOTE_STAGES.length}: ${def.title}`}
      className={`relative border-b border-ink/10 pl-12 ${state === 'later' ? 'opacity-60' : ''}`}
    >
      {/* the spine: number bubble + the line to the next step */}
      <span
        aria-hidden
        className={`absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${
          isCur
            ? 'border-terracotta bg-terracotta text-cream'
            : state === 'done'
              ? 'border-success-300 bg-success-100 text-success-700'
              : 'border-ink/15 bg-white text-ink/50'
        }`}
      >
        {state === 'done' ? '✓' : def.n}
      </span>
      <button
        type="button"
        onClick={onOpen}
        disabled={isCur}
        className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left disabled:cursor-default"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
          Step {def.n} of {QUOTE_STAGES.length}
        </span>
        <span className="font-serif text-lg font-semibold leading-tight text-ink">{def.title}</span>
        {!isCur ? (
          <span className="text-xs text-ink/60">
            {state === 'later' ? 'Up next · ' : ''}
            {summary}
          </span>
        ) : null}
      </button>
      <div hidden={!isCur} className="pb-1">
        {children}
        {onNext && def.lead ? (
          <div className="mx-4 mb-4 mt-2 flex items-center gap-3 rounded-xl bg-ink px-4 py-3 text-cream">
            <span className="flex-1 text-sm text-cream/80">{def.lead}</span>
            <button
              type="button"
              onClick={onNext}
              data-stage-next={id}
              className="inline-flex h-10 items-center rounded-full bg-terracotta px-4 text-sm font-semibold text-cream hover:bg-terracotta-700"
            >
              Next · {QUOTE_STAGES.find((d) => d.id === nextStage(id))?.title}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */

let schedSeq = 0;
const nextSchedKey = () => `sch_${Date.now().toString(36)}_${schedSeq++}`;

/** Ordinal labels for auto-generated installment names (matches the prototype). */
const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
const ordinalLabel = (i: number) => `${ORDINALS[i] ?? `Payment ${i + 1}`} payment`;

const METHOD_TYPE_LABEL: Record<'bank' | 'qr' | 'link', string> = {
  bank: 'Bank / e-wallet',
  qr: 'QR code',
  link: 'Payment link',
};

const DUE_OPTIONS: ReadonlyArray<[InstallmentDue, string]> = [
  ['on_lock', 'On booking'],
  ['before_event', 'Before event'],
  ['on_event', 'Event day'],
];

export function ProposalMaker({
  threadId,
  requestedPax,
  livePax = null,
  requestedHours = 8,
  coupleName,
  packages = [],
  cards = [],
  coupleCrewProvider = null,
  paymentMethods = [],
  viewerPromo = null,
  giftBasis = null,
  feeStanding = null,
  papicStanding = null,
  revision = null,
}: {
  threadId: string;
  /**
   * S5 · "Update this quote": the LIVE quote this builder opens pre-filled
   * from (`seedQuoteRevision`). Present → the builder opens already expanded,
   * its lines, discount, title, note, expiry and payment methods seeded, and a
   * banner says sending REPLACES that quote and the couple must accept again.
   * Null → an empty builder behind the "Build a quote" button, unchanged.
   */
  revision?: QuoteRevisionSeed | null;
  /**
   * The Setnayan gift's basis for THIS thread, or null when this quote will
   * carry no gift (fee off, the card said no, not a Setnayan-sourced client, or
   * one of the supplier's first five free bookings). Resolved once on the
   * server by `giftQuoteBasis`; the browser re-prices it as the total changes.
   *
   * ⛔ NULL MEANS SAY NOTHING — never "0 photos". A count promised on a booking
   * that will not be billed for it is the silent broken promise the owner
   * warned about (DECISION_LOG 2026-09-09).
   */
  giftBasis?: GiftQuoteBasis | null;
  /**
   * WHERE THIS SHOP STANDS ON THE BOOKING FEE for this thread's couple —
   * resolved once on the server by `resolveBookingFeeStanding`, then re-priced
   * in the browser as the total changes.
   *
   * 🔴 OWNER, 2026-09-20: "as a vendor i do not know i have to pay." A supplier
   * deciding what to charge could see the Setnayan GIFT this quote buys their
   * couple and not the FEE that pays for it. Both now sit under the total.
   *
   * ⚠ Unlike `giftBasis`, null is NOT the only silent case and silence is NOT
   * the default: a free-5 booking says it is free, an imported client says it
   * carries no fee, and a failed read says we could not check. Only `silent`
   * (the fee system dark) renders nothing.
   */
  feeStanding?: BookingFeeStanding | null;
  /**
   * HOW MUCH EXCLUSIVE PAPIC THIS BOOKING CAN CARRY — the other half of the
   * owner's 2026-09-20 ruling: *"the maximum additional papic service they can
   * also purchase on top to offer that exclusive deal."*
   *
   * Resolved once on the server by `resolvePapicQuoteStanding`, then re-priced
   * in the browser as the total changes, through the SAME
   * `previewGiftForTotal` the gift block below uses.
   *
   * 🔑 `giftBasis` IS DERIVED FROM THIS ONE READ (`giftBasisFrom`), so the two
   * lines under the total can never be answered against different moments.
   */
  papicStanding?: PapicQuoteStanding | null;
  /**
   * `chat_threads.pax_at_inquiry` — what the couple ASKED with, and what any
   * earlier quote was written against.
   *
   * ⚠ NO LONGER THE SEED. It is the historical figure the header names beside
   * the live one, and the fallback when no live count exists.
   */
  requestedPax: number;
  /**
   * What the couple is planning for NOW — and, since 2026-09-09, WHAT THE
   * BUILDER OPENS AT (owner decision; binding prototype
   * `chat_interface_v4_2026-09-09.html` shows the field pre-filled at the live
   * count).
   *
   * 🔑 THIS MOVES MONEY, WHICH IS WHY BOTH NUMBERS STAY ON SCREEN. A quote
   * opened at 170 when the couple asked with 150 is a different price, so the
   * header names the seed AND the inquiry count in every state. Dropping
   * either one is how a supplier quotes against a number nobody agreed to.
   */
  livePax?: number | null;
  requestedHours?: number;
  coupleName?: string | null;
  packages?: { id: string; name: string }[];
  /**
   * THE SHOP'S SERVICE CARDS — the seed every real shop can use. Measured
   * 2026-09-22: production holds 0 packages and 0 templates, so the picker
   * above never rendered for anyone; the two live cards were unreachable.
   * Picking one or several REPLACES the lines with what the cards say and
   * sets crew / travel / discount / schedule from them (`applyCardSeedToDraft`
   * decides exactly what a card overrides and what the supplier keeps).
   */
  cards?: QuoteCardOption[];
  /** When the couple has booked a crew-meal marketplace service, the provider name (enables the offset banner). */
  coupleCrewProvider?: string | null;
  /** The vendor's published payment methods (§ 9) — the couple sees the picked subset. */
  paymentMethods?: ProposalPaymentMethodOption[];
  /**
   * Creator Economy PR-C — this thread came through a storyteller's chapter and
   * the vendor promised the audience rate below (accepted collab,
   * audience_rate_terms). Surfaces a banner beside the Discount input and
   * labels the composed discount line "Viewer promo — {terms}" so the
   * customer-facing quote reflects the promo. The vendor still types the peso
   * amount (terms are freeform text; Setnayan never computes the discount).
   */
  viewerPromo?: { terms: string; creatorName?: string | null } | null;
}) {
  // S5 · a revision opens EXPANDED — the supplier came here from "Update this
  // quote" and a closed "Build a quote" button would read as a link that did
  // nothing (the same trap the `?compose=deal` panel fell into on 2026-09-18).
  const [open, setOpen] = useState(revision != null);
  // WHICH STEP IS OPEN. A fresh quote starts at Know the event; "Update this
  // quote" opens at Set the price (`openingStage`). Nothing is locked — a
  // folded step's header reopens it.
  const [stage, setStage] = useState<QuoteStageId>(() => openingStage({ revision: revision != null }));
  /*
    THE OPENING GUEST COUNT — the live one, falling back to the inquiry count.

    ⚠ THIS IS THE NUMBER THE FIRST QUOTE IS PRICED AGAINST, so it is read once,
    here, and named in the header rather than left to be inferred.
  */
  const seedPax = livePax ?? requestedPax;
  const [pax, setPax] = useState(seedPax);
  const [hours, setHours] = useState(requestedHours);
  const [items, setItems] = useState<Line[]>(() =>
    revision && revision.lines.length > 0
      ? revision.lines.map((s) => ({ ...s, key: nextKey() }))
      : [newLine(false)],
  );
  const [crew, setCrew] = useState<Crew>({
    mode: coupleCrewProvider ? 'offset' : 'charge',
    size: 5,
    perHeadPhp: 350,
  });
  const [transport, setTransport] = useState<Transport>({ mode: 'included', flatPhp: 2000 });
  // A revision's negative lines (discount, credit) arrive folded into this one
  // field — see lib/quote-revision-seed.ts for why they cannot seed as lines.
  const [discountPhp, setDiscountPhp] = useState(revision?.discountPhp ?? 0);
  // Self-balancing payment schedule (§ 8). seq-0 = the downpayment/lock; the auto
  // "Final balance" is generated by the resolver, never a stored row.
  // A REVISION CARRIES ITS SCHEDULE (2026-09-20). This used to start from the
  // default below whatever the quote being replaced said, so "Update this
  // quote" reset a supplier's own terms. The seed (`seedScheduleFromStored`,
  // lib/quote-revision-seed.ts) is the replaced quote's schedule in this
  // editor's own draft shape; no seed → the default, as before.
  const [installments, setInstallments] = useState<SchedRow[]>(() =>
    revision?.schedule && revision.schedule.manual.length > 0
      ? revision.schedule.manual.map((d) => ({ ...d, key: nextSchedKey() }))
      : [
          { key: nextSchedKey(), label: 'First payment', kind: 'percent', amountPhp: null, percent: 20, due: 'on_lock', offsetDays: 0 },
        ],
  );
  const [autoBalanceMeta, setAutoBalanceMeta] = useState<AutoBalanceMeta>(
    () =>
      revision?.schedule?.autoBalance ?? {
        label: 'Final balance',
        due: 'before_event',
        offsetDays: 14,
      },
  );
  // Accepted payment methods (§ 9) — default to every publishable (approved+shown) method.
  const [selectedMethods, setSelectedMethods] = useState<Record<string, boolean>>(() =>
    revision && revision.paymentMethodIds.length > 0
      ? Object.fromEntries(paymentMethods.map((m) => [m.id, revision.paymentMethodIds.includes(m.id)]))
      : Object.fromEntries(paymentMethods.filter((m) => m.publishable).map((m) => [m.id, true])),
  );
  const [validUntil, setValidUntil] = useState(revision?.validUntil ?? '');
  const [title, setTitle] = useState(revision?.title ?? '');
  const [note, setNote] = useState(revision?.note ?? '');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [seeding, startSeed] = useTransition();
  // "Your cards": which of the shop's cards this quote is built from, which of
  // their add-ons are ticked, and what the last seed said about the event.
  const [pickedCards, setPickedCards] = useState<Record<string, boolean>>({});
  const [chosenAddons, setChosenAddons] = useState<Record<number, boolean>>({});
  // The reason beside the Discount field ("Booked 3+ months ahead · −10%") — the
  // card's, applied (owner 2026-09-22). Cleared the moment the supplier types
  // over the figure, so a hand-edited discount is never captioned as the card's.
  const [discountReason, setDiscountReason] = useState<string | null>(null);
  // The card's reservation terms, shown under the schedule it seeded.
  const [cardTerms, setCardTerms] = useState<string | null>(null);
  const [cardWarnings, setCardWarnings] = useState<QuoteSeedWarning[]>([]);
  const [cardTitle, setCardTitle] = useState<string>('');

  /*
    Still sitting on what the builder opened with — i.e. the supplier has not
    typed over the seed. Named for the seed, not for "the request", because
    those are no longer the same number.
  */
  const atSeed = pax === seedPax && hours === requestedHours;
  /** The live count and the inquiry count actually differ and both are known. */
  const countsDiffer = livePax != null && livePax !== requestedPax;

  // Everything numeric flows through the shared resolver. Rebuilds only when a
  // pricing input changes.
  const { subtotal, gross, credit, netPayable, lineItems } = useMemo(() => {
    const crewRow: PackageLinePricingRow = {
      crew_meal_mode: crew.mode,
      crew_size: crew.size > 0 ? Math.round(crew.size) : 0,
      crew_per_head_centavos: toCentavos(crew.perHeadPhp),
    };
    const transportRow: PackageLinePricingRow = {
      transport_mode: transport.mode,
      transport_flat_centavos: toCentavos(transport.flatPhp),
    };

    const resolved = items.map((l) => ({ l, c: resolveLineCentavos(l, pax, hours) }));
    const linesSum = resolved.reduce((s, x) => s + x.c, 0);
    const charge = crewChargeCentavos(crewRow);
    const trans = transportChargeCentavos(transportRow);
    const sub = linesSum + charge + trans;
    const discountC = toCentavos(discountPhp);
    const grs = Math.max(0, sub - discountC);
    const cr = crewCreditCentavos(crewRow);
    const net = Math.max(0, grs - cr);

    // Compose the persisted itemization. Discount + crew-offset credit ride as
    // NEGATIVE lines so the server's re-summed total equals net payable.
    const li: ProposalLineItem[] = [];
    for (const { l, c } of resolved) {
      li.push({
        label: l.label.trim() || 'Line item',
        detail: basisDetail(l, pax, hours),
        amount_centavos: l.free ? null : c,
      });
    }
    if (crew.mode === 'charge' && charge > 0) {
      li.push({
        label: 'Crew meal',
        detail: `${Math.round(crew.size)} crew × ${formatCentavos(toCentavos(crew.perHeadPhp))}/head`,
        amount_centavos: charge,
      });
    }
    if (transport.mode === 'flat' && trans > 0) {
      li.push({ label: 'Transportation', detail: 'Flat fee', amount_centavos: trans });
    } else if (transport.mode === 'distance') {
      li.push({ label: 'Transportation', detail: 'Quoted after site check', amount_centavos: null });
    }
    if (discountC > 0) {
      // PR-C: on an attributed thread the discount IS the promised viewer
      // promo — label it so the customer quote reflects the chapter deal.
      li.push(
        viewerPromo
          ? {
              label: 'Viewer promo',
              detail: viewerPromo.terms,
              amount_centavos: -discountC,
            }
          : { label: 'Discount', detail: discountReason, amount_centavos: -discountC },
      );
    } else if (viewerPromo) {
      // No peso amount entered yet — still reflect the promised promo on the
      // quote as an informational line (null amount renders label+detail only).
      li.push({
        label: 'Viewer promo',
        detail: viewerPromo.terms,
        amount_centavos: null,
      });
    }
    if (crew.mode === 'offset' && cr > 0) {
      li.push({
        label: 'Crew meal — couple provides',
        detail: 'Credit applied to final payment',
        amount_centavos: -cr,
      });
    }
    return { subtotal: sub, gross: grs, credit: cr, netPayable: net, lineItems: li };
  }, [items, crew, transport, discountPhp, discountReason, pax, hours, viewerPromo]);

  /**
   * THE GIFT, RE-PRICED AS THEY TYPE — and what it costs them.
   *
   * Owner 2026-09-15, asked whether the composer should show the upside alone:
   * **"show both."** A supplier deciding what to charge could previously see
   * neither: the photo count existed only on the SENT quote, and the charge
   * only on the bill that arrives later.
   *
   * ⚠ PRICED OFF `netPayable`, NOT the subtotal — that is the figure the line
   * items add up to and the figure `sendCustomProposalCore` re-sums to, so the
   * preview and the bill describe the same money. `previewGiftForTotal` runs
   * the SAME `bookingFeePhp` → `setnayanGiftForFee` pair the server and the SQL
   * run; it is deliberately not a local estimate.
   */
  const gift = useMemo(
    () => previewGiftForTotal(netPayable, giftBasis),
    [netPayable, giftBasis],
  );
  const giftCopy = giftQuoteCopy(gift, 'supplier');

  /**
   * THE FEE THIS QUOTE WOULD INCUR, re-priced as they type — off the SAME
   * `netPayable` the gift is priced from and the server re-sums to, through the
   * same `bookingFeePhp` the SQL charge is pinned against. Never a local rate.
   */
  const feeCopy = useMemo(
    () => (feeStanding ? bookingFeeForecast(feeStanding, netPayable / 100) : null),
    [feeStanding, netPayable],
  );

  /**
   * THE MAXIMUM EXCLUSIVE PAPIC THIS QUOTE COULD CARRY — priced off the same
   * `netPayable`, through the same `previewGiftForTotal` the gift block uses,
   * so the ceiling and the gift can never disagree.
   */
  const papicCopy = useMemo(
    () => (papicStanding ? papicTopUpForQuote(papicStanding, netPayable) : null),
    [papicStanding, netPayable],
  );

  // Self-balancing schedule — resolved against the quote total (gross, before the
  // crew credit) so the downpayment is a % of the full contract; the credit then
  // comes off the final. Same pure resolver the server re-runs on send.
  const scheduleDraft = useMemo(
    () => ({
      manual: installments.map(
        (r): InstallmentDraft => ({
          label: r.label,
          kind: r.kind,
          amountPhp: r.amountPhp,
          percent: r.percent,
          due: r.due,
          offsetDays: r.offsetDays,
        }),
      ),
      autoBalance: autoBalanceMeta,
      baseCentavos: gross,
      creditCentavos: credit,
    }),
    [installments, autoBalanceMeta, gross, credit],
  );
  const schedule = useMemo(() => resolveSchedule(scheduleDraft), [scheduleDraft]);
  // The generated auto "Final balance" row (last resolved installment), if any.
  const autoRow = schedule.installments.find((r) => r.is_auto_balance) ?? null;

  /**
   * THE FIVE STEPS — their states and their one-line summaries, from the live
   * draft through `lib/quote-stages.ts`. The fee and the Papic figures are the
   * SAME calls the open step renders (`bookingFeePhp` on the standing's own
   * schedule; `gift` from `previewGiftForTotal`), so a folded step can never
   * show a number the open one does not.
   */
  const stageState = stageStates(stage);
  const pickedCardLabels = cards.filter((c) => pickedCards[c.id]).map((c) => c.label);
  const feeText =
    feeStanding && (feeStanding.kind === 'free' || feeStanding.kind === 'billable') && netPayable > 0
      ? `${feePesos(bookingFeePhp(netPayable / 100, feeStanding.schedule))}${feeStanding.kind === 'free' ? ' waived' : ''}`
      : null;
  const papicText = gift
    ? `${formatGiftPhotos(gift.credits)} photos`
    : papicStanding?.kind === 'available'
      ? 'off'
      : null;
  const stageSummary = stageSummaries({
    eventLine: coupleName?.trim() || null,
    pax,
    hours,
    cardsLine: pickedCardLabels.length ? pickedCardLabels.join(' + ') : null,
    netPayableCentavos: netPayable,
    feeText,
    papicText,
    paymentsCount: installments.length + (autoRow && autoRow.amount_centavos > 0 ? 1 : 0),
    railLabels: paymentMethods.filter((m) => selectedMethods[m.id]).map((m) => m.label),
    validUntil,
  });
  const stageProps = (id: QuoteStageId) => ({
    id,
    state: stageState[id],
    summary: stageSummary[id],
    onOpen: () => setStage(id),
    onNext: nextStage(id) ? () => setStage(nextStage(id)!) : null,
  });

  const selectedMethodIds = useMemo(
    () => paymentMethods.filter((m) => selectedMethods[m.id]).map((m) => m.id),
    [paymentMethods, selectedMethods],
  );

  const payload = useMemo(
    () =>
      JSON.stringify({
        lineItems,
        validUntil,
        title,
        note,
        schedule: scheduleDraft,
        paymentMethodIds: selectedMethodIds,
      }),
    [lineItems, validUntil, title, note, scheduleDraft, selectedMethodIds],
  );

  /* ── Line mutation helpers ────────────────────────────────────────────── */
  const patchLine = (key: string, patch: Partial<Line>) =>
    setItems((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setItems((prev) => prev.filter((l) => l.key !== key));
  const moveLine = (fromKey: string, toKey: string) =>
    setItems((prev) => {
      if (fromKey === toKey) return prev;
      const from = prev.findIndex((l) => l.key === fromKey);
      const to = prev.findIndex((l) => l.key === toKey);
      if (from < 0 || to < 0) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      return next;
    });

  /* ── Payment-schedule mutation helpers (§ 8) ──────────────────────────── */
  const patchInstallment = (key: string, patch: Partial<InstallmentDraft>) =>
    setInstallments((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // A label the vendor hasn't personalized (still one of the auto ordinals).
  const isDefaultLabel = (label: string) =>
    label === 'First payment' || ORDINALS.some((_, i) => label === ordinalLabel(i));
  const removeInstallment = (key: string) =>
    setInstallments((prev) => {
      // Never remove the downpayment (seq 0).
      const idx = prev.findIndex((r) => r.key === key);
      if (idx <= 0) return prev;
      const next = prev.filter((r) => r.key !== key);
      // Re-sequence the auto-ordinal labels so they stay in order; leave any
      // vendor-personalized label untouched.
      return next.map((r, i) => (isDefaultLabel(r.label) ? { ...r, label: ordinalLabel(i) } : r));
    });
  // "Add payment · splits the balance" — materialize the current auto Final
  // balance (post-credit) into a real fixed installment; the resolver then
  // regenerates a fresh (smaller / zero) balance so the plan still nets to ₱0.
  const addPayment = () => {
    if (!autoRow || autoRow.amount_centavos <= 0) return;
    setInstallments((prev) => [
      ...prev,
      {
        key: nextSchedKey(),
        label: ordinalLabel(prev.length),
        kind: 'fixed',
        // 🔴 `Math.round(… / 100)` HERE MOVED THE MONEY. Splitting a balance of
        // ₱11,333.35 materialised ₱11,333, the resolver regenerated a fresh
        // ₱0.35 auto "Final balance", and the couple got a schedule with a
        // 35-centavo line nobody wrote. Exact centavos in, exact centavos out.
        amountPhp: centavosToPesos(autoRow.amount_centavos),
        percent: null,
        due: autoBalanceMeta.due,
        offsetDays: autoBalanceMeta.offsetDays,
      },
    ]);
  };

  async function seedFromPackage(packageId: string) {
    if (!packageId) return;
    startSeed(async () => {
      const seed = await loadPackageLinesForQuote(packageId);
      if (!seed || seed.lines.length === 0) return;
      setItems(
        seed.lines.map((s: QuoteSeedLine) => ({
          key: nextKey(),
          label: s.label,
          basis: s.basis,
          free: s.free,
          flatPhp: s.flatPhp,
          ratePhp: s.ratePhp,
          minPax: s.minPax,
          basePhp: s.basePhp,
          inclHours: s.inclHours,
          extraPhp: s.extraPhp,
        })),
      );
      if (seed.crew) setCrew(seed.crew);
      if (seed.transport) setTransport(seed.transport);
    });
  }

  /**
   * RE-SEED FROM THE PICKED CARDS. Every change to the pick or the ticked
   * add-ons re-reads the cards on the server (the event date and the card's
   * sibling rows are read there, never trusted from here) and hands the seed
   * to `applyCardSeedToDraft`, which decides what the card overrides.
   */
  function reseedFromCards(nextPicked: Record<string, boolean>, nextAddons: Record<number, boolean>) {
    const ids = cards.filter((c) => nextPicked[c.id]).map((c) => c.id);
    if (ids.length === 0) {
      setDiscountReason(null);
      setCardTerms(null);
      setCardWarnings([]);
      setCardTitle('');
      return;
    }
    startSeed(async () => {
      const seed = await loadServiceCardLinesForQuote({
        threadId,
        vendorServiceIds: ids,
        chosenAddonIds: Object.entries(nextAddons)
          .filter(([, on]) => on)
          .map(([id]) => Number(id)),
        pax,
        hours,
      });
      if (!seed) return;
      const after = applyCardSeedToDraft(seed, {
        crew,
        transport,
        discountPhp,
        coupleProvidesCrewMeal: Boolean(coupleCrewProvider),
      });
      setItems(after.lines.map((l) => ({ ...l, key: nextKey() })));
      setCrew(after.crew);
      setTransport(after.transport);
      setDiscountPhp(after.discountPhp);
      setDiscountReason(after.discountReason);
      if (after.schedule) setInstallments(after.schedule.map((d) => ({ ...d, key: nextSchedKey() })));
      setCardTerms(after.terms);
      setCardWarnings(seed.warnings);
      setCardTitle(after.title);
    });
  }
  const toggleCard = (id: string) => {
    const next = { ...pickedCards, [id]: !pickedCards[id] };
    setPickedCards(next);
    reseedFromCards(next, chosenAddons);
  };
  const toggleAddon = (id: number) => {
    const next = { ...chosenAddons, [id]: !chosenAddons[id] };
    setChosenAddons(next);
    reseedFromCards(pickedCards, next);
  };

  /*
    Undo my edits — back to what the builder OPENED at, not back to the inquiry
    count. Reset that jumped to a different number than the one the supplier
    started from would be a second, silent re-pricing.
  */
  const resetToSeed = () => {
    setPax(seedPax);
    setHours(requestedHours);
  };

  /* ── Styles ───────────────────────────────────────────────────────────── */
  const field =
    'rounded-md border border-ink/15 bg-cream px-2 py-1 text-sm text-ink focus:border-terracotta focus:outline-none';
  const numField = `${field} text-right tabular-nums`;
  const lbl = 'font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta';

  if (!open) {
    return (
      <div className="rounded-xl border border-terracotta/30 bg-terracotta/[0.05] p-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-terracotta/40 bg-cream px-4 text-sm font-medium text-ink hover:border-terracotta"
        >
          <span aria-hidden>🧾</span> Build a quote
        </button>
        <p className="mt-2 text-xs text-ink/55">
          Compose line items with per-line pricing, throw in freebies, and send a priced quote into this chat.
        </p>
      </div>
    );
  }

  return (
    <form
      action={sendCustomProposalFromChat}
      className="overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-sm"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="payload" value={payload} />

      {/* S5 · UPDATING A QUOTE. Says what sending does — replaces the named
          quote, and the couple must accept again (owner: "they can do updates
          and must be reaccepted"). The earlier quote stays in the thread as
          history; nothing is deleted. */}
      {revision ? (
        <div className="border-b border-terracotta/30 bg-terracotta/[0.06] px-4 py-2.5 text-sm text-ink/80">
          <p>
            <span className="font-semibold text-ink">Updating “{revision.of.title}”</span>
            {revision.of.totalCentavos > 0 ? ` · ${formatCentavos(revision.of.totalCentavos)}` : ''}
            {revision.of.status === 'accepted' ? ' · accepted by the couple' : ''}
          </p>
          <p className="mt-0.5 text-xs text-ink/60">
            Sending replaces that quote. It stays in the conversation as history, and the couple
            must review and accept the new one
            {revision.of.status === 'accepted' ? ' — their earlier acceptance no longer stands' : ''}.
          </p>
        </div>
      ) : null}

      {/* THE STEP STRIP — where the supplier is, and the way back to any step. */}
      <div data-testid="quote-step-strip" className="flex gap-1 overflow-x-auto border-b border-ink/10 px-3 py-2">
        {QUOTE_STAGES.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setStage(d.id)}
            aria-pressed={stageState[d.id] === 'cur'}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] ${
              stageState[d.id] === 'cur'
                ? 'bg-ink text-cream'
                : stageState[d.id] === 'done'
                  ? 'text-success-700'
                  : 'text-ink/40'
            }`}
          >
            {stageState[d.id] === 'done' ? '✓ ' : `${d.n} `}
            {d.title}
          </button>
        ))}
      </div>

      {/* ── STEP 1 · KNOW THE EVENT ─────────────────────────────────────── */}
      <QuoteStage {...stageProps('know')}>
      {/* Header — seeded pax/hours (rule 0) */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 p-4">
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-semibold leading-none text-ink">
            {coupleName?.trim() || 'New quote'}
          </h3>
          <p className="mt-1.5 text-xs text-ink/55">
            {atSeed ? (
              <>
                Sized to their plan now · <strong className="text-ink/75">{seedPax} pax</strong> · {requestedHours}h
                {countsDiffer ? <> · was {requestedPax} at inquiry</> : null}
              </>
            ) : (
              <>
                Quoting <strong className="text-ink/75">{pax} pax · {hours}h</strong> — their plan says {seedPax} now
                {countsDiffer ? <> · was {requestedPax} at inquiry</> : null}{' '}
                <button
                  type="button"
                  onClick={resetToSeed}
                  className="text-terracotta-700 underline hover:text-terracotta"
                >
                  reset
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-wider text-ink/50">
            pax
            <input
              type="number"
              min={1}
              step={1}
              value={pax}
              onChange={(e) => setPax(Number(e.target.value) || 0)}
              className={`${numField} w-16 text-center`}
            />
          </label>
          <label className="flex flex-col items-center gap-1 text-[10px] uppercase tracking-wider text-ink/50">
            hrs
            <input
              type="number"
              min={1}
              step={1}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value) || 0)}
              className={`${numField} w-14 text-center`}
            />
          </label>
        </div>
      </div>

      </QuoteStage>

      {/* ── STEP 2 · CHOOSE WHAT TO OFFER ───────────────────────────────── */}
      <QuoteStage {...stageProps('offer')}>
      {/* YOUR CARDS — the shop's service cards seed the quote (owner 2026-09-22).
          One or several; each contributes its priced line, its freebies and the
          add-ons ticked under it. Mounted ONCE, and only when the shop has a card. */}
      {cards.length > 0 ? (
        <div data-testid="quote-card-picker" className="space-y-2 border-b border-ink/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className={lbl}>Your cards</span>
            <span className="text-[11px] text-ink/45">
              {seeding ? 'Loading…' : 'Pick one or more · sets the lines, terms and discount'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCard(c.id)}
                disabled={seeding}
                aria-pressed={Boolean(pickedCards[c.id])}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                  pickedCards[c.id]
                    ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                    : 'border-ink/15 bg-white text-ink/70 hover:border-ink/40'
                }`}
              >
                {pickedCards[c.id] ? '✓ ' : '+ '}
                {c.label}
                {c.fromPhp != null ? (
                  <span className="text-ink/45">· from {formatCentavos(toCentavos(c.fromPhp))}</span>
                ) : null}
              </button>
            ))}
          </div>
          {cards
            .filter((c) => pickedCards[c.id] && (c.addons.length > 0 || c.comesWith.length > 0))
            .map((c) => (
              <div key={`x-${c.id}`} className="flex flex-wrap items-center gap-1.5 pl-1 text-[11px] text-ink/55">
                <span>{c.label}:</span>
                {c.addons.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAddon(a.id)}
                    disabled={seeding}
                    aria-pressed={Boolean(chosenAddons[a.id])}
                    className={`rounded-full border px-2 py-0.5 ${
                      chosenAddons[a.id]
                        ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                        : 'border-ink/15 bg-white hover:border-ink/40'
                    }`}
                  >
                    {chosenAddons[a.id] ? '✓ ' : '+ '}
                    {a.label}
                    {a.fromPhp != null ? ` · +${formatCentavos(toCentavos(a.fromPhp))}` : ''}
                  </button>
                ))}
                {c.comesWith.map((w) => {
                  // "Comes with" names a KIND; offer the shop's card of that kind when there is one.
                  const other = cards.find((o) => o.id !== c.id && o.label === w && !pickedCards[o.id]);
                  return other ? (
                    <button
                      key={`cw-${other.id}`}
                      type="button"
                      onClick={() => toggleCard(other.id)}
                      disabled={seeding}
                      className="rounded-full border border-dashed border-ink/25 bg-white px-2 py-0.5 hover:border-ink/40"
                    >
                      comes with {other.label} · add
                    </button>
                  ) : (
                    <span key={`cw-${w}`}>comes with {w}</span>
                  );
                })}
              </div>
            ))}
          {cardWarnings.length > 0 ? (
            <p data-testid="quote-card-warnings" className="text-[11px] text-warn-900">
              {cardWarnings
                .map((w) =>
                  w.kind === 'lead_time'
                    ? `Their date is ${Math.floor(w.monthsAway)} months out — your card recommends ${w.recommendedMonths}.`
                    : `Inside your last-minute window — a ${w.pct}% surcharge line was added.`,
                )
                .join(' ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Bundle picker (optional) */}
      {packages.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-4 py-3">
          <span className={lbl}>Start from a package</span>
          <select
            defaultValue=""
            disabled={seeding}
            onChange={(e) => {
              void seedFromPackage(e.target.value);
              e.target.value = '';
            }}
            className={`${field} min-w-[10rem]`}
          >
            <option value="" disabled>
              {seeding ? 'Loading…' : 'Choose a bundle…'}
            </option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-ink/45">Seeds the line items — you can still edit each one.</span>
        </div>
      ) : null}

      </QuoteStage>

      {/* ── STEP 3 · SET THE PRICE ──────────────────────────────────────── */}
      <QuoteStage {...stageProps('price')}>
      {/* Line items */}
      <div className="space-y-2 border-b border-ink/10 p-4">
        <div className="flex items-center justify-between">
          <span className={lbl}>Line items</span>
          <span className="text-[11px] text-ink/45">⠿ drag to reorder</span>
        </div>
        {items.map((l) => {
          const cents = resolveLineCentavos(l, pax, hours);
          return (
            <div
              key={l.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKey) moveLine(dragKey, l.key);
                setDragKey(null);
              }}
              className={`rounded-xl border p-2.5 ${
                l.free ? 'border-success-300/60 bg-success-100/40' : 'border-ink/10 bg-white'
              } ${dragKey === l.key ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  draggable
                  onDragStart={() => setDragKey(l.key)}
                  onDragEnd={() => setDragKey(null)}
                  role="button"
                  aria-label="Drag to reorder"
                  className="cursor-grab select-none px-0.5 text-lg leading-none text-ink/25"
                >
                  ⠿
                </span>
                <input
                  type="text"
                  value={l.label}
                  onChange={(e) => patchLine(l.key, { label: e.target.value })}
                  aria-label="Line item name"
                  className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink focus:outline-none"
                />
                {l.free ? (
                  <span className="whitespace-nowrap rounded-full border border-success-300/70 bg-white px-2 py-0.5 text-[10.5px] font-medium text-success-700">
                    Complimentary
                  </span>
                ) : (
                  <span className="whitespace-nowrap font-serif text-base text-ink tabular-nums">
                    {formatCentavos(cents)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => patchLine(l.key, { free: !l.free })}
                  aria-label="Toggle complimentary"
                  className={`px-1 text-sm ${l.free ? 'text-success-600' : 'text-ink/40 hover:text-ink'}`}
                >
                  🎁
                </button>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  aria-label="Remove line item"
                  className="px-1 text-sm text-ink/40 hover:text-danger-700"
                >
                  ✕
                </button>
              </div>

              {!l.free ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-ink/10 pl-6 pt-2 text-xs text-ink/60">
                  <select
                    value={l.basis}
                    onChange={(e) => patchLine(l.key, { basis: e.target.value as Basis })}
                    aria-label="Pricing basis"
                    className={field}
                  >
                    <option value="flat">Flat</option>
                    <option value="per_pax">Per pax</option>
                    <option value="per_hour">Per hour</option>
                  </select>
                  {l.basis === 'flat' ? (
                    <span className="flex items-center gap-1">
                      ₱
                      <input
                        type="number"
                        min={0}
                        value={l.flatPhp}
                        onChange={(e) => patchLine(l.key, { flatPhp: Number(e.target.value) || 0 })}
                        aria-label="Flat amount"
                        className={`${numField} w-24`}
                      />
                    </span>
                  ) : l.basis === 'per_pax' ? (
                    <>
                      <span className="flex items-center gap-1">
                        ₱
                        <input
                          type="number"
                          min={0}
                          value={l.ratePhp}
                          onChange={(e) => patchLine(l.key, { ratePhp: Number(e.target.value) || 0 })}
                          aria-label="Rate per pax"
                          className={`${numField} w-20`}
                        />
                      </span>
                      <span>/pax · min</span>
                      <input
                        type="number"
                        min={0}
                        value={l.minPax}
                        onChange={(e) => patchLine(l.key, { minPax: Number(e.target.value) || 0 })}
                        aria-label="Minimum pax"
                        className={`${numField} w-16`}
                      />
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        ₱
                        <input
                          type="number"
                          min={0}
                          value={l.basePhp}
                          onChange={(e) => patchLine(l.key, { basePhp: Number(e.target.value) || 0 })}
                          aria-label="Hour base"
                          className={`${numField} w-24`}
                        />
                      </span>
                      <span>incl</span>
                      <input
                        type="number"
                        min={0}
                        value={l.inclHours}
                        onChange={(e) => patchLine(l.key, { inclHours: Number(e.target.value) || 0 })}
                        aria-label="Included hours"
                        className={`${numField} w-14`}
                      />
                      <span>h · +₱</span>
                      <input
                        type="number"
                        min={0}
                        value={l.extraPhp}
                        onChange={(e) => patchLine(l.key, { extraPhp: Number(e.target.value) || 0 })}
                        aria-label="Extra hour rate"
                        className={`${numField} w-20`}
                      />
                      <span>/hr</span>
                    </>
                  )}
                  <span className="ml-auto text-ink/45">{basisDetail(l, pax, hours)}</span>
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newLine(false)])}
            className="rounded-full border border-dashed border-terracotta/60 px-3 py-1 text-xs text-terracotta-700 hover:border-terracotta"
          >
            + Feature
          </button>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newLine(true)])}
            className="rounded-full border border-dashed border-success-300 px-3 py-1 text-xs text-success-700 hover:border-success-600"
          >
            🎁 Freebie
          </button>
        </div>
      </div>

      {/* Crew meal & transportation */}
      <div className="space-y-2 border-b border-ink/10 p-4">
        <span className={lbl}>Crew meal &amp; transportation</span>
        {coupleCrewProvider ? (
          <div className="flex items-center gap-2 rounded-lg border border-success-300/60 bg-success-100/40 px-3 py-2 text-xs text-success-700">
            ✓ Couple booked <strong>{coupleCrewProvider}</strong> — your crew is covered.
          </div>
        ) : null}

        {/* Crew meal */}
        <div className="rounded-xl border border-ink/10 bg-white p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink/70">Crew meal</span>
            <select
              value={crew.mode}
              onChange={(e) => setCrew({ ...crew, mode: e.target.value as CrewMode })}
              aria-label="Crew meal handling"
              className={`${field} ml-auto`}
            >
              <option value="included">Included</option>
              <option value="charge">Charge</option>
              <option value="offset">Offset — couple provides</option>
            </select>
          </div>
          {crew.mode === 'included' ? (
            <p className="mt-2 pl-1 text-xs text-ink/45">In the line price.</p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/60">
              <input
                type="number"
                min={0}
                value={crew.size}
                onChange={(e) => setCrew({ ...crew, size: Number(e.target.value) || 0 })}
                aria-label="Crew size"
                className={`${numField} w-14`}
              />
              <span>crew · ₱</span>
              <input
                type="number"
                min={0}
                value={crew.perHeadPhp}
                onChange={(e) => setCrew({ ...crew, perHeadPhp: Number(e.target.value) || 0 })}
                aria-label="Per head"
                className={`${numField} w-20`}
              />
              <span>/head</span>
              <span className={`ml-auto ${crew.mode === 'offset' ? 'text-success-700' : 'text-ink'}`}>
                {crew.mode === 'charge'
                  ? formatCentavos(crewChargeCentavos({ crew_meal_mode: 'charge', crew_size: crew.size, crew_per_head_centavos: toCentavos(crew.perHeadPhp) }))
                  : `credit ${formatCentavos(credit)} → final payment`}
              </span>
            </div>
          )}
        </div>

        {/* Transportation */}
        <div className="rounded-xl border border-ink/10 bg-white p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink/70">Transportation</span>
            <select
              value={transport.mode}
              onChange={(e) => setTransport({ ...transport, mode: e.target.value as TransportMode })}
              aria-label="Transportation handling"
              className={`${field} ml-auto`}
            >
              <option value="included">Included</option>
              <option value="flat">Flat fee</option>
              <option value="distance">By distance</option>
            </select>
          </div>
          {transport.mode === 'flat' ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/60">
              ₱
              <input
                type="number"
                min={0}
                value={transport.flatPhp}
                onChange={(e) => setTransport({ ...transport, flatPhp: Number(e.target.value) || 0 })}
                aria-label="Transport flat fee"
                className={`${numField} w-24`}
              />
              <span className="ml-auto text-ink">
                {formatCentavos(transportChargeCentavos({ transport_mode: 'flat', transport_flat_centavos: toCentavos(transport.flatPhp) }))}
              </span>
            </div>
          ) : transport.mode === 'distance' ? (
            <p className="mt-2 pl-1 text-xs text-ink/45">Quoted after site check.</p>
          ) : (
            <p className="mt-2 pl-1 text-xs text-ink/45">In the line price.</p>
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="space-y-2 border-b border-ink/10 bg-cream/70 p-4">
        {/* PR-C — viewer-promo nudge: this inquiry arrived through a storyteller
            chapter whose accepted collab promised the audience rate below. The
            vendor enters the peso value as the Discount; the composed line is
            labeled "Viewer promo" so the couple's quote reflects the deal. */}
        {viewerPromo ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-ink/80">
            <span className="font-semibold text-ink">Viewer promo promised</span>
            {viewerPromo.creatorName ? (
              <> via {viewerPromo.creatorName}&rsquo;s chapter</>
            ) : null}
            : <span className="font-medium text-ink">{viewerPromo.terms}</span>.
            Enter the peso value below as the discount — it settles off-platform.
          </div>
        ) : null}
        <div className="flex items-baseline justify-between text-sm text-ink/60">
          <span>Subtotal</span>
          <span className="font-serif tabular-nums">{formatCentavos(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-ink/60">
          <span>
            {viewerPromo ? 'Discount · viewer promo' : 'Discount'}
            {discountReason ? (
              <span data-testid="quote-discount-reason" className="ml-1 text-[11px] text-terracotta-700">
                · {discountReason}
              </span>
            ) : null}
          </span>
          <span className="flex items-center gap-1">
            ₱
            <input
              type="number"
              min={0}
              step={500}
              value={discountPhp}
              onChange={(e) => {
                setDiscountPhp(Number(e.target.value) || 0);
                // A hand-edited figure is the supplier's, not the card's.
                setDiscountReason(null);
              }}
              aria-label="Discount"
              className={`${numField} w-24`}
            />
          </span>
        </div>
        <div className="flex items-baseline justify-between border-t border-ink/15 pt-2">
          <span className="text-sm font-medium text-ink">Total</span>
          <span className="font-serif text-2xl text-ink tabular-nums">{formatCentavos(gross)}</span>
        </div>
        {credit > 0 ? (
          <>
            <div className="flex items-baseline justify-between text-xs text-success-700">
              <span>Crew-meal credit → final payment</span>
              <span className="tabular-nums">−{formatCentavos(credit)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-ink">Net payable</span>
              <span className="font-serif text-lg text-ink tabular-nums">{formatCentavos(netPayable)}</span>
            </div>
          </>
        ) : null}

        {/* THE SETNAYAN GIFT, while the price is still being decided.
            Sits under the total because that is the number it is derived from
            and the number the supplier is looking at when they decide it.
            Renders ONLY when this booking will really be billed for it —
            `giftCopy` is null otherwise, and silence is the honest rendering of
            "no gift" (never "0 photos"). */}
        {/* WHAT THIS QUOTE WILL COST YOU, beside what it gives your couple.
            Owner 2026-09-15 on the gift: "show both." The fee is the other
            half of that sentence — a supplier pricing a job should see the
            money going out as well as the photos going in. */}
        <BookingFeeNotice disclosure={feeCopy} />

        {giftCopy ? (
          <div
            data-testid="compose-setnayan-gift"
            className="mt-3 rounded-lg border border-mulberry-600/25 bg-mulberry-600/5 px-3 py-2.5"
          >
            <p className="text-sm font-semibold text-mulberry-600">{giftCopy.headline}</p>
            <p className="mt-0.5 text-xs text-ink/60">{giftCopy.detail}</p>
          </div>
        ) : null}

        {/* THE MAXIMUM EXCLUSIVE PAPIC DEAL THIS BOOKING CAN CARRY.
            ⚖ Owner 2026-09-20: "the maximum additional papic service they can
            also purchase on top to offer that exclusive deal." Sits LAST
            because it either qualifies the gift block above it ("that is the
            most") or replaces it — measured 2026-09-20, ZERO live service cards
            have the gift switched on, so until now this whole area of the
            composer said nothing at all about Papic. */}
        <BookingFeeNotice
          testId="papic-quote-notice"
          disclosure={papicCopy}
          cta={papicCopy?.cta}
        />
      </div>

      </QuoteStage>

      {/* ── STEP 4 · TERMS ──────────────────────────────────────────────── */}
      <QuoteStage {...stageProps('terms')}>
      {/* Payment schedule — self-balancing, pays to ₱0 (§ 8) */}
      <div className="space-y-2 border-b border-ink/10 p-4">
        <div className="flex items-center justify-between">
          <span className={lbl}>Payment schedule</span>
          {schedule.over_by_centavos > 0 ? (
            <span className="text-[11px] font-medium text-warn-900">
              over by {formatCentavos(schedule.over_by_centavos)} — trim a payment
            </span>
          ) : schedule.credit_over_centavos > 0 ? (
            <span className="text-[11px] font-medium text-warn-900">
              credit exceeds the balance — lower a payment
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success-700">
              ✓ balances to ₱0
            </span>
          )}
        </div>

        {cardTerms ? (
          <p data-testid="quote-card-terms" className="text-[11px] text-ink/55">
            From your card: {cardTerms}
          </p>
        ) : null}

        {installments.map((r, i) => {
          const resolved = schedule.installments[i];
          const isDown = i === 0;
          return (
            <div key={r.key} className="rounded-xl border border-ink/10 bg-white p-2.5">
              <div className="flex items-center gap-2">
                {isDown ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-terracotta/50 bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium text-terracotta-700">
                    🔒 locks
                  </span>
                ) : null}
                <input
                  type="text"
                  value={r.label}
                  onChange={(e) => patchInstallment(r.key, { label: e.target.value })}
                  aria-label="Installment name"
                  className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink focus:outline-none"
                />
                {r.kind === 'percent' ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={r.percent ?? 0}
                      onChange={(e) => patchInstallment(r.key, { percent: Number(e.target.value) || 0 })}
                      aria-label="Percent of total"
                      className={`${numField} w-16`}
                    />
                    <span className="text-xs text-ink/50">%</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-ink/50">
                    ₱
                    {/* `step` DEFAULTS TO 1 ON type="number", so without this
                        the field declares itself invalid for exactly the
                        centavo amounts the ₱/% toggle and "Add payment" now
                        put into it — and a supplier could not type ₱1,999.95
                        at all. The resolver keeps centavos; the control has to
                        admit them. */}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.amountPhp ?? 0}
                      onChange={(e) => patchInstallment(r.key, { amountPhp: Number(e.target.value) || 0 })}
                      aria-label="Installment amount"
                      className={`${numField} w-24`}
                    />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    // Centavo-exact: a 15% row on a centavo-bearing total is
                    // ₱1,999.95, and rounding it to ₱2,000 on a ₱/% tap moved
                    // 5 centavos of a real contract.
                    patchInstallment(r.key, r.kind === 'percent' ? { kind: 'fixed', amountPhp: centavosToPesos(resolved?.raw_centavos ?? 0) } : { kind: 'percent', percent: r.percent ?? 0 })
                  }
                  aria-label="Toggle peso / percent"
                  title={r.kind === 'percent' ? 'Switch to a fixed peso amount' : 'Switch to a percent of the total'}
                  className="rounded-md border border-ink/15 px-1.5 py-0.5 text-[11px] text-ink/60 hover:border-terracotta"
                >
                  {/* Shows the unit a tap SWITCHES TO, not the one already
                      shown next to the input — that was the double "%": a
                      percent row read "20 %" from the input's own suffix,
                      then a second "%" right after it on this button, which
                      read as the same fact printed twice rather than as a
                      control (owner screenshot 2026-09-11). */}
                  {r.kind === 'percent' ? '₱' : '%'}
                </button>
                {!isDown ? (
                  <button
                    type="button"
                    onClick={() => removeInstallment(r.key)}
                    aria-label="Remove installment"
                    className="px-1 text-sm text-ink/40 hover:text-danger-700"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-ink/10 pl-1 pt-2 text-xs text-ink/60">
                <select
                  value={r.due}
                  onChange={(e) => patchInstallment(r.key, { due: e.target.value as InstallmentDue })}
                  aria-label="Due timing"
                  className={field}
                >
                  {DUE_OPTIONS.map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                {r.due === 'before_event' ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      value={r.offsetDays}
                      onChange={(e) => patchInstallment(r.key, { offsetDays: Number(e.target.value) || 0 })}
                      aria-label="Days before event"
                      className={`${numField} w-14`}
                    />
                    <span>days before</span>
                  </>
                ) : null}
                <span className="ml-auto flex items-center gap-2 tabular-nums">
                  {resolved && resolved.credit_applied_centavos > 0 ? (
                    <span className="text-success-700">−{formatCentavos(resolved.credit_applied_centavos)} credit</span>
                  ) : null}
                  <strong className="font-serif text-sm text-ink">
                    {formatCentavos(resolved?.amount_centavos ?? 0)}
                  </strong>
                </span>
              </div>
            </div>
          );
        })}

        {/* Auto "Final balance" — the resolver's remainder row (pays to ₱0). */}
        {autoRow ? (
          <div className="rounded-xl border border-terracotta/30 bg-terracotta/[0.04] p-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-terracotta/50 bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium text-terracotta-700">
                ✦ auto
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink/70">{autoBalanceMeta.label}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {autoRow.credit_applied_centavos > 0 ? (
                  <span className="text-xs text-success-700">−{formatCentavos(autoRow.credit_applied_centavos)} credit</span>
                ) : null}
                <strong className="font-serif text-base text-ink">{formatCentavos(autoRow.amount_centavos)}</strong>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-dashed border-ink/10 pl-1 pt-2 text-xs text-ink/60">
              <select
                value={autoBalanceMeta.due}
                onChange={(e) => setAutoBalanceMeta((m) => ({ ...m, due: e.target.value as InstallmentDue }))}
                aria-label="Final balance due timing"
                className={field}
              >
                {DUE_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              {autoBalanceMeta.due === 'before_event' ? (
                <>
                  <input
                    type="number"
                    min={0}
                    value={autoBalanceMeta.offsetDays}
                    onChange={(e) => setAutoBalanceMeta((m) => ({ ...m, offsetDays: Number(e.target.value) || 0 }))}
                    aria-label="Days before event"
                    className={`${numField} w-14`}
                  />
                  <span>days before</span>
                </>
              ) : null}
              <span className="ml-auto text-ink/45">covers the remainder</span>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={addPayment}
          disabled={!autoRow || autoRow.amount_centavos <= 0}
          className="rounded-full border border-dashed border-terracotta/60 px-3 py-1 text-xs text-terracotta-700 enabled:hover:border-terracotta disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add payment · splits the balance
        </button>
        <p className="text-[11px] text-ink/45">
          First payment is the downpayment the couple pays to lock the date. The final balance always
          settles the plan to ₱0{credit > 0 ? '; the crew-meal credit comes off it first' : ''}.
        </p>
      </div>

      {/* Accepted payment methods (§ 9) — which of the vendor's rails the couple sees */}
      <div className="space-y-2 border-b border-ink/10 p-4">
        <span className={lbl}>Accepted payment methods</span>
        {paymentMethods.length === 0 ? (
          <p className="text-xs text-ink/55">
            No published payment methods yet. Add BDO / GCash / Maya details in your dashboard settings —
            the couple will pay you directly, off-platform.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMethods((s) => ({ ...s, [m.id]: !s[m.id] }))}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
                    selectedMethods[m.id]
                      ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                      : 'border-ink/15 bg-white text-ink/60 hover:border-ink/40'
                  }`}
                  title={`${METHOD_TYPE_LABEL[m.methodType]}${m.publishable ? '' : ' · pending review'}`}
                >
                  {m.label}
                  {!m.publishable ? <span className="text-warn-900">·pending</span> : null}
                  {selectedMethods[m.id] ? ' ✓' : ''}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink/45">
              Only the methods you tick show on this quote&rsquo;s &ldquo;how to pay.&rdquo; Untick all to fall
              back to every approved method.
            </p>
          </>
        )}
      </div>

      {/* Meta + send */}
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={lbl}>Title (optional)</span>
            <input
              type="text"
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={cardTitle || 'Auto-titled if blank'}
              className={`${field} w-full`}
            />
          </label>
          <label className="block space-y-1">
            <span className={lbl}>Valid until (optional)</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={`${field} w-full`}
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className={lbl}>Note to the couple (optional)</span>
          <textarea
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A short message that appears above the quote."
            className={`${field} w-full resize-y`}
          />
        </label>
      </div>
      </QuoteStage>

      {/* ── STEP 5 · REVIEW & SEND ──────────────────────────────────────── */}
      <QuoteStage {...stageProps('send')}>
      <div className="space-y-3 p-4">
        {/*
          🔴 THIS SAID "accepting just adds it to their plan" AND THAT IS
          BACKWARDS. Owner, 2026-09-18: *"Plan should only fill at lock. not
          when accepted. accepting it allows the user to test different builds
          properly"* — combinations of different suppliers, compared before any
          of them is committed.

          The shipped behaviour already agreed with him and this one sentence
          did not: `respond_vendor_proposal` upserts `event_vendors` at status
          `shortlisted`, and `event_vendor_line_items` stays empty until Lock.
          Measured on the platform's first real quote — accepted 06:46, budget
          line items 0.

          🔑 A supplier reading the old line would tell a couple their quote was
          "in the plan" the moment it was accepted, and it is not. Nothing was
          broken except what we said about it.
        */}
        <p className="text-xs text-ink/55">
          The quote appears in this chat. The couple reviews and accepts it —
          accepting shortlists you at this price so they can compare
          combinations of suppliers. It books nothing and pays nothing; their
          plan fills only when they Lock.
        </p>
        <div className="flex items-center gap-2">
          <SubmitButton
            pendingLabel="Sending…"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            Send quote · {formatCentavos(netPayable)}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center rounded-xl border border-ink/15 px-4 text-sm text-ink/70 hover:border-ink/40"
          >
            Cancel
          </button>
        </div>
      </div>
      </QuoteStage>
    </form>
  );
}
