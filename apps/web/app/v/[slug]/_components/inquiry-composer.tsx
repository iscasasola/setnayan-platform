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
import {
  SaveToContinue,
  SaveGateHint,
} from '@/app/_components/anon-gate/save-to-continue';
import { onServiceInquiryFocus } from '@/lib/service-inquiry-focus';

export type InquiryComposerService = {
  vendorServiceId: string;
  label: string;
  priceLabel: string;
  /**
   * The early-booking tier THIS couple's event date qualifies them for, already
   * named server-side ("Booked 6+ months ahead · −10%"). Owner-locked
   * 2026-07-27: the ladder is picked by their date, never negotiated in chat.
   * null / absent → no tier applies, or the vendor hides prices → nothing shown.
   * DISPLAY ONLY — the vendor confirms the final price in their reply.
   */
  leadTierNote?: string | null;
};

/** The couple's saved requirements template for this category (pre-fill). */
export type SavedRequirements = {
  payload: Record<string, string[]>;
  specialRequest: string;
  autoSend: boolean;
};

/**
 * EVERYTHING the composer needs to open on ONE specific service — the whole
 * prop set it currently receives for `activeServices[0]`, resolved per service.
 *
 * WHY THIS EXISTS. The composer's `initial` has always been the vendor's FIRST
 * active service, whichever card the couple was actually reading. Once the
 * details sheet gives them a per-card "Inquire about this", that seam becomes a
 * visible lie: they read card five, tapped Inquire, and the pop-up says card
 * one. So the page hands over every service's context, and the composer swaps
 * to whichever one the sheet names.
 *
 * The per-CATEGORY fields matter as much as the label: `requirementsFields` and
 * `savedRequirements` are keyed by `canonical_service`, so re-pointing the
 * composer without them would show a photographer's facets on a caterer's
 * inquiry.
 *
 * Populated ONLY when `serviceDetailsEnabled()`. Empty ⇒ the bus is not even
 * subscribed and every path below is the shipped one.
 */
