'use client';

/**
 * InquiryComposer — multi-service inquiry modal for the public vendor profile.
 *
 * Behaviour (owner directive 2026-06-17):
 *   • Single-service vendor  → skip the modal entirely; tapping "Inquire"
 *     submits immediately just like a direct CTA.
 *   • Multi-service vendor   → tapping "Inquire" opens a bottom-sheet on
 *     mobile / centered dialog on desktop showing:
 *       – The clicked service pre-checked (locked, cannot be unchecked)
 *       – The vendor's other published services as optional checkboxes
 *       – "Send inquiry" bundles all ticked services into ONE thread
 *   • Existing thread         → instead of the modal, show "You already have
 *     an inquiry with this vendor" + a "View thread" link.  The couple can
 *     still send an updated inquiry if they want more services.
 *
 * Design: Clean Editorial palette (Alabaster/Obsidian/Champagne Gold/Mulberry).
 * Bottom-sheet on mobile (<640px), centered dialog on sm+.
 */

import { useMemo, useRef, useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  MessageCircle,
  MessageSquare,
  Users,
  X,
} from 'lucide-react';
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
   * The vendor's OTHER standalone services — shown as optional checkboxes in
   * the modal, recorded source='couple_added' when ticked.
   */
  alsoOptions: InquiryComposerService[];
  /**
   * Live headcount (Adaptive Pax Pricing Phase 3) — surfaced read-only so
   * the couple can correct a stale estimate before the vendor quotes against
   * it. null → pill not rendered.
   */
  inquiryPax?: number | null;
  /** Link to the guest-count editor. null → no Edit link. */
  guestEditHref?: string | null;
  /**
   * If this couple already has a non-declined thread with this vendor for
   * their primary event, pass its thread_id here. The composer surfaces a
   * "View thread" shortcut instead of triggering the modal CTA.
   * When null the normal "Inquire" flow runs.
   */
  existingThreadId?: string | null;
  /**
   * Full path to the existing thread (/dashboard/[eventId]/messages/[threadId]).
   * Must be non-null when existingThreadId is non-null.
   */
  existingThreadHref?: string | null;
};

