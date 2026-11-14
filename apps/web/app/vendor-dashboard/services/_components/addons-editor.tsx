'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { FormRows } from '@/app/_components/form-row';
import { AddLineRow, LineRow } from '@/app/_components/form-row-line';
import { pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { setServiceAddons } from '../addon-actions';
import { StayForm } from '@/app/_components/stay-form';

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
    /**
     * EXTRAS ON THE CARD'S FIRST PAGE (makers prototype 7 Nov 2026 § 3: "Extras · priced add-ons · optional"). Each
     * line is the label + its "from ₱", in one bordered list, and leaves by ITS SWIPE with Undo — THE ONE SWIPE
     * (`SwipeToDelete`) and the shipped Undo toast; no ✕ on the line (owner 7 Nov: *"all swipe to delete works"*).
     * Nothing is written until the card's save, so Undo puts the line back where it was. Same field names as ever.
     */
    const swipeOut = (row: Row) => {
      const at = rows.findIndex((r) => r.key === row.key);
      remove(row.key);
      pushUndo({
        label: row.label.trim() ? `“${row.label.trim()}” removed` : 'Extra removed',
        undo: async () => {
          setRows((cur) => {
            if (cur.some((r) => r.key === row.key)) return cur;
            const next = [...cur];
            next.splice(at < 0 ? next.length : Math.min(at, next.length), 0, row);
            return next;
          });
        },
      });
    };
    const patch = (key: number, next: Partial<AddonDraft>) =>
      setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...next } : r)));
    /* 📐 ONE FORM (ruling 6058, prototype `card_maker_one_form_2026-11-11`): an extra is ONE row — its words where a row's
       name stands, its "from ₱" in the list's 120 px pill (`LineRow`) — and "Add an extra" is the list's last row. */
    return (
      <div data-addons-bare="">
        <input type="hidden" name="addons_present" value="1" />
        <FormRows width="narrow">
          {rows.map((r, i) => (
            <SwipeToDelete
              key={r.key}
              label={`Remove ${r.label.trim() || `extra ${i + 1}`}`}
              word="Remove"
              radiusClass="rounded-none"
              surfaceClass="bg-cream"
              onDelete={() => swipeOut(r)}
            >
              <div data-addon-line="">
                <LineRow
                  words={r.label}
                  wordsName={`Extra ${i + 1}`}
                  wordsField="addon_label"
                  wordsMax={80}
                  onKeepWords={(t) => patch(r.key, { label: t })}
                  amount={{ value: r.price, name: 'From (PHP)', empty: 'from ₱', field: 'addon_price', onKeep: (d) => patch(r.key, { price: d }) }}
                  data="addon-line"
                />
              </div>
            </SwipeToDelete>
          ))}
          {rows.length < 12 ? (
            <div data-addon-add="">
              <AddLineRow label="Add an extra" onAdd={add} data="addon-add" />
            </div>
          ) : null}
        </FormRows>
      </div>
    );
  }
  return (
    <StayForm
      door="svServices.setServiceAddons"
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
    </StayForm>
  );
}
