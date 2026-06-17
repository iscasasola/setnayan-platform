'use client';

/**
 * apps/web/app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx
 *
 * The single-page inline checkout drawer that replaces the 2-step
 * /orders/new → /orders/[id] flow for every add-on detail page during
 * pilot.
 *
 * WHY · Day 2 of the 4-day pre-pilot voucher + inline-checkout sprint
 *       (CLAUDE.md 2026-05-29 Day 2 row · V1 SCOPE EXPANSION approved
 *       by owner · pilot 2026-06-01 in 4 days). Owner directive: bundle
 *       voucher apply · BDO + GCash QR display · screenshot upload ·
 *       reference number · submit into one cohesive surface that mounts
 *       on every add-on detail page, replacing the per-detail-page
 *       "Set up / Add" CTAs that previously routed to /orders/new.
 *
 * Mount contract:
 *   • Props provide serviceKey, displayName, originalPriceCentavos (as
 *     a string for safe BigInt round-trip without TS-DOM lib upgrades),
 *     eventId, and the platform settings + QR refs the drawer renders.
 *   • Collapsed state shows ONE button: "Add this service · ₱X,XXX.XX"
 *   • Click → expands the drawer with voucher + payment steps inline.
 *   • Mobile: bottom sheet (slide-up · max-h-[90vh] · safe-area-aware).
 *   • Desktop: right-side drawer (matches ChoosePlanSheet positioning).
 *
 * Voucher flow:
 *   • "Have a code?" toggle starts collapsed (per locked policy)
 *   • Input is uppercased on blur · max 8 chars
 *   • Apply button calls applyVoucherAction via React server-action wiring
 *   • Result renders inline with brand-voice reason on rejection OR
 *     discount + final total + Remove affordance on success
 *
 * Submit flow:
 *   • Always requires a screenshot (no orphan "no payment" state)
 *   • Channel toggle: BDO vs GCash · drives which QR + account block shows
 *   • Reference number is optional but recommended
 *   • Submit calls submitOrderAction · success state shows confirmation +
 *     link to track on /dashboard/[eventId]/orders/[orderId]
 *
 * Cross-references:
 *   • CLAUDE.md 2026-05-29 Day 2 row (this work)
 *   • apps/web/app/dashboard/[eventId]/checkout/actions.ts
 *     (applyVoucherAction + submitOrderAction)
 *   • PR #594 + PR #595 schema substrate (discount_codes + redemptions +
 *     order_ledger + orders.voucher_* columns)
 *   • apps/web/app/_components/file-upload.tsx (FileUpload reused for the
 *     screenshot upload step · direct-to-R2 client-side upload pattern)
 *   • apps/web/lib/platform-settings.ts (BDO + GCash from public.platform_settings)
 *   • Responsive default: bottom sheet on mobile, drawer on desktop
 *     (matches ChoosePlanSheet from apps/web/app/_components/app-store/
 *     choose-plan-sheet.tsx)
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { SDLoader, LOADER_STEPS } from '@/components/sd-loader';
import { trackFailure } from '@/lib/telemetry/track-error';
import {
  applyVoucherAction,
  submitOrderAction,
  type ApplyVoucherResult,
  type SubmitOrderResult,
} from '@/app/dashboard/[eventId]/checkout/actions';

export type InlineCheckoutDrawerProps = {
  serviceKey: string;
  displayName: string;
  /**
   * Original (sticker) price in centavos as a plain integer string. We use
   * a string here so the React props don't depend on BigInt (which is a
   * post-ES2020 type · cleaner for SSR-bridged client components).
   * e.g. 149900 for ₱1,499.00.
   */
  originalPriceCentavos: string;
  eventId: string;
  /** Pre-fetched platform settings · drawer just renders. */
  settings: {
    bdo_account_name: string | null;
    bdo_account_number: string | null;
    bdo_qr_url: string | null;
    gcash_account_name: string | null;
    gcash_number: string | null;
    gcash_qr_url: string | null;
  };
  /** Optional custom collapsed CTA label · defaults to "Add this service". */
  triggerLabel?: string;
  /**
   * Optional override class on the trigger button · lets the parent page
   * use the same `button-primary` etc styling as its existing CTAs.
   */
  triggerClassName?: string;
};

/**
 * Format peso centavos for display. Mirrors formatCentavosPeso in
 * calculate.ts (kept private to avoid client-importing the BigInt module).
 */
