'use client';

/**
 * The cost-based price formula on /admin/pricing (owner 2026-11-21, Setnayan-specs
 * DECISION_LOG "NEW BASE PRICING FORMULA"):
 *
 *   price = base cost × 10 × 4.5 ÷ 0.73, rounded up to ₱1
 *
 * Three pieces, all in this file so the catalog editor only gains a few lines:
 *   · `PricingFormulaCard` — the one small card at the top of the catalog: the
 *     sentence, the four numbers, and "Apply to all rows with a cost" behind a
 *     confirm that lists every SKU, old → new, before anything is sent.
 *   · `FormulaLine` — "Formula ₱124 · +₱24" (or "Add cost") beside a row's price.
 *   · `PricingFormulaContext` — the settings, read once by the surface, so rows
 *     deep in the shelves can read them without threading a prop through every level.
 *
 * 🔒 NOTHING HERE CHANGES A PRICE BY ITSELF. Saving the four numbers moves no
 * price; "Use formula price" fills the row's Price box and the admin still presses
 * "Save this price"; "Apply to all" sends each change through the same audited
 * per-row save (and § 9.1 second-admin approval) as a typed edit.
 */

import { createContext, useActionState, useContext, useMemo, useState } from 'react';
import { Calculator, Save, Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows } from '@/app/_components/form-row';
import { savePricingFormula } from '@/app/admin/pricing/price-control-actions';
import { applyFormulaPrices, type ApplyFormulaState, type RowActionState } from '@/app/admin/pricing/actions';
import {
  PRICING_ROUND_STEPS,
  formulaAppliesTo,
  formulaCandidates,
  formulaDifferenceLabel,
  formulaPrice,
  formulaSentence,
  type FormulaCandidateRow,
  type PricingFormulaSettings,
} from '@/lib/pricing-formula';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';

const peso = (n: number) => formatPhp(n);

/** Null = the settings could not be read; rows then suggest nothing. */
export const PricingFormulaContext = createContext<PricingFormulaSettings | null>(null);

export function usePricingFormula(): PricingFormulaSettings | null {
  return useContext(PricingFormulaContext);
}

/** Beside a row's price: "Formula ₱124 · +₱24", or "Add cost" when the row has none. */
export function FormulaLine({ cost, price }: { cost: number; price: number }) {
  const settings = usePricingFormula();
  if (!settings) return null;
  const f = formulaPrice(cost, settings);
  if (f == null) {
    return (
      <span className="block text-[10.5px] text-ink/45" data-formula-line="no-cost">
        Add cost
      </span>
    );
  }
  const diff = formulaDifferenceLabel(f, price);
  return (
    <span className="block text-[10.5px] tabular-nums text-ink/60" data-formula-line="">
      Formula {peso(f)}
      <span className={diff === 'same' ? 'text-ink/45' : 'font-semibold text-gold-text'}> · {diff}</span>
    </span>
  );
}

