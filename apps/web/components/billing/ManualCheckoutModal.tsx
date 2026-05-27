'use client';

/**
 * ManualCheckoutModal · GCash + BDO dual-channel checkout overlay.
 *
 * Renders when /api/v1/billing/initialize-maya (Branch A) returns a
 * `MANUAL_QR_OVERLAY` payload. Two-tab switcher above the QR canvas lets
 * the customer pick between GCash Network and BDO Corporate Network ·
 * the canvas swaps with a smooth opacity fade transition.
 *
 * Visual theme: titanium-gray dark luxury (zinc-950 base · zinc-800
 * panels · champagne-gold accent · serif display + clean sans body).
 * This is a modal-only theme override and does NOT impact the rest of
 * the site's cream/ink/terracotta brand palette.
 *
 * Path is `apps/web/components/billing/ManualCheckoutModal.tsx` per
 * owner's literal directive 2026-05-28 sixth message · creates a new
 * top-level components/ directory alongside the existing app/_components/.
 * Both directories are valid Next.js conventions · the @ import alias
 * resolves both via the tsconfig baseUrl pointing at apps/web/.
 *
 * Supersedes the earlier MayaQrOverlayModal which is retired (the Maya
 * Branch B path still exists in the API route for when the Maya
 * Sandbox approval lands · in that mode the route returns a redirectUrl
 * and this modal never renders).
 *
 * Spec corpus: V2_Cutover_Plan_2026-05-28.md Phase B (billing surface).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Append a cache-buster query param to a QR image URL so that newly-uploaded
 * admin QR codes are fetched on next modal-open instead of being served from
 * a stale browser disk cache. The buster is computed ONCE per modal-open
 * session (via `useMemo` in the consumer) — tab toggling between GCash and
 * BDO does NOT re-fetch, but each new modal-open invalidates.
 *
 * Defensive against URLs that already carry a query string: uses '&' when
 * '?' is already present.
 */