export type InquiryComposerServiceDetail = InquiryComposerService & {
  categoryKey: string | null;
  /** Human category label, for the "keep this to reuse for other X" copy. */
  categoryLabel: string | null;
  /** This service's price-included "comes with" set. */
  linked: { label: string }[];
  /** The leaf's couple-facing multi_select facets. */
  requirementsFields: RequirementField[];
  /** The couple's saved template for (event, this category). */
  savedRequirements: SavedRequirements | null;
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
  /**
   * Anon-draft: true when the viewer is a Supabase ANONYMOUS user (finished
   * onboarding without an account). The public vendor page lives outside the
   * dashboard's AnonGateProvider, so it passes this explicitly. When true, the
   * Inquire click shows the "save your plan" prompt up front instead of
   * optimistically firing the inquiry and bouncing on `not_secured`. Default
   * false (secured users + signed-out visitors are unaffected — a signed-out
   * visitor still falls through to the server `not_signed_in` → /login path).
   */
  viewerIsAnonymous?: boolean;
  /**
   * Creator Economy PR-C — the `?ref_chapter=` public_id the viewer arrived
   * with (a chapter's Book CTA). Threaded through to startServiceInquiry,
   * which VALIDATES it server-side before stamping CTA-click attribution.
   */
  referringChapterPublicId?: string | null;
  /**
   * Inquiry-source taxonomy (owner 2026-07-17) — a caller-declared, enum-
   * validated origin for live non-chapter sources (e.g. 'editorial' when the
   * viewer arrived via a /realstories credit chip). null = website default.
   */
  inquirySource?: string | null;
  /**
   * Per-service context for the details sheet's "Inquire about this"
   * (flag: NEXT_PUBLIC_SERVICE_DETAILS_ENABLED). When the sheet names a service
   * present here, the composer re-points `initial` / `linked` / `alsoOptions` /
   * the requirements form at THAT service and opens.
   *
   * Empty (the default) ⇒ the focus bus is never subscribed and every prop
   * above is used exactly as it is today.
   */
  serviceDetails?: InquiryComposerServiceDetail[];
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
  viewerIsAnonymous = false,
  referringChapterPublicId = null,
  inquirySource = null,
  serviceDetails = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalState>({ kind: 'closed' });
  const [gateOpen, setGateOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Per-service focus (flag: NEXT_PUBLIC_SERVICE_DETAILS_ENABLED) ──────────
  // Which service the details sheet pointed us at. null = the server's default
  // (`activeServices[0]`), i.e. exactly today's behaviour.
  const [focusedServiceId, setFocusedServiceId] = useState<string | null>(null);

  // ── Requirements capture state (pre-filled from the saved template) ────────
  const [reqPayload, setReqPayload] = useState<Record<string, Set<string>>>(() =>
    seedReqPayload(savedRequirements),
  );
  const [specialRequest, setSpecialRequest] = useState<string>(
    savedRequirements?.specialRequest ?? '',
  );
  const [autoSend, setAutoSend] = useState<boolean>(savedRequirements?.autoSend ?? false);
  // Bundle nudge (flag-gated): default ON so adding extra services nudges a
  // single bundle quote; the couple can opt out.
  const [wantBundle, setWantBundle] = useState<boolean>(true);

  // ── Auto carry-forward (Phase 1b PR-5) ─────────────────────────────────────
  // The gate: Setnayan AI ON + a saved row for this category with auto_send=true.
  // When true the Inquire click skips the pop-up and sends the SAVED template
  // straight through. `savedRequirements` is the couple's own event_vendor_-
  // preferences row (the only source) — never any vendor-authored content.
  const autoCarry = shouldAutoCarryForward(aiActive, savedRequirements);
  const [autoState, setAutoState] = useState<AutoCarryState>({ kind: 'idle' });

  // ── The ACTIVE service — the focused one, else the server's default ────────
  // Every read below goes through these, so there is ONE place that decides
  // which service this pop-up is about. With `serviceDetails` empty (flag off)
  // `focused` is always null and each of these IS the prop it replaced.
  const detailById = useMemo(
    () => new Map(serviceDetails.map((d) => [d.vendorServiceId, d])),
    [serviceDetails],
  );
  const focused = focusedServiceId ? (detailById.get(focusedServiceId) ?? null) : null;
  const activeInitial: InquiryComposerService & { categoryKey: string | null } = focused
    ? {
        vendorServiceId: focused.vendorServiceId,
        label: focused.label,
        priceLabel: focused.priceLabel,
        leadTierNote: focused.leadTierNote ?? null,
        categoryKey: focused.categoryKey,
      }
    : initial;
  const activeLinked = focused ? focused.linked : linked;
  const activeAlsoOptions: InquiryComposerService[] = focused
    ? serviceDetails
        .filter((d) => d.vendorServiceId !== focused.vendorServiceId)
        .map((d) => ({
          vendorServiceId: d.vendorServiceId,
          label: d.label,
          priceLabel: d.priceLabel,
        }))
    : alsoOptions;
  const activeRequirementsFields = focused ? focused.requirementsFields : requirementsFields;
  const activeSavedRequirements = focused ? focused.savedRequirements : savedRequirements;
  const activeCategoryLabel = focused ? focused.categoryLabel : categoryLabel;

  // Point the pop-up at the service the details sheet named, then open it.
  //
  // Subscribed only when the server handed over per-service context, so the
  // shipped path adds not one listener. An id we were not given is IGNORED —
  // the sheet cannot make this composer inquire about something the server did
  // not serialize. This is always an EXPLICIT open, never an auto-send: the
  // couple asked about THIS card, so they see the pop-up even when Setnayan
  // AI's carry-forward would normally skip it.
  useEffect(() => {
    if (detailById.size === 0) return;
    return onServiceInquiryFocus((id) => {
      const detail = detailById.get(id);
      if (!detail) return;
      if (viewerIsAnonymous) {
        // Opening a vendor thread needs a secured account — ask up front rather
        // than letting them fill the pop-up and bounce on `not_secured`.
        setGateOpen(true);
        return;
      }
      setFocusedServiceId(id);
      // Re-seed the capture form from THIS category's saved template, so the
      // couple never sees a caterer's answers on a photographer's inquiry.
      setChecked(new Set());
      setReqPayload(seedReqPayload(detail.savedRequirements));
      setSpecialRequest(detail.savedRequirements?.specialRequest ?? '');
      setAutoSend(detail.savedRequirements?.autoSend ?? false);
      setModal({ kind: 'open' });
    });
  }, [detailById, viewerIsAnonymous]);

  const alsoById = useMemo(
    () => new Map(activeAlsoOptions.map((s) => [s.vendorServiceId, s])),
    [activeAlsoOptions],
  );
  const hasAlsoOptions = activeAlsoOptions.length > 0;
  // Proactive bundle nudge — LIVE by default (2026-06-21); kill-switch:
  // NEXT_PUBLIC_BUNDLE_NUDGE_ENABLED=false (NEXT_PUBLIC inlined at build).
  const bundleNudge = process.env.NEXT_PUBLIC_BUNDLE_NUDGE_ENABLED !== 'false';
  const anyAlsoChecked = activeAlsoOptions.some((s) => checked.has(s.vendorServiceId));
  const categoryName = (activeCategoryLabel ?? '').trim() || 'this category';

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
    // Drop the details-sheet focus with the pop-up, so the next plain "Inquire"
    // click is about the vendor's default service again rather than silently
    // inheriting whichever card was last opened. No-op when the flag is off.
    setFocusedServiceId(null);
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
        initialServiceId: activeInitial.vendorServiceId,
        initialCategoryKey: activeInitial.categoryKey,
        alsoServiceIds,
        requestBundleQuote: bundleNudge && wantBundle && alsoServiceIds.length > 0,
        requirements: {
          payload,
          specialRequest: specialRequest.trim() || null,
          autoSend,
        },
        // Creator Economy PR-C — provenance (server-validated before stamping).
        referringChapterPublicId,
        inquirySource,
      });
      if (result.status === 'ok') {
        setModal({ kind: 'sent' });
        router.push(`/dashboard/${result.eventId}/messages/${result.threadId}`);
        return;
      }
      if (result.status === 'not_signed_in' || result.status === 'not_secured') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        // Anon-draft: an anonymous couple (not_secured) must CREATE an account to
        // convert in place before opening a vendor thread; a signed-out visitor
        // goes to login. Either way they return here afterward.
        const dest = result.status === 'not_secured' ? '/signup' : '/login';
        window.location.href = `${dest}?next=${next}`;
        return;
      }
      if (result.status === 'no_event') {
        // No event yet — take them to create one instead of dead-ending on a
        // message with no path forward; they return here after.
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/onboarding/wedding?next=${next}`;
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
        initialServiceId: activeInitial.vendorServiceId,
        initialCategoryKey: activeInitial.categoryKey,
        // Auto-send carries only the saved per-category requirements — it never
        // auto-opts into the vendor's other "also ask about" services.
        alsoServiceIds: [],
        requirements: carry,
        // Creator Economy PR-C — provenance (server-validated before stamping).
        referringChapterPublicId,
        inquirySource,
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
      if (result.status === 'not_signed_in' || result.status === 'not_secured') {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        // Anon-draft: an anonymous couple (not_secured) must CREATE an account to
        // convert in place before opening a vendor thread; a signed-out visitor
        // goes to login. Either way they return here afterward.
        const dest = result.status === 'not_secured' ? '/signup' : '/login';
        window.location.href = `${dest}?next=${next}`;
        return;
      }
      if (result.status === 'no_event') {
        // No event yet — take them to create one instead of dead-ending.
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/onboarding/wedding?next=${next}`;
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
    // Anon-draft: opening a vendor thread needs a secured account. Ask up front
    // rather than letting them fill the pop-up (or auto-fire) and bounce.
    if (viewerIsAnonymous) {
      setGateOpen(true);
      return;
    }
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
            {activeInitial.label}
          </span>
          <span className="font-mono text-[11px] text-ink/55">{activeInitial.priceLabel}</span>
        </div>
        {/* Early-booking tier, picked by THEIR event date (owner-locked
            2026-07-27). Display only — say so, because the quote is still the
            vendor's to confirm. */}
        {activeInitial.leadTierNote ? (
          <p className="px-1 text-[11px] text-ink/60">
            <span className="font-medium text-ink/75">{activeInitial.leadTierNote}</span>{' '}
            — {vendorLabel} confirms the final price in their reply.
          </p>
        ) : null}
      </fieldset>

      {/* Linked services — read-only ✓ included */}
      {activeLinked.length > 0 ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
            Comes with
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {activeLinked.map((l, i) => (
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

      {/* Also-ask checkboxes (multi-service vendors only). Bundle nudge (flag)
          reframes this into a proactive "add these for one bundle price" ask. */}
      {hasAlsoOptions ? (
        <fieldset className="space-y-2">
          {bundleNudge ? (
            <div className="rounded-lg border border-mulberry/25 bg-mulberry/[0.04] px-3 py-2">
              <p className="text-sm font-medium text-ink">
                {vendorLabel} also offers these
              </p>
              <p className="text-xs text-ink/60">
                Add any that fit your day and ask for <span className="font-medium text-ink">one bundle price</span> — often cheaper than booking separately.
              </p>
            </div>
          ) : (
            <legend className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/50">
              Also ask about
            </legend>
          )}
          <ul className="space-y-1.5">
            {activeAlsoOptions.map((s) => {
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
          {bundleNudge && anyAlsoChecked ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-mulberry/30 bg-mulberry/5 px-3 py-2.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={wantBundle}
                onChange={() => setWantBundle((v) => !v)}
                disabled={isSubmitting || sent}
                className="h-4 w-4 rounded border-ink/30 text-mulberry focus:ring-mulberry"
              />
              <span>Ask {vendorLabel} for <span className="font-medium">one bundle price</span> for everything above</span>
            </label>
          ) : null}
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
            requirementsFields={activeRequirementsFields}
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

      {/* Anon-draft pre-emptive note — the account step is visible before the
          tap. Suppressed once they've an existing-thread shortcut (no CTA). */}
      {viewerIsAnonymous ? (
        <SaveGateHint>
          Free to plan — you’ll save your account to send this to the vendor.
        </SaveGateHint>
      ) : null}

      {/* Auto carry-forward hint — sets expectation that saved prefs go along. */}
      {!viewerIsAnonymous && autoCarry && autoState.kind === 'idle' ? (
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
          requirementsFields={activeRequirementsFields}
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

      <SaveToContinue open={gateOpen} onClose={() => setGateOpen(false)} action="message" />
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
