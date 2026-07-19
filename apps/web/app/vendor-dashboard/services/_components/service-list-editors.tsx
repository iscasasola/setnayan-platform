'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Gift, Layers, Plus, Tag, X } from 'lucide-react';

/**
 * Repeatable list editors for a service card (service-card redesign · Phase 3b).
 *
 * Each editor is a nested block INSIDE the main service form (create /
 * inline-edit). It manages its own row state client-side and renders parallel,
 * index-aligned HIDDEN inputs the server action reads via formData.getAll(…):
 *
 *   • InclusionsEditor    → inclusion_label[]  · inclusion_worth[]
 *   • DiscountsEditor     → discount_type[] · discount_rate[] · discount_unit[]
 *                           · discount_expires_at[] · discount_conditions_md[]
 *   • PriceBracketsEditor → bracket_min_pax[] · bracket_max_pax[] · bracket_price[]
 *
 * The server action does a replace-all (DELETE by service+profile, INSERT) into
 * the matching child table. Fully-blank rows are ignored server-side; the
 * validation contract (rate>0, promo needs expiry, label 1–80, max≥min) is
 * enforced there too. These editors do NOT render their own <form> — they submit
 * as part of the enclosing form (unlike AddonsEditor, which is standalone).
 *
 * The visual idiom mirrors pricing-basis-editor.tsx / coverage-panel.tsx:
 * editorial palette CSS vars, Lucide icons, the shared `input-field` class.
 */

const line = 'var(--m-line)';

// ── Discount labels (mirrors services-manager.tsx's DISCOUNT_TYPE_LABELS) ─────
export type DiscountType =
  | 'early_booking'
  | 'off_peak'
  | 'bundle'
  | 'promo'
  | 'returning';

const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  early_booking: 'Early Booking',
  off_peak: 'Off-Peak',
  bundle: 'Package Bundle',
  promo: 'Limited-Time Promo',
  returning: 'Returning Couple',
};

function RowRemove({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
      style={{ borderColor: line, color: 'var(--m-slate)' }}
    >
      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

function AddRowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: 'var(--m-orange-2)' }}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · InclusionsEditor — FREE items each with an optional stated worth
// ════════════════════════════════════════════════════════════════════════════
export type InclusionDraft = { label: string; worth: string };
type InclusionRow = InclusionDraft & { key: number };

export function InclusionsEditor({ initial }: { initial: InclusionDraft[] }) {
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<InclusionRow[]>(
    initial.map((r, i) => ({ key: i, ...r })),
  );

  const add = () =>
    setRows((cur) => [...cur, { key: nextKey.current++, label: '', worth: '' }]);
  const remove = (key: number) => setRows((cur) => cur.filter((r) => r.key !== key));

  return (
    <details
      className="rounded-xl border"
      style={{ borderColor: line, background: 'var(--m-paper-2)' }}
      open={rows.length > 0}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5">
        <span
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
          What&rsquo;s included
          {rows.length > 0 ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              {rows.length}
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
      </summary>
      <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: line }}>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          FREE items bundled into your price — each with an optional peso worth
          couples see as free value (&ldquo;₱X free&rdquo;). This is your value
          story, separate from priced Add-ons below.
        </p>

        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <input
                  name="inclusion_label"
                  defaultValue={r.label}
                  maxLength={80}
                  placeholder="e.g. Same-day highlight reel"
                  className="input-field flex-[2]"
                />
                <input
                  name="inclusion_worth"
                  defaultValue={r.worth}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="worth ₱"
                  className="input-field flex-1"
                />
                <RowRemove onClick={() => remove(r.key)} label="Remove inclusion" />
              </div>
            ))}
          </div>
        ) : null}

        <AddRowButton onClick={add}>Add inclusion</AddRowButton>
      </div>
    </details>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2 · DiscountsEditor — multiple discounts (couple sees the best they qualify for)
// ════════════════════════════════════════════════════════════════════════════
export type DiscountDraft = {
  discount_type: DiscountType | '';
  rate: string;
  unit: 'pct' | 'php';
  /** YYYY-MM-DD (date input value) or ''. */
  expires_at: string;
  conditions_md: string;
};
type DiscountRow = DiscountDraft & { key: number };

