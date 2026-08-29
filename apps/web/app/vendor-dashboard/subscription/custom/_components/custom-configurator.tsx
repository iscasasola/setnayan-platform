'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Users,
  CalendarClock,
  Images,
  Globe,
  Minus,
  Plus,
  Pencil,
  // Aliased, following the repo's existing idiom (account-inline.tsx): a bare
  // `Infinity` import shadows the JS global inside this module.
  Infinity as InfinityIcon,
} from 'lucide-react';
import {
  computeCustomQuote,
  CUSTOM_BASE,
  type CustomComposition,
  type CustomUnitPrices,
} from '@/lib/vendor-custom-pricing';
import { requestCustomPlan } from '../actions';

/**
 * Custom-plan configurator (client). Renders the 7 composition controls, shows
 * the LIVE 28-day + annual quote via the SAME pricing lib the server re-prices
 * from (computeCustomQuote), and posts the composition to requestCustomPlan
 * (apply-then-pay). Prices are the admin-managed catalog values passed down from
 * the server — never hardcoded here.
 *
 * No discount control (admin-only · PR-C) — the vendor always composes at LIST.
 */

type PayInfo = {
  bdoName: string | null;
  bdoNumber: string | null;
  gcashName: string | null;
  gcashNumber: string | null;
};

type Props = {
  unitPrices: CustomUnitPrices;
  /** Verified store? Gates the submit (it's a paid sales path). */
  canRequest: boolean;
  /** The vendor's current ACTIVE composition (Custom tier only) — read-only + Adjust. */
  activeComposition: CustomComposition | null;
  pay: PayInfo;
};

const PESO = new Intl.NumberFormat('en-PH');

function peso(n: number): string {
  return `₱${PESO.format(Math.round(n))}`;
}

/** Default composition = the included base (nothing added). */
const BASE_COMPOSITION: CustomComposition = {
  branches: 1,
  reachKm: CUSTOM_BASE.reachKm,
  nationwide: false,
  seats: CUSTOM_BASE.seats,
  slotsPerCategory: CUSTOM_BASE.slotsPerCategory,
  photos: CUSTOM_BASE.photos,
  domain: false,
  pipelineUnlimited: false,
};