function formatPesoCentavos(centavosStr: string): string {
  const pesos = Number(centavosStr) / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function InlineCheckoutDrawer({
  serviceKey,
  displayName,
  originalPriceCentavos,
  eventId,
  settings,
  triggerLabel,
  triggerClassName,
}: InlineCheckoutDrawerProps) {
  const [open, setOpen] = useState(false);

  // Native (Capacitor) app → hand payment off to the WEBSITE instead of running
  // the in-app BDO/GCash flow. Two reasons: (1) Apple/Google forbid selling
  // digital goods in-app via an external rail (BDO/GCash) — that's an App Store
  // rejection; the purchase must happen out-of-app. (2) The website is the
  // cheaper path (base catalog price, 0% store cut) — owner 2026-06-16. The
  // shell tags its WebView UA with 'SetnayanApp'. Detected POST-MOUNT so the
  // server-rendered markup (web variant) doesn't hydration-mismatch.
  const [isNativeApp, setIsNativeApp] = useState(false);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /SetnayanApp/i.test(navigator.userAgent)) {
      setIsNativeApp(true);
    }
  }, []);

  // Open this checkout page in the EXTERNAL browser ('_system' → Capacitor hands
  // off to Safari/Chrome), where the buyer completes the purchase out-of-app at
  // the base price via BDO/GCash. Only ever called on native.
  const openWebCheckout = () => {
    if (typeof window === 'undefined') return;
    window.open(window.location.href, '_system');
  };

  // Voucher state — managed locally because the apply action returns a
  // result we render inline · we don't navigate.
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherResult, setVoucherResult] = useState<ApplyVoucherResult | null>(null);
  const [voucherPending, startVoucherTransition] = useTransition();
  const [showVoucherField, setShowVoucherField] = useState(false);

  // Channel toggle · default GCash because it's the dominant pilot rail.
  const [channel, setChannel] = useState<'gcash' | 'bdo'>('gcash');

  // Submit state.
  const [submitResult, setSubmitResult] = useState<SubmitOrderResult | null>(null);
  const [submitPending, startSubmitTransition] = useTransition();
  const [screenshotRef, setScreenshotRef] = useState<string | null>(null);
  // Lets the brand loader's "Ready ✓" completion breathe before we swap the
  // drawer body to the success card. See the reveal effect below.
  const [revealSuccess, setRevealSuccess] = useState(false);

  // Client idempotency key · minted once per drawer mount, ships with
  // every submit attempt. The (order_id, client_idempotency_key) unique
  // index on payments turns a double-submit retry into a 23505 we treat
  // as success (matches createOrder pattern from PR #591/#593).
  const idempotencyKey = useId();

  // Compute final price displayed in the drawer header.
  const finalPriceStr =
    voucherResult?.applied && voucherResult.code
      ? voucherResult.final_centavos
      : originalPriceCentavos;
  const finalPesoDisplay = formatPesoCentavos(finalPriceStr);
  const originalPesoDisplay = formatPesoCentavos(originalPriceCentavos);
  const hasVoucher = voucherResult?.applied === true && voucherResult.code !== null;

  // On a successful submit, hold the brand loader's "Ready ✓" state briefly,
  // then reveal the confirmation card. Gives the completion beat room to play.
  useEffect(() => {
    if (!submitResult?.ok || revealSuccess) return;
    const t = setTimeout(() => setRevealSuccess(true), 850);
    return () => clearTimeout(t);
  }, [submitResult?.ok, revealSuccess]);

  // Esc + body-lock when open · matches ChoosePlanSheet semantics.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  // Trigger button styling · default is a terracotta filled pill (matches
  // the app-store/state-cta.tsx "Add" button) but the parent can override.
  const trigger = (
    <button
      type="button"
      onClick={() => (isNativeApp ? openWebCheckout() : setOpen(true))}
      className={
        triggerClassName ??
        'inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600'
      }
      aria-haspopup={isNativeApp ? undefined : 'dialog'}
      title={isNativeApp ? 'Opens setnayan.com to pay with BDO/GCash' : undefined}
    >
      {isNativeApp ? (
        <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={2} />
      ) : (
        <CreditCard aria-hidden className="h-4 w-4" strokeWidth={2} />
      )}
      {triggerLabel ?? 'Add this service'}
      <span className="font-mono text-xs font-normal opacity-90">
        · {originalPesoDisplay}
      </span>
    </button>
  );

  // We always render the trigger button so it stays in document flow
  // (preserves layout · keyboard focus returns here on close). The drawer
  // is portalled-style fixed-positioned and overlays the rest of the page.
  return (
    <>
      {trigger}
      {!open ? null : (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inline-checkout-title"
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end"
      >
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close checkout"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        />

        {/* Sheet — bottom on mobile, right drawer on desktop. */}
        <div className="relative flex max-h-[90vh] w-full flex-col rounded-t-3xl border border-ink/10 bg-cream shadow-xl sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-l-3xl sm:rounded-tr-none">
          <header className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
                Checkout
              </p>
              <h2
                id="inline-checkout-title"
                className="text-lg font-semibold tracking-tight"
              >
                {displayName}
              </h2>
              <p className="font-mono text-xs text-ink/55">
                {hasVoucher ? (
                  <>
                    <span className="line-through opacity-60">
                      {originalPesoDisplay}
                    </span>{' '}
                    <span className="text-terracotta">{finalPesoDisplay}</span>
                  </>
                ) : (
                  finalPesoDisplay
                )}
              </p>
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

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/*
              Body has three states:
              1. revealSuccess  → the confirmation card (after the loader's
                 "Ready ✓" beat).
              2. submitting / just-succeeded → the brand "thinking" loader,
                 which flips to its completion state when the order resolves.
              3. otherwise → the voucher + payment + submit form.
            */}
            {revealSuccess && submitResult?.ok ? (
              <SubmitSuccess
                eventId={eventId}
                orderId={submitResult.order_id}
                referenceCode={submitResult.reference_code}
                onDone={() => {
                  setOpen(false);
                  setSubmitResult(null);
                  setVoucherInput('');
                  setVoucherResult(null);
                  setShowVoucherField(false);
                  setChannel('gcash');
                  setScreenshotRef(null);
                  setRevealSuccess(false);
                }}
              />
            ) : submitPending || submitResult?.ok ? (
              <div className="flex min-h-[340px] items-center justify-center">
                {/*
                  Order-and-pay processing → "Ready ✓" completion (Organic
                  loaders handoff 2026-06-07). `done` flips when the server
                  action resolves ok; the reveal effect above then swaps to the
                  confirmation card after the completion beat.
                */}
                <SDLoader
                  steps={LOADER_STEPS.checkout}
                  done={!!submitResult?.ok}
                  doneLabel="Order sent"
                  hint="Submitting"
                />
              </div>
            ) : (
              <div className="space-y-5">
                {/* (1) Voucher block · collapsed by default per locked policy. */}
                <VoucherBlock
                  showField={showVoucherField}
                  onShowField={() => setShowVoucherField(true)}
                  voucherInput={voucherInput}
                  onVoucherInputChange={setVoucherInput}
                  voucherResult={voucherResult}
                  voucherPending={voucherPending}
                  onApply={() => {
                    if (voucherPending) return;
                    startVoucherTransition(async () => {
                      const fd = new FormData();
                      fd.set('code', voucherInput);
                      fd.set('service_key', serviceKey);
                      fd.set('original_centavos', originalPriceCentavos);
                      const result = await applyVoucherAction(null, fd);
                      setVoucherResult(result);
                      if (result.applied) {
                        // Lock the input visually · user can Remove to retry.
                        setVoucherInput(result.code ?? voucherInput);
                      }
                    });
                  }}
                  onRemove={() => {
                    setVoucherInput('');
                    setVoucherResult(null);
                  }}
                  originalPesoDisplay={originalPesoDisplay}
                />

                {/* (2) Channel toggle. */}
                <ChannelToggle channel={channel} onChange={setChannel} />

                {/* (3) QR + account block based on channel. */}
                <PaymentDetailsBlock channel={channel} settings={settings} />

                {/* (4) Submit form. */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (submitPending) return;
                    if (!screenshotRef) {
                      setSubmitResult({
                        ok: false,
                        reason: 'Please upload a payment screenshot.',
                      });
                      return;
                    }
                    const fd = new FormData(e.currentTarget);
                    fd.set('event_id', eventId);
                    fd.set('service_key', serviceKey);
                    fd.set('display_name', displayName);
                    fd.set('original_centavos', originalPriceCentavos);
                    fd.set('channel', channel);
                    fd.set('screenshot_ref', screenshotRef);
                    fd.set('client_idempotency_key', idempotencyKey);
                    if (hasVoucher && voucherResult?.code) {
                      fd.set('voucher_code', voucherResult.code);
                      fd.set(
                        'voucher_discount_centavos',
                        voucherResult.discount_centavos,
                      );
                    }
                    startSubmitTransition(async () => {
                      const result = await submitOrderAction(fd);
                      setSubmitResult(result);
                      if (!result.ok) {
                        void trackFailure({
                          eventType: 'SUPABASE_SAVE_ERROR',
                          elementName: 'Submit payment order',
                          filePath:
                            'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx',
                          error: result.reason,
                          payload: { eventId, serviceKey, channel },
                        });
                      }
                    });
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/70">
                      Reference number from your transfer
                    </label>
                    <input
                      type="text"
                      name="reference_number"
                      placeholder="e.g. BD123456789"
                      className="input-field"
                    />
                    <p className="mt-1 text-[11px] text-ink/50">
                      Optional · but recommended so our team can match faster.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink/70">
                      Payment screenshot · required
                    </label>
                    <FileUpload
                      bucket="media"
                      pathPrefix={`payment-screenshots/inline-checkout/${eventId}`}
                      maxSizeMB={5}
                      acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                      name="screenshot_ref"
                      variant="wide"
                      onChange={(v) => {
                        setScreenshotRef(typeof v === 'string' ? v : null);
                      }}
                      help="Snap a photo of your bank-transfer or GCash confirmation."
                    />
                  </div>

                  {/* Submit result rejection (NOT a redirect · render inline). */}
                  {submitResult && submitResult.ok === false ? (
                    <p
                      role="alert"
                      className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800"
                    >
                      {submitResult.reason}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={submitPending || !screenshotRef}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
                  >
                    {submitPending ? (
                      <>
                        <Loader2
                          aria-hidden
                          className="h-4 w-4 animate-spin"
                          strokeWidth={2}
                        />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <Upload aria-hidden className="h-4 w-4" strokeWidth={2} />
                        Submit request
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-ink/50">
                    Our team reconciles within one business day. You&rsquo;ll get
                    an email when your order moves to approved.
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
}

// ============================================================================
// Sub-components — kept local so the file stays one mount-point per page.
// ============================================================================

function VoucherBlock({
  showField,
  onShowField,
  voucherInput,
  onVoucherInputChange,
  voucherResult,
  voucherPending,
  onApply,
  onRemove,
  originalPesoDisplay,
}: {
  showField: boolean;
  onShowField: () => void;
  voucherInput: string;
  onVoucherInputChange: (v: string) => void;
  voucherResult: ApplyVoucherResult | null;
  voucherPending: boolean;
  onApply: () => void;
  onRemove: () => void;
  originalPesoDisplay: string;
}) {
  const applied = voucherResult?.applied === true && voucherResult.code !== null;
  const rejected =
    voucherResult !== null &&
    voucherResult.applied === false &&
    voucherResult.reason !== undefined &&
    voucherInput.length > 0;

  // Collapsed state · "Have a code?" link.
  if (!showField && !applied) {
    return (
      <div className="rounded-lg border border-ink/10 bg-cream px-4 py-2.5">
        <button
          type="button"
          onClick={onShowField}
          className="inline-flex items-center gap-2 text-xs font-medium text-terracotta hover:underline"
        >
          <Tag aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Have a code?
        </button>
      </div>
    );
  }

  // Applied state · show code + discount + Remove.
  if (applied && voucherResult) {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Code applied · {voucherResult.code}
            </p>
            <p className="font-mono text-xs text-emerald-800/80">
              {voucherResult.discount_php} off · final total{' '}
              {voucherResult.final_php}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1 text-emerald-800/60 hover:bg-emerald-100 hover:text-emerald-900"
            aria-label="Remove voucher"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    );
  }

  // Input state — type / apply / rejection.
  return (
    <div className="space-y-2 rounded-lg border border-ink/10 bg-cream px-4 py-3">
      <label className="block text-xs font-medium text-ink/70">
        Enter your code
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={voucherInput}
          onChange={(e) => {
            // Keep lowercase as the user types; uppercase only on apply
            // (and we also uppercase server-side for safety).
            onVoucherInputChange(e.target.value.slice(0, 16));
          }}
          onBlur={(e) =>
            onVoucherInputChange(e.target.value.trim().toUpperCase().slice(0, 16))
          }
          placeholder="ABCD1234"
          maxLength={16}
          className="input-field flex-1 font-mono uppercase tracking-widest"
          aria-label="Discount code"
        />
        <button
          type="button"
          onClick={onApply}
          disabled={voucherPending || voucherInput.trim().length === 0}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream transition-colors hover:bg-ink/90 disabled:opacity-60"
        >
          {voucherPending ? (
            <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
          ) : null}
          Apply
        </button>
      </div>
      {rejected && voucherResult?.reason ? (
        <p role="alert" className="text-xs text-rose-800">
          {voucherResult.reason}
        </p>
      ) : (
        <p className="text-[11px] text-ink/50">
          Codes are case-insensitive · 8 characters. Won&rsquo;t apply if the
          original price ({originalPesoDisplay}) is already free.
        </p>
      )}
    </div>
  );
}

function ChannelToggle({
  channel,
  onChange,
}: {
  channel: 'gcash' | 'bdo';
  onChange: (c: 'gcash' | 'bdo') => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink/70">
        Pay via
      </label>
      <div
        role="radiogroup"
        aria-label="Payment channel"
        className="inline-flex w-full rounded-full border border-ink/10 bg-cream p-0.5"
      >
        {(['gcash', 'bdo'] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={channel === c}
            onClick={() => onChange(c)}
            className={`flex-1 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              channel === c
                ? 'bg-terracotta text-cream'
                : 'text-ink/70 hover:text-ink'
            }`}
          >
            {c === 'gcash' ? 'GCash' : 'BDO bank transfer'}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaymentDetailsBlock({
  channel,
  settings,
}: {
  channel: 'gcash' | 'bdo';
  settings: InlineCheckoutDrawerProps['settings'];
}) {
  // Pre-resolve the matching name + number + qr per channel.
  const name = channel === 'gcash' ? settings.gcash_account_name : settings.bdo_account_name;
  const number = channel === 'gcash' ? settings.gcash_number : settings.bdo_account_number;
  const qrUrl = channel === 'gcash' ? settings.gcash_qr_url : settings.bdo_qr_url;
  const hasInfo = Boolean(number?.trim());

  if (!hasInfo) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Bank account details will follow via separate email · our team will
        reach out within the day.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-ink/10 bg-cream px-4 py-3">
      <p className="text-xs font-medium text-ink/70">
        Send your payment to {channel === 'gcash' ? 'GCash' : 'BDO'} · then
        upload your screenshot below.
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        {name ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink/55">Name</dt>
            <dd className="font-mono text-ink">{name}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-ink/55">
            {channel === 'gcash' ? 'Number' : 'Account number'}
          </dt>
          <dd className="font-mono text-ink">{number}</dd>
        </div>
      </dl>
      {qrUrl ? (
        <div className="mt-3 flex justify-center">
          {/* Native <img> instead of next/image so we don't have to wrestle
              with remotePatterns for the platform_settings R2 host · the
              QR is admin-uploaded as a public asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`${channel === 'gcash' ? 'GCash' : 'BDO'} QR code`}
            className="h-40 w-40 rounded-lg border border-ink/10 object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

function SubmitSuccess({
  eventId,
  orderId,
  referenceCode,
  onDone,
}: {
  eventId: string;
  orderId: string;
  referenceCode: string;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2
          aria-hidden
          className="h-6 w-6 text-emerald-700"
          strokeWidth={2}
        />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Request submitted
        </h3>
        <p className="text-sm text-ink/70">
          We&rsquo;ll get back to you after verification. Our team reconciles
          within one business day and you&rsquo;ll get an email when your order
          moves to approved.
        </p>
      </div>
      <div className="rounded-lg bg-ink/5 px-4 py-3 text-left">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Reference code
        </p>
        <p className="font-mono text-base text-ink">{referenceCode}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={`/dashboard/${eventId}/orders/${orderId}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-cream px-4 py-2 text-xs font-medium text-ink/85 hover:bg-ink/5"
        >
          Track this order
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-xs font-semibold text-cream hover:bg-mulberry-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
