'use client';

/**
 * price-basis-rows — "How the price works ▾ One price · Per guest · Per hour" on the couple's Add-a-supplier sheet and
 * its record card — v2 (owner 2026-11-13, DECISION_LOG "PRICE BASIS v2 AGREED — BUILT WITH THE SHIPPED BOXES AND THE
 * SHIPPED PAYMENT PLAN"; `prototypes/manual_service_price_basis_2026-11-13/v2.html`).
 *
 * The couple records WHAT WAS AGREED — both numbers typed, never read from the schedule or the guest list:
 *   One price → Price (one payment for the whole day).
 *   Per guest → Total agreed · Guests agreed.
 *   Per hour  → Total agreed · Hours agreed.
 * Every box is the shipped house `TypedRow` (its own edit mark, open-row height and placeholder rule — never the
 * prototype's drawn pill). T17 (HOUSE_TEMPLATES "Details go inside the ⓘ"): each row is its title and at most one short
 * line; every explanation — "not your guest list", "works out to ₱X a guest" — is in the row's own ⓘ.
 */

import type { ReactNode } from 'react';
import { FORM_PICK_CLASS, FormRow, FormRows, TypedRow, usePillWidth, type FormRowAbout } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { PRICING_BASIS_OPTIONS } from '@/app/vendor-dashboard/services/_components/pricing-basis-editor';
import {
  AGREED_COUNT_FIELD,
  ONE_PRICE_LINE,
  PRICE_BASIS_FIELD,
  TOTAL_ROW_NAME,
  countRowName,
  worksOutWords,
  type SelfAddedBasis,
} from '@/lib/self-added-price-basis';

/** The Card Maker's three, with the maker's label for a flat price (canvas-maker.tsx `basisOptions`). */
const BASIS_OPTIONS = PRICING_BASIS_OPTIONS.map((o) => ({
  key: o.key,
  label: o.key === 'fixed' ? 'One price' : o.label,
  hint: o.hint,
}));

/** Digits of a kept amount / count → a number above 0, or null. */
function kept(t: string): number | null {
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PriceBasisRows({
  basis,
  onBasis,
  totalKept,
  totalAbout,
  onTotalType,
  onTotalKeep,
  countKept,
  onCountType,
  onCountKeep,
  after,
}: {
  basis: SelfAddedBasis;
  onBasis: (b: SelfAddedBasis) => void;
  /** The total — One price's Price, or Per guest / Per hour's Total agreed. Posts as the shipped `total_cost_php`. */
  totalKept: string;
  /** The total row's ⓘ (the record card says the unpaid payments re-split). */
  totalAbout?: FormRowAbout;
  onTotalType: (t: string) => void;
  onTotalKeep: (t: string) => void;
  /** Per guest / Per hour — the guests / hours agreed. */
  countKept: string;
  onCountType: (t: string) => void;
  onCountKeep: (t: string) => void;
  /** More rows of the same list (the record card's Inclusions). */
  after?: ReactNode;
}) {
  const planWords = 'The payment plan below has to add up to it.';
  const works = basis === 'fixed' ? null : worksOutWords(basis, kept(totalKept), kept(countKept));
  return (
    <FormRows width="wide" data="add-manual-terms">
      <BasisRow basis={basis} onBasis={onBasis} />
      <TypedRow
        // A new row per basis — its name and its ⓘ change with the choice; the amount carries over.
        key={`total-${basis === 'fixed' ? 'one' : 'agreed'}`}
        name={basis === 'fixed' ? 'Price' : TOTAL_ROW_NAME}
        fieldName="total_cost_php"
        value={totalKept}
        amount
        placeholder={basis === 'fixed' ? '80000' : basis === 'per_pax' ? '162000' : '30000'}
        note={basis === 'fixed' ? ONE_PRICE_LINE : undefined}
        about={
          totalAbout ?? {
            words:
              basis === 'fixed'
                ? `What you agreed, in pesos. ${planWords}`
                : basis === 'per_pax'
                  ? `What you agreed with them for everyone, in pesos. ${planWords}`
                  : `What you agreed with them for the day, in pesos. ${planWords}`,
          }
        }
        attrs={{ 'data-manual-field': 'total_cost_php' }}
        onType={onTotalType}
        onKeep={(t) => {
          onTotalKeep(t);
          return { ok: true as const };
        }}
      />
      {basis === 'fixed' ? null : (
        <TypedRow
          key={`count-${basis}`}
          name={countRowName(basis)}
          fieldName={AGREED_COUNT_FIELD}
          value={countKept}
          inputMode="numeric"
          required
          placeholder={basis === 'per_pax' ? 'e.g. 120' : 'e.g. 5'}
          maxLength={basis === 'per_pax' ? 6 : 6}
          about={{
            words: (
              <>
                {basis === 'per_pax' ? 'The number you both agreed on — not your guest list.' : 'The hours you both agreed on — not the schedule.'}
                {works ? (
                  <>
                    {' '}
                    <span data-price-basis-works="">{works}</span> — what they are offered when they claim.
                  </>
                ) : null}
              </>
            ),
          }}
          check={(t) => {
            if (!t.trim()) return null;
            const n = Number(t.replace(/,/g, ''));
            if (!Number.isFinite(n) || n <= 0) return basis === 'per_pax' ? 'Type how many guests.' : 'Type how many hours.';
            if (basis === 'per_pax' && !Number.isInteger(n)) return 'Guests are whole numbers.';
            return null;
          }}
          attrs={{ 'data-manual-field': AGREED_COUNT_FIELD, 'data-price-basis-count': basis }}
          onType={onCountType}
          onKeep={(t) => {
            onCountKeep(t);
            return { ok: true as const };
          }}
        />
      )}
      {after}
    </FormRows>
  );
}

function BasisRow({ basis, onBasis }: { basis: SelfAddedBasis; onBasis: (b: SelfAddedBasis) => void }) {
  const width = usePillWidth();
  const current = BASIS_OPTIONS.find((o) => o.key === basis) ?? BASIS_OPTIONS[0]!;
  return (
    <FormRow
      name="How the price works"
      about={{ words: current.hint }}
      data="price-basis"
      attrs={{ 'data-price-basis': basis }}
    >
      <PickMenu
        label="How the price works"
        value={basis}
        options={BASIS_OPTIONS}
        onPick={(k) => onBasis(k as SelfAddedBasis)}
        dataAttr="data-price-basis-pick"
        className={`${FORM_PICK_CLASS} ${width}`}
      />
      <input type="hidden" name={PRICE_BASIS_FIELD} value={basis} />
    </FormRow>
  );
}
