'use client';

/**
 * The opened payout's form rows (admin clean port, owner 19 Nov 2026). Reposition only — the same three things the
 * payout card's forms always posted, now drawn by the house Form rows instead of a raw `<select>` and raw boxes:
 *   · Rail — `payment_method` (Maya · GCash · BDO transfer · Check), one dropdown, default the payout's own method;
 *   · Reference # — `payout_reference`;
 *   · a reason — `reason` (required to place a hold, optional to release one).
 * Each row posts under the same `name` the old field had (`TypedRow`'s `fieldName`; a hidden input for the dropdown),
 * so `markPayoutPaidAction` · `holdPayoutAction` · `releasePayoutHoldAction` read exactly what they read before.
 */
import { useState } from 'react';

import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';

const RAILS = [
  { key: 'maya', label: 'Maya' },
  { key: 'gcash', label: 'GCash' },
  { key: 'bdo_transfer', label: 'BDO transfer' },
  { key: 'check', label: 'Check' },
] as const;

export function MarkPaidRows({ defaultRail }: { defaultRail: string | null }) {
  const [rail, setRail] = useState<string>(RAILS.some((r) => r.key === defaultRail) ? (defaultRail as string) : 'maya');
  const [reference, setReference] = useState('');
  return (
    <FormRows data="payout-mark-paid">
      <ChosenRow
        data="payout-rail"
        name="Rail"
        value={rail}
        options={RAILS.map((r) => ({ key: r.key, label: r.label }))}
        onPick={setRail}
        dataAttr="data-payout-rail"
      />
      <input type="hidden" name="payment_method" value={rail} />
      <TypedRow
        data="payout-reference"
        name="Reference #"
        placeholder="Reference #"
        value={reference}
        fieldName="payout_reference"
        onKeep={(text) => setReference(text)}
      />
    </FormRows>
  );
}

export function ReasonRow({ name, placeholder, required = false }: { name: string; placeholder: string; required?: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <FormRows data="payout-reason">
      <TypedRow
        data="payout-reason"
        name={name}
        placeholder={placeholder}
        value={reason}
        required={required}
        fieldName="reason"
        onKeep={(text) => setReason(text)}
      />
    </FormRows>
  );
}
