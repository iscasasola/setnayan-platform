'use client';

import { useRef, useState } from 'react';
import { CreditCard, X } from 'lucide-react';

import {
  InlineCheckoutDrawer,
  type InlineCheckoutDrawerProps,
} from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { useModalA11y } from '@/lib/use-modal-a11y';

// Client-side "Choose plan" sheet rendered as the App Store-style GET button.
// On mobile it slides up from the bottom (single-thumb reach); on desktop
// the same sheet docks as a right-side drawer.
//
// 2026-05-29 Day 2 inline-checkout sprint (CLAUDE.md V1 SCOPE EXPANSION) ·
// Replaces the per-plan "Add to event" link to /dashboard/[eventId]/orders/new
// with the new <InlineCheckoutDrawer> that lands a one-page checkout
// experience (voucher + QR + screenshot + submit) without leaving the
// detail page. Each plan row now renders its own <InlineCheckoutDrawer>
// trigger pre-bound to that SKU's code + price + display name. The legacy
// /orders/new path is retired (redirect to /add-ons) per the same sprint.
//
// Backward-compat: pages that previously passed only the formatted `price`
// string keep working because the drawer falls back to a free price (0
// centavos) when `priceCentavos` is absent. Pages that want full checkout
// must thread `priceCentavos` through the plan rows (see panood/page.tsx).

export type ChoosePlanSku = {
  sku_code: string;
  name: string;
  scope: string;
  price: string;
  unit: string;
  badge?: string;
  /**
   * Integer centavos for the inline checkout drawer. String-encoded so
   * the React props tree stays BigInt-free (post-ES2020 type). Optional
   * for backward-compat; when missing, the drawer treats the plan as ₱0
   * which is fine for the launch-promo SKUs but should be set explicitly
   * for paid plans so the discount math has a base.
   */
  priceCentavos?: string;
};

export type ChoosePlanSheetProps = {
  eventId: string;
  triggerLabel: string;
  // e.g. "From ₱499 / day"
  priceFromLabel?: string;
  plans: ChoosePlanSku[];
  // Shown above the plan list. e.g. "Pick the plan that matches your event day."
  introCopy?: string;
  // Optional footnote rendered below the plan list. Stays in-sheet,
  // useful for refund policy or capacity hints.
  footnote?: string;
  /**
   * Optional PROMINENT notice, rendered above the plan list in a bordered block —
   * for a fact the buyer must read BEFORE paying, as opposed to `footnote`, which is
   * 11px muted fine print suited to policy detail.
   *
   * Added for Live Studio's lead-time warning (an unlock bought the night before a
   * wedding may not clear manual payment reconciliation in time). Additive and
   * optional, so every existing caller renders byte-for-byte as before.
   */
  notice?: string | readonly string[];
  /**
   * ✅ THE PRE-PURCHASE TICK BOX — omit it and there is no gate at all.
   *
   * Present ONLY while the buyer has never accepted. Once accepted (persisted on
   * `users`, not on the event or the order), the parent stops passing this and the
   * box never appears again — for this purchase, for the next one, and for their
   * next celebration. Owner ruling 2026-09-02.
   *
   * 🔒 AFFIRMATIVE, LIKE EVERY OTHER BOX IN THIS APP. It starts UNTICKED and the
   * person ticks it themselves. There is no hidden field and no pre-selection —
   * the rule `app/signup/consent-is-affirmative.test.ts` exists to enforce, after a
   * door was found posting `<input type="hidden" … value="yes" />` and opting every
   * couple in silently.
   *
   * ⚠ IT GATES THE CHECKOUT, NOT THE SHEET. The buyer may read the plans and the
   * prices; what is withheld is the "Add to event" button. A gate on the whole sheet
   * would hide the very information the notice is asking them to act on.
   */
  acknowledgement?: {
    /** The sentence beside the box. A first-person claim the buyer is making. */
    label: string;
    /** Persists the tick. Called with `true` on tick and `false` on untick. */
    onChange: (accepted: boolean) => Promise<void>;
  };
  /**
   * Pre-fetched platform settings (BDO + GCash) that every plan's
   * checkout drawer renders. Optional — when omitted the drawer falls
   * back to a "Bank account details will follow" message so the
   * page still works on dev/preview without env-bound settings.
   */
  settings?: InlineCheckoutDrawerProps['settings'];
};

const EMPTY_SETTINGS: InlineCheckoutDrawerProps['settings'] = {
  bdo_account_name: null,
  bdo_account_number: null,
  bdo_qr_url: null,
  gcash_account_name: null,
  gcash_number: null,
  gcash_qr_url: null,
};

