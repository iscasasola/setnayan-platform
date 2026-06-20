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
 * Bottom-sheet on mobile (<640px), centered dialog on sm+. Clean Editorial
 * palette (Alabaster/Obsidian/Champagne Gold/Mulberry).
 */

import type { ReactNode, RefObject } from 'react';
import { AlertCircle, Check, MessageCircle, X } from 'lucide-react';
import { humanizeFacet, type RequirementField } from '@/lib/requirements-capture';

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="requirements-modal-title"
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
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {topSlot}

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
          {phase === 'error' && errorMessage ? (
            <p className="flex items-center gap-1.5 text-xs text-danger-700">
              <AlertCircle aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {errorMessage}
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
                {sentLabel}
              </>
            ) : isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
