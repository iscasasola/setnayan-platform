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
 *   • Mobile: bottom sheet (slide-up · max-h-[90dvh] · safe-area-aware).
 *     `dvh` (not `vh`) is load-bearing: on iOS Safari / Chrome Android `vh`
 *     resolves to the LARGE viewport (URL bar hidden), so a `90vh` sheet is
 *     bottom-anchored below the browser toolbar and its last rows — the
 *     screenshot dropzone and "Submit request" — are unreachable. Reported
 *     2026-07-21: "cannot complete transaction, bottom part not viewable".
 *   • Desktop: right-side drawer (matches ChoosePlanSheet positioning).
 *
 * Voucher flow:
 *   • "Have a code?" toggle starts collapsed (per locked policy)
 *   • Input is uppercased on blur · max 16 chars
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
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  Smartphone,
  Tag,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';
import { CopyButton } from '@/app/_components/copy-button';
import { useAnonGate } from '@/app/_components/anon-gate/anon-gate-context';
import { SaveToContinue } from '@/app/_components/anon-gate/save-to-continue';
import { SDLoader, LOADER_STEPS } from '@/components/sd-loader';
import { trackFailure } from '@/lib/telemetry/track-error';
import { useModalA11y } from '@/lib/use-modal-a11y';
import {
  applyVoucherAction,
  submitOrderAction,
  type ApplyVoucherResult,
  type SubmitOrderResult,
} from '@/app/dashboard/[eventId]/checkout/actions';
import { computeVatFromBase } from '@/lib/receipts';

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
  /**
   * Effective VAT rate from `platform_settings.default_vat_rate_pct`, resolved server-side via
   * `getEffectiveVatRatePct` and handed down. 0 while Setnayan is non-VAT registered. Never
   * hardcode it here — a hardcoded 12 outliving a configured 0 is exactly the bug this fixes.
   */
  vatRatePct?: number;
  eventId: string;
  /**
   * Per-USER subscription mode (Setnayan AI term pass): when set, the drawer
   * passes a `cycles` count to the checkout and the order is eventless (the
   * parent passes eventId=''). Charge = catalog unit × cycles, re-resolved
   * server-side. Omitted for every normal event-scoped SKU.
   */
  cycles?: number;
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

/**
 * The gross the couple actually pays, from a PRE-VAT base in centavos.
 *
 * The rate is PASSED IN from the server (getEffectiveVatRatePct → platform_settings), never
 * hardcoded here. It used to be a hardcoded 12 while the configured rate was 0, so this drawer
 * quoted ₱2,800 for a ₱2,500 SKU — and the server charged the same, which is why the drift was
 * invisible: both halves were wrong in the same direction.
 */
