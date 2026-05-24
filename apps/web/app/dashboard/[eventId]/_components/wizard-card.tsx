/**
 * Concierge Active Wizard · framework card shell.
 *
 * Iteration 0016 · Phase 0 framework per CLAUDE.md Sixth 2026-05-23 row
 * (V1 SCOPE EXPANSION). Provides the visual chrome + state primitives that
 * every one of the 38 wizard cards renders inside. The CARD-SPECIFIC inline
 * UI (date picker · vendor pick · checklist · etc.) is passed in as
 * `children` so this shell stays decoupled from individual card logic ·
 * Phases 1-5 add the per-card variants without touching this file.
 *
 * Visual chrome:
 *   - ★ TODAY'S FOCUS heading rail (terracotta accent)
 *   - Pill row: phase label (e.g. "FOUNDATION") on left · position badge
 *     ("Step 2 of 48") on right · position = canonical index in
 *     WIZARD_TASKS sorted by order field
 *   - Display-typeface title in italic Cormorant
 *   - Why-it-matters paragraph in body Manrope at 75% ink
 *   - Children slot for the card-specific inline form
 *   - Optional footer slot for the [Save] action + secondary actions
 *
 * Reusable across all three card kinds:
 *   - 'data_input' cards (date · palette · monogram · etc.) pass a form
 *     as children + a [Save] button as footer
 *   - 'vendor_pick' cards pass a vendor-recommendations list as children
 *     + nothing as footer (each vendor row has its own [Lock] button)
 *   - 'external_process' cards pass a checklist or upload widget as
 *     children + [Mark done] as footer
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]]: pill
 * labels + titles + whyItMatters are all curated in WIZARD_TASKS in
 * lib/wizard.ts · never placeholder text · never engineering jargon.
 *
 * No client-side state lives here · the card is a thin presentational
 * shell. Each card's interactivity ships in its own client component
 * mounted as `children`. Phase 0 framework only.
 */

import { Star } from 'lucide-react';
import { WIZARD_TASKS, type WizardTask } from '@/lib/wizard';

type Props = {
  task: WizardTask;
  /** Card-specific inline UI (form · vendor list · checklist · etc.). */
  children: React.ReactNode;
  /** Optional footer · usually the [Save] button + secondary actions. */
  footer?: React.ReactNode;
  /** Total task count override · defaults to WIZARD_TASKS.length so the
   *  display always reflects the current sequence (was hardcoded 38 ·
   *  fixed 2026-05-24 alongside the wizard's 38 → 64 expansion). */
  totalTasks?: number;
};

export function WizardCard({
  task,
  children,
  footer,
  totalTasks = WIZARD_TASKS.length,
}: Props) {
  return (
    <section
      aria-labelledby="wizard-card-heading"
      className="space-y-3"
    >
      {/* ★ TODAY'S FOCUS rail · same as legacy TodaysOneThing so the
          transition between the two during the Phase 1-5 rollout doesn't
          jar the host visually. */}
      <header className="flex items-baseline gap-2">
        <Star
          aria-hidden
          className="h-3.5 w-3.5 text-terracotta"
          strokeWidth={1.75}
        />
        <h2
          id="wizard-card-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta"
        >
          Today&apos;s focus
        </h2>
      </header>

      {/* `overflow-hidden` + `min-w-0` ensure that no child element
       *  (long string, fixed-width image, accidental table) can push
       *  the card width past its container. Belt-and-suspenders on top
       *  of the carousel li's `max-w-full` · together they guarantee
       *  the card never exceeds the screen on any viewport. */}
      <article className="flex min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border-2 border-terracotta/30 bg-cream p-6 sm:p-8">
        {/* Phase pill (left) + order badge (right) */}
        <header className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/40 bg-terracotta/5 px-3 py-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              {task.pillLabel}
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
            Step {WIZARD_TASKS.findIndex((t) => t.id === task.id) + 1} of {totalTasks}
          </p>
        </header>

        {/* Title + why-it-matters · curated in WIZARD_TASKS · brand voice */}
        <div className="space-y-3">
          <h3 className="font-display text-2xl italic leading-tight text-ink sm:text-3xl">
            {task.title}
          </h3>
          <p className="text-sm leading-relaxed text-ink/75 sm:text-base">
            {task.whyItMatters}
          </p>
        </div>

        {/* Card-specific inline UI · passed in as children */}
        <div className="space-y-3">{children}</div>

        {/* Optional footer · [Save] action or secondary buttons */}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </article>
    </section>
  );
}