export function CustomConfigurator({
  unitPrices,
  canRequest,
  activeComposition,
  pay,
}: Props) {
  const hasActive = activeComposition != null;
  // When there's an active plan, start locked (read-only) with an Adjust button;
  // otherwise the composer is open from the start.
  const [adjusting, setAdjusting] = useState(!hasActive);
  const [comp, setComp] = useState<CustomComposition>(
    activeComposition ?? BASE_COMPOSITION,
  );
  const [channel, setChannel] = useState<'bdo' | 'gcash'>('bdo');
  const [submitting, setSubmitting] = useState(false);

  const quote = useMemo(
    () => computeCustomQuote(comp, unitPrices),
    [comp, unitPrices],
  );

  const set = <K extends keyof CustomComposition>(
    key: K,
    value: CustomComposition[K],
  ) => setComp((c) => ({ ...c, [key]: value }));

  const editable = adjusting;

  // The two terms a subscription may be bought for, and nothing else (owner
  // 2026-08-27). Default '28d' — the cheaper commitment is the safe default.
  const [term, setTerm] = useState<'28d' | 'annual'>('28d');

  // Per-line breakdown (what each axis adds beyond the included base).
  // The +100 km reach step and the +100-photo pack were dropped 2026-08-27
  // (owner) — nationwide is the only reach upgrade now. Their maths is gone
  // rather than left computing a line worth zero.
  const extraBranches = Math.max(0, comp.branches - 1);
  const extraSeats = Math.max(0, comp.seats - CUSTOM_BASE.seats);
  const extraSlots = Math.max(0, comp.slotsPerCategory - CUSTOM_BASE.slotsPerCategory);

  const lines: { label: string; amount: number }[] = [
    { label: 'Base — Enterprise with its limits removed', amount: unitPrices.base },
  ];
  if (extraBranches > 0)
    lines.push({
      label: `${extraBranches} extra branch${extraBranches === 1 ? '' : 'es'} × ${peso(unitPrices.branch)}`,
      amount: extraBranches * unitPrices.branch,
    });
  if (comp.nationwide)
    lines.push({ label: 'Nationwide reach', amount: unitPrices.reachNationwide });
  if (extraSeats > 0)
    lines.push({
      label: `${extraSeats} extra seat${extraSeats === 1 ? '' : 's'} × ${peso(unitPrices.seat)}`,
      amount: extraSeats * unitPrices.seat,
    });
  if (extraSlots > 0)
    lines.push({
      label: `${extraSlots} extra slot${extraSlots === 1 ? '' : 's'}/category × ${peso(unitPrices.slot)}`,
      amount: extraSlots * unitPrices.slot,
    });
  if (comp.domain)
    lines.push({ label: 'Custom domain', amount: unitPrices.domain });
  if (comp.pipelineUnlimited)
    lines.push({
      label: 'No limit on customers per date',
      amount: unitPrices.pipelineUnlimited,
    });

  return (
    <form
      action={requestCustomPlan}
      onSubmit={() => setSubmitting(true)}
      className="grid gap-6 lg:grid-cols-[1fr_20rem]"
    >
      {/* Hidden composition — the SERVER re-prices from these + the catalog. */}
      <input type="hidden" name="branches" value={comp.branches} />
      <input type="hidden" name="nationwide" value={comp.nationwide ? 'true' : 'false'} />
      <input type="hidden" name="seats" value={comp.seats} />
      <input type="hidden" name="slotsPerCategory" value={comp.slotsPerCategory} />
      <input type="hidden" name="domain" value={comp.domain ? 'true' : 'false'} />
      <input
        type="hidden"
        name="pipelineUnlimited"
        value={comp.pipelineUnlimited ? 'true' : 'false'}
      />
      <input type="hidden" name="term" value={term} />
      <input type="hidden" name="channel" value={channel} />

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {hasActive && !editable && (
          <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50 px-4 py-3">
            <p className="text-sm text-success-900">
              This is your current active Custom plan.
            </p>
            <button
              type="button"
              onClick={() => setAdjusting(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink/30"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Adjust
            </button>
          </div>
        )}

        <StepperControl
          icon={<Building2 className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />}
          label="Branches"
          hint="Main address is included. Add branches to widen your listing footprint."
          value={comp.branches}
          min={1}
          max={50}
          step={1}
          disabled={!editable}
          onChange={(v) => set('branches', v)}
          suffix={comp.branches === 1 ? 'main only' : undefined}
        />

        <ToggleControl
          icon={<MapPin className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />}
          label="Nationwide reach"
          hint="Base 100 km included. Nationwide is the only reach upgrade."
          checked={comp.nationwide}
          disabled={!editable}
          onChange={(v) => set('nationwide', v)}
        />

        {/* Owner 2026-08-29 — "2500 for no limit". The hint names the number it
            removes rather than saying "unlimited", because a supplier who does
            not know their ceiling is 10 cannot tell what they are buying. */}
        <ToggleControl
          icon={<InfinityIcon className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />}
          label="No limit on customers per date"
          hint="Every plan lets you chase 10 customers at a time for one date. This removes that ceiling."
          checked={comp.pipelineUnlimited === true}
          disabled={!editable}
          onChange={(v) => set('pipelineUnlimited', v)}
        />

        <StepperControl
          icon={<Users className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />}
          label="Team seats"
          hint="Base 10 included. Each extra seat lets one more teammate in."
          value={comp.seats}
          min={CUSTOM_BASE.seats}
          max={500}
          step={1}
          disabled={!editable}
          onChange={(v) => set('seats', v)}
        />

        <StepperControl
          icon={<CalendarClock className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />}
          label="Event slots / category"
          hint="Base 8 included. Bookings you can hold per category, per day."
          value={comp.slotsPerCategory}
          min={CUSTOM_BASE.slotsPerCategory}
          max={200}
          step={1}
          disabled={!editable}
          onChange={(v) => set('slotsPerCategory', v)}
        />

        <ToggleControl
          icon={<Globe className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />}
          label="Custom domain"
          hint="Serve your shop page on your own domain."
          checked={comp.domain}
          disabled={!editable}
          onChange={(v) => set('domain', v)}
        />
      </div>

      {/* ── Live quote + submit (sticky on desktop) ──────────────────────── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="sn-tile p-5">
          <p className="sn-eye">Your Custom plan</p>
          {/*
            🔑 THE FIGURE SHOWN IS THE FIGURE CHARGED. Both come from the same
            `quote`, and the server recomputes it from the catalog before
            minting — so the number here and the number on the order are the
            same by construction, not by agreement.
          */}
          <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">
            {peso(term === 'annual' ? quote.annual : quote.final28)}
            <span className="ml-1 text-sm font-normal text-ink/55">
              {term === 'annual' ? 'per year' : 'per 28 days'}
            </span>
          </p>

          <div
            role="radiogroup"
            aria-label="Billing term"
            className="mt-3 flex items-center gap-1 rounded-lg border border-ink/12 p-1"
          >
            {([
              ['28d', 'Every 28 days'],
              ['annual', 'Yearly · save 20%'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={term === value}
                disabled={!editable}
                onClick={() => setTerm(value)}
                className={
                  'flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ' +
                  (term === value
                    ? 'bg-ink text-white'
                    : 'text-ink/70 hover:bg-ink/5')
                }
              >
                {label}
              </button>
            ))}
          </div>
          {/*
            Custom's annual was × 10 ("13 cycles, pay 10, 3 free") until the
            owner aligned it to × 10.4 on 2026-08-27 — the same 20% every other
            tier gets. The old mechanism sentence is FALSE at 10.4 (13 cycles at
            10.4 is 2.6 free, not 3), so it says the saving instead, in the same
            words as the three tier cards.

            ⚠ A WARNING THAT USED TO SIT HERE — "do not harmonise this with the
            tier cards' save 20%, it would misprice a live quote" — WAS DELETED
            WITH THE RULING THAT MADE IT OBSOLETE. It was correct while the
            multipliers differed and became actively misleading the moment they
            did not.
          */}
          <p className="mt-2 text-sm tabular-nums text-ink/70">
            {term === 'annual' ? peso(quote.final28) : peso(quote.annual)}
            <span className="ml-1 text-xs text-ink/50">
              {term === 'annual' ? 'per 28 days instead' : 'per year — save 20%'}
            </span>
          </p>

          <div className="mt-4 space-y-1.5 border-t border-ink/10 pt-3">
            {lines.map((l, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="text-ink/65">{l.label}</span>
                <span className="shrink-0 tabular-nums text-ink/80">
                  {peso(l.amount)}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
            Custom starts at {peso(unitPrices.base)}. Prices are charm-rounded and
            can never quote below the base.
          </p>

          {editable && (
            <>
              {/* Pay channel */}
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50">
                  Pay with
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(['bdo', 'gcash'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      aria-pressed={channel === ch}
                      className={
                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ' +
                        (channel === ch
                          ? 'border-terracotta bg-terracotta/10 text-ink'
                          : 'border-ink/15 text-ink/60 hover:border-ink/30')
                      }
                    >
                      {ch === 'bdo' ? 'BDO' : 'GCash'}
                    </button>
                  ))}
                </div>
                {channel === 'bdo' && pay.bdoNumber?.trim() && (
                  <p className="mt-1.5 text-[11px] text-ink/50">
                    {pay.bdoNumber}
                    {pay.bdoName?.trim() ? ` · ${pay.bdoName}` : ''}
                  </p>
                )}
                {channel === 'gcash' && pay.gcashNumber?.trim() && (
                  <p className="mt-1.5 text-[11px] text-ink/50">
                    {pay.gcashNumber}
                    {pay.gcashName?.trim() ? ` · ${pay.gcashName}` : ''}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!canRequest || submitting}
                className="mt-4 w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting ? 'Sending…' : 'Request this plan'}
              </button>

              {!canRequest ? (
                <p className="mt-2 text-[11px] leading-relaxed text-ink/50">
                  Get verified first — Custom plans are for verified stores.
                </p>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-ink/50">
                  Request sent — the SETNAYAN team reviews and sends payment
                  instructions. Nothing is charged until you approve.
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </form>
  );
}

/* ── Controls ──────────────────────────────────────────────────────────── */

function ControlShell({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className="text-ink/70">{icon}</span>
            {label}
          </p>
          <p className="mt-0.5 text-xs text-ink/55">{hint}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function StepperControl({
  icon,
  label,
  hint,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const dec = () => onChange(clamp(value - step));
  const inc = () => onChange(clamp(value + step));

  return (
    <ControlShell icon={icon} label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={dec}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/15 text-ink transition-colors hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          aria-label={label}
          className="h-2 w-full min-w-0 cursor-pointer accent-terracotta disabled:cursor-not-allowed disabled:opacity-45"
        />

        <button
          type="button"
          onClick={inc}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/15 text-ink transition-colors hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>

        <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">
          {PESO.format(value)}
        </span>
      </div>
      {suffix && <p className="mt-1 text-right text-[11px] text-ink/45">{suffix}</p>}
    </ControlShell>
  );
}

function ToggleControl({
  icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <ControlShell icon={icon} label={label} hint={hint}>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-ink/25 accent-terracotta focus:ring-terracotta/40 disabled:cursor-not-allowed"
        />
        {checked ? 'Included' : 'Not included'}
      </label>
    </ControlShell>
  );
}
