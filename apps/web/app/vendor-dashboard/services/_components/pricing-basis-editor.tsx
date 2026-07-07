'use client';

import { useState, type ReactNode } from 'react';

/**
 * Pricing-basis editor (service-card redesign · Phase 3a). The three ways a
 * vendor sets the card's base "from ₱X" anchor — the couple always still
 * requests a quote; this is only the shopping anchor.
 *
 *   • Fixed    — a flat starting price (+ optional adaptive-pax surcharge above
 *                a base guest count). Multi-tier pax brackets = a later phase.
 *   • Per pax  — a per-guest rate + a minimum pax floor (anchor = rate × min).
 *   • Per hour — a base that covers a minimum block + a per-extra-hour rate.
 *
 * Only the active basis's inputs are mounted, so a switch cleanly drops the
 * others from the submitted form; the server action recomputes the synced
 * starting_price_php anchor + nulls the inactive columns.
 */

export type Basis = 'fixed' | 'per_pax' | 'per_hour';

export type PricingDefaults = {
  pricing_basis: Basis;
  starting_price_php: number | null;
  base_pax: number | null;
  added_pax_price_php: number | null;
  per_pax_price_php: number | null;
  min_pax: number | null;
  hour_base_php: number | null;
  min_hours: number | null;
  extra_hour_php: number | null;
};

const line = 'var(--m-line)';

const OPTIONS: { key: Basis; label: string; hint: string }[] = [
  { key: 'fixed', label: 'Fixed price', hint: 'One flat price (booths, packages)' },
  { key: 'per_pax', label: 'Per guest', hint: 'Priced by head (catering, mobile bar)' },
  { key: 'per_hour', label: 'Per hour', hint: 'Priced by time (booths, hosts, lights)' },
];

