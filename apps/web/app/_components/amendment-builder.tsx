'use client';

// Multi-line proposal-amendment builder (negotiation Phase 3). Lets a couple (or
// vendor, for a counter) assemble a BUNDLE of items — discount / add-on /
// freebie / specialized request — and send it as one amendment. Shared by the
// create chip and the card's Counter. Serializes the rows into a hidden `items`
// JSON field the server action (createAmendmentFromChat / counter...) validates.

import { useState, type ReactNode } from 'react';
import {
  AMENDMENT_ITEM_KINDS,
  ITEM_KIND_LABEL,
  isMoneyKind,
  type AmendmentItemKind,
} from '@/lib/proposal-amendments';

type Row = { kind: AmendmentItemKind; label: string; amount: string };

export function AmendmentBuilder({
  action,
  threadId,
  returnPath,
  amendmentId,
  submitLabel,
  initial,
  onCancel,
}: {
  action: (formData: FormData) => Promise<void>;
  threadId: string;
  returnPath: string;
  amendmentId?: string;
  submitLabel: string;
  initial?: Row[];
  onCancel?: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial && initial.length > 0 ? initial : [{ kind: 'discount', label: '', amount: '' }],
  );

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.label.trim().length > 0)
      .map((r) => ({
        kind: r.kind,
        label: r.label.trim(),
        amount: isMoneyKind(r.kind) ? Number(r.amount) || 0 : undefined,
      })),
  );

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, { kind: 'addon', label: '', amount: '' }]);
  const remove = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  return (
    <form
      action={action}
      className="mt-1.5 flex w-full flex-col gap-2 rounded-xl border border-mulberry/20 bg-mulberry/[0.04] p-2.5"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnPath} />
      {amendmentId ? <input type="hidden" name="amendment_id" value={amendmentId} /> : null}
      <input type="hidden" name="items" value={itemsJson} />

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <select
              value={r.kind}
              onChange={(e) => update(i, { kind: e.target.value as AmendmentItemKind })}
              className="input-field h-9 w-[104px] text-sm"
              aria-label="Item type"
            >
              {AMENDMENT_ITEM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ITEM_KIND_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={r.label}
              onChange={(e) => update(i, { label: e.target.value })}
              maxLength={200}
              placeholder={r.kind === 'request' ? 'e.g. Upload raw photos' : 'Describe it'}
              className="input-field h-9 min-w-[120px] flex-1 text-sm"
            />
            {isMoneyKind(r.kind) ? (
              <input
                type="number"
                min="1"
                value={r.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                placeholder="₱"
                className="input-field h-9 w-[92px] text-sm"
                aria-label="Amount"
              />
            ) : null}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove item"
              className="inline-flex h-9 w-8 items-center justify-center rounded-md text-ink/40 hover:bg-ink/[0.06] hover:text-ink"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="self-start text-xs font-medium text-mulberry hover:underline"
      >
        + Add item
      </button>

      <input
        type="text"
        name="note"
        maxLength={2000}
        placeholder="Note (optional)"
        className="input-field h-9 text-sm"
      />

      <div className="flex gap-2">
        <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-ink/15 px-3.5 text-sm text-ink/60 hover:bg-ink/[0.04]"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export type AmendmentBuilderRow = Row;
