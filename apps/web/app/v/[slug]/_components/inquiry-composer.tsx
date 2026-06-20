'use client';

/**
 * InquiryComposer — inquiry pop-up for the public vendor profile.
 *
 * Behaviour (owner directive 2026-06-17 + Phase 1b PR-3 2026-06-20 +
 * PR-5 auto carry-forward 2026-06-20):
 *   • Auto carry-forward (Setnayan AI value): when AI is ON for the event AND
 *     the couple already has a saved requirements row for this category with
 *     auto_send=true, tapping "Inquire" SKIPS the pop-up entirely and sends the
 *     saved requirements straight through, with a calm inline note that their
 *     saved [category] preferences were included automatically by Setnayan AI.
 *     The FIRST inquiry (where they fill + check auto-send) still shows the
 *     pop-up — only SUBSEQUENT same-category inquiries auto-send. The
 *     carry-forward payload is sourced SOLELY from the couple's own saved row
 *     (event_vendor_preferences) — never from any vendor-authored content.
 *   • Otherwise (AI OFF / auto_send=false / no saved row): tapping "Inquire"
 *     ALWAYS opens a bottom-sheet on mobile / centered dialog on desktop BEFORE
 *     the inquiry is sent. The pop-up shows:
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
import { Check, MessageCircle, MessageSquare, Sparkles, Users } from 'lucide-react';
import { startServiceInquiry, type StartServiceInquiryResult } from '../inquiry-actions';
import {
  type RequirementField,
  type RequirementsActionInput,
  buildAutoCarryForwardRequirements,
  shouldAutoCarryForward,
} from '@/lib/requirements-capture';
import {
  RequirementsModal,
  type RequirementsModalPhase,
} from '@/app/_components/requirements-modal';

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
   * Phase 1b PR-5 — is Setnayan AI active for this couple's event? Auto
   * carry-forward (skip the pop-up + auto-send the saved requirements) is the
   * Setnayan AI value and only fires when this is true AND the saved row has
   * auto_send=true. When false the pop-up always shows (FREE tier keeps
   * save-template + manual pre-fill from PR-3/PR-4). Default false.
   */
  aiActive?: boolean;
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

/**
 * Phase 1b PR-5 — state for the inline auto carry-forward flow (pop-up skipped).
 * Lives outside ModalState so the auto path never opens the modal; it drives a
 * small calm confirmation rendered in place of the Inquire button.
 */