export function PricingBasisEditor({
  idPrefix,
  defaults,
  fixedExtra,
  category,
}: {
  idPrefix: string;
  defaults: PricingDefaults;
  /**
   * Optional content rendered ONLY inside the Fixed branch (mounted only when
   * basis === 'fixed', so its inputs cleanly drop from the form otherwise).
   * Phase 3b threads the PriceBracketsEditor through here so pax brackets show
   * exclusively for the Fixed basis.
   */
  fixedExtra?: ReactNode;
  /** Vendor category — tailors the per-guest copy to "per meal" for crew_meals. */
  category?: string;
}) {
  const isCrewMeals = category === 'crew_meals';
  const perPaxUnit = isCrewMeals ? 'meal' : 'guest';
  const [basis, setBasis] = useState<Basis>(defaults.pricing_basis ?? 'fixed');
  const options = isCrewMeals
    ? OPTIONS.map((o) =>
        o.key === 'per_pax' ? { ...o, label: 'Per meal', hint: 'Priced per crew meal' } : o,
      )
    : OPTIONS;
  return (
    <div className="space-y-3">
      <input type="hidden" name="pricing_basis" value={basis} />
      <div>
        <p className="mb-1.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          How do you price this?
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {options.map((o) => {
            const on = basis === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setBasis(o.key)}
                className="rounded-xl border px-2 py-2 text-center"
                style={{
                  borderColor: on ? 'var(--m-orange-2)' : line,
                  background: on ? 'var(--m-orange-4)' : 'var(--m-paper-2)',
                }}
              >
                <span className="block text-[13px] font-medium" style={{ color: on ? 'var(--m-orange-2)' : 'var(--m-ink)' }}>
                  {o.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-tight" style={{ color: 'var(--m-slate-3)' }}>
                  {o.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {basis === 'fixed' ? (
        <div className="space-y-3">
          <PField
            label="Starting price (PHP)"
            id={`${idPrefix}-price`}
            help="Whole pesos. Leave blank for 'quote on request'."
          >
            <input id={`${idPrefix}-price`} name="starting_price_php" type="number" min={0} step={1} defaultValue={defaults.starting_price_php ?? ''} placeholder="e.g. 25000" className="input-field" />
          </PField>
          <div className="grid gap-3 sm:grid-cols-2">
            <PField label="Base covers (guests)" id={`${idPrefix}-basepax`} help="Guests the price covers. Blank = flat, no per-guest surcharge.">
              <input id={`${idPrefix}-basepax`} name="base_pax" type="number" min={1} step={1} defaultValue={defaults.base_pax ?? ''} placeholder="e.g. 100" className="input-field" />
            </PField>
            <PField label="Added cost / extra guest (PHP)" id={`${idPrefix}-addpax`} help="Optional. Charged per guest above the base.">
              <input id={`${idPrefix}-addpax`} name="added_pax_price_php" type="number" min={0} step={1} defaultValue={defaults.added_pax_price_php ?? ''} placeholder="e.g. 350" className="input-field" />
            </PField>
          </div>
          {fixedExtra}
        </div>
      ) : basis === 'per_pax' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <PField label={`Price per ${perPaxUnit} (PHP)`} id={`${idPrefix}-perpax`} help={isCrewMeals ? 'Your per-meal rate — well under a guest per-head.' : 'Your per-head rate.'}>
            <input id={`${idPrefix}-perpax`} name="per_pax_price_php" type="number" min={0} step={1} defaultValue={defaults.per_pax_price_php ?? ''} placeholder={isCrewMeals ? 'e.g. 150' : 'e.g. 650'} className="input-field" />
          </PField>
          <PField label={isCrewMeals ? 'Minimum meals' : 'Minimum guests'} id={`${idPrefix}-minpax`} help="The floor. Anchor shown = rate × minimum.">
            <input id={`${idPrefix}-minpax`} name="min_pax" type="number" min={1} step={1} defaultValue={defaults.min_pax ?? ''} placeholder={isCrewMeals ? 'e.g. 15' : 'e.g. 50'} className="input-field" />
          </PField>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <PField label="Base price (PHP)" id={`${idPrefix}-hourbase`} help="Covers the minimum block below.">
              <input id={`${idPrefix}-hourbase`} name="hour_base_php" type="number" min={0} step={1} defaultValue={defaults.hour_base_php ?? ''} placeholder="e.g. 8000" className="input-field" />
            </PField>
            <PField label="Minimum hours" id={`${idPrefix}-minhours`} help="Hours the base covers — e.g. 5.">
              <input id={`${idPrefix}-minhours`} name="min_hours" type="number" min={0.5} step={0.5} defaultValue={defaults.min_hours ?? ''} placeholder="e.g. 5" className="input-field" />
            </PField>
          </div>
          <PField label="Additional per hour (PHP)" id={`${idPrefix}-extrahour`} help="Charged for each hour beyond the minimum.">
            <input id={`${idPrefix}-extrahour`} name="extra_hour_php" type="number" min={0} step={1} defaultValue={defaults.extra_hour_php ?? ''} placeholder="e.g. 1500" className="input-field" />
          </PField>
        </div>
      )}
    </div>
  );
}

/**
 * What's included in the price (service-card redesign · Phase 3a). Crew meal +
 * transport each default to NOT included → the card flags them and they feed the
 * couple's 0007 budget lines. `crew_meal_required` (legacy budget trigger) is
 * kept in sync server-side as the inverse of crew_meal_included.
 */
export function IncludedFlags({
  idPrefix,
  defaults,
  category,
}: {
  idPrefix: string;
  defaults: {
    crew_meal_included: boolean;
    transport_included: boolean;
    transport_flat_fee_php: number | null;
  };
  /** Vendor category — a crew_meals listing IS the crew meal, so the crew-meal
   *  checkbox is hidden (and forced "included") to avoid a contradictory flag. */
  category?: string;
}) {
  const isCrewMeals = category === 'crew_meals';
  const [transportIncluded, setTransportIncluded] = useState(defaults.transport_included);
  return (
    <div
      className="space-y-2.5 rounded-xl border p-3"
      style={{ borderColor: line, background: 'var(--m-paper-2)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        What&rsquo;s included in the price?
      </p>
      {isCrewMeals ? (
        // This service IS the crew meal — force "included" so the card never
        // shows a self-contradictory "crew meal required / not included" flag.
        <input type="hidden" name="crew_meal_included" value="on" />
      ) : (
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--m-slate)' }}>
          <input type="checkbox" name="crew_meal_included" defaultChecked={defaults.crew_meal_included} className="h-4 w-4 cursor-pointer accent-[var(--m-ink)]" />
          <span>Crew meal included <span style={{ color: 'var(--m-slate-3)' }}>— off = couple provides it (added to their budget)</span></span>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--m-slate)' }}>
        <input
          type="checkbox"
          name="transport_included"
          checked={transportIncluded}
          onChange={(e) => setTransportIncluded(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-[var(--m-ink)]"
        />
        <span>Transport included <span style={{ color: 'var(--m-slate-3)' }}>— within your coverage area</span></span>
      </label>
      {!transportIncluded ? (
        <PField
          label="Flat transport fee (PHP) — optional"
          id={`${idPrefix}-transportfee`}
          help="Leave blank to quote transport by distance."
        >
          <input id={`${idPrefix}-transportfee`} name="transport_flat_fee_php" type="number" min={0} step={1} defaultValue={defaults.transport_flat_fee_php ?? ''} placeholder="e.g. 2000" className="input-field" />
        </PField>
      ) : null}
    </div>
  );
}

function PField({ label, id, help, children }: { label: string; id: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        {label}
      </label>
      {children}
      {help ? (
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
