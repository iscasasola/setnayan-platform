'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { setServiceAddons } from '../addon-actions';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { AddLinePill } from './service-list-editors';

/** The maker's one box: 48 px, the house rhythm (owner-approved makers, 2026-11-07). */
export const MAKER_BOX = 'h-12 w-full rounded-xl border bg-raised px-3.5 text-[16px] text-ink outline-none focus:border-sn-accent';

/**
 * Priced add-ons editor for a service card (Vendor Services rework 2026-07-02).
 * A replace-all repeater posting to setServiceAddons. Rows carry a stable key so
 * uncontrolled inputs keep their typed values across add/remove.
 */
export type AddonDraft = { label: string; price: string };
type Row = AddonDraft & { key: number };

export function AddonsEditor({
  serviceId,
  initial,
  bare = false,
}: {
  serviceId: string;
  initial: AddonDraft[];
  /**
   * The rows only, posting with the card's ONE save (the simpler maker, 2026-10-14): no `<form>`, no "Save add-ons".
   * `addons_present` tells `commitVendorService` this list was on screen, so an empty list clears and an absent one
   * leaves the stored add-ons alone.
   */
  bare?: boolean;
}) {
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(initial.map((r, i) => ({ key: i, ...r })));

  const add = () =>
    setRows((cur) => [...cur, { key: nextKey.current++, label: '', price: '' }]);
  const remove = (key: number) => setRows((cur) => cur.filter((r) => r.key !== key));

  if (bare) {
    /* 👈 THE MAKER'S EXTRAS (owner-approved card maker, 2026-11-07): one line per extra — what it is · its "from ₱" —
       in the house's 48 px boxes, swiped left to remove WITH UNDO (the shared `SwipeToDelete` + `deleteWithUndo`; no ✕
       on the row). The rows are CONTROLLED here so an Undo brings back what was typed. Field names unchanged. */
    const patch = (key: number, next: Partial<AddonDraft>) =>
      setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...next } : r)));
    const swipeAway = (r: Row) => {
      const before = rows;
      deleteWithUndo({
        label: r.label.trim() ? `“${r.label.trim()}” removed` : 'Extra removed',
        hide: () => remove(r.key),
        restore: () => setRows(before),
        commit: () => undefined, // nothing was written — the card is not saved yet
      });
    };
    return (
      <div className="space-y-2" data-addons-bare="">
        <input type="hidden" name="addons_present" value="1" />
        {rows.map((r, i) => (
          <SwipeToDelete key={r.key} label={`Remove ${r.label.trim() || `extra ${i + 1}`}`} word="Remove" onDelete={() => swipeAway(r)}>
            <div className="flex items-center gap-2" data-addon-line="">
              <input
                name="addon_label"
                value={r.label}
                onChange={(e) => patch(r.key, { label: e.target.value })}
                maxLength={80}
                aria-label={`Extra ${i + 1}`}
                placeholder="e.g. Extra hour of coverage"
                className={`${MAKER_BOX} min-w-0 flex-[2]`}
                style={{ borderColor: 'var(--m-line)' }}
              />
              <input
                name="addon_price"
                value={r.price}
                onChange={(e) => patch(r.key, { price: e.target.value.replace(/[^0-9]/g, '') })}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                aria-label="From price of this extra (PHP)"
                placeholder="from ₱"
                className={`${MAKER_BOX} min-w-0 flex-1`}
                style={{ borderColor: 'var(--m-line)' }}
              />
            </div>
          </SwipeToDelete>
        ))}
        <AddLinePill onClick={add} disabled={rows.length >= 12}>
          Add an extra
        </AddLinePill>
      </div>
    );
  }
  return (
    <form
      action={setServiceAddons}
      className="rounded-lg border p-3"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <input type="hidden" name="vendor_service_id" value={serviceId} />
      <p className="text-xs font-medium" style={{ color: 'var(--m-ink)' }}>
        Add-ons
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
        Optional priced extras — each shows a &ldquo;from&rdquo; price on your card.
      </p>

      {rows.length > 0 ? (
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <input
                name="addon_label"
                defaultValue={r.label}
                maxLength={80}
                placeholder="e.g. Drone coverage"
                className="input-field flex-[2]"
              />
              <input
                name="addon_price"
                defaultValue={r.price}
                type="number"
                min={0}
                step={1}
                placeholder="from ₱"
                className="input-field flex-1"
              />
              <button
                type="button"
                aria-label="Remove add-on"
                onClick={() => remove(r.key)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color: 'var(--m-orange-2)' }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add add-on
        </button>
        <SubmitButton
          className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-[11px] font-medium"
          pendingLabel="Saving…"
        >
          Save add-ons
        </SubmitButton>
      </div>
    </form>
  );
}
