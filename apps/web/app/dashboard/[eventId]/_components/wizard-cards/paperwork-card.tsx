'use client';

/**
 * Concierge Active Wizard · reusable PaperworkCard primitive.
 *
 * Backs every external_process card that follows the "submit to external
 * process → wait → mark done" shape (cards 25 Cenomar · 26 Church docs ·
 * 27 Pre-Cana · 28 Marriage License · 35 Thank-yous · 36 Reviews · 37
 * Download Photos · plus 17 STD Video + 21 Deploy Invitation + 33 Print
 * outs + 38 Editorial as variants).
 *
 * Two-CTA shape per CLAUDE.md 2026-05-23 Sixth row + owner 2026-05-24
 * option 2A in_flight decision:
 *   [Submitted · in flight] → markTaskInFlight · advances wizard past
 *     this card · row appears in IN-FLIGHT TRAY for later mark-done
 *   [Mark done · I have it]  → markTaskDone · permanent advance
 *
 * Optional `metaFields` array lets each card capture per-card context at
 * submit time (PSA reference number · license number · render job ID ·
 * etc.). Values are stamped onto wizard_state via the generic
 * markTaskInFlight / markTaskDone actions' meta_* formData prefix.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] — every
 * paperwork card surfaces a polite "here's what this is and how long it
 * usually takes" body before the actions. No engineering jargon.
 */

import { useState, useTransition } from 'react';
import { Clock3, CheckCircle2 } from 'lucide-react';
import type { WizardTaskId } from '@/lib/wizard';
import { markTaskInFlight, markTaskDone } from '../../wizard-actions';

export type PaperworkMetaField = {
  /** Form field name (sent server-side as `meta_<name>`). */
  name: string;
  /** Visible label above the input. */
  label: string;
  /** Optional placeholder. */
  placeholder?: string;
  /** HTML input type · defaults to text. */
  type?: 'text' | 'tel' | 'email' | 'url';
  /** Required when present. */
  required?: boolean;
  /** Max chars. */
  maxLength?: number;
};

type Props = {
  eventId: string;
  taskId: WizardTaskId;
  /** Body copy explaining the paperwork step · brand voice · 1-3
   *  short paragraphs. Rendered above the action buttons. */
  intro: React.ReactNode;
  /** Optional fields the host fills BEFORE clicking [Submitted ·
   *  in flight] or [Mark done]. Their values flow to wizard_state via
   *  the meta_* prefix on the generic server actions. */
  metaFields?: ReadonlyArray<PaperworkMetaField>;
  /** Label override for the in-flight CTA. Defaults to "Submitted · in
   *  flight" — some cards (Pre-Cana · Thank-yous) use friendlier copy. */
  inFlightLabel?: string;
  /** Hide the in-flight CTA entirely (some cards skip the in_flight
   *  state because the process is instant — Reviews · Download Photos). */
  hideInFlight?: boolean;
  /** Label override for the mark-done CTA. */
  doneLabel?: string;
};

export function PaperworkCard({
  eventId,
  taskId,
  intro,
  metaFields = [],
  inFlightLabel = 'Submitted · in flight',
  hideInFlight = false,
  doneLabel = 'Mark done',
}: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});

  function buildFormData(): FormData {
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    for (const field of metaFields) {
      const value = metaValues[field.name] ?? '';
      if (value.trim().length > 0) {
        formData.set(`meta_${field.name}`, value.trim());
      } else if (field.required) {
        throw new Error(`${field.label} is required`);
      }
    }
    return formData;
  }

  function fireAction(action: (fd: FormData) => Promise<void>) {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        const formData = buildFormData();
        await action(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't update — try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="text-sm leading-relaxed text-ink/80">{intro}</div>

      {metaFields.length > 0 ? (
        <div className="space-y-3">
          {metaFields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`paperwork-meta-${field.name}`}
                className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
              >
                {field.label}
                {field.required ? <span className="ml-1 text-rose-700">*</span> : null}
              </label>
              <input
                id={`paperwork-meta-${field.name}`}
                type={field.type ?? 'text'}
                value={metaValues[field.name] ?? ''}
                onChange={(e) =>
                  setMetaValues((v) => ({ ...v, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 sm:max-w-md"
              />
            </div>
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!hideInFlight ? (
          <button
            type="button"
            onClick={() => fireAction(markTaskInFlight)}
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Clock3 aria-hidden className="h-4 w-4" strokeWidth={2} />
            {inFlightLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => fireAction(markTaskDone)}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {isPending ? 'Saving…' : doneLabel}
        </button>
      </div>
    </div>
  );
}