export function DiscountsEditor({
  initial,
  /** When true and there are no rows, seed one off_peak row (Off-Season nudge). */
  seedOffPeak = false,
  seedExpiry,
  seedConditions,
}: {
  initial: DiscountDraft[];
  seedOffPeak?: boolean;
  seedExpiry?: string;
  seedConditions?: string;
}) {
  // Preserve the "Set up off-season offer" nudge: if the vendor arrived via the
  // nudge and has no discounts yet, open with one pre-filled off_peak row.
  const seeded: DiscountDraft[] =
    initial.length === 0 && seedOffPeak
      ? [
          {
            discount_type: 'off_peak',
            rate: '',
            unit: 'pct',
            expires_at: seedExpiry ?? '',
            conditions_md: seedConditions ?? '',
          },
        ]
      : initial;

  const nextKey = useRef(seeded.length);
  const [rows, setRows] = useState<DiscountRow[]>(
    seeded.map((r, i) => ({ key: i, ...r })),
  );

  const add = () =>
    setRows((cur) => [
      ...cur,
      {
        key: nextKey.current++,
        discount_type: 'early_booking',
        rate: '',
        unit: 'pct',
        expires_at: '',
        conditions_md: '',
      },
    ]);
  const remove = (key: number) => setRows((cur) => cur.filter((r) => r.key !== key));
  const patch = (key: number, next: Partial<DiscountDraft>) =>
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...next } : r)));

  return (
    <details
      className="rounded-xl border"
      style={{ borderColor: line, background: 'var(--m-paper-2)' }}
      open={rows.length > 0}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5">
        <span
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          <Tag aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
          Discounts
          {rows.length > 0 ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              {rows.length}
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
      </summary>
      <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: line }}>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Add as many as you like. Couples are shown the single best discount they
          qualify for. A Limited-Time Promo needs an expiry date.
        </p>

        {rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((r) => (
              <div
                key={r.key}
                className="space-y-2 rounded-lg border p-3"
                style={{ borderColor: line, background: 'var(--m-paper)' }}
              >
                <div className="flex items-center gap-2">
                  <select
                    name="discount_type"
                    value={r.discount_type}
                    onChange={(e) =>
                      patch(r.key, { discount_type: e.target.value as DiscountType | '' })
                    }
                    className="input-field flex-1 cursor-pointer"
                    aria-label="Discount type"
                  >
                    {Object.entries(DISCOUNT_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <RowRemove onClick={() => remove(r.key)} label="Remove discount" />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    name="discount_rate"
                    defaultValue={r.rate}
                    type="number"
                    min={0.01}
                    step="any"
                    placeholder={r.unit === 'pct' ? 'e.g. 10' : 'e.g. 5000'}
                    className="input-field flex-1"
                    aria-label="Discount amount"
                  />
                  {/* Unit toggle — a hidden input carries the value so getAll()
                      stays index-aligned regardless of which button is active. */}
                  <input type="hidden" name="discount_unit" value={r.unit} />
                  <div
                    className="inline-flex overflow-hidden rounded-lg border"
                    style={{ borderColor: line }}
                    role="group"
                    aria-label="Discount unit"
                  >
                    {(['pct', 'php'] as const).map((u) => {
                      const on = r.unit === u;
                      return (
                        <button
                          key={u}
                          type="button"
                          onClick={() => patch(r.key, { unit: u })}
                          aria-pressed={on}
                          className="px-3 py-2 text-xs font-medium"
                          style={{
                            background: on ? 'var(--m-ink)' : 'var(--m-paper-2)',
                            color: on ? 'var(--m-paper)' : 'var(--m-slate-2)',
                          }}
                        >
                          {u === 'pct' ? '%' : '₱'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="block text-[11px] font-medium" style={{ color: 'var(--m-slate)' }}>
                      Expiry {r.discount_type === 'promo' ? '(required)' : '(optional)'}
                    </span>
                    <input
                      name="discount_expires_at"
                      defaultValue={r.expires_at}
                      type="date"
                      className="input-field"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="block text-[11px] font-medium" style={{ color: 'var(--m-slate)' }}>
                      Conditions (optional)
                    </span>
                    <input
                      name="discount_conditions_md"
                      defaultValue={r.conditions_md}
                      maxLength={1000}
                      placeholder="e.g. Book ≥ 6 months ahead"
                      className="input-field"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Anchor rows so getAll() sees zero entries → a clean replace-all-clear.
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            No discounts yet.
          </p>
        )}

        <AddRowButton onClick={add}>Add discount</AddRowButton>
      </div>
    </details>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 3 · PriceBracketsEditor — Fixed-basis pax tiers (one open row = a flat price)
// ════════════════════════════════════════════════════════════════════════════
export type BracketDraft = { min_pax: string; max_pax: string; price: string };
type BracketRow = BracketDraft & { key: number };

export function PriceBracketsEditor({ initial }: { initial: BracketDraft[] }) {
  const nextKey = useRef(initial.length);
  const [rows, setRows] = useState<BracketRow[]>(
    initial.map((r, i) => ({ key: i, ...r })),
  );

  const add = () =>
    setRows((cur) => [
      ...cur,
      { key: nextKey.current++, min_pax: '', max_pax: '', price: '' },
    ]);
  const remove = (key: number) => setRows((cur) => cur.filter((r) => r.key !== key));

  return (
    <details
      className="rounded-xl border"
      style={{ borderColor: line, background: 'var(--m-paper-2)' }}
      open={rows.length > 0}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2.5">
        <span
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          <Layers aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate)' }} />
          Price by guest count
          {rows.length > 0 ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              {rows.length}
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
      </summary>
      <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: line }}>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Optional. Set a locked price per venue-size band — one row with a blank
          &ldquo;up to&rdquo; is a single flat price. Your card&rsquo;s
          &ldquo;from ₱X&rdquo; shows the lowest bracket. Leave empty to use the
          Starting price above.
        </p>

        {rows.length > 0 ? (
          <div className="space-y-2">
            {/* Header row for clarity on the three number fields. */}
            <div
              className="hidden gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.1em] sm:flex"
              style={{ color: 'var(--m-slate-3)' }}
            >
              <span className="flex-1">From guests</span>
              <span className="flex-1">Up to guests</span>
              <span className="flex-1">Price (₱)</span>
              <span className="w-9" />
            </div>
            {rows.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <input
                  name="bracket_min_pax"
                  defaultValue={r.min_pax}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="from"
                  className="input-field flex-1"
                  aria-label="From guests"
                />
                <input
                  name="bracket_max_pax"
                  defaultValue={r.max_pax}
                  type="number"
                  min={1}
                  step={1}
                  placeholder="any"
                  className="input-field flex-1"
                  aria-label="Up to guests"
                />
                <input
                  name="bracket_price"
                  defaultValue={r.price}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="₱"
                  className="input-field flex-1"
                  aria-label="Bracket price"
                />
                <RowRemove onClick={() => remove(r.key)} label="Remove bracket" />
              </div>
            ))}
          </div>
        ) : null}

        <AddRowButton onClick={add}>Add price bracket</AddRowButton>
      </div>
    </details>
  );
}