export function ChoosePlanSheet({
  eventId,
  triggerLabel,
  priceFromLabel,
  plans,
  introCopy,
  footnote,
  notice,
  acknowledgement,
  settings,
}: ChoosePlanSheetProps) {
  const [open, setOpen] = useState(false);
  /**
   * Starts false ALWAYS — never seeded from a prop. A parent that wanted to
   * pre-tick this would have to stop passing `acknowledgement` entirely, which is
   * exactly the honest way to express "already accepted".
   */
  const [accepted, setAccepted] = useState(false);
  /** Withhold checkout while an unaccepted acknowledgement is on screen. */
  const checkoutLocked = !!acknowledgement && !accepted;
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
      >
        <CreditCard aria-hidden className="h-4 w-4" strokeWidth={2} />
        {triggerLabel}
        {priceFromLabel ? (
          <span className="font-mono text-xs font-normal opacity-90">
            · {priceFromLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="choose-plan-title"
          className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center sm:items-center sm:justify-end focus:outline-none"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close plan picker"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          {/* Sheet */}
          <div className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border border-ink/10 bg-cream shadow-xl sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-l-3xl sm:rounded-tr-none">
            <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
              <div className="space-y-0.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                  Choose your plan
                </p>
                <h2 id="choose-plan-title" className="text-lg font-semibold tracking-tight">
                  Pick what fits your event
                </h2>
                {introCopy ? (
                  <p className="max-w-xs text-xs text-ink/60">{introCopy}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-ink/55 hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </header>

            {/* PROMINENT, above the plans: a fact that changes whether the buyer
                should pay TODAY belongs before the price, not in the fine print
                under it. `role="note"` rather than `alert` — it is important, not
                an error, and it is present on first render for everyone. */}
            {notice ? (
              <div
                role="note"
                className="mx-5 mt-4 space-y-2 rounded-xl border border-terracotta/30 bg-terracotta/[0.06] px-3.5 py-3 text-xs leading-relaxed text-ink/80"
              >
                {(typeof notice === 'string' ? [notice] : notice).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : null}

            {/* The tick box sits directly UNDER the notice it refers to and ABOVE
                the plans it gates, so the claim and the thing being claimed are
                never separated by a price. */}
            {acknowledgement ? (
              <label id="choose-plan-ack" className="mx-5 mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ink/15 bg-cream/60 px-3.5 py-3 text-xs leading-relaxed text-ink/85">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAccepted(next);
                    // Fire-and-forget: the gate has already opened locally, and a
                    // failed write only means the buyer is asked once more next
                    // time — never that a paid-for purchase is blocked.
                    void acknowledgement.onChange(next).catch(() => {});
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-mulberry"
                />
                <span>{acknowledgement.label}</span>
              </label>
            ) : null}


            <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto pb-[max(0px,env(safe-area-inset-bottom))]">
              {plans.map((plan) => (
                <li key={plan.sku_code} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        {plan.name}
                        {plan.badge ? (
                          <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta">
                            {plan.badge}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink/60">{plan.scope}</p>
                    </div>
                    <p className="font-mono text-sm text-ink/85">
                      {plan.price}
                      <span className="text-xs text-ink/55">{plan.unit}</span>
                    </p>
                  </div>
                  {/*
                    2026-05-29 Day 2 inline-checkout · Each plan opens its own
                    drawer pre-bound to that SKU. priceCentavos defaults to "0"
                    when the parent page hasn't threaded it through yet — fine
                    for free SKUs, but the drawer's voucher math expects a
                    real centavos value so paid plans should explicitly pass.
                    Pages using ChoosePlanSheet must thread settings + per-plan
                    priceCentavos for full checkout to work.
                  */}
                  {checkoutLocked ? (
                    <button
                      type="button"
                      disabled
                      aria-describedby="choose-plan-ack"
                      className="inline-flex w-fit cursor-not-allowed items-center gap-1.5 rounded-full border border-ink/15 bg-ink/[0.04] px-4 py-1.5 text-xs font-semibold text-ink/45"
                    >
                      Tick the box above to continue
                    </button>
                  ) : (
                    <InlineCheckoutDrawer
                      eventId={eventId}
                      serviceKey={plan.sku_code}
                      displayName={plan.name}
                      originalPriceCentavos={plan.priceCentavos ?? '0'}
                      settings={settings ?? EMPTY_SETTINGS}
                      triggerLabel="Add to event"
                      triggerClassName="inline-flex w-fit items-center gap-1.5 rounded-full bg-mulberry px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-600"
                    />
                  )}
                </li>
              ))}
            </ul>

            {footnote ? (
              <footer className="border-t border-ink/10 px-5 py-3 text-[11px] text-ink/55">
                {footnote}
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
