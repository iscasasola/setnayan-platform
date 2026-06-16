'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, MessageCircle, Users, X, ExternalLink } from 'lucide-react';
import { startServiceInquiry, type StartServiceInquiryResult } from '../inquiry-actions';

export type InquiryComposerService = {
  vendorServiceId: string;
  label: string;
  priceLabel: string;
};

type Props = {
  vendorProfileId: string;
  vendorLabel: string;
  /** The service the couple clicked Inquire on — recorded source='initial'. */
  initial: InquiryComposerService & { categoryKey: string | null };
  /**
   * Price-included linked services for the initial pick — shown as read-only
   * "✓ included" context and recorded source='linked' server-side. The couple
   * can't uncheck a price-included service into non-existence.
   */
  linked: { label: string }[];
  /**
   * The vendor's OTHER standalone services — unchecked opt-in "Also ask about"
   * checkboxes, recorded source='couple_added' when ticked.
   */
  alsoOptions: InquiryComposerService[];
  /**
   * Live headcount (Adaptive Pax Pricing Phase 3) that startServiceInquiry will
   * snapshot onto chat_threads.pax_at_inquiry — surfaced read-only so the couple
   * can correct a stale estimate before the vendor quotes against it. null →
   * no count to anchor on yet, the pill doesn't render. Display-only; the
   * binding snapshot is still re-resolved server-side at submit time.
   */
  inquiryPax?: number | null;
  /** Link to the guest-count editor (the couple's guest list). null → no Edit link. */
  guestEditHref?: string | null;
  /**
   * If the couple already has a non-declined thread with this vendor, pass the
   * thread_id here. The composer will surface "You already have an inquiry"
   * with a View thread link and an optional "Ask about more services" path.
   */
  existingThreadId?: string | null;
  /** Full href to the existing thread (e.g. /dashboard/[eventId]/messages/[threadId]). */
  existingThreadHref?: string | null;
};

type ModalState =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'submitting' }
  | { kind: 'sent'; threadHref: string }
  | { kind: 'error'; message: string };

