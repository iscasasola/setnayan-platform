'use client';

import { useId, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { updateVendorProfileField } from '../../actions';
import { moveSection, type PortfolioSectionKey } from '@/lib/portfolio-section-order';

/**
 * ↕ REORDER — the Portfolio's closing row (ruling 5940; approved Portfolio v3: "Reorder · NEW" under More — "Drag
 * sections into your order"). The row opens the house bottom `Sheet`: every section this shop draws, in the order it
 * is drawn, each with ↑ and ↓ (44-px presses — a drag needs a second hand on a phone and has no keyboard path).
 *
 *   · Save writes the whole order through the SHIPPED field save (`updateVendorProfileField`, field `portfolio_order`
 *     → `vendor_profiles.portfolio_section_order`, migration 20271342126686) — no new server action.
 *   · Reset saves an empty list (the shipped order is what an empty list means).
 *   · A refused save says so in the toast and the page keeps the order it had; nothing moves on the page until it saved.
 *   · More is not in the list: it always closes the page, then this row.
 * 🔒 lib/portfolio-section-order.test.ts
 */
export function ReorderSections({
  order,
  names,
  onSaved,
}: {
  /** The sections as drawn now. */
  order: readonly PortfolioSectionKey[];
  names: Readonly<Record<PortfolioSectionKey, string>>;
  /** The stored list after a save (an empty list = the shipped order). */
  onSaved: (stored: readonly string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PortfolioSectionKey[]>([...order]);
  const [saving, setSaving] = useState(false);
  const titleId = useId();

  const save = async (next: readonly PortfolioSectionKey[]) => {
    setSaving(true);
    const fd = new FormData();
    fd.set('field', 'portfolio_order');
    for (const k of next) fd.append('section', k);
    let ok = false;
    let error = 'Couldn’t save your order. Nothing moved — try again.';
    try {
      const r = await updateVendorProfileField(null, fd);
      ok = r.ok;
      if (!r.ok && r.error) error = r.error;
    } catch {
      ok = false;
    }
    setSaving(false);
    if (!ok) {
      guestToast.error(error);
      return;
    }
    onSaved(next);
    setOpen(false);
    guestToast.success(next.length === 0 ? 'Order reset' : 'Your order is saved');
  };

  return (
    <>
      <div className="mx-4 mt-5 border-t border-ink/10 pt-1">
        <button
          type="button"
          onClick={() => {
            setDraft([...order]);
            setOpen(true);
          }}
          aria-haspopup="dialog"
          className="sn-press flex min-h-12 w-full items-center gap-2 text-left text-[16px] font-semibold text-sn-accent"
          data-portfolio-reorder=""
        >
          <ArrowUpDown aria-hidden className="h-4 w-4" strokeWidth={2} />
          Reorder
        </button>
      </div>
      <Sheet open={open} onClose={() => (saving ? undefined : setOpen(false))} labelledById={titleId} title="Reorder your sections" rise>
        <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1" data-portfolio-reorder-sheet="">
          <p className="pb-2 text-[13px] leading-snug text-ink/65">Your Portfolio shows its sections in this order. More always comes last.</p>
          <ol className="divide-y divide-ink/10" data-portfolio-reorder-list="">
            {draft.map((k, i) => (
              <li key={k} className="flex min-h-[52px] items-center gap-2" data-portfolio-reorder-row={k}>
                <span className="w-6 flex-none font-mono text-[12px] text-ink/45">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{names[k]}</span>
                <button
                  type="button"
                  disabled={i === 0 || saving}
                  onClick={() => setDraft((d) => moveSection(d, i, -1))}
                  aria-label={`Move ${names[k]} up`}
                  className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink/70 disabled:opacity-30"
                  data-portfolio-reorder-up={k}
                >
                  <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  disabled={i === draft.length - 1 || saving}
                  onClick={() => setDraft((d) => moveSection(d, i, 1))}
                  aria-label={`Move ${names[k]} down`}
                  className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink/70 disabled:opacity-30"
                  data-portfolio-reorder-down={k}
                >
                  <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save([])}
              className="min-h-12 rounded-full border border-ink/15 px-3 text-[14px] font-medium text-ink disabled:opacity-50"
              data-portfolio-reorder-reset=""
            >
              Reset
            </button>
            <button
              type="button"
              disabled={saving}
              aria-busy={saving || undefined}
              onClick={() => void save(draft)}
              className="min-h-12 rounded-full bg-ink px-3 text-[14px] font-semibold text-[color:var(--m-paper)] disabled:opacity-50"
              data-portfolio-reorder-save=""
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