export function PricingFormulaCard({ rows }: { rows: FormulaCandidateRow[] }) {
  const settings = usePricingFormula();
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(String(settings?.roundStepPhp ?? 1));
  const [confirming, setConfirming] = useState(false);
  const [saveState, saveAction] = useActionState<RowActionState, FormData>(savePricingFormula, {
    ok: false,
    message: null,
  });
  const [applyState, applyAction, applying] = useActionState<ApplyFormulaState, FormData>(
    async (prev, fd) => {
      const r = await applyFormulaPrices(prev, fd);
      setConfirming(false);
      return r;
    },
    { ok: false, message: null, sent: 0 },
  );

  const changes = useMemo(() => (settings ? formulaCandidates(rows, settings) : []), [rows, settings]);
  const withCost = rows.filter((r) => r.isActive && formulaAppliesTo(r) && r.cost > 0).length;

  if (!settings) {
    return (
      <div
        className="mb-4 rounded-r-2xl border border-l-[3px] border-ink/10 border-l-danger-700 bg-ink/[0.02] p-4"
        data-pricing-formula="unread"
      >
        <h2 className="text-[15px] font-bold">Price formula</h2>
        <p className="mt-1 text-[13px] text-danger-700">
          Couldn&apos;t read the formula settings, so no formula price is shown. Refresh in a moment.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mb-4 rounded-r-2xl border border-l-[3px] border-ink/10 border-l-gold bg-ink/[0.02] p-4"
      data-pricing-formula=""
    >
      <h2 className="text-[15px] font-bold">Price formula</h2>
      <p className="mt-1 text-[13px] tabular-nums text-ink/75">{formulaSentence(settings)}</p>
      <p className="mt-0.5 text-[12px] text-ink/55">
        Applies to the main price only — per-head, sign-up, yearly and bundle prices stay as they are.
      </p>
      <p className="text-[12px] text-ink/55">It only suggests. No price changes until you apply it.</p>

      {editing ? (
        <form action={saveAction} className="mt-3 space-y-3" data-pricing-formula-form="">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberBox name="pricing_opex_factor" label="OPEX ×" defaultValue={settings.opexFactor} step="0.001" />
            <NumberBox name="pricing_margin_factor" label="Margin ×" defaultValue={settings.marginFactor} step="0.001" />
            <NumberBox
              name="pricing_fee_tax_cover"
              label="Fees + tax ÷"
              defaultValue={settings.feeTaxCover}
              step="0.0001"
              max="1"
            />
          </div>
          <FormRows data="pricing-round-step">
            <ChosenRow
              data="pricing-round-step"
              name="Round up to"
              value={step}
              options={PRICING_ROUND_STEPS.map((s) => ({ key: String(s), label: peso(s) }))}
              onPick={setStep}
              dataAttr="data-pricing-round-step"
            />
          </FormRows>
          <input type="hidden" name="pricing_round_step_php" value={step} />
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton tone="brand" main type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save formula" />
            <ActionButton tone="neutral" quiet icon={<X aria-hidden strokeWidth={1.9} />} label="Close" onClick={() => setEditing(false)} />
          </div>
        </form>
      ) : null}
      {saveState.message && (
        <p className={`mt-2 text-xs ${saveState.ok ? 'text-success-800' : 'text-danger-700'}`}>{saveState.message}</p>
      )}

      {confirming ? (
        <form action={applyAction} className="mt-3 rounded-xl bg-danger-700/[0.05] p-3" data-pricing-formula-confirm="">
          <p className="text-[13px] font-bold text-danger-700">
            {formatCount(changes.length)} price{changes.length === 1 ? '' : 's'} would change
          </p>
          <p className="mt-0.5 text-[12px] text-ink/60">Each one waits for a second admin in /admin/approvals.</p>
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] text-ink/75 sm:grid-cols-2">
            {changes.map((c) => (
              <li key={c.code} className="tabular-nums">
                <input type="hidden" name="service_code" value={c.code} />
                <input type="hidden" name={`shown_price_${c.code}`} value={c.newPrice} />
                <span className="font-semibold">{c.title}</span>{' '}
                <span className="text-ink/45">{c.code}</span>{' '}
                <span className="font-mono">{peso(c.oldPrice)}</span> →{' '}
                <span className="font-mono font-bold text-danger-700">{peso(c.newPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ActionButton
              tone="brand"
              main
              type="submit"
              disabled={applying}
              icon={<Send aria-hidden strokeWidth={1.9} />}
              label={applying ? 'Sending…' : `Send ${formatCount(changes.length)} price change${changes.length === 1 ? '' : 's'}`}
            />
            <ActionButton tone="neutral" quiet icon={<X aria-hidden strokeWidth={1.9} />} label="Cancel" onClick={() => setConfirming(false)} />
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!editing && (
            <ActionButton
              tone="neutral"
              icon={<Calculator aria-hidden strokeWidth={1.9} />}
              label="Change the numbers"
              onClick={() => setEditing(true)}
            />
          )}
          <ActionButton
            tone="brand"
            disabled={changes.length === 0}
            icon={<Send aria-hidden strokeWidth={1.9} />}
            label="Apply to all rows with a cost"
            onClick={() => setConfirming(true)}
          />
          <span className="text-[12px] text-ink/55">
            {withCost === 0
              ? 'No price on sale has a cost yet.'
              : changes.length === 0
                ? `All ${formatCount(withCost)} with a cost already match.`
                : `${formatCount(changes.length)} of ${formatCount(withCost)} with a cost would move.`}
          </span>
        </div>
      )}
      {applyState.message && (
        <p className={`mt-2 text-xs ${applyState.ok ? 'text-success-800' : 'text-danger-700'}`}>{applyState.message}</p>
      )}
    </div>
  );
}

function NumberBox({
  name,
  label,
  defaultValue,
  step,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  step: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-ink">{label}</span>
      <input
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        min="0"
        max={max}
        required
        defaultValue={String(defaultValue)}
        className="input-field h-9 w-full text-sm tabular-nums"
      />
    </label>
  );
}
