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
  sendCustomProposalFromChat,
  loadPackageLinesForQuote,
  type QuoteSeedLine,
} from '@/app/vendor-dashboard/messages/[threadId]/proposal-actions';

/**
 * Vendor Proposal Maker · PR 3 — the in-thread quote editor.
 *
 * Translates prototypes/vendor_proposal_maker_2026-07-10.html into React:
 * per-line pricing bases (Flat / Per pax / Per hour) resolved against the
 * event's pax + coverage hours, freebies (₱0 → "Complimentary"), 6-dot
 * drag-reorder, crew meal (Included / Charge / Offset-credit) + transportation,
 * a discount, and a live total. On send it composes a flat ProposalLineItem[]
 * (centavos) + persists a real vendor_proposals row + posts the in-thread card
 * (sendCustomProposalCore).
 *
 * ALL money math flows through the pure resolver in lib/package-line-pricing.ts
 * (the same helpers the bundle maker + lock use) — this component only converts
 * the vendor's peso-facing inputs to centavos and formats the results.
 *
 * DEFERRED (see the changelog + spec § PR 3): the self-balancing payment
 * SCHEDULE editor + payment-methods persistence. The downpayment here is a
 * simple % PREVIEW; the methods row is cosmetic (saved at lock later).
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
type PaymentMethod = 'bdo' | 'gcash' | 'bank' | 'maya';

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

const METHOD_LIST: ReadonlyArray<[PaymentMethod, string]> = [
  ['bdo', 'BDO'],
  ['gcash', 'GCash'],
  ['bank', 'Bank transfer'],
  ['maya', 'Maya'],
];

export function ProposalMaker({
  threadId,
  requestedPax,
  requestedHours = 8,
  coupleName,
  packages = [],
  coupleCrewProvider = null,
}: {
  threadId: string;
  /** Seeded from thread.pax_at_inquiry so the opening quote is sized to what they asked for. */
  requestedPax: number;
  requestedHours?: number;
  coupleName?: string | null;
  packages?: { id: string; name: string }[];
  /** When the couple has booked a crew-meal marketplace service, the provider name (enables the offset banner). */
  coupleCrewProvider?: string | null;
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
  const [methods, setMethods] = useState<Record<PaymentMethod, boolean>>({
    bdo: true,
    gcash: true,
    bank: false,
    maya: false,
  });
  const [downpaymentPct, setDownpaymentPct] = useState(20);
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

  const downpaymentCentavos = Math.round((netPayable * Math.min(100, Math.max(0, downpaymentPct))) / 100);

  const payload = useMemo(
    () => JSON.stringify({ lineItems, validUntil, title, note }),
    [lineItems, validUntil, title, note],
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

      {/* Downpayment preview (schedule editor deferred) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 p-4">
        <span className={lbl}>Downpayment</span>
        <input
          type="number"
          min={0}
          max={100}
          value={downpaymentPct}
          onChange={(e) => setDownpaymentPct(Number(e.target.value) || 0)}
          aria-label="Downpayment percent"
          className={`${numField} w-16`}
        />
        <span className="text-xs text-ink/55">
          % · locks with <strong className="text-ink/75">{formatCentavos(downpaymentCentavos)}</strong>
        </span>
        <span className="ml-auto text-[11px] text-ink/40">Full schedule set at lock.</span>
      </div>

      {/* Accepted payment methods (cosmetic — persisted at lock) */}
      <div className="space-y-2 border-b border-ink/10 p-4">
        <span className={lbl}>Accepted payment methods</span>
        <div className="flex flex-wrap gap-2">
          {METHOD_LIST.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethods((m) => ({ ...m, [id]: !m[id] }))}
              className={`rounded-full border px-3 py-1 text-xs ${
                methods[id]
                  ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                  : 'border-ink/15 bg-white text-ink/60 hover:border-ink/40'
              }`}
            >
              {label}
              {methods[id] ? ' ✓' : ''}
            </button>
          ))}
        </div>
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
