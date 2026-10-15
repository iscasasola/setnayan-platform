'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { setServiceAddons } from '../addon-actions';

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
    return (
      <div className="space-y-2" data-addons-bare="">
        <input type="hidden" name="addons_present" value="1" />
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <input
              name="addon_label"
              defaultValue={r.label}
              maxLength={80}
              aria-label="Add-on"
              placeholder="e.g. Drone coverage"
              className="input-field min-w-0 flex-[2]"
            />
            <input
              name="addon_price"
              defaultValue={r.price}
              type="number"
              min={0}
              step={1}
              aria-label="From (PHP)"
              placeholder="from ₱"
              className="input-field min-w-0 flex-1"
            />
            <button
              type="button"
              aria-label="Remove add-on"
              onClick={() => remove(r.key)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
              style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        ))}
        {rows.length < 12 ? (
          <button
            type="button"
            onClick={add}
            className="sn-press inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sn-accent"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add an add-on
          </button>
        ) : null}
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
