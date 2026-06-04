'use client';

// ============================================================================
// VendorDirectPay — couple-facing "pay this vendor DIRECTLY" surface.
//
// Couples pay vendors OFF-PLATFORM. Setnayan never holds, routes, or can
// reverse the money (RA 11967 non-party-publisher posture). This component is
// the trust-forward presentation of a booked vendor's PUBLISHED payment
// destinations (bank details / an uploaded QR / a payment link) plus the
// always-on disclosure the owner requires on every vendor-payment surface
// (project_setnayan_vendor_payment_disclosure).
//
// Security: the `methods` prop is fetched SERVER-SIDE via the secure helper
// `fetchPublishedMethodsForCouple` (lib/vendor-payment-methods.server.ts),
// which proves event ownership before reading the owner-RLS'd
// vendor_payment_methods table through the admin client. This component never
// queries that table — it only renders props. QR display URLs are already
// presigned on the server (CoupleFacingMethod.qr_display_url).
//
// Mounted by VendorItemizationCard, just above its PaymentSection, on both the
// /budget per-vendor cards and the per-vendor workspace embed.
// ============================================================================

import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Link2,
  QrCode,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { CoupleFacingMethod } from '@/lib/vendor-payment-methods';

export type VendorDirectPayProps = {
  vendorName: string;
  methods: CoupleFacingMethod[];
};

export function VendorDirectPay({ vendorName, methods }: VendorDirectPayProps) {
  // No published direct-pay option (off-platform/manual vendor, or none
  // shared yet). Keep it quiet — a single hint that points to chat, the
  // canonical coordination channel for these vendors.
  //
  // Padding-neutral: this component mounts INSIDE the already-padded
  // PaymentSection (<section className="… p-5">), so it must not add its
  // own horizontal padding. Spacing between it and the Payments header is
  // owned by the parent's `space-y-3`.
  if (methods.length === 0) {
    return (
      <p className="text-xs text-ink/55">
        This vendor hasn&rsquo;t shared a direct payment option yet — message them
        in chat.
      </p>
    );
  }

  return (
    <section aria-label={`Pay ${vendorName} directly`} className="space-y-3">
      <header className="flex items-center gap-2">
        <Building2 aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Pay this vendor directly
        </h3>
      </header>

      {/* Always-on disclosure — EXACT owner-locked copy. Must render whenever
          any method is shown. Do not soften or paraphrase. */}
      <div
        role="note"
        className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2.5 text-xs leading-relaxed text-amber-900"
      >
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" strokeWidth={1.75} />
        <p>
          Setnayan doesn&rsquo;t control or hold payments to vendors. You&rsquo;re
          paying {vendorName} directly — confirm these details are really theirs
          before you send, and only pay vendors you trust. Setnayan can&rsquo;t
          reverse or mediate an off-platform payment.
        </p>
      </div>

      <ul className="space-y-2">
        {methods.map((m) => (
          <li key={m.payment_method_id}>
            <MethodCard method={m} vendorName={vendorName} />
          </li>
        ))}
      </ul>
    </section>
  );
}

// ----------------------------------------------------------------------------
// Per-method card — renders one of three shapes (bank / qr / link).
// ----------------------------------------------------------------------------

function MethodCard({
  method,
  vendorName,
}: {
  method: CoupleFacingMethod;
  vendorName: string;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-cream p-3">
      <div className="flex flex-wrap items-center gap-2">
        <MethodIcon type={method.method_type} />
        <span className="text-sm font-medium text-ink">{method.label}</span>
        {method.provider ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            {method.provider}
          </span>
        ) : null}
        {method.is_primary ? (
          <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
            Primary
          </span>
        ) : null}
      </div>

      <div className="mt-2.5">
        {method.method_type === 'bank' ? (
          <BankBody method={method} />
        ) : method.method_type === 'qr' ? (
          <QrBody method={method} vendorName={vendorName} />
        ) : (
          <LinkBody method={method} vendorName={vendorName} />
        )}
      </div>

      {method.note ? (
        <p className="mt-2 text-xs text-ink/55">{method.note}</p>
      ) : null}
    </div>
  );
}

function MethodIcon({ type }: { type: CoupleFacingMethod['method_type'] }) {
  const cls = 'h-4 w-4 text-ink/45';
  if (type === 'bank') return <Building2 aria-hidden className={cls} strokeWidth={1.75} />;
  if (type === 'qr') return <QrCode aria-hidden className={cls} strokeWidth={1.75} />;
  return <Link2 aria-hidden className={cls} strokeWidth={1.75} />;
}

