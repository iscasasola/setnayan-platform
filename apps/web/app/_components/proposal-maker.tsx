'use client';

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
  type QuoteSeedLine,
} from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';

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

/** One manual installment row in the editor (peso/percent-facing). */
type SchedRow = InstallmentDraft & { key: string };

/* ── Pure helpers (peso-facing UI ⇄ centavos resolver) ───────────────────── */

/** Peso → whole centavos. */
const toCentavos = (php: number): number => Math.round((Number(php) || 0) * 100);

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
  requestedHours = 8,
  coupleName,
  packages = [],
  coupleCrewProvider = null,
  paymentMethods = [],
}: {
  threadId: string;
  /** Seeded from thread.pax_at_inquiry so the opening quote is sized to what they asked for. */
  requestedPax: number;
  requestedHours?: number;
  coupleName?: string | null;
  packages?: { id: string; name: string }[];
  /** When the couple has booked a crew-meal marketplace service, the provider name (enables the offset banner). */
  coupleCrewProvider?: string | null;
  /** The vendor's published payment methods (§ 9) — the couple sees the picked subset. */
  paymentMethods?: ProposalPaymentMethodOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pax, setPax] = useState(requestedPax);
  const [hours, setHours] = useState(requestedHours);
  const [items, setItems] = useState<Line[]>(() => [newLine(false)]);
  const [crew, setCrew] = useState<Crew>({
    mode: coupleCrewProvider ? 'offset' : 'charge',
    size: 5,
    perHeadPhp: 350,
  });
  const [transport, setTransport] = useState<Transport>({ mode: 'included', flatPhp: 2000 });
  const [discountPhp, setDiscountPhp] = useState(0);
  // Self-balancing payment schedule (§ 8). seq-0 = the downpayment/lock; the auto
  // "Final balance" is generated by the resolver, never a stored row.
  const [installments, setInstallments] = useState<SchedRow[]>(() => [
    { key: nextSchedKey(), label: 'First payment', kind: 'percent', amountPhp: null, percent: 20, due: 'on_lock', offsetDays: 0 },
  ]);
  const [autoBalanceMeta, setAutoBalanceMeta] = useState<AutoBalanceMeta>({
    label: 'Final balance',
    due: 'before_event',
    offsetDays: 14,
  });
  // Accepted payment methods (§ 9) — default to every publishable (approved+shown) method.
  const [selectedMethods, setSelectedMethods] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(paymentMethods.filter((m) => m.publishable).map((m) => [m.id, true])),
  );
  const [validUntil, setValidUntil] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [seeding, startSeed] = useTransition();

  const atRequest = pax === requestedPax && hours === requestedHours;

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
      li.push({ label: 'Discount', detail: null, amount_centavos: -discountC });
    }
    if (crew.mode === 'offset' && cr > 0) {
      li.push({
        label: 'Crew meal — couple provides',
        detail: 'Credit applied to final payment',
        amount_centavos: -cr,
      });
    }
    return { subtotal: sub, gross: grs, credit: cr, netPayable: net, lineItems: li };
  }, [items, crew, transport, discountPhp, pax, hours]);

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
        amountPhp: Math.round(autoRow.amount_centavos / 100),
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

  const resetToRequest = () => {
    setPax(requestedPax);
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

      {/* Header — seeded pax/hours (rule 0) */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 p-4">
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-semibold leading-none text-ink">
            {coupleName?.trim() || 'New quote'}
          </h3>
          <p className="mt-1.5 text-xs text-ink/55">
            {atRequest ? (
              <>
                Sized to their request · <strong className="text-ink/75">{requestedPax} pax</strong> · {requestedHours}h
              </>
            ) : (
              <>
                Quoting <strong className="text-ink/75">{pax} pax · {hours}h</strong> — request was {requestedPax} pax{' '}
                <button
                  type="button"
                  onClick={resetToRequest}
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
              step={10}
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
        <div className="flex items-baseline justify-between text-sm text-ink/60">
          <span>Subtotal</span>
          <span className="font-serif tabular-nums">{formatCentavos(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-ink/60">
          <span>Discount</span>
          <span className="flex items-center gap-1">
            ₱
            <input
              type="number"
              min={0}
              step={500}
              value={discountPhp}
              onChange={(e) => setDiscountPhp(Number(e.target.value) || 0)}
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
      </div>

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
                    <input
                      type="number"
                      min={0}
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
                    patchInstallment(r.key, r.kind === 'percent' ? { kind: 'fixed', amountPhp: Math.round((resolved?.raw_centavos ?? 0) / 100) } : { kind: 'percent', percent: r.percent ?? 0 })
                  }
                  aria-label="Toggle peso / percent"
                  className="rounded-md border border-ink/15 px-1.5 py-0.5 text-[11px] text-ink/60 hover:border-terracotta"
                >
                  {r.kind === 'percent' ? '%' : '₱'}
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
              placeholder="Auto-titled if blank"
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
        <p className="text-xs text-ink/55">
          The quote appears in this chat. The couple reviews + accepts it — accepting just adds it to their plan,
          never a payment.
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
    </form>
  );
}
