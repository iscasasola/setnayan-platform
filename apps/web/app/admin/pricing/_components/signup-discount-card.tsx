'use client';

import { useActionState, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import {
  PAPIC_DISCOUNT_FLOOR_PCT,
  discountComplaints,
  previewFamilySave,
} from '@/lib/onboarding-family-discount';

const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`;

/**
 * THE one sign-up discount (owner tracker d18, 2026-10-02: *"40% off everything
 * bought during sign-up"*, one admin-set number). It replaces the two per-family
 * boxes that sat on the Papic and Setnayan AI tabs.
 *
 * ⚠ ONE BOX, MANY PRICES. Nudging it re-derives every stored sign-up price
 * (Papic rungs + Setnayan AI bands); the before → after of each row that would
 * move is shown BEFORE the save, and the action reports how many actually moved.
 */
export function SignupDiscountCard({
  discountPct,
  rows,
  action,
}: {
  discountPct: number;
  rows: { serviceCode: string; title: string; regularPhp: number; signupPhp: number | null }[];
  action: (prev: RowActionState, fd: FormData) => Promise<RowActionState>;
}) {
  const [state, formAction] = useActionState<RowActionState, FormData>(action, {
    ok: false,
    message: null,
  });
  const [pct, setPct] = useState(String(discountPct));

  const n = Number(pct);
  const usable = pct.trim() !== '' && Number.isFinite(n);
  const complaints = usable ? discountComplaints('papic', n) : [];
  const blocked = complaints.some((c) => c.kind === 'out_of_range');
  const preview = usable && !blocked ? previewFamilySave(rows, n) : [];
  const moving = preview.filter((p) => p.moves);

  return (
    <form
      action={formAction}
      className="mb-6 rounded-r-2xl border border-l-[3px] border-ink/10 border-l-gold bg-ink/[0.02] p-4"
      data-signup-discount=""
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="min-w-0 flex-1 text-[15px] font-bold">Off everything bought during sign-up</h2>
        <label className="block shrink-0 text-right">
          <span className="mb-1.5 block font-mono text-[9.5px] uppercase tracking-[0.15em] text-ink/55">
            Sign-up discount
          </span>
          <div className="relative">
            <input
              name="discount_pct"
              type="number"
              step="0.01"
              min={PAPIC_DISCOUNT_FLOOR_PCT}
              max="99.99"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="input-field w-28 pr-7 text-right font-mono tabular-nums"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
              %
            </span>
          </div>
        </label>
      </div>

      {complaints.map((c) => (
        <p
          key={c.kind}
          className={`mt-2.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${
            c.kind === 'not_a_discount'
              ? 'border border-gold/40 bg-gold/[0.10] text-gold-deep'
              : 'border border-danger-700/30 bg-danger-700/[0.06] text-danger-700'
          }`}
        >
          {c.message}
        </p>
      ))}

      {moving.length > 0 && (
        <div className="mt-3 rounded-xl border border-danger-700/30 bg-danger-700/[0.05] p-3">
          <p className="flex items-center gap-2 text-[13px] font-bold text-danger-700">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saving this changes {moving.length} sign-up price{moving.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] text-ink/75 sm:grid-cols-2">
            {moving.map((p) => (
              <li key={p.serviceCode} className="tabular-nums">
                <span className="font-semibold">{p.title}</span>{' '}
                <span className="font-mono">
                  {p.currentSignupPhp == null ? 'none' : peso(p.currentSignupPhp)}
                </span>{' '}
                →{' '}
                <span className="font-mono font-bold text-danger-700">
                  {p.nextSignupPhp == null ? 'none' : peso(p.nextSignupPhp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="rounded-md bg-terracotta-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-terracotta-800"
        >
          Save
        </button>
        {state.message && (
          <span className={`text-xs ${state.ok ? 'text-success-800' : 'text-danger-700'}`}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
