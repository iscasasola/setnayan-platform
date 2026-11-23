'use client';

import { useActionState, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import type { RowActionState } from '@/app/admin/pricing/actions';
import {
  PAPIC_DISCOUNT_FLOOR_PCT,
  discountComplaints,
  previewFamilySave,
} from '@/lib/onboarding-family-discount';
import { ActionButton } from '@/components/action-button';
import { TEMPLATE_SUBLINE, TemplateSection } from '@/app/_components/template-rows';

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

  // 📐 Admin clean port (owner 19 Nov 2026): the gold-barred card became ONE row of the design template — the line,
  // the % field and Save — with its warnings and the before → after list under it, inside the same frame.
  return (
    <TemplateSection label="Sign-up discount" first data="signup-discount">
      <form action={formAction} className="sn-frame sn-frame-flush px-4" data-signup-discount="">
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
          <b className="min-w-0 flex-1 text-[15px] font-semibold leading-tight text-ink">Off everything bought during sign-up</b>
          <span className="flex flex-none items-center gap-2">
            <label className="relative block">
              <span className="sr-only">Sign-up discount</span>
              <input
                name="discount_pct"
                type="number"
                step="0.01"
                min={PAPIC_DISCOUNT_FLOOR_PCT}
                max="99.99"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                className="input-field w-24 pr-7 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink/50">
                %
              </span>
            </label>
            <ActionButton tone="brand" type="submit" icon={<Save aria-hidden strokeWidth={1.9} />} label="Save" />
          </span>
        </div>

        {complaints.map((c) => (
          <p
            key={c.kind}
            className="pb-2 text-[13px] font-semibold"
            style={{ color: c.kind === 'not_a_discount' ? 'rgb(var(--color-warn))' : 'rgb(var(--color-danger))' }}
          >
            {c.message}
          </p>
        ))}

        {moving.length > 0 && (
          <div className="border-t border-[color:var(--sn-divider)] py-2.5">
            <p className="flex items-center gap-2 text-[13px] font-bold" style={{ color: 'rgb(var(--color-danger))' }}>
              <AlertTriangle className="h-4 w-4" strokeWidth={2} aria-hidden />
              Saving this changes {moving.length} sign-up price{moving.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] text-ink/75 sm:grid-cols-2">
              {moving.map((p) => (
                <li key={p.serviceCode} className="tabular-nums">
                  <span className="font-semibold">{p.title}</span>{' '}
                  <span>{p.currentSignupPhp == null ? 'none' : peso(p.currentSignupPhp)}</span>{' '}
                  →{' '}
                  <span className="font-bold" style={{ color: 'rgb(var(--color-danger))' }}>
                    {p.nextSignupPhp == null ? 'none' : peso(p.nextSignupPhp)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.message && (
          <p className={`pb-2.5 ${TEMPLATE_SUBLINE}`} style={{ color: state.ok ? 'rgb(var(--color-ok))' : 'rgb(var(--color-danger))' }}>
            {state.message}
          </p>
        )}
      </form>
    </TemplateSection>
  );
}
