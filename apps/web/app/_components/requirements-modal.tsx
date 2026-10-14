'use client';

/**
 * RequirementsModal — the shared per-category "What we're looking for" editor.
 *
 * Extracted from inquiry-composer.tsx (Phase 1b PR-3) so BOTH surfaces share it:
 *   • the PUBLIC vendor page Inquire pop-up (apps/web/app/v/[slug]/_components/
 *     inquiry-composer.tsx) — passes a `topSlot` with the inquiry-only sections
 *     (pax pill · "Inquiring about" · "Comes with" · "Also ask about"), and a
 *     "Send inquiry" CTA that sends the thread.
 *   • the couple Shortlist customization icon (Phase 1b PR-4) — no `topSlot`,
 *     just the requirements core, with a "Save" CTA that persists via
 *     setEventPreference.
 *
 * The reusable CORE (always rendered): the leaf's admin multi_select facets as
 * checkbox chips ("What we're looking for"), a free-text "Special request" box,
 * and the "keep + auto-send to my next inquiries" affordance. Pre-filled by the
 * caller's controlled state. Inquiry-specific context lives in `topSlot`, which
 * keeps the public Inquire pop-up rendering EXACTLY as before.
 *
 * Bottom-sheet on mobile (<640px), centered dialog on sm+.
 *
 * 2026-10-12 look sweep: every control is the house kind — the facets are `Chips`, the keep is the one `SwitchTrack`,
 * the CTA an `ActionButton` (main), the ✕ a 44-px target; the dark behind is the popup rule's `sn-popup-dark`; what is
 * only read sits on the panel and ends in a divider (no boxed backgrounds); colours are flipping tokens.
 */

import type { ReactNode, RefObject } from 'react';
import { AlertCircle, Check, Loader2, MessageCircle, X } from 'lucide-react';
import { humanizeFacet, type RequirementField } from '@/lib/requirements-capture';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { ActionButton } from '@/components/action-button';
import { Chips } from './chips';
import { SwitchTrack } from './switch-track';

/** CTA lifecycle so the footer button reflects submit/sent state. */
export type RequirementsModalPhase = 'idle' | 'submitting' | 'sent' | 'error';

export type RequirementsModalProps = {
  /** Eyebrow text in the header (e.g. "Inquire with Acme" / "Catering requirements"). */
  title: string;
  /** Sub-line under the title. */
  subtitle?: string;
  /**
   * Inquiry-only context block rendered ABOVE the requirements core (pax pill,
   * "Inquiring about", "Comes with", "Also ask about"). Omitted on the shortlist
   * edit surface — there's only the requirements core.
   */
  topSlot?: ReactNode;
  /** The leaf's couple-facing multi_select facets. Empty → only the note box. */
  requirementsFields: RequirementField[];
  /** Controlled facet selections, keyed by field key. */
  reqPayload: Record<string, Set<string>>;
  toggleFacet: (fieldKey: string, option: string) => void;
  /** Controlled free-text special request. */
  specialRequest: string;
  setSpecialRequest: (v: string) => void;
  /** Controlled carry-forward flag. */
  autoSend: boolean;
  setAutoSend: (v: boolean) => void;
  /** Human label for the category ("Catering"), for the keep/auto-send copy. */
  categoryName: string;
  /** Footer CTA label in the idle state (e.g. "Send inquiry" / "Save"). */
  submitLabel: string;
  /** Footer CTA label once complete (e.g. "Inquiry sent" / "Saved"). */
  sentLabel: string;
  /** CTA lifecycle. */
  phase: RequirementsModalPhase;
  /** Disable inputs while submitting / sent. */
  isSubmitting: boolean;
  /** Error message to surface inline (only shown when phase === 'error'). */
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: () => void;
  dialogRef: RefObject<HTMLDivElement | null>;
};

export function RequirementsModal({
  title,
  subtitle,
  topSlot,
  requirementsFields,
  reqPayload,
  toggleFacet,
  specialRequest,
  setSpecialRequest,
  autoSend,
  setAutoSend,
  categoryName,
  submitLabel,
  sentLabel,
  phase,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
  dialogRef,
}: RequirementsModalProps) {
  const sent = phase === 'sent';
  // This sub-component mounts only while open, so mount = open. The shared hook
  // handles focus trap + restore + Esc-to-close + body-scroll-lock.
  useModalA11y({ open: true, onClose, containerRef: dialogRef });
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end justify-center focus:outline-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="requirements-modal-title"
    >
      {/* The popup rule's dark — dark AND blurred; a tap on it closes. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="sn-popup-dark absolute inset-0 cursor-default"
      />

      {/* Modal panel */}
      <div
        className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink/10 bg-cream dark:bg-raised shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:rounded-2xl sm:shadow-[0_30px_80px_-40px_rgba(26,26,26,0.4)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div>
            <p
              id="requirements-modal-title"
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta"
            >
              {title}
            </p>
            {subtitle ? <p className="mt-0.5 text-sm text-ink/70">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {topSlot}

          {/* ── Per-category requirements (Phase 1b PR-3) ──────────────────── */}
          {requirementsFields.length > 0 ? (
            <div className="space-y-4 border-b border-ink/15 pb-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
                What we&rsquo;re looking for
              </p>
              {requirementsFields.map((field) => {
                const selected = reqPayload[field.key] ?? new Set<string>();
                return (
                  <fieldset key={field.key} className="space-y-2">
                    <legend className="block text-sm font-medium text-ink/80">{field.label}</legend>
                    <Chips
                      label={field.label}
                      options={field.options.map((opt) => ({
                        key: opt,
                        label: humanizeFacet(opt),
                        disabled: isSubmitting || sent,
                      }))}
                      value={Array.from(selected)}
                      onToggle={(opt) => toggleFacet(field.key, opt)}
                    />
                  </fieldset>
                );
              })}
            </div>
          ) : null}

          {/* Special request free-text */}
          <div className="space-y-1.5">
            <label
              htmlFor="requirements-special-request"
              className="block text-sm font-medium text-ink/80"
            >
              Special request
            </label>
            <textarea
              id="requirements-special-request"
              value={specialRequest}
              onChange={(e) => setSpecialRequest(e.target.value)}
              disabled={isSubmitting || sent}
              maxLength={2000}
              rows={3}
              placeholder="Anything specific you'd like this supplier to know?"
              className="input-field w-full"
            />
          </div>

          {/* Keep + auto-send affordance — the one switch, at the end of a button that also holds the words. */}
          <button
            type="button"
            role="switch"
            aria-checked={autoSend}
            onClick={() => setAutoSend(!autoSend)}
            disabled={isSubmitting || sent}
            className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-sm text-ink/80">
              Keep this to reuse for other {categoryName} inquiries
              <span className="mt-0.5 block text-xs text-ink/55">
                We&rsquo;ll auto-fill these for your next {categoryName} supplier.
              </span>
            </span>
            <SwitchTrack on={autoSend} />
          </button>

          {/* Error */}
          {phase === 'error' && errorMessage ? (
            <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--color-danger))]">
              <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {errorMessage}
            </p>
          ) : null}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-ink/10 px-5 py-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          {sent ? (
            <ActionButton tone="ok" main icon={Check} label={sentLabel} className="w-full" />
          ) : isSubmitting ? (
            <ActionButton
              tone="brand"
              main
              waiting
              icon={<Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} />}
              label="Saving…"
              className="w-full"
            />
          ) : (
            <ActionButton tone="brand" main icon={MessageCircle} label={submitLabel} onClick={onSubmit} className="w-full" />
          )}
        </div>
      </div>
    </div>
  );
}