type ModalState =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
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
  const dialogRef = useRef<HTMLDivElement>(null);

  /** True when this vendor has multiple services (modal is needed). */
  const isMultiService = alsoOptions.length > 0;

  const alsoById = useMemo(
    () => new Map(alsoOptions.map((s) => [s.vendorServiceId, s])),
    [alsoOptions],
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeModal() {
    setModal({ kind: 'closed' });
    setChecked(new Set());
  }

  // ESC key closes the modal.
  useEffect(() => {
    if (modal.kind === 'closed') return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handle);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handle);
      document.body.style.overflow = prev;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.kind]);

  async function submit() {
    if (pending || modal.kind === 'submitting' || modal.kind === 'sent') return;
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
        setModal({ kind: 'sent' });
        router.push(`/dashboard/${result.eventId}/messages/${result.threadId}`);
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

  function handleInquireClick() {
    if (!isMultiService) {
      // Single-service vendor — skip the modal entirely.
      submit();
    } else {
      setModal({ kind: 'open' });
    }
  }

  const isSubmitting = modal.kind === 'submitting' || pending;

  // ── Existing-thread state ──────────────────────────────────────────────────
  if (existingThreadId && existingThreadHref) {
    return (
      <div className="space-y-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-5">
        <p className="text-sm text-ink">
          <span className="font-semibold">You already have an inquiry</span> with{' '}
          {vendorLabel}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={existingThreadHref}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream hover:bg-mulberry-600"
          >
            <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            View thread
          </Link>
          {/* Allow re-opening the inquiry to add more services */}
          {isMultiService ? (
            <button
              type="button"
              onClick={() => setModal({ kind: 'open' })}
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline"
            >
              Ask about more services
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Main CTA (no existing thread) ─────────────────────────────────────────
  return (
    <>
      {/* Trigger button — shown inline on the vendor profile "Get in touch" section */}
      <button
        type="button"
        onClick={handleInquireClick}
        disabled={isSubmitting}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-default disabled:opacity-90"
      >
        {isSubmitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {`Inquire with ${vendorLabel}`}
          </>
        )}
      </button>

      {/* Error shown outside the modal for the single-service submit path */}
      {modal.kind === 'error' && !isMultiService ? (
        <p className="flex items-center gap-1.5 text-xs text-danger-700">
          <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {modal.message}
        </p>
      ) : null}

      {/* ── Multi-service modal ─────────────────────────────────────────────── */}
      {isMultiService && modal.kind !== 'closed' ? (
        /* Backdrop */
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inquiry-modal-title"
        >
          {/* Translucent backdrop — click closes */}
          <button
            type="button"
            aria-label="Close"
            onClick={closeModal}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />

          {/* Modal panel */}
          <div
            ref={dialogRef}
            className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] sm:max-h-[80vh] sm:w-full sm:max-w-lg sm:rounded-2xl sm:shadow-[0_30px_80px_-40px_rgba(26,26,26,0.4)]"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
              <div>
                <p
                  id="inquiry-modal-title"
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta"
                >
                  {vendorLabel} also offers
                </p>
                <p className="mt-0.5 text-sm text-ink/70">
                  Which services would you like to ask about?
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* Pax pill */}
              {typeof inquiryPax === 'number' && inquiryPax > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-cream/70 px-3 py-2">
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
              ) : null}

              {/* Initial service — pre-checked, locked */}
              <fieldset className="space-y-2">
                <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                  Inquiring about
                </legend>
                <div className="flex items-center gap-2 rounded-lg border border-terracotta/50 bg-terracotta/5 px-3 py-2">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-terracotta bg-terracotta">
                    <Check aria-hidden className="h-2.5 w-2.5 text-cream" strokeWidth={3} />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {initial.label}
                  </span>
                  <span className="font-mono text-[11px] text-ink/55">{initial.priceLabel}</span>
                </div>
              </fieldset>

              {/* Linked services — read-only ✓ included */}
              {linked.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                    Comes with
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {linked.map((l, i) => (
                      <li
                        key={`${l.label}-${i}`}
                        className="inline-flex items-center gap-1 rounded-full border border-success-300/60 bg-success-50 px-2.5 py-0.5 text-[12px] text-success-900"
                      >
                        <Check aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                        {l.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Also-ask checkboxes */}
              <fieldset className="space-y-2">
                <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
                  Also ask about
                </legend>
                <ul className="space-y-1.5">
                  {alsoOptions.map((s) => {
                    const on = checked.has(s.vendorServiceId);
                    return (
                      <li key={s.vendorServiceId}>
                        <label
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                            on
                              ? 'border-terracotta/50 bg-terracotta/5 text-ink'
                              : 'border-ink/10 bg-cream/80 text-ink/80 hover:border-terracotta/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(s.vendorServiceId)}
                            disabled={isSubmitting || modal.kind === 'sent'}
                            className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                          />
                          <span className="min-w-0 flex-1 truncate">{s.label}</span>
                          <span className="font-mono text-[11px] text-ink/55">
                            {s.priceLabel}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>

              {/* Error */}
              {modal.kind === 'error' ? (
                <p className="flex items-center gap-1.5 text-xs text-danger-700">
                  <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  {modal.message}
                </p>
              ) : null}
            </div>

            {/* Footer CTA */}
            <div className="border-t border-ink/10 px-5 py-4 pb-[max(env(safe-area-inset-bottom),16px)]">
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting || modal.kind === 'sent'}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-default disabled:opacity-90"
              >
                {modal.kind === 'sent' ? (
                  <>
                    <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Inquiry sent
                  </>
                ) : isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" aria-hidden />
                    Sending…
                  </>
                ) : (
                  <>
                    <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    Send inquiry
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
