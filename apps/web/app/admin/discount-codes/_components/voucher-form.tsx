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
import { ChosenRow, FormRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { TemplateSection } from '@/app/_components/template-rows';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { actionButtonClass } from '@/components/action-button-class';

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
  effective_from: string | null; // ISO string OR null (null = effective immediately)
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
  /**
   * A8·A-9: true when any catalogue read was refused. The list is then partial, so the form says so and holds the
   * save back: saving would drop every covered service that failed to load.
   */
  catalogFailed?: boolean;
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
  catalogFailed = false,
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

  // Controlled state for pct + cap inputs so the per-service live preview
  // below recomputes when admin types. Form still submits via FormData;
  // controlled inputs work fine with native form submission.
  const [pctValueStr, setPctValueStr] = useState<string>(initialPct);
  const [capPesosStr, setCapPesosStr] = useState<string>(initialCapPesos);
  // The code, as kept in its Form row (create only — on edit it is fixed).
  const [codeStr, setCodeStr] = useState<string>(initial.code);


  const initialExpiresAt = initial.expires_at
    ? isoToDatetimeLocal(initial.expires_at)
    : '';
  const initialEffectiveFrom = initial.effective_from
    ? isoToDatetimeLocal(initial.effective_from)
    : '';

  // Live preview: given a sticker price + current form state, return the
  // discounted price as centavos. Returns null if discount values aren't
  // filled in yet (just show sticker price · no strikethrough).
  // Mirrors `apps/web/lib/vouchers/calculate.ts` semantics — kept inline
  // here as a small UI-only helper that operates on plain numbers (admin
  // form inputs · safe for the magnitudes involved).
  function previewDiscountedCentavos(
    originalCentavos: number,
    type: DiscountType,
    pct: string,
    capPesos: string,
  ): number | null {
    if (type === 'free') {
      return 0;
    }
    const pctNum = Number(pct);
    if (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum > 100) return null;

    if (type === 'pct_off') {
      return Math.round((originalCentavos * (100 - pctNum)) / 100);
    }

    if (type === 'pct_off_capped') {
      const capNum = Number(capPesos);
      if (!Number.isFinite(capNum) || capNum <= 0) return null;
      const rawDiscount = (originalCentavos * pctNum) / 100;
      const capCentavos = Math.round(capNum * 100);
      const discount = Math.min(rawDiscount, capCentavos);
      return Math.round(originalCentavos - discount);
    }

    return null;
  }

  function formatPeso(centavos: number): string {
    return (centavos / 100).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

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
  // for pct_off_capped. Covered services now ALWAYS show — the only voucher
  // type that hid them was the vendor token grant, retired 2026-08-18.
  const showPctInput =
    discountType === 'pct_off' || discountType === 'pct_off_capped';
  const showCapInput = discountType === 'pct_off_capped';
  const showCoveredServices = true;

  // The discount kinds — ONE dropdown (a set of choices is a dropdown), posting `discount_type` exactly as the radios did.
  const typeOptions = (
    [
      { v: 'pct_off' as const, label: 'Percentage off' },
      { v: 'pct_off_capped' as const, label: 'Percentage off (capped)' },
      // 'grant_tokens' was REMOVED here 2026-08-07 with the token
      // retirement. It minted a currency with no redeem surface at all
      // — `redeem_vendor_token_voucher` has zero callers in the app, so
      // every voucher of that type was unredeemable from the hour it
      // was created.
      //
      // ⚠ THAT REMOVAL TOOK THE OPTION AND LEFT THE EDITOR. Removing
      // it from this list stopped anyone CREATING one; the fields that
      // EDIT one stayed, and the only voucher in production was a
      // grant_tokens row (TESTGTK1, expired 2026-06-28, never
      // redeemed) — so the retired wallet was the one thing this
      // screen could show. The owner saw it and asked why.
      // 🔑 RETIRING A THING MEANS RETIRING ITS EDITOR TOO. A removed
      // create-option only stops NEW rows; the existing row is what
      // renders. Fifth time this shape has resurfaced.
      // The row was deleted 2026-08-18 and the fields removed with it.
      // The value stays in the DB enum (dropping an enum label is a
      // migration with no caller left to justify it) but nothing in
      // the app can write, edit or display one.
      { v: 'free' as const, label: 'Free (100% off)' },
    ] satisfies { v: DiscountType; label: string }[]
  ).map((opt) => ({ key: opt.v, label: opt.label }));

  const INPUT = 'input-field w-[200px] max-w-full flex-none rounded-full';

  // 📐 ADMIN CLEAN PORT (owner "ok", 19 Nov 2026 — reposition only): each field is a Form row in one frame, every
  // helper sentence moved behind its row's ⓘ, the type radios became one dropdown. Same posted names and values.
  return (
    <form action={action}>
      {isEdit && (
        <input
          type="hidden"
          name="discount_code_id"
          value={initial.discount_code_id ?? ''}
        />
      )}
      <input type="hidden" name="discount_type" value={discountType} />

      <div className={`${ADMIN_FRAME} px-4 py-1`}>
        <FormRows width="wide">
          {/* Code · 8 A-Z 0-9 · uppercase on keep · fixed on edit (still posted, as the read-only box did) */}
          {isEdit ? (
            <FormRow
              name="Code"
              about={{ words: "Codes can't be renamed — disabling the old one and creating a fresh code is the safer path for historical audit." }}
            >
              <input type="hidden" name="code" value={initial.code} />
              <span className="text-[14px] font-semibold uppercase tracking-[0.06em] text-ink">{initial.code}</span>
            </FormRow>
          ) : (
            <TypedRow
              name="Code"
              about={{ words: 'Eight characters · letters and numbers only · we uppercase on save so people can type either case.' }}
              value={codeStr}
              required
              maxLength={8}
              fieldName="code"
              clean={(t) => t.trim().toUpperCase()}
              check={(t) => (/^[A-Za-z0-9]{8}$/.test(t.trim()) ? null : 'Code must be exactly 8 characters · A-Z and 0-9 only.')}
              onKeep={(t) => setCodeStr(t)}
              data="voucher-code"
            />
          )}

          <ChosenRow
            name="What kind of discount?"
            about={{ words: 'Percentage off scales by percentage · Percentage off (capped) tops out at a peso ceiling · Free makes covered services 100% off.' }}
            value={discountType}
            options={typeOptions}
            onPick={(key) => setDiscountType(key as DiscountType)}
            data="voucher-type"
          />

          {/* Percentage · shown for pct_off + pct_off_capped */}
          {showPctInput && (
            <FormRow name="Percentage off (1-100)">
              <input
                type="number"
                id="discount_pct"
                aria-label="Percentage off (1-100)"
                name="discount_pct"
                min="1"
                max="100"
                step="1"
                value={pctValueStr}
                onChange={(e) => setPctValueStr(e.target.value)}
                required
                className={INPUT}
              />
            </FormRow>
          )}

          {/* Cap · shown ONLY for pct_off_capped */}
          {showCapInput && (
            <FormRow
              name="Maximum discount (₱)"
              about={{ words: 'The percentage tops out at this peso amount · e.g. a 50% off code with a ₱500 cap on a ₱2,000 service still takes only ₱500 off (not ₱1,000).' }}
            >
              <input
                type="number"
                id="cap_pesos"
                aria-label="Maximum discount (₱)"
                name="cap_pesos"
                min="0.01"
                step="0.01"
                value={capPesosStr}
                onChange={(e) => setCapPesosStr(e.target.value)}
                required
                className={INPUT}
              />
            </FormRow>
          )}

          {discountType === 'free' && (
            <p className="border-t border-ink/10 py-3 text-[13px] text-ink/60">
              Free codes make every covered service 100% off · no value needed.
            </p>
          )}

          {/* Expires at · REQUIRED */}
          <FormRow
            name="Effective until"
            about={{ words: 'The code stops working at this moment · pick a date and time in Philippine local time.' }}
          >
            <input
              type="datetime-local"
              id="expires_at"
              aria-label="Effective until"
              name="expires_at"
              defaultValue={initialExpiresAt}
              required
              className={INPUT}
            />
          </FormRow>

          {/* Effective FROM · optional · null = effective immediately. Owner
              request 2026-05-29 for gift-card scheduling use case. */}
          <FormRow
            name="Effective from (optional)"
            about={{ words: 'Leave blank for effective immediately · or schedule the code to activate later (gift-card use case · e.g. birthday on Dec 1). Must be before the effective-until.' }}
          >
            <input
              type="datetime-local"
              id="effective_from"
              aria-label="Effective from (optional)"
              name="effective_from"
              defaultValue={initialEffectiveFrom}
              className={INPUT}
            />
          </FormRow>

          {/* Max uses · optional */}
          <FormRow
            name="Max uses (optional)"
            about={{ words: 'Leave blank for unlimited within the effective window · set a number if you want the code to retire after that many redemptions.' }}
          >
            <input
              type="number"
              id="max_uses"
              aria-label="Max uses (optional)"
              name="max_uses"
              min="1"
              step="1"
              defaultValue={initial.max_uses ?? ''}
              className={INPUT}
            />
          </FormRow>
        </FormRows>
      </div>

      {/* Covered services · multi-checkbox grouped by category. Always shown
          since 2026-08-18 — the only type that hid it is retired. */}
      {showCoveredServices && (
      <TemplateSection
        label="Which services does this code cover?"
        tip="At least one. Couples can only apply the voucher when at least one item in their cart is a covered service."
        data="voucher-services"
      >
        <div className={`${ADMIN_FRAME} space-y-4 p-4`}>
          {catalogFailed ? (
            <p role="alert" className="rounded-lg bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
              Couldn’t read the whole catalogue, so this list may be missing services. Saving is off until it loads.
            </p>
          ) : null}
          {grouped.size === 0 && catalogFailed ? null : grouped.size === 0 ? (
            <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
              No active services in the catalog right now.
            </p>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <fieldset key={category}>
                <legend className="text-[13px] font-semibold text-ink">
                  {category}
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => {
                    const isChecked = initial.covered_service_keys.includes(
                      s.sku_code,
                    );
                    // Live preview: compute discounted centavos if the
                    // current form state has meaningful discount values.
                    // null → just show sticker · admin hasn't filled in
                    // pct (or cap for the capped path) yet.
                    const previewCentavos = previewDiscountedCentavos(
                      s.price_centavos,
                      discountType,
                      pctValueStr,
                      capPesosStr,
                    );
                    const showPreview =
                      previewCentavos !== null &&
                      previewCentavos !== s.price_centavos;
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
                            className="ml-1 text-xs tabular-nums"
                            style={{ color: 'var(--m-slate)' }}
                          >
                            ({s.sku_code})
                          </span>
                          {/* Price + live discount preview · ₱ formatted en-PH */}
                          <span className="mt-0.5 block text-xs tabular-nums">
                            {showPreview ? (
                              <>
                                <span
                                  className="line-through"
                                  style={{ color: 'var(--m-slate)' }}
                                >
                                  ₱{formatPeso(s.price_centavos)}
                                </span>
                                <span
                                  className="ml-2 font-semibold"
                                  style={{ color: 'var(--m-orange-2)' }}
                                >
                                  ₱{formatPeso(previewCentavos!)}
                                </span>
                              </>
                            ) : (
                              <span style={{ color: 'var(--m-slate)' }}>
                                ₱{formatPeso(s.price_centavos)}
                              </span>
                            )}
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
      </TemplateSection>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4">
        <SubmitButton
          className={actionButtonClass('brand', { main: true })}
          pendingLabel={submitPendingLabel}
          disabled={catalogFailed}
        >
          {submitLabel}
        </SubmitButton>
        <Link
          href="/admin/studio?tab=discount-codes"
          className="text-sm underline-offset-2 hover:underline"
          style={{ color: 'var(--m-slate)' }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