function formatGrossCentavos(centavosStr: string, vatRatePct: number): string {
  const { gross } = computeVatFromBase(Number(centavosStr) / 100, vatRatePct);
  return `₱${gross.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Pre-mint a Setnayan reference code CLIENT-SIDE (same `SN` + 8-hex shape as the
 * server's generateReferenceCode) so the drawer can show it BEFORE the couple
 * leaves to pay — they copy it into their BDO/GCash transfer note, and the
 * reconciliation matcher pairs the inbound bank/GCash message to this order by
 * reference. Generated in a mount effect (never during SSR) to avoid a
 * hydration mismatch; the server re-validates + accepts it at submit.
 */
function generateClientReference(): string {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return (
    'SN' +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function InlineCheckoutDrawer({
  serviceKey,
  displayName,
  originalPriceCentavos,
  // Effective VAT rate, resolved SERVER-side from platform_settings and handed down. Defaults
  // to 0 so a caller that forgets it under-quotes rather than inventing a tax.
  vatRatePct = 0,
  eventId,
  cycles,
  settings,
  triggerLabel,
  triggerClassName,
}: InlineCheckoutDrawerProps) {
  const [open, setOpen] = useState(false);
  const { isAnonymous } = useAnonGate();
  // Anon-draft: gate at the TRIGGER, not at final submit — so an anonymous
  // buyer is asked to secure their account BEFORE filling payment details and
  // uploading a screenshot, never after. The submitOrderAction `needsAccount`
  // path below stays as a server-side backstop.
  const [gateOpen, setGateOpen] = useState(false);

  // Native (Capacitor) app → HIDE the purchase entirely. Apple Guideline 3.1.1
  // (and Play Billing) forbid selling digital goods in-app via a non-store rail
  // (BDO/GCash), AND forbid steering links to an external/web purchase — PH
  // storefronts get no anti-steering carve-out. So in-app we show the feature
  // with NO buy mechanism and NO pointer to where to buy. Web/PWA/desktop keep
  // the full in-app BDO/GCash drawer, unchanged. The shell tags its WebView UA
  // with 'SetnayanApp'; detected POST-MOUNT to avoid a hydration mismatch with
  // the server-rendered (web) markup. (Supersedes the 2026-06-16 route-to-web
  // approach — that external link is itself a 3.1.1 violation; full Apple IAP
  // is the v1.1 plan.)
  const [isNativeApp, setIsNativeApp] = useState(false);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && /SetnayanApp/i.test(navigator.userAgent)) {
      setIsNativeApp(true);
    }
  }, []);

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

  // Stable id so the visible "Reference number" label is programmatically
  // associated with its input (a11y · screen readers announce the field name
  // on focus). Mirrors the wrapped-label pattern the order-detail page uses.
  const referenceFieldId = useId();

  // Pre-minted Setnayan reference · shown in the payment step BEFORE the couple
  // pays, and threaded to submitOrderAction so the created order carries the
  // same code. Minted in an effect (client-only) to avoid an SSR hydration
  // mismatch; stays '' until mount, by which point the drawer is still closed.
  const [referenceCode, setReferenceCode] = useState('');
  useEffect(() => {
    setReferenceCode(generateClientReference());
  }, []);

  // Compute final price displayed in the drawer header.
  const finalPriceStr =
    voucherResult?.applied && voucherResult.code
      ? voucherResult.final_centavos
      : originalPriceCentavos;
  const finalPesoDisplay = formatPesoCentavos(finalPriceStr);
  const originalPesoDisplay = formatPesoCentavos(originalPriceCentavos);
  // VAT-inclusive gross = what the couple actually pays (the server charges this).
  const finalGrossDisplay = formatGrossCentavos(finalPriceStr, vatRatePct);
  const originalGrossDisplay = formatGrossCentavos(originalPriceCentavos, vatRatePct);
  const hasVoucher = voucherResult?.applied === true && voucherResult.code !== null;

  // On a successful submit, hold the brand loader's "Ready ✓" state briefly,
  // then reveal the confirmation card. Gives the completion beat room to play.
  useEffect(() => {
    if (!submitResult?.ok || revealSuccess) return;
    const t = setTimeout(() => setRevealSuccess(true), 850);
    return () => clearTimeout(t);
  }, [submitResult?.ok, revealSuccess]);

  // Esc-to-close + body-lock + focus management (move focus in, trap Tab,
  // restore on close) via the shared modal-a11y primitive. Replaces the
  // hand-rolled Esc/scroll-lock effect — which had no focus handling — so the
  // drawer is now a proper keyboard/SR-trapped dialog.
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open, onClose: () => setOpen(false), containerRef: dialogRef });

  // Trigger button styling · default is a terracotta filled pill (matches
  // the app-store/state-cta.tsx "Add" button) but the parent can override.
  const trigger = isNativeApp ? (
    // In-app (iOS/Android shell): no purchase mechanism, no price, no steering
    // link — an inert locked chip so the feature stays visible but is not buyable
    // here (Guideline 3.1.1 / Play Billing). Full store IAP arrives in v1.1.
    <span
      aria-disabled="true"
      className={
        triggerClassName
          ? `${triggerClassName} pointer-events-none cursor-default opacity-60`
          : 'inline-flex items-center gap-2 rounded-full bg-stone-100 px-5 py-2 text-sm font-semibold text-stone-400'
      }
    >
      <Lock aria-hidden className="h-4 w-4" strokeWidth={2} />
      {triggerLabel ?? 'Premium feature'}
    </span>
  ) : (
    <button
      type="button"
      onClick={() => (isAnonymous ? setGateOpen(true) : setOpen(true))}
      className={
        triggerClassName ??
        'inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600'
      }
      aria-haspopup="dialog"
    >
      <CreditCard aria-hidden className="h-4 w-4" strokeWidth={2} />
      {triggerLabel ?? 'Add this service'}
      <span className="font-mono text-xs font-normal opacity-90">
        · {originalGrossDisplay}
      </span>
    </button>
  );

  // We always render the trigger button so it stays in document flow
  // (preserves layout · keyboard focus returns here on close). The drawer
  // is portalled-style fixed-positioned and overlays the rest of the page.
  return (
    <>
      {trigger}
      <SaveToContinue open={gateOpen} onClose={() => setGateOpen(false)} action="order" />
      {!open ? null : (
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inline-checkout-title"
        className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center sm:items-center sm:justify-end focus:outline-none"
      >
        {/* Backdrop */}
        <button
          type="button"
          aria-label="Close checkout"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        />

        {/* Sheet — bottom on mobile, right drawer on desktop. */}
        <div className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-cream shadow-xl sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-l-3xl sm:rounded-tr-none">
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
                      {originalGrossDisplay}
                    </span>{' '}
                    <span className="text-terracotta">{finalGrossDisplay}</span>
                  </>
                ) : (
                  finalGrossDisplay
                )}
              </p>
              <p className="font-mono text-[10px] text-ink/40">incl. 12% VAT</p>
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

          {/* Scroll body. The bottom pad clears the iOS home indicator so the
              submit button is never sitting under it. */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          vatRatePct={vatRatePct}
                />

                {/* (2) Channel toggle. */}
                <ChannelToggle channel={channel} onChange={setChannel} />

                {/* (3) QR + account block based on channel. */}
                <PaymentDetailsBlock
                  channel={channel}
                  settings={settings}
                  referenceCode={referenceCode}
                />

                {/* (3b) Instant online payment · shown but LOCKED until the
                    PayMongo merchant verification is approved (owner directive
                    2026-07-11). Purely presentational — not selectable. */}
                <PayMongoSoon />

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
                    if (typeof cycles === 'number') fd.set('cycles', String(cycles));
                    fd.set('service_key', serviceKey);
                    fd.set('display_name', displayName);
                    fd.set('original_centavos', originalPriceCentavos);
                    fd.set('channel', channel);
                    fd.set('screenshot_ref', screenshotRef);
                    fd.set('client_idempotency_key', idempotencyKey);
                    // The pre-minted reference shown in the payment step — the
                    // server accepts it (validated) so the order carries the
                    // same code the couple put in their transfer note.
                    if (referenceCode) fd.set('preminted_reference', referenceCode);
                    if (hasVoucher && voucherResult?.code) {
                      fd.set('voucher_code', voucherResult.code);
                      fd.set(
                        'voucher_discount_centavos',
                        voucherResult.discount_centavos,
                      );
                    }
                    startSubmitTransition(async () => {
                      const result = await submitOrderAction(fd);
                      // Anon-draft: the order was blocked because the buyer
                      // hasn't secured their account. Route to /signup (convert
                      // in place) with a return path back to this page so they
                      // land right where they left off, plan intact.
                      if (!result.ok && result.needsAccount) {
                        const next = encodeURIComponent(
                          window.location.pathname + window.location.search,
                        );
                        window.location.href = `/signup?next=${next}`;
                        return;
                      }
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
                    <label
                      htmlFor={referenceFieldId}
                      className="mb-1 block text-xs font-medium text-ink/70"
                    >
                      Reference number from your transfer
                    </label>
                    <input
                      id={referenceFieldId}
                      type="text"
                      name="reference_number"
                      autoComplete="off"
                      placeholder="e.g. BD123456789"
                      className="input-field"
                    />
                    <p className="mt-1 text-[11px] text-ink/50">
                      Optional · but recommended so our team can match faster.
                    </p>
                  </div>

                  <div>
                    {/* label passed to FileUpload so the field name renders with
                        the dropzone (whose own input is htmlFor-associated),
                        instead of an orphan <label> with no `for` target. */}
                    <FileUpload
                      // Privacy-critical: payment proofs are PRIVATE. Route to
                      // the private thread-files bucket (read only via short-lived
                      // presigned GETs) — never the public `media` bucket, which
                      // would leak the screenshot at a permanent public URL.
                      bucket="thread-files"
                      pathPrefix={`payment-screenshots/inline-checkout/${eventId}`}
                      maxSizeMB={5}
                      acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
                      name="screenshot_ref"
                      label="Payment screenshot · required"
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
                      className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-800"
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
  vatRatePct,
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
  /** Effective rate handed down from the drawer (server-resolved). */
  vatRatePct: number;
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
      <div className="space-y-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-success-900">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
              Code applied · {voucherResult.code}
            </p>
            <p className="font-mono text-xs text-success-800/80">
              {voucherResult.discount_php} off · final total{' '}
              {formatGrossCentavos(voucherResult.final_centavos, vatRatePct)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full p-1 text-success-800/60 hover:bg-success-100 hover:text-success-900"
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
        <p role="alert" className="text-xs text-danger-800">
          {voucherResult.reason}
        </p>
      ) : (
        <p className="text-[11px] text-ink/50">
          Codes are case-insensitive. Won&rsquo;t apply if the
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
    <div className="space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
        Pay manually · available now
      </p>
      <div role="radiogroup" aria-label="Payment method" className="space-y-2.5">
        <MethodCard
          selected={channel === 'gcash'}
          onSelect={() => onChange('gcash')}
          badge="G"
          badgeClass="bg-[#0A6CF1] text-white"
          title="GCash"
          desc="Scan our GCash QR, or send to our number"
        />
        <MethodCard
          selected={channel === 'bdo'}
          onSelect={() => onChange('bdo')}
          badge="BDO"
          badgeClass="bg-[#0A2C6B] text-white"
          title="Bank Transfer — BDO"
          desc="Scan our BDO QR, or transfer to the account"
        />
      </div>
    </div>
  );
}

function MethodCard({
  selected,
  onSelect,
  badge,
  badgeClass,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  badge: string;
  badgeClass: string;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-mulberry bg-mulberry/5 ring-1 ring-mulberry'
          : 'border-ink/10 bg-cream hover:border-mulberry/40'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[11px] font-extrabold tracking-wide ${badgeClass}`}
      >
        {badge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          <span className="rounded-full border border-success-200 bg-success-50 px-1.5 py-0.5 text-[10px] font-semibold text-success-800">
            Ready
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-ink/55">{desc}</span>
      </span>
      <span
        aria-hidden
        className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border transition-colors ${
          selected ? 'border-mulberry bg-mulberry text-cream' : 'border-ink/25'
        }`}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}

/**
 * The PayMongo instant-payment rail, shown but LOCKED. Owner directive
 * 2026-07-11: keep the online options visible (Card / Maya / GrabPay) but
 * un-clickable until the PayMongo merchant verification (BIR COR → submit →
 * approval) lands. Presentational only — no state, never selectable.
 */
function PayMongoSoon() {
  const options: { icon: typeof CreditCard; title: string; desc: string }[] = [
    { icon: CreditCard, title: 'Credit / Debit Card', desc: 'Visa · Mastercard' },
    { icon: Wallet, title: 'Maya', desc: 'Instant e-wallet' },
    { icon: Smartphone, title: 'GrabPay', desc: 'Instant e-wallet' },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-cream/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-xs font-semibold text-ink/70">
          Instant payment{' '}
          <span className="font-normal text-ink/45">· via PayMongo</span>
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-warn-50 px-2 py-0.5 text-[10px] font-semibold text-warn-900">
          <Clock aria-hidden className="h-3 w-3" strokeWidth={2.25} />
          Coming soon
        </span>
      </div>
      <div className="space-y-2">
        {options.map((o) => {
          const Icon = o.icon;
          return (
            <div
              key={o.title}
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-3 py-2 opacity-60"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-ink/5 text-ink/40">
                <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink/50">
                  {o.title}
                </span>
                <span className="block text-[11px] text-ink/40">{o.desc}</span>
              </span>
              <Lock aria-hidden className="h-3.5 w-3.5 flex-none text-ink/35" strokeWidth={2} />
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex gap-1.5 px-1 text-[11px] leading-relaxed text-ink/50">
        <Clock aria-hidden className="mt-0.5 h-3 w-3 flex-none text-warn-900" strokeWidth={2} />
        <span>
          Instant online payment unlocks once our PayMongo verification is
          approved. Until then, GCash or BDO work perfectly — we confirm within
          one business day.
        </span>
      </p>
    </div>
  );
}

function PaymentDetailsBlock({
  channel,
  settings,
  referenceCode,
}: {
  channel: 'gcash' | 'bdo';
  settings: InlineCheckoutDrawerProps['settings'];
  referenceCode: string;
}) {
  // Pre-resolve the matching name + number + qr per channel.
  const name = channel === 'gcash' ? settings.gcash_account_name : settings.bdo_account_name;
  const number = channel === 'gcash' ? settings.gcash_number : settings.bdo_account_number;
  const qrUrl = channel === 'gcash' ? settings.gcash_qr_url : settings.bdo_qr_url;
  const hasInfo = Boolean(number?.trim());

  if (!hasInfo) {
    return (
      <div className="rounded-lg border border-warn-200 bg-warn-50 px-4 py-3 text-xs text-warn-900">
        Bank account details will follow via separate email · our team will
        reach out within the day.
      </div>
    );
  }

  const label = channel === 'gcash' ? 'GCash' : 'BDO';

  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-4">
      <p className="text-xs text-ink/60">
        Send your <span className="font-semibold text-ink">{label}</span> payment,
        then upload your screenshot below.
      </p>

      {referenceCode ? (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta/[0.06] px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-terracotta-700">
                Reference code
              </p>
              <p className="truncate font-mono text-[15px] font-semibold text-ink">
                {referenceCode}
              </p>
            </div>
            <CopyButton value={referenceCode} />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink/55">
            Put this in your {label} transfer note so we can match your payment
            instantly.
          </p>
        </div>
      ) : null}

      {qrUrl ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl border border-ink/10 bg-white p-3 shadow-sm">
            {/* Native <img> instead of next/image so we don't have to wrestle
                with remotePatterns for the platform_settings R2 host · the
                QR is admin-uploaded as a public asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`${label} QR code`}
              className="h-40 w-40 rounded-lg object-contain"
            />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
            {channel === 'gcash' ? 'Scan in GCash' : 'Scan in your BDO app'}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink/40">
          or {channel === 'gcash' ? 'send to our number' : 'transfer manually'}
        </span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <div className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10">
        {name ? (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="min-w-0">
              <span className="block text-[11px] text-ink/50">
                {channel === 'gcash' ? 'GCash name' : 'Account name'}
              </span>
              <span className="block truncate font-mono text-[13px] text-ink">
                {name}
              </span>
            </span>
            <CopyButton value={name} />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-[11px] text-ink/50">
              {channel === 'gcash' ? 'GCash number' : 'Account number'}
            </span>
            <span className="block truncate font-mono text-[13px] text-ink">
              {number}
            </span>
          </span>
          <CopyButton value={number ?? ''} />
        </div>
      </div>
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
  const nextSteps: [string, string][] = [
    [
      'We confirm your payment',
      'Usually within a few hours · always within one business day.',
    ],
    [
      'Your access goes live',
      'It unlocks automatically the moment your payment is confirmed.',
    ],
    [
      'You get an email + receipt',
      'Confirmation and your Official Receipt land in your inbox.',
    ],
  ];

  return (
    <div className="space-y-5 py-2 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-50 ring-1 ring-success-200">
        <CheckCircle2 aria-hidden className="h-9 w-9 text-success-700" strokeWidth={2} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-xl font-semibold tracking-tight">Payment submitted</h3>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-ink/65">
          Thank you — we&rsquo;ve received your details. You can relax; we&rsquo;ll
          take it from here.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full bg-warn-50 px-3.5 py-1.5 text-xs font-semibold text-warn-900">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn-900/70" />
        Pending verification
      </span>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
            Reference code
          </p>
          <p className="truncate font-mono text-base text-ink">{referenceCode}</p>
        </div>
        <CopyButton value={referenceCode} />
      </div>
      <div className="space-y-2.5 text-left">
        {nextSteps.map(([title, detail], i) => (
          <div key={title} className="flex gap-3">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-mulberry/10 font-mono text-[11px] font-semibold text-mulberry">
              {i + 1}
            </span>
            <span className="text-xs leading-relaxed">
              <span className="font-semibold text-ink">{title}</span>
              <span className="mt-0.5 block text-ink/55">{detail}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
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
          Done
        </button>
      </div>
    </div>
  );
}
