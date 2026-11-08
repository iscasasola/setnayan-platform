'use client';

import { Check, Info, Loader2 } from 'lucide-react';

import { ITS_MY_BUSINESS_LABEL, SHOP_NAME_HELD_MESSAGE } from '@/lib/shop-name-hold';

/**
 * The refusal for a held shop name, with its way out (owner 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE").
 *
 * ONE card for both doors — the open-shop wizard (step 1) and the My Shop rename — so the sentence a vendor reads
 * and the button they press are the same wherever the name is refused.
 *
 * 🔑 NEVER A DEAD END. The refusal always carries "It's my business", which files the name to the admin queue
 * (`vendor_correction_requests` → /admin/corrections) — the same shape as the owner's "It's my number" ruling. Once
 * pressed it turns into its sent state and offers nothing twice.
 *
 * 🔒 It says the name is held and nothing about WHY: the person typing must not learn that another shop was closed,
 * banned or suspended. The copy lives in `lib/shop-name-hold.ts`, held by `lib/shop-name-hold.test.ts`.
 */
export function HeldShopNameCard({
  sent,
  pending = false,
  sentText,
  error = null,
  onClaim,
}: {
  /** The request is filed (or, in the wizard, queued to go with the shop). */
  sent: boolean;
  pending?: boolean;
  /** What the sent state says — the wizard and My Shop differ in WHEN the request reaches the team. */
  sentText: string;
  /** A filing that failed, said where the button is. */
  error?: string | null;
  onClaim: () => void;
}) {
  return (
    <span
      className="block space-y-2 rounded-lg px-3 py-2.5 text-xs"
      style={{ background: 'var(--m-orange-4)', color: 'var(--m-ink)' }}
      role="status"
      aria-live="polite"
      data-held-shop-name={sent ? 'sent' : 'refused'}
    >
      <span className="flex items-start gap-1.5">
        <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange-deep)' }} />
        <span>{SHOP_NAME_HELD_MESSAGE}</span>
      </span>
      {sent ? (
        <span className="flex items-start gap-1.5 font-medium" style={{ color: 'var(--m-sage-deep)' }}>
          <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          <span>{sentText}</span>
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClaim}
            disabled={pending}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-60"
            style={{ borderColor: 'var(--m-orange-deep)', color: 'var(--m-orange-deep)', background: '#fff' }}
          >
            {pending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : null}
            {ITS_MY_BUSINESS_LABEL}
          </button>
          {error ? <span style={{ color: 'var(--m-orange-deep)' }}>{error}</span> : null}
        </span>
      )}
    </span>
  );
}
