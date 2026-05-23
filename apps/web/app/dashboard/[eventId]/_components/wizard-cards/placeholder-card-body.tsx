/**
 * Concierge Active Wizard · placeholder card body.
 *
 * Iteration 0016 · Phase 1 framework consumer. The WizardHero renders this
 * body inside <WizardCard> when the resolved active task does NOT yet have
 * an inline-completion UI implemented (Phases 2-5 are still landing).
 *
 * Polite brand voice per [[feedback_setnayan_no_dev_text_post_launch]] ·
 * never "coming soon" or "TODO" or "in development". The copy reads as a
 * deliberate "we're crafting this experience" beat rather than an
 * engineering placeholder.
 *
 * Once Phase 2-5 PRs ship their card variants, the WizardHero adds the
 * matching `case task.id === ... return <SomeCard ... />` branch and the
 * placeholder stops rendering for that task. No changes needed here.
 */

import { Sparkles } from 'lucide-react';

type Props = {
  /** The wizard task ID currently resolving as active focus. Used only
   *  for the data-task-id attribute (helps QA spot which placeholder
   *  fired without changing the visible UI). */
  taskId: string;
};

export function PlaceholderCardBody({ taskId }: Props) {
  return (
    <div
      data-wizard-task-id={taskId}
      className="space-y-3 rounded-xl border border-ink/10 bg-cream/60 p-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles
          aria-hidden
          className="h-3.5 w-3.5 text-terracotta"
          strokeWidth={2}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
          Crafting this card
        </p>
      </div>
      <p className="text-sm leading-relaxed text-ink/75">
        We&apos;re building this step into the same inline-completion shape
        as the date card you just used. It lands with the next refresh —
        you won&apos;t miss a beat when it does.
      </p>
    </div>
  );
}
