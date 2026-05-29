'use client';

/**
 * VoucherForm — shared create + edit form for /admin/discount-codes.
 *
 * WHY · Day 1.5 corrective refactor of PR #594 per CLAUDE.md 2026-05-29
 *       Day 1.5 row. Owner refined the voucher spec AFTER Day 1 shipped:
 *       drop amount_off in favor of pct_off_capped (percentage off up to
 *       a fiat cap). Schema now uses pct_value INT + cap_centavos BIGINT
 *       in place of the generic discount_value column.
 *
 *       Single component services both /new (create) + /[id]/edit (update)
 *       so the form shape stays in lock-step. Client component because the
 *       cap row conditionally renders only when type === 'pct_off_capped'.
 *
 * Field contract (mirrors apps/web/app/admin/discount-codes/actions.ts):
 *   • code              — 8 A-Z 0-9 chars · auto-uppercase on blur · readOnly on edit
 *   • discount_type     — radio: pct_off | pct_off_capped | free
 *   • discount_pct      — number 1-100 (shown for pct_off + pct_off_capped)
 *   • cap_pesos         — number (shown ONLY when pct_off_capped)
 *   • expires_at        — datetime-local · REQUIRED
 *   • max_uses          — number · optional (blank = unlimited)
 *   • covered_services  — multi-checkbox of service_catalog.sku_code rows
 *
 * Brand voice on every error + helper line per [[feedback_setnayan_no_dev_text_post_launch]].
 */

import { useState } from 'react';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';

type ServiceOption = {
  sku_code: string;
  display_name: string;
  category: string;
  price_centavos: number;
};

type DiscountType = 'pct_off' | 'pct_off_capped' | 'free';

export type VoucherFormInitial = {
  discount_code_id: string | null; // null = create mode
  code: string;
  discount_type: DiscountType;
  /** Integer 1-100 for pct_off + pct_off_capped, null for free. */
  pct_value: number | null;
  /** Centavos (NOT pesos) cap, NOT NULL only for pct_off_capped. */
  cap_centavos: number | null;
  covered_service_keys: string[];
  expires_at: string | null; // ISO string OR null
  max_uses: number | null;
};

type Props = {
  initial: VoucherFormInitial;
  services: ServiceOption[];
  action: (formData: FormData) => Promise<void>;
  /** Render label on the submit button (Create vs Save). */
  submitLabel: string;
  /** Pending-state label on the submit button. */
  submitPendingLabel: string;
};

/**
 * Format a centavos integer back to pesos for the cap input default value
 * (server round-trips through Math.round(parseFloat(input) * 100) on save).
 */
function centavosToPesos(c: number): string {
  return (c / 100).toFixed(2);
}

/**
 * Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` shape that the
 * <input type="datetime-local"> control accepts. Renders the user's
 * LOCAL time (browser interprets ISO via Date and then we drop the TZ).
 */
function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