function appendCacheBuster(url: string, buster: number): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${buster}`;
}

export type ManualCheckoutResponse = {
  success: boolean;
  gatewayMode: 'MANUAL_QR_OVERLAY' | 'AUTOMATED_MAYA_API';
  calculatedTotal: number;
  currency?: string;
  discount_applied?: boolean;
  referenceNumber: string;
  primaryItemDescriptor?: string;
  lineItems?: Array<{ name: string; totalAmount: { value: string } }>;
  instructions: {
    gcashQrUrl: string;
    bdoQrUrl: string;
    gcashAccountName?: string;
    bdoAccountName?: string;
    accountName?: string; // legacy single-field support
    message: string;
    slaMinutes?: number;
  };
};

export type PaymentChannel = 'gcash' | 'bdo';

type Props = {
  response: ManualCheckoutResponse;
  isOpen: boolean;
  onClose: () => void;
  /** Optional · enables the "upload screenshot" affordance to speed admin reconciliation. */
  onScreenshotUpload?: (file: File) => Promise<void>;
  /** Optional · default starting channel. Defaults to 'gcash'. */
  defaultChannel?: PaymentChannel;
};

const FADE_MS = 280;

export default function ManualCheckoutModal({
  response,
  isOpen,
  onClose,
  onScreenshotUpload,
  defaultChannel = 'gcash',
}: Props) {
  const [activeChannel, setActiveChannel] = useState<PaymentChannel>(defaultChannel);
  const [copied, setCopied] = useState(false);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotResult, setScreenshotResult] = useState<'idle' | 'success' | 'error'>('idle');

  // ESC + outside-click closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Reset channel + screenshot state when the modal re-opens fresh.
  useEffect(() => {
    if (isOpen) {
      setActiveChannel(defaultChannel);
      setScreenshotResult('idle');
    }
  }, [isOpen, defaultChannel]);

  // Cache buster computed once per modal-open session · stable across tab
  // toggles (so switching GCash ↔ BDO does not refetch) but each new
  // modal-open invalidates the browser cache for the QR assets.
  const cacheBuster = useMemo(() => Date.now(), [
    // Tying to isOpen flip ensures the buster updates if the modal is
    // closed + reopened within the same React lifecycle.
    isOpen,
  ]);

  const channels = useMemo<Array<{
    key: PaymentChannel;
    label: string;
    qrUrl: string;
    accountName: string;
  }>>(() => [
    {
      key: 'gcash',
      label: 'GCash Network',
      qrUrl: appendCacheBuster(response.instructions.gcashQrUrl, cacheBuster),
      accountName: response.instructions.gcashAccountName ?? response.instructions.accountName ?? 'Setnayan Wedding Platform',
    },
    {
      key: 'bdo',
      label: 'BDO Corporate Network',
      qrUrl: appendCacheBuster(response.instructions.bdoQrUrl, cacheBuster),
      accountName: response.instructions.bdoAccountName ?? response.instructions.accountName ?? 'Setnayan Corporation',
    },
  ], [response.instructions, cacheBuster]);

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(response.referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = response.referenceNumber;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    }
  };

  const handleScreenshotChange = async (file: File | null) => {
    if (!file || !onScreenshotUpload) return;
    setScreenshotUploading(true);
    setScreenshotResult('idle');
    try {
      await onScreenshotUpload(file);
      setScreenshotResult('success');
    } catch {
      setScreenshotResult('error');
    } finally {
      setScreenshotUploading(false);
    }
  };

  if (!isOpen || response.gatewayMode !== 'MANUAL_QR_OVERLAY') {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-checkout-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="
          relative w-full max-w-2xl overflow-hidden rounded-2xl
          border border-zinc-700/80
          bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900
          text-zinc-100 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]
        "
      >
        {/* Subtle titanium-sheen top edge */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-400/30 to-transparent" aria-hidden />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 bg-zinc-950/60 px-7 py-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
              Manual checkout · awaiting verification
            </p>
            <h2
              id="manual-checkout-title"
              className="mt-1.5 font-serif text-2xl font-light tracking-tight text-zinc-50"
            >
              Settle your order
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close payment instructions"
            onClick={onClose}
            className="
              rounded-full border border-zinc-700 bg-zinc-900/60 p-2 text-zinc-300
              transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-50
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          {/* Total + line items */}
          <Block label="Total due">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl font-light tracking-tight text-zinc-50">
                ₱{formatPeso(response.calculatedTotal)}
              </span>
              <span className="text-sm text-zinc-500">{response.currency ?? 'PHP'}</span>
              {response.discount_applied === false ? (
                <span className="ml-auto inline-flex items-center rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200">
                  100% retail · zero discount
                </span>
              ) : null}
            </div>
            {response.lineItems && response.lineItems.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {response.lineItems.map((item, idx) => (
                  <li
                    key={`${item.name}-${idx}`}
                    className="flex items-baseline justify-between border-b border-zinc-800/60 pb-1.5 last:border-b-0 last:pb-0"
                  >
                    <span className="text-zinc-300">{item.name}</span>
                    <span className="tabular-nums text-zinc-400">₱{item.totalAmount.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Block>

          {/* Channel switcher · pills above the QR canvas */}
          <Block label="Choose your network">
            <div
              role="tablist"
              aria-label="Payment channel"
              className="
                inline-flex items-center gap-1 rounded-full border border-zinc-700
                bg-zinc-900/60 p-1 shadow-inner
              "
            >
              {channels.map((ch) => {
                const isActive = ch.key === activeChannel;
                return (
                  <button
                    key={ch.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="manual-checkout-qr-canvas"
                    onClick={() => setActiveChannel(ch.key)}
                    className={
                      isActive
                        ? `
                            rounded-full bg-gradient-to-b from-zinc-200 to-zinc-400
                            px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em]
                            text-zinc-900 shadow-sm transition
                          `
                        : `
                            rounded-full px-4 py-1.5 text-xs font-medium uppercase
                            tracking-[0.14em] text-zinc-400 transition
                            hover:text-zinc-100
                          `
                    }
                    style={{ transitionDuration: `${FADE_MS}ms` }}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </div>

            {/* QR canvas · stacked images crossfade by opacity */}
            <div
              id="manual-checkout-qr-canvas"
              className="
                relative mt-5 h-64 w-full overflow-hidden rounded-2xl
                border border-zinc-700/70 bg-zinc-950
                shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]
              "
            >
              {channels.map((ch) => (
                <QrLayer
                  key={ch.key}
                  qrUrl={ch.qrUrl}
                  label={ch.label}
                  accountName={ch.accountName}
                  isActive={ch.key === activeChannel}
                />
              ))}
            </div>
          </Block>

          {/* Reference number */}
          <Block label="Your reference number">
            <div className="flex items-center gap-2">
              <code
                className="
                  flex-1 select-all rounded-lg border border-zinc-700 bg-zinc-900/80
                  px-3 py-2.5 font-mono text-sm tracking-wide text-zinc-100
                "
              >
                {response.referenceNumber}
              </code>
              <button
                type="button"
                onClick={copyRef}
                className="
                  rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-2.5
                  text-xs font-medium uppercase tracking-[0.14em] text-amber-200
                  transition hover:bg-amber-400/20
                "
                style={{ transitionDuration: `${FADE_MS}ms` }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Include this exact reference in your transaction notes so we can match your payment.
            </p>
          </Block>

          {/* SLA message */}
          <Block label="What happens next">
            <p className="text-sm leading-relaxed text-zinc-300">
              {response.instructions.message}
            </p>
            {response.instructions.slaMinutes ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-400">
                <span className="size-2 rounded-full bg-amber-400" aria-hidden />
                Reconciliation SLA · {response.instructions.slaMinutes} minutes after we see your transfer
              </p>
            ) : null}
          </Block>

          {/* Optional screenshot upload */}
          {onScreenshotUpload ? (
            <Block label="Speed it up · upload your transfer screenshot">
              <label
                className="
                  flex cursor-pointer flex-col items-start gap-2 rounded-xl border
                  border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-3 text-sm
                  text-zinc-300 transition hover:border-amber-300/40 hover:bg-zinc-900/70
                "
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void handleScreenshotChange(e.target.files?.[0] ?? null)}
                />
                <span className="font-medium text-zinc-100">
                  {screenshotUploading ? 'Uploading…' :
                   screenshotResult === 'success' ? 'Screenshot uploaded ✓ · admin will reconcile shortly' :
                   screenshotResult === 'error'   ? 'Upload failed · try again' :
                   'Tap to attach (PNG · JPG · WebP)'}
                </span>
                <span className="text-xs text-zinc-500">
                  Helps admin match your transfer faster · still confirms within SLA without it.
                </span>
              </label>
            </Block>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 bg-zinc-950/60 px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="
              rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-2 text-sm
              font-medium text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800
            "
          >
            I&apos;ll do this later
          </button>
          <button
            type="button"
            onClick={copyRef}
            className="
              rounded-full bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400
              px-5 py-2 text-sm font-semibold text-zinc-900
              shadow-[0_6px_18px_-6px_rgba(251,191,36,0.5)]
              transition hover:from-amber-100 hover:via-amber-200 hover:to-amber-300
            "
          >
            {copied ? 'Reference copied ✓' : 'Copy reference + open my app'}
          </button>
        </div>

        {/* Subtle titanium-sheen bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-400/30 to-transparent" aria-hidden />
      </div>
    </div>
  );
}

// ---------- internals ----------

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </p>
      {children}
    </section>
  );
}

function QrLayer({
  qrUrl,
  label,
  accountName,
  isActive,
}: {
  qrUrl: string;
  label: string;
  accountName: string;
  isActive: boolean;
}) {
  return (
    <div
      role="tabpanel"
      aria-hidden={!isActive}
      className="absolute inset-0 flex items-center justify-center transition-opacity"
      style={{
        opacity: isActive ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="
            relative h-44 w-44 overflow-hidden rounded-xl border border-zinc-700/80
            bg-zinc-50 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)]
          "
        >
          {/* External URL · img element to avoid next/image config friction
              while the QR assets live on a separate CDN. Replace with
              <Image src=... /> when assets move to R2 + next.config domains
              get the host whitelisted.
              Explicit width + height attrs reserve the box's aspect ratio
              before the image bytes arrive · prevents CLS during the
              opacity fade transition between channels. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`${label} QR code`}
            width={176}
            height={176}
            decoding="async"
            loading="eager"
            className="h-full w-full object-contain p-3"
          />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{accountName}</p>
        </div>
      </div>
    </div>
  );
}

function formatPeso(amount: number): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