type AutoCarryState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; threadHref: string }
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
  aiActive = false,
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

  // ── Auto carry-forward (Phase 1b PR-5) ─────────────────────────────────────
  // The gate: Setnayan AI ON + a saved row for this category with auto_send=true.
  // When true the Inquire click skips the pop-up and sends the SAVED template
  // straight through. `savedRequirements` is the couple's own event_vendor_-
  // preferences row (the only source) — never any vendor-authored content.
  const autoCarry = shouldAutoCarryForward(aiActive, savedRequirements);
  const [autoState, setAutoState] = useState<AutoCarryState>({ kind: 'idle' });

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

  function inFlight() {
    return (
      pending ||
      modal.kind === 'submitting' ||
      modal.kind === 'sent' ||
      autoState.kind === 'sending' ||
      autoState.kind === 'sent'
    );
  }

  // Modal "Send inquiry" CTA — sends the CURRENT form state (manual / edited).
  async function submit() {
    if (inFlight()) return;
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

  // Phase 1b PR-5 — auto carry-forward path. Skips the pop-up entirely: builds
  // the inquiry requirements SOLELY from the couple's saved template
  // (`savedRequirements` = their event_vendor_preferences row · the privacy
  // boundary) and sends directly, then shows a calm inline confirmation. Does
  // NOT navigate away so the "included automatically" note stays visible; a
  // "View thread" link is offered instead.
  async function autoInquire() {
    if (inFlight()) return;
    const carry: RequirementsActionInput = buildAutoCarryForwardRequirements(savedRequirements);
    setAutoState({ kind: 'sending' });
    startTransition(async () => {
      const result: StartServiceInquiryResult = await startServiceInquiry({
        vendorProfileId,
        initialServiceId: initial.vendorServiceId,
        initialCategoryKey: initial.categoryKey,
        // Auto-send carries only the saved per-category requirements — it never
        // auto-opts into the vendor's other "also ask about" services.
        alsoServiceIds: [],
        requirements: carry,
      });
      if (result.status === 'ok') {
        setAutoState({
          kind: 'sent',
          threadHref: `/dashboard/${result.eventId}/messages/${result.threadId}`,
        });
        // Refresh so the page re-renders into its "existing thread" state on
        // next visit, without yanking the couple off the confirmation now.
        router.refresh();
        return;
      }
      if (result.status === 'not_signed_in') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
        return;
      }
      if (result.status === 'no_event') {
        setAutoState({
          kind: 'error',
          message: 'Create your event first, then send an inquiry.',
        });
        return;
      }
      setAutoState({
        kind: 'error',
        message: result.message ?? 'Could not send inquiry.',
      });
    });
  }

  // The Inquire button's click: auto-send when the gate is on, else open the
  // pop-up. (The existing-thread "Update what you're looking for" affordance
  // always opens the pop-up — an explicit edit intent is never auto-fired.)
  function onInquireClick() {
    if (autoCarry) {
      void autoInquire();
    } else {
      setModal({ kind: 'open' });
    }
  }

  const isSubmitting = modal.kind === 'submitting' || pending;
  // Map the composer's richer ModalState onto the shared modal's CTA lifecycle.
  const modalPhase: RequirementsModalPhase =
    modal.kind === 'submitting'
      ? 'submitting'
      : modal.kind === 'sent'
        ? 'sent'
        : modal.kind === 'error'
          ? 'error'
          : 'idle';
  const sent = modal.kind === 'sent';

  // The inquiry-only context block rendered ABOVE the requirements core: the
  // headcount pill, the locked "Inquiring about" pick, "Comes with" linked
  // services, and "Also ask about" optional services. Passed to the shared
  // RequirementsModal as `topSlot` — the shortlist edit surface omits this.
  const inquiryTopSlot = (
    <>
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
    </>
  );

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
            title={`Inquire with ${vendorLabel}`}
            subtitle="Tell them what you’re looking for."
            topSlot={inquiryTopSlot}
            requirementsFields={requirementsFields}
            reqPayload={reqPayload}
            toggleFacet={toggleFacet}
            specialRequest={specialRequest}
            setSpecialRequest={setSpecialRequest}
            autoSend={autoSend}
            setAutoSend={setAutoSend}
            categoryName={categoryName}
            submitLabel="Send inquiry"
            sentLabel="Inquiry sent"
            phase={modalPhase}
            isSubmitting={isSubmitting}
            errorMessage={modal.kind === 'error' ? modal.message : null}
            onClose={closeModal}
            onSubmit={submit}
            dialogRef={dialogRef}
          />
        ) : null}
      </div>
    );
  }

  // ── Auto carry-forward CONFIRMATION (Phase 1b PR-5) ────────────────────────
  // The pop-up was skipped; the saved requirements were attached + sent. Show a
  // calm inline note attributing the auto-fill to Setnayan AI + a thread link.
  if (autoState.kind === 'sent') {
    return (
      <div className="space-y-2 rounded-xl border border-terracotta/30 bg-terracotta/5 p-4">
        <p className="flex items-start gap-2 text-sm text-ink">
          <Sparkles
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
            strokeWidth={1.75}
          />
          <span>
            Inquiry sent to{' '}
            <span className="font-semibold">{vendorLabel}</span>. Setnayan AI
            included your saved {categoryName} preferences automatically.
          </span>
        </p>
        <Link
          href={autoState.threadHref}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-mulberry px-4 text-sm font-semibold text-cream hover:bg-mulberry-600"
        >
          <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          View thread
        </Link>
      </div>
    );
  }

  const isAutoSending = autoState.kind === 'sending';

  // ── Main CTA (no existing thread) ─────────────────────────────────────────
  return (
    <>
      {/* Trigger button — shown inline on the vendor profile "Get in touch" section */}
      <button
        type="button"
        onClick={onInquireClick}
        disabled={isSubmitting || isAutoSending}
        className="inline-flex h-11 items-center gap-2 rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-default disabled:opacity-90"
      >
        {isSubmitting || isAutoSending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" aria-hidden />
            Sending…
          </>
        ) : (
          <>
            {autoCarry ? (
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            )}
            {`Inquire with ${vendorLabel}`}
          </>
        )}
      </button>

      {/* Auto carry-forward hint — sets expectation that saved prefs go along. */}
      {autoCarry && autoState.kind === 'idle' ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-ink/55">
          <Sparkles aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          Your saved {categoryName} preferences will be included automatically.
        </p>
      ) : null}

      {/* Auto carry-forward error (rare) — inline, non-blocking. */}
      {autoState.kind === 'error' ? (
        <p className="mt-2 text-xs text-danger-700">{autoState.message}</p>
      ) : null}

      {modal.kind !== 'closed' ? (
        <RequirementsModal
          title={`Inquire with ${vendorLabel}`}
          subtitle="Tell them what you’re looking for."
          topSlot={inquiryTopSlot}
          requirementsFields={requirementsFields}
          reqPayload={reqPayload}
          toggleFacet={toggleFacet}
          specialRequest={specialRequest}
          setSpecialRequest={setSpecialRequest}
          autoSend={autoSend}
          setAutoSend={setAutoSend}
          categoryName={categoryName}
          submitLabel="Send inquiry"
          sentLabel="Inquiry sent"
          phase={modalPhase}
          isSubmitting={isSubmitting}
          errorMessage={modal.kind === 'error' ? modal.message : null}
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