// --- bank ------------------------------------------------------------------

function BankBody({ method }: { method: CoupleFacingMethod }) {
  return (
    <dl className="space-y-1.5">
      {method.account_name ? (
        <CopyRow label="Account name" value={method.account_name} />
      ) : null}
      {method.account_number ? (
        <CopyRow label="Account number" value={method.account_number} mono />
      ) : null}
      {method.provider ? (
        <CopyRow label="Bank / wallet" value={method.provider} />
      ) : null}
    </dl>
  );
}

function CopyRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-ink/[0.03] px-2.5 py-1.5">
      <div className="min-w-0">
        <dt className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">
          {label}
        </dt>
        <dd className={`truncate text-sm text-ink ${mono ? 'font-mono' : ''}`}>{value}</dd>
      </div>
      <CopyButton value={value} fieldLabel={label} />
    </div>
  );
}

function CopyButton({ value, fieldLabel }: { value: string; fieldLabel: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable (insecure context / permissions). Fail
      // silently — the value is still visible for manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? `${fieldLabel} copied` : `Copy ${fieldLabel.toLowerCase()}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink/10 bg-cream px-2 py-1 text-[11px] font-medium text-ink/70 transition-colors hover:border-terracotta/50 hover:text-terracotta"
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-3 w-3 text-emerald-700" strokeWidth={2.25} />
          <span className="text-emerald-700">Copied</span>
        </>
      ) : (
        <>
          <Copy aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          Copy
        </>
      )}
    </button>
  );
}

// --- qr --------------------------------------------------------------------

function QrBody({
  method,
  vendorName,
}: {
  method: CoupleFacingMethod;
  vendorName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <QrCode aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Show QR
      </button>

      {open ? (
        <ModalShell
          onClose={() => setOpen(false)}
          titleId={`qr-title-${method.payment_method_id}`}
          title={method.label}
        >
          <div className="space-y-3">
            {method.qr_display_url ? (
              <div className="flex justify-center rounded-xl border border-ink/10 bg-cream p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={method.qr_display_url}
                  alt={`${method.label} payment QR code`}
                  className="h-56 w-56 max-w-full object-contain"
                />
              </div>
            ) : (
              <p className="rounded-md bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
                This QR couldn&rsquo;t be loaded. Ask the vendor to re-share it in chat.
              </p>
            )}

            {method.decoded_destination ? (
              <div className="rounded-md bg-ink/[0.03] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">
                  Destination
                </p>
                <p className="mt-0.5 break-words font-mono text-xs text-ink">
                  {method.decoded_destination}
                </p>
              </div>
            ) : null}

            <p className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={1.75} />
              <span>Confirm this is {vendorName}&rsquo;s before you scan.</span>
            </p>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

// --- link ------------------------------------------------------------------

function LinkBody({
  method,
  vendorName,
}: {
  method: CoupleFacingMethod;
  vendorName: string;
}) {
  const [open, setOpen] = useState(false);
  const url = method.link_url;

  if (!url) {
    return (
      <p className="rounded-md bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
        This payment link is unavailable. Ask the vendor to re-share it in chat.
      </p>
    );
  }

  function onContinue() {
    if (url) window.open(url, '_blank', 'noopener');
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-terracotta-700"
      >
        <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Pay
      </button>

      {open ? (
        <ModalShell
          onClose={() => setOpen(false)}
          titleId={`link-title-${method.payment_method_id}`}
          title="You're leaving Setnayan"
        >
          <div className="space-y-3">
            <div className="rounded-md bg-ink/[0.03] px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">
                Destination
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-ink">{url}</p>
            </div>

            <p className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={1.75} />
              <span>
                Setnayan doesn&rsquo;t control this payment. Make sure the address
                above is really theirs — Setnayan can&rsquo;t recover money sent to
                the wrong place.
              </span>
            </p>

            <p className="text-xs text-ink/55">
              You&rsquo;re paying {vendorName} directly on their own payment page.
            </p>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-ink/30 hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onContinue}
                className="inline-flex items-center gap-1.5 rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:bg-terracotta-700"
              >
                <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Continue
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

// --- shared modal shell ----------------------------------------------------

function ModalShell({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — click to dismiss. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-ink/10 bg-cream shadow-xl">
        <header className="flex items-center justify-between gap-2 border-b border-ink/10 px-4 py-3">
          <h4 id={titleId} className="truncate text-sm font-semibold text-ink">
            {title}
          </h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