export function VoucherForm({
  initial,
  services,
  action,
  submitLabel,
  submitPendingLabel,
}: Props) {
  const isEdit = initial.discount_code_id !== null;
  const [discountType, setDiscountType] = useState<DiscountType>(
    initial.discount_type,
  );

  // Pre-fill the value fields based on initial.discount_type.
  // pct_value is integer · cap_centavos round-trips through pesos display.
  const initialPct =
    initial.pct_value !== null ? String(initial.pct_value) : '';
  const initialCapPesos =
    initial.cap_centavos !== null ? centavosToPesos(initial.cap_centavos) : '';

  const initialExpiresAt = initial.expires_at
    ? isoToDatetimeLocal(initial.expires_at)
    : '';

  // Group services by category so the multi-checkbox renders as compact
  // category-grouped sub-lists. Easier for an admin to find "all Papic
  // SKUs" or "Photography services" without scanning the full list.
  const grouped = services.reduce<Map<string, ServiceOption[]>>((acc, s) => {
    const arr = acc.get(s.category) ?? [];
    arr.push(s);
    acc.set(s.category, arr);
    return acc;
  }, new Map());

  // pct input is shown for both pct_off and pct_off_capped (it's the same
  // underlying field per the locked schema). The cap input ONLY appears
  // for pct_off_capped.
  const showPctInput =
    discountType === 'pct_off' || discountType === 'pct_off_capped';
  const showCapInput = discountType === 'pct_off_capped';

  return (
    <form action={action} className="space-y-6">
      {isEdit && (
        <input
          type="hidden"
          name="discount_code_id"
          value={initial.discount_code_id ?? ''}
        />
      )}

      {/* Code · 8 A-Z 0-9 · uppercase on blur · readOnly on edit */}
      <div>
        <label
          htmlFor="code"
          className="block text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          Code
        </label>
        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--m-slate)' }}
        >
          {isEdit
            ? "Codes can't be renamed — disabling the old one and creating a fresh code is the safer path for historical audit."
            : 'Eight characters · letters and numbers only · we uppercase on save so people can type either case.'}
        </p>
        <input
          type="text"
          id="code"
          name="code"
          defaultValue={initial.code}
          readOnly={isEdit}
          required={!isEdit}
          maxLength={8}
          pattern="[A-Za-z0-9]{8}"
          autoCapitalize="characters"
          spellCheck={false}
          className="mt-2 block w-full rounded-md border px-3 py-2 font-mono text-sm uppercase tracking-wider"
          style={{
            background: isEdit ? 'var(--m-paper-2)' : 'var(--m-paper)',
            borderColor: 'var(--m-line)',
            color: 'var(--m-ink)',
          }}
          onBlur={(e) => {
            e.target.value = e.target.value.trim().toUpperCase();
          }}
        />
      </div>

      {/* Discount type · radio · controls the conditional value field */}
      <div>
        <span
          className="block text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          What kind of discount?
        </span>
        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--m-slate)' }}
        >
          Percentage off scales by percentage · Percentage off (capped) tops
          out at a peso ceiling · Free makes covered services 100% off.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {(
            [
              { v: 'pct_off' as const, label: 'Percentage off' },
              { v: 'pct_off_capped' as const, label: 'Percentage off (capped)' },
              { v: 'free' as const, label: 'Free (100% off)' },
            ] satisfies { v: DiscountType; label: string }[]
          ).map((opt) => (
            <label
              key={opt.v}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                background:
                  discountType === opt.v ? 'var(--m-blush)' : 'var(--m-paper)',
                borderColor:
                  discountType === opt.v ? 'var(--m-orange-2)' : 'var(--m-line)',
                color:
                  discountType === opt.v ? 'var(--m-orange-2)' : 'var(--m-slate)',
              }}
            >
              <input
                type="radio"
                name="discount_type"
                value={opt.v}
                checked={discountType === opt.v}
                onChange={() => setDiscountType(opt.v)}
                className="accent-current"
                required
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Percentage · shown for pct_off + pct_off_capped */}
      {showPctInput && (
        <div>
          <label
            htmlFor="discount_pct"
            className="block text-sm font-medium"
            style={{ color: 'var(--m-ink)' }}
          >
            Percentage off (1-100)
          </label>
          <input
            type="number"
            id="discount_pct"
            name="discount_pct"
            min="1"
            max="100"
            step="1"
            defaultValue={initialPct}
            required
            className="mt-2 block w-full max-w-xs rounded-md border px-3 py-2"
            style={{
              background: 'var(--m-paper)',
              borderColor: 'var(--m-line)',
              color: 'var(--m-ink)',
            }}
          />
        </div>
      )}

      {/* Cap · shown ONLY for pct_off_capped */}
      {showCapInput && (
        <div>
          <label
            htmlFor="cap_pesos"
            className="block text-sm font-medium"
            style={{ color: 'var(--m-ink)' }}
          >
            Maximum discount (₱)
          </label>
          <p
            className="mt-1 text-xs"
            style={{ color: 'var(--m-slate)' }}
          >
            The percentage tops out at this peso amount · e.g. a 50% off code
            with a ₱500 cap on a ₱2,000 service still takes only ₱500 off
            (not ₱1,000).
          </p>
          <input
            type="number"
            id="cap_pesos"
            name="cap_pesos"
            min="0.01"
            step="0.01"
            defaultValue={initialCapPesos}
            required
            className="mt-2 block w-full max-w-xs rounded-md border px-3 py-2"
            style={{
              background: 'var(--m-paper)',
              borderColor: 'var(--m-line)',
              color: 'var(--m-ink)',
            }}
          />
        </div>
      )}

      {discountType === 'free' && (
        <p
          className="rounded-md border px-3 py-2 text-sm"
          style={{
            background: 'var(--m-paper-2)',
            borderColor: 'var(--m-line)',
            color: 'var(--m-slate)',
          }}
        >
          Free codes make every covered service 100% off · no value needed.
        </p>
      )}

      {/* Expires at · REQUIRED */}
      <div>
        <label
          htmlFor="expires_at"
          className="block text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          Effective until
        </label>
        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--m-slate)' }}
        >
          The code stops working at this moment · pick a date and time in
          Philippine local time.
        </p>
        <input
          type="datetime-local"
          id="expires_at"
          name="expires_at"
          defaultValue={initialExpiresAt}
          required
          className="mt-2 block w-full max-w-xs rounded-md border px-3 py-2"
          style={{
            background: 'var(--m-paper)',
            borderColor: 'var(--m-line)',
            color: 'var(--m-ink)',
          }}
        />
      </div>

      {/* Max uses · optional */}
      <div>
        <label
          htmlFor="max_uses"
          className="block text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          Max uses (optional)
        </label>
        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--m-slate)' }}
        >
          Leave blank for unlimited within the effective window · set a number
          if you want the code to retire after that many redemptions.
        </p>
        <input
          type="number"
          id="max_uses"
          name="max_uses"
          min="1"
          step="1"
          defaultValue={initial.max_uses ?? ''}
          className="mt-2 block w-full max-w-xs rounded-md border px-3 py-2"
          style={{
            background: 'var(--m-paper)',
            borderColor: 'var(--m-line)',
            color: 'var(--m-ink)',
          }}
        />
      </div>

      {/* Covered services · multi-checkbox grouped by category */}
      <div>
        <span
          className="block text-sm font-medium"
          style={{ color: 'var(--m-ink)' }}
        >
          Which services does this code cover?
        </span>
        <p
          className="mt-1 text-xs"
          style={{ color: 'var(--m-slate)' }}
        >
          At least one. Couples can only apply the voucher when at least one
          item in their cart is a covered service.
        </p>
        <div
          className="mt-3 space-y-4 rounded-md border p-4"
          style={{
            background: 'var(--m-paper)',
            borderColor: 'var(--m-line)',
          }}
        >
          {grouped.size === 0 ? (
            <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
              No active services in the catalog right now.
            </p>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <fieldset key={category}>
                <legend
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--m-orange-2)' }}
                >
                  {category}
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => {
                    const isChecked = initial.covered_service_keys.includes(
                      s.sku_code,
                    );
                    return (
                      <label
                        key={s.sku_code}
                        className="flex cursor-pointer items-start gap-2 text-sm"
                        style={{ color: 'var(--m-slate)' }}
                      >
                        <input
                          type="checkbox"
                          name="covered_services"
                          value={s.sku_code}
                          defaultChecked={isChecked}
                          className="mt-0.5 accent-[var(--m-orange-2)]"
                        />
                        <span className="leading-tight">
                          <span style={{ color: 'var(--m-ink)' }}>
                            {s.display_name}
                          </span>
                          <span
                            className="ml-1 font-mono text-xs"
                            style={{ color: 'var(--m-slate)' }}
                          >
                            ({s.sku_code})
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <SubmitButton pendingLabel={submitPendingLabel}>
          {submitLabel}
        </SubmitButton>
        <Link
          href="/admin/discount-codes"
          className="text-sm underline-offset-2 hover:underline"
          style={{ color: 'var(--m-slate)' }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
