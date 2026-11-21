'use client';

import { useId, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { actionButtonClass } from '@/components/action-button-class';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { StayForm } from '@/app/_components/stay-form';
import { SubmitButton } from '@/app/_components/submit-button';
import s from '@/app/vendor-dashboard/_components/set-two/set-two.module.css';
import { addPortionRule } from './actions';
import { BASIS_LABELS, BLOCK_LABELS, MEAL_LABELS } from './production-sheet-model';

/**
 * Add a portion rule — the fold becomes a sheet (supplier pages set two, page 5). Same fields, same choices, the same
 * names `addPortionRule` reads: item · per guest · unit · "Only these meals" (none checked = all guests) · the part
 * ("Whole event" or "<Part> only") · the count ("Count: Confirmed / Expected (+maybe) / Ceiling (+pending)") · buffer %.
 * The two raw selects are dropdowns; the checkboxes are chips; Save rule is the sheet's main button.
 */
export function AddRuleSheet({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const [label, setLabel] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [block, setBlock] = useState('');
  const [basis, setBasis] = useState('confirmed');
  const [buffer, setBuffer] = useState('0');

  return (
    <>
      <button type="button" className={`${s.row} w-full text-left`} onClick={() => setOpen(true)} aria-haspopup="dialog" data-add-portion-rule="">
        <span aria-hidden className={s.rowIcon}>
          <Plus strokeWidth={1.75} />
        </span>
        <span className={s.rowBody}>
          <b className={s.rowTitle}>Add a portion rule</b>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} rise>
        <div className="px-4 pb-5 pt-1">
          <div className="flex items-center gap-2">
            <h2 id={titleId} className="flex-1 text-[17px] font-bold text-ink">
              Add a portion rule
            </h2>
            <ActionButton tone="neutral" quiet icon={X} label="Close" iconOnly onClick={() => setOpen(false)} />
          </div>
          <StayForm door="supClients.addPortionRule" action={addPortionRule} onSaved={() => setOpen(false)}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="applies_to_block" value={block} />
            <input type="hidden" name="headcount_basis" value={basis} />
            <FormRows width="short" className="mt-2">
              <TypedRow name="Item" value={label} empty="Item, e.g. Rice" required maxLength={120} fieldName="label" onKeep={setLabel} data="rule-label" />
              <TypedRow name="Per guest" value={qty} empty="Qty per guest" required maxLength={12} inputMode="numeric" fieldName="qty_per_guest" onKeep={setQty} data="rule-qty" />
              <TypedRow name="Unit" value={unit} empty="Unit, e.g. kg" required maxLength={30} fieldName="unit" onKeep={setUnit} data="rule-unit" />
            </FormRows>
            <p className="mt-3 text-[13px] font-semibold text-ink">
              Only these meals: <span className="font-normal text-[color:var(--m-slate-2)]">(none checked = all guests)</span>
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(MEAL_LABELS)
                .filter(([k]) => k !== 'unspecified')
                .map(([key, word]) => (
                  <label
                    key={key}
                    className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-[var(--m-r-sm)] bg-[color:var(--m-paper-2)] px-3 text-[13px] font-semibold text-[color:var(--m-slate-2)] has-[:checked]:bg-[color:var(--surface-soft)] has-[:checked]:text-sn-accent has-[:checked]:shadow-[inset_0_0_0_1.5px_rgb(var(--sn-accent))] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sn-accent"
                  >
                    <input type="checkbox" name={`meal_${key}`} className="peer sr-only" />
                    <Check aria-hidden className="hidden h-3.5 w-3.5 peer-checked:inline" />
                    {word}
                  </label>
                ))}
            </div>
            <FormRows width="short" className="mt-2">
              <ChosenRow
                name="Part"
                value={block}
                buttonText={block ? `${BLOCK_LABELS[block]} only` : 'Whole event'}
                options={[{ key: '', label: 'Whole event' }, ...Object.entries(BLOCK_LABELS).map(([k, w]) => ({ key: k, label: `${w} only` }))]}
                onPick={setBlock}
                data="rule-block"
              />
              <ChosenRow
                name="Count"
                value={basis}
                buttonText={`Count: ${BASIS_LABELS[basis]}`}
                options={Object.entries(BASIS_LABELS).map(([k, w]) => ({ key: k, label: `Count: ${w}` }))}
                onPick={setBasis}
                data="rule-basis"
              />
              <TypedRow name="Buffer %" value={buffer} maxLength={5} inputMode="numeric" fieldName="waste_factor_pct" onKeep={(t) => setBuffer(t || '0')} data="rule-buffer" />
            </FormRows>
            <SubmitButton className={actionButtonClass('brand', { main: true, extra: 'mt-4 w-full' })} pendingLabel="Saving…">
              <Check aria-hidden strokeWidth={1.9} />
              <span>Save rule</span>
            </SubmitButton>
          </StayForm>
        </div>
      </Sheet>
    </>
  );
}