export function InquiryComposer({
  vendorProfileId,
  vendorLabel,
  initial,
  linked,
  alsoOptions,
  inquiryPax,
  guestEditHref,
  existingThreadId,
  existingThreadHref,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const alsoById = useMemo(
    () => new Map(alsoOptions.map((s) => [s.vendorServiceId, s])),
    [alsoOptions],
  );

  // Multi-service = vendor has other standalone services the couple can opt into.
  const isMultiService = alsoOptions.length > 0;

  // ESC to close + body scroll lock while modal is open.
  useEffect(() => {
    if (modal.kind !== 'open' && modal.kind !== 'submitting') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal({ kind: 'closed' });
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modal.kind]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    const alsoServiceIds = Array.from(checked).filter((id) => alsoById.has(id));
    setModal({ kind: 'submitting' });
    startTransition(async () => {
      const result: StartServiceInquiryResult = await startServiceInquiry({
        vendorProfileId,
        initialServiceId: initial.vendorServiceId,
        initialCategoryKey: initial.categoryKey,
        alsoServiceIds,
      });
      if (result.status === 'ok') {
        const href = `/dashboard/${result.eventId}/messages/${result.threadId}`;
        setModal({ kind: 'sent', threadHref: href });
        router.push(href);
        return;
      }
      if (result.status === 'not_signed_in') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (result.status === 'no_event') {
        setModal({
          kind: 'error',
          message: 'Create your event first, then send an inquiry.',
        });
        return;
      }
      setModal({ kind: 'error', message: result.message ?? 'Could not send inquiry.' });
    });
  }

  const isSubmitting = modal.kind === 'submitting' || pending;
  const isSent = modal.kind === 'sent';
  const modalErrorMessage = modal.kind === 'error' ? modal.message : null;
  const modalOpen = modal.kind === 'open' || modal.kind === 'submitting';

  // --- Existing thread state ---
  if (existingThreadId && existingThreadHref) {
    return (
      <div className="space-y-3 rounded-xl border border-ink/10 bg-cream p-5">
        <div className="flex items-start gap-3">
          <MessageCircle
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-mulberry"
            strokeWidth={1.75}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-ink">
              You already have an inquiry with {vendorLabel}
            </p>
            <p className="text-sm text-ink/65">
              Your conversation is open. View it to continue or check their reply.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={existingThreadHref}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-mulberry px-4 text-sm font-semibold text-cream transition-colors hover:bg-mulberry/90"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            View thread
          </Link>
          {isMultiService ? (
            <button
              type="button"
              onClick={() => setModal({ kind: 'open' })}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/15 bg-cream px-4 text-sm font-medium text-ink/80 transition-colors hover:border-ink/30 hover:text-ink"
            >
              Ask about more services
            </button>
          ) : null}
        </div>
        {modalOpen ? (
          <MultiServiceModal
            initial={initial}
            linked={linked}
            alsoOptions={alsoOptions}
            inquiryPax={inquiryPax}
            guestEditHref={guestEditHref}
            vendorLabel={vendorLabel}
            checked={checked}
            toggle={toggle}
            isSubmitting={isSubmitting}
            isSent={isSent}
            errorMessage={modalErrorMessage}
            onClose={() => setModal({ kind: 'closed' })}
            onSubmit={submit}
          />
        ) : null}
        {modalErrorMessage ? (
          <p className="flex items-center gap-1.5 text-xs text-rose-700">
            <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {modalErrorMessage}
          </p>
        ) : null}
      </div>
    );
  }

  // --- No existing thread: single-service short-circuit ---
  if (!isMultiService) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isSent || isSubmitting) return;
          submit();
        }}
        className="space-y-4 rounded-xl border border-ink/10 bg-cream p-5"
      >
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Inquire about
          </p>
          <p className="text-sm text-ink">
            <span className="font-semibold text-ink">{initial.label}</span>
            <span className="ml-2 font-mono text-xs text-ink/60">{initial.priceLabel}</span>
          </p>
        </div>
        <PaxPill inquiryPax={inquiryPax} guestEditHref={guestEditHref} />
        <LinkedChips linked={linked} />
        {modalErrorMessage ? (
          <p className="flex items-center gap-1.5 text-xs text-rose-700">
            <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {modalErrorMessage}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSent || isSubmitting}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry/90 disabled:cursor-default disabled:opacity-90"
        >
          {isSent ? (
            <>
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
              Inquiry sent
            </>
          ) : (
            <>
              <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {isSubmitting ? 'Sending…' : `Inquire with ${vendorLabel}`}
            </>
          )}
        </button>
      </form>
    );
  }

  // --- Multi-service: trigger button + modal ---
  return (
    <>
      <div className="rounded-xl border border-ink/10 bg-cream p-5">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Inquire about
          </p>
          <p className="text-sm text-ink">
            <span className="font-semibold text-ink">{initial.label}</span>
            <span className="ml-2 font-mono text-xs text-ink/60">{initial.priceLabel}</span>
          </p>
          <p className="text-xs text-ink/55">
            This vendor also offers {alsoOptions.length} other service
            {alsoOptions.length === 1 ? '' : 's'} — you can bundle them in one message.
          </p>
        </div>
        <PaxPill inquiryPax={inquiryPax} guestEditHref={guestEditHref} />
        {isSent ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} />
            Inquiry sent
          </p>
        ) : (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => setModal({ kind: 'open' })}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry/90 disabled:opacity-70"
          >
            <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {`Inquire with ${vendorLabel}`}
          </button>
        )}
      </div>

      {modalOpen ? (
        <MultiServiceModal
          initial={initial}
          linked={linked}
          alsoOptions={alsoOptions}
          inquiryPax={inquiryPax}
          guestEditHref={guestEditHref}
          vendorLabel={vendorLabel}
          checked={checked}
          toggle={toggle}
          isSubmitting={isSubmitting}
          isSent={isSent}
          errorMessage={modalErrorMessage}
          onClose={() => setModal({ kind: 'closed' })}
          onSubmit={submit}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function PaxPill({
  inquiryPax,
  guestEditHref,
}: {
  inquiryPax?: number | null;
  guestEditHref?: string | null;
}) {
  if (typeof inquiryPax !== 'number' || inquiryPax <= 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-cream/70 px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-sm text-ink/80">
        <Users aria-hidden className="h-3.5 w-3.5 text-ink/55" strokeWidth={1.75} />
        Headcount for this inquiry:
        <span className="font-semibold text-ink">{inquiryPax}</span>
      </span>
      {guestEditHref ? (
        <Link
          href={guestEditHref}
          className="ml-auto font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-mulberry underline-offset-2 hover:underline"
        >
          Edit
        </Link>
      ) : null}
    </div>
  );
}

function LinkedChips({ linked }: { linked: { label: string }[] }) {
  if (linked.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
        Comes with
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {linked.map((l, i) => (
          <li
            key={`${l.label}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50 px-2.5 py-0.5 text-[12px] text-emerald-900"
          >
            <Check aria-hidden className="h-3 w-3" strokeWidth={2.25} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MultiServiceModal — bottom sheet on mobile, centered dialog on desktop.
// ---------------------------------------------------------------------------

type ModalProps = {
  initial: InquiryComposerService & { categoryKey: string | null };
  linked: { label: string }[];
  alsoOptions: InquiryComposerService[];
  inquiryPax?: number | null;
  guestEditHref?: string | null;
  vendorLabel: string;
  checked: Set<string>;
  toggle: (id: string) => void;
  isSubmitting: boolean;
  isSent: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: () => void;
};

function MultiServiceModal({
  initial,
  linked,
  alsoOptions,
  inquiryPax,
  guestEditHref,
  vendorLabel,
  checked,
  toggle,
  isSubmitting,
  isSent,
  errorMessage,
  onClose,
  onSubmit,
}: ModalProps) {
  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      aria-modal="true"
      role="dialog"
      aria-label={`Inquire with ${vendorLabel}`}
    >
      {/* Dimmed overlay */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />

      {/* Panel — bottom-sheet on mobile, centered dialog on desktop */}
      <div className="relative z-10 w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl border border-ink/10 bg-cream shadow-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-5 py-4">
          <div className="space-y-0.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Inquire with {vendorLabel}
            </p>
            <p className="text-base font-semibold text-ink">
              Which services would you like to ask about?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/8 hover:text-ink"
            aria-label="Close"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 py-5">
          {/* Initial service — pre-checked, locked */}
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
              Selected service
            </p>
            <label className="flex cursor-default items-center gap-3 rounded-xl border border-terracotta/50 bg-terracotta/5 px-3 py-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-terracotta bg-terracotta">
                <Check aria-hidden className="h-2.5 w-2.5 text-cream" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">
                {initial.label}
              </span>
              <span className="font-mono text-[11px] text-ink/55">{initial.priceLabel}</span>
            </label>
          </div>

          <LinkedChips linked={linked} />
          <PaxPill inquiryPax={inquiryPax} guestEditHref={guestEditHref} />

          {/* Also-ask options */}
          <fieldset className="space-y-2">
            <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
              Also ask about
            </legend>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {alsoOptions.map((s) => {
                const on = checked.has(s.vendorServiceId);
                return (
                  <li key={s.vendorServiceId}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        on
                          ? 'border-terracotta/50 bg-terracotta/5 text-ink'
                          : 'border-ink/10 bg-cream/80 text-ink/80 hover:border-terracotta/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(s.vendorServiceId)}
                        disabled={isSent || isSubmitting}
                        className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                      />
                      <span className="min-w-0 flex-1 truncate">{s.label}</span>
                      <span className="font-mono text-[11px] text-ink/55">{s.priceLabel}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {errorMessage ? (
            <p className="flex items-center gap-1.5 text-xs text-rose-700">
              <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {errorMessage}
            </p>
          ) : null}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-ink/10 px-5 py-4">
          <button
            type="button"
            disabled={isSent || isSubmitting}
            onClick={onSubmit}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-mulberry text-sm font-semibold text-cream transition-colors hover:bg-mulberry/90 disabled:cursor-default disabled:opacity-90"
          >
            {isSent ? (
              <>
                <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                Inquiry sent
              </>
            ) : (
              <>
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {isSubmitting ? 'Sending…' : `Send inquiry`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
