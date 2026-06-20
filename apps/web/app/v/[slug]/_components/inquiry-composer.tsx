'use client';

/**
 * InquiryComposer — inquiry pop-up for the public vendor profile.
 *
 * Behaviour (owner directive 2026-06-17 + Phase 1b PR-3 2026-06-20):
 *   • Tapping "Inquire" ALWAYS opens a bottom-sheet on mobile / centered dialog
 *     on desktop BEFORE the inquiry is sent. The pop-up shows:
 *       – (multi-service only) the clicked service pre-checked + locked, the
 *         vendor's price-included links, and the vendor's other services as
 *         optional "also ask about" checkboxes.
 *       – Per-category REQUIREMENTS capture (Phase 1b PR-3): the leaf's
 *         admin-defined multi_select facets as checkboxes ("What we're looking
 *         for"), a free-text "Special request" box, and a "keep this to reuse +
 *         auto-send to my next inquiries" affordance. Pre-fills from the
 *         couple's saved event_vendor_preferences row for this category.
 *   • Existing thread → instead of the pop-up, show "You already have an
 *     inquiry with this vendor" + a "View thread" link. The couple can still
 *     re-open the pop-up to add services / update requirements.
 *
 * Capture is core/FREE — never gated on Setnayan AI. The requirements save is
 * best-effort server-side; the inquiry always sends.
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
import { humanizeFacet, type RequirementField } from '@/lib/requirements-capture';

export type InquiryComposerService = {
  vendorServiceId: string;
  label: string;
  priceLabel: string;
};

/** The couple's saved requirements template for this category (pre-fill). */
export type SavedRequirements = {
  payload: Record<string, string[]>;
  specialRequest: string;
  autoSend: boolean;
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
   * Phase 1b PR-3 — the leaf category's admin-defined multi_select facets,
   * rendered as "What we're looking for" checkbox groups. Empty → only the
   * special-request box shows (the leaf has no field schema).
   */
  requirementsFields?: RequirementField[];
  /**
   * Phase 1b PR-3 — the couple's previously saved requirements template for
   * THIS (event, category), to pre-fill the pop-up. null → fresh form.
   */
  savedRequirements?: SavedRequirements | null;
  /**
   * Human label for the category, for the "Keep this to reuse for other
   * [category] inquiries" affordance. Falls back to "this category".
   */
  categoryLabel?: string | null;
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
  requirementsFields = [],
  savedRequirements = null,
  categoryLabel,
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

  // ── Requirements capture state (pre-filled from the saved template) ────────
  const [reqPayload, setReqPayload] = useState<Record<string, Set<string>>>(() =>
    seedReqPayload(savedRequirements),
  );
  const [specialRequest, setSpecialRequest] = useState<string>(
    savedRequirements?.specialRequest ?? '',
  );
  const [autoSend, setAutoSend] = useState<boolean>(savedRequirements?.autoSend ?? false);

  const alsoById = useMemo(
    () => new Map(alsoOptions.map((s) => [s.vendorServiceId, s])),
    [alsoOptions],
  );
  const hasAlsoOptions = alsoOptions.length > 0;
  const categoryName = (categoryLabel ?? '').trim() || 'this category';

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFacet(fieldKey: string, option: string) {
    setReqPayload((prev) => {
      const next = { ...prev };
      const set = new Set(next[fieldKey] ?? []);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      next[fieldKey] = set;
      return next;
    });
  }

  function resetCaptureState() {
    setChecked(new Set());
    setReqPayload(seedReqPayload(savedRequirements));
    setSpecialRequest(savedRequirements?.specialRequest ?? '');
    setAutoSend(savedRequirements?.autoSend ?? false);
  }

  function closeModal() {
    setModal({ kind: 'closed' });
    resetCaptureState();
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
    const payload: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(reqPayload)) {
      const picks = Array.from(set);
      if (picks.length > 0) payload[key] = picks;
    }
    setModal({ kind: 'submitting' });
    startTransition(async () => {
      const result: StartServiceInquiryResult = await startServiceInquiry({
        vendorProfileId,
        initialServiceId: initial.vendorServiceId,
        initialCategoryKey: initial.categoryKey,
        alsoServiceIds,
        requirements: {
          payload,
          specialRequest: specialRequest.trim() || null,
          autoSend,
        },
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
          {/* Allow re-opening the inquiry to add services / update requirements */}
          <button
            type="button"
            onClick={() => setModal({ kind: 'open' })}
            className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55 underline-offset-2 hover:text-terracotta hover:underline"
          >
            Update what you&rsquo;re looking for
          </button>
        </div>

        {modal.kind !== 'closed' ? (
          <RequirementsModal
            vendorLabel={vendorLabel}
            initial={initial}
            linked={linked}
            alsoOptions={alsoOptions}
            hasAlsoOptions={hasAlsoOptions}
            requirementsFields={requirementsFields}
            reqPayload={reqPayload}
            toggleFacet={toggleFacet}
            specialRequest={specialRequest}
            setSpecialRequest={setSpecialRequest}
            autoSend={autoSend}
            setAutoSend={setAutoSend}
            categoryName={categoryName}
            inquiryPax={inquiryPax}
            guestEditHref={guestEditHref}
            checked={checked}
            toggle={toggle}
            modal={modal}
            isSubmitting={isSubmitting}
            onClose={closeModal}
            onSubmit={submit}
            dialogRef={dialogRef}
          />
        ) : null}
      </div>
    );
  }

  // ── Main CTA (no existing thread) ─────────────────────────────────────────
  return (
    <>
      {/* Trigger button — shown inline on the vendor profile "Get in touch" section */}
      <button
        type="button"
        onClick={() => setModal({ kind: 'open' })}
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

      {modal.kind !== 'closed' ? (
        <RequirementsModal
          vendorLabel={vendorLabel}
          initial={initial}
          linked={linked}
          alsoOptions={alsoOptions}
          hasAlsoOptions={hasAlsoOptions}
          requirementsFields={requirementsFields}
          reqPayload={reqPayload}
          toggleFacet={toggleFacet}
          specialRequest={specialRequest}
          setSpecialRequest={setSpecialRequest}
          autoSend={autoSend}
          setAutoSend={setAutoSend}
          categoryName={categoryName}
          inquiryPax={inquiryPax}
          guestEditHref={guestEditHref}
          checked={checked}
          toggle={toggle}
          modal={modal}
          isSubmitting={isSubmitting}
          onClose={closeModal}
          onSubmit={submit}
          dialogRef={dialogRef}
        />
      ) : null}
    </>
  );
}

/** Seed the checkbox state from a saved template (deep-copies into Sets). */
function seedReqPayload(saved: SavedRequirements | null): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  if (!saved?.payload) return out;
  for (const [key, values] of Object.entries(saved.payload)) {
    if (Array.isArray(values)) out[key] = new Set(values.filter((v) => typeof v === 'string'));
  }
  return out;
}

type RequirementsModalProps = {
  vendorLabel: string;
  initial: InquiryComposerService & { categoryKey: string | null };
  linked: { label: string }[];
  alsoOptions: InquiryComposerService[];
  hasAlsoOptions: boolean;
  requirementsFields: RequirementField[];
  reqPayload: Record<string, Set<string>>;
  toggleFacet: (fieldKey: string, option: string) => void;
  specialRequest: string;
  setSpecialRequest: (v: string) => void;
  autoSend: boolean;
  setAutoSend: (v: boolean) => void;
  categoryName: string;
  inquiryPax?: number | null;
  guestEditHref?: string | null;
  checked: Set<string>;
  toggle: (id: string) => void;
  modal: ModalState;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
};

function RequirementsModal({
  vendorLabel,
  initial,
  linked,
  alsoOptions,
  hasAlsoOptions,
  requirementsFields,
  reqPayload,
  toggleFacet,
  specialRequest,
  setSpecialRequest,
  autoSend,
  setAutoSend,
  categoryName,
  inquiryPax,
  guestEditHref,
  checked,
  toggle,
  modal,
  isSubmitting,
  onClose,
  onSubmit,
  dialogRef,
}: RequirementsModalProps) {
  const sent = modal.kind === 'sent';
  return (
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
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      {/* Modal panel */}
      <div
        ref={dialogRef}
        className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-cream shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-2xl sm:shadow-[0_30px_80px_-40px_rgba(26,26,26,0.4)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <p
              id="inquiry-modal-title"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta"
            >
              Inquire with {vendorLabel}
            </p>
            <p className="mt-0.5 text-sm text-ink/70">
              Tell them what you&rsquo;re looking for.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

          {/* Also-ask checkboxes (multi-service vendors only) */}
          {hasAlsoOptions ? (
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
                          disabled={isSubmitting || sent}
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
          ) : null}

          {/* ── Per-category requirements (Phase 1b PR-3) ──────────────────── */}
          {requirementsFields.length > 0 ? (
            <div className="space-y-4 rounded-xl border border-ink/10 bg-cream/60 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                What we&rsquo;re looking for
              </p>
              {requirementsFields.map((field) => {
                const selected = reqPayload[field.key] ?? new Set<string>();
                return (
                  <fieldset key={field.key} className="space-y-2">
                    <legend className="block text-sm font-medium text-ink/80">{field.label}</legend>
                    <div className="flex flex-wrap gap-2">
                      {field.options.map((opt) => {
                        const on = selected.has(opt);
                        return (
                          <label
                            key={opt}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                              on
                                ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                                : 'border-ink/15 bg-cream text-ink/75 hover:border-ink/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggleFacet(field.key, opt)}
                              disabled={isSubmitting || sent}
                              className="h-3.5 w-3.5 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                            />
                            <span>{humanizeFacet(opt)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          ) : null}

          {/* Special request free-text */}
          <div className="space-y-1.5">
            <label
              htmlFor="inquiry-special-request"
              className="block text-sm font-medium text-ink/80"
            >
              Special request
            </label>
            <textarea
              id="inquiry-special-request"
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              disabled={isSubmitting || sent}
              maxLength={2000}
              rows={3}
              placeholder="Anything specific you'd like this vendor to know?"
              className="input-field w-full"
            />
          </div>

          {/* Keep + auto-send affordance */}
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink/10 bg-cream/70 px-3 py-2.5">
            <input
              type="checkbox"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              disabled={isSubmitting || sent}
              className="mt-0.5 h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
            />
            <span className="text-sm text-ink/80">
              Keep this to reuse for other {categoryName} inquiries
              <span className="mt-0.5 block text-xs text-ink/55">
                We&rsquo;ll auto-fill these for your next {categoryName} vendor.
              </span>
            </span>
          </label>

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
            onClick={onSubmit}
            disabled={isSubmitting || sent}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-default disabled:opacity-90"
          >
            {sent ? (
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
  );
}
