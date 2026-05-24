/**
 * Concierge Active Wizard · horizontal carousel surface.
 *
 * Owner-locked 2026-05-24: today's focus becomes a horizontal scroll
 * carousel showing the active focus card + the next few upcoming cards.
 * Cards with unmet prerequisites render DARKENED + unactionable with
 * "Locked until {prereq.title}" copy.
 *
 * Layout:
 *   - Mobile (<sm): full-width cards, snap-x scroll, one visible at a time
 *   - Tablet (sm-lg): ~60% width cards, snap-x scroll, 1-2 visible
 *   - Desktop (lg+): ~40% width cards, snap-x scroll, 2-3 visible
 *
 * Card states (visual):
 *   - ACTIVE (first unsettled with prereqs met): full color · interactive
 *     · renders the full inline-completion body via renderCardBody.
 *   - PEEK-UNLOCKED (subsequent unsettled tasks with prereqs met): lighter
 *     · renders a compact "Up next" preview · NOT interactive (preserves
 *     the canonical flow — host completes active before moving on).
 *   - PEEK-LOCKED (subsequent tasks with prereqs unmet): darkened ·
 *     unactionable · "Locked until {prereq.title}" copy.
 *
 * Per [[feedback_setnayan_concierge_wizard_ux]] · NO LINKS within the
 * carousel · active card completes inline · locked / peek cards show
 * status only.
 */

import { Lock, ArrowRight } from 'lucide-react';
import {
  isTaskUnlocked,
  getFirstUnmetPrereq,
  type WizardTask,
  type WizardTaskId,
  type WizardState,
} from '@/lib/wizard';
import { WizardCard } from './wizard-card';

type Props = {
  /** Pre-resolved by parent · first entry is the ACTIVE focus, rest are
   *  upcoming peek cards. Use lib/wizard.ts `getCarouselTasks(state, N)`. */
  tasks: ReadonlyArray<WizardTask>;
  /** events.wizard_state · used to compute lock state per task. */
  state: WizardState;
  /** The active task's inline-completion body, pre-rendered by parent
   *  via renderCardBody dispatch (parent has the runtime context: event
   *  data, recommendations, etc.). */
  activeCardBody: React.ReactNode;
  /** Optional per-task body map · when present, EVERY task in the
   *  carousel renders its full active-card body instead of the peek
   *  preview shape. Used by the temp preview-all-cards mode so the host
   *  can walk through every card's actual content during preview · NOT
   *  just the title + "Up next" arrow. The parent (`wizard-hero.tsx`)
   *  decides which mode to ship based on the TEMP_WIZARD_PREVIEW_ALL_CARDS
   *  flag in `lib/wizard.ts` and feeds this map when the flag is on. */
  taskBodies?: ReadonlyMap<WizardTaskId, React.ReactNode>;
};

export function WizardCarousel({
  tasks,
  state,
  activeCardBody,
  taskBodies,
}: Props) {
  if (tasks.length === 0) return null;

  const activeTask = tasks[0]!;
  const peekTasks = tasks.slice(1);

  // No section-level "Today's focus" header — the inner WizardCard
  // shell already renders that rail. A second header here showed up as
  // a duplicate in production. Owner directive 2026-05-24.
  return (
    <section
      aria-label="Today's focus carousel"
      className="space-y-3"
    >
      {/* Carousel track · scroll-snap-x. Each card claims FULL VIEWPORT
          WIDTH (basis-full) so only ONE card is visible at a time. The
          next/locked cards exist in the track but only become visible
          when the host swipes horizontally. Owner directive 2026-05-24:
          peeks should NOT show; one card fills the surface.

          Premium-feel snap behavior (2026-05-24 owner directive):
            · `snap-mandatory`        — every scroll position lands on a snap point
            · `snap-always` (per li)  — a flick can NEVER skip past a card,
                                        even with momentum (browser fling)
            · `scroll-smooth`         — programmatic scrolls (e.g. arrow
                                        keys or future "scroll-to-step"
                                        helpers) ease rather than jump
            · `overscroll-x-contain`  — horizontal scroll inside the
                                        carousel never propagates to the
                                        page, so a fast swipe doesn't
                                        rubber-band the body
            · `touch-pan-x` (per li)  — explicit horizontal pan affordance
                                        so iOS Safari handles both
                                        horizontal carousel swipe AND
                                        vertical page scroll cleanly.
                                        2026-05-24 mobile-scroll-lock fix:
                                        was `touch-pan-x` which BLOCKED
                                        vertical pan inside the card —
                                        after tapping a calendar day in
                                        Card 01, iOS would lock vertical
                                        page scroll until the next clean
                                        gesture. `touch-manipulation`
                                        (touch-action: manipulation) allows
                                        pan-x + pan-y + pinch-zoom; the
                                        only thing it disables is the
                                        300ms double-tap-zoom delay, which
                                        is fine for app UI. */}
      <div className="-mx-4 sm:-mx-6 lg:mx-0">
        <ul className="flex snap-x snap-mandatory scroll-smooth overscroll-x-contain gap-3 overflow-x-auto scroll-px-4 px-4 pb-4 sm:scroll-px-6 sm:px-6 sm:gap-4 lg:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* ACTIVE card · first slot · full inline-completion body.
           *  basis-full = consumes the full visible width on every
           *  breakpoint. The carousel container is constrained by the
           *  parent dashboard column width, so on desktop this means
           *  full column · on mobile means full viewport.
           *
           *  Width-containment guards (2026-05-24 owner directive ·
           *  "card never exceeds screen size"):
           *    · `max-w-full` — card cannot grow past parent width even
           *      if a child element tries to set an inline pixel width
           *    · `min-w-0`    — allows flex children of the card body
           *      to shrink properly (fixes long-text overflow that
           *      would otherwise force horizontal scroll inside the
           *      card itself) */}
          <li className="snap-start snap-always shrink-0 basis-full max-w-full min-w-0 touch-manipulation">
            <WizardCard task={activeTask}>{activeCardBody}</WizardCard>
          </li>

          {/* PEEK cards · subsequent slots. By default (canonical mode)
              render the compact peek preview shape based on lock state
              · same basis-full · only visible after the host swipes /
              scrolls past the active card. When the parent passes
              `taskBodies`, every peek card renders its FULL active-card
              body instead · used by the temp preview-all-cards mode.
              Each peek li carries the same snap-always + width-guards
              so the lock-to-card behavior + screen-size containment
              hold for every position in the carousel. */}
          {peekTasks.map((task) => {
            const body = taskBodies?.get(task.id);
            const unlocked = isTaskUnlocked(state, task);
            const firstUnmet = unlocked ? null : getFirstUnmetPrereq(state, task);
            return (
              <li
                key={task.id}
                className="snap-start snap-always shrink-0 basis-full max-w-full min-w-0 touch-manipulation"
              >
                {body ? (
                  // Preview-all-cards mode · render the same active card
                  // shell the parent built for this task so the host can
                  // walk through every card's actual UI.
                  <WizardCard task={task}>{body}</WizardCard>
                ) : unlocked ? (
                  <PeekUnlockedPreview task={task} />
                ) : (
                  <PeekLockedPreview task={task} blockingPrereq={firstUnmet} />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * Preview card for an UPCOMING task whose prereqs are met but is not
 * yet the active focus (because the active focus comes first in
 * canonical order). Lighter visual treatment + "Up next" badge ·
 * no interactive body.
 */
function PeekUnlockedPreview({ task }: { task: WizardTask }) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-2xl border border-ink/15 bg-cream/60 p-5 opacity-90 transition-opacity hover:opacity-100 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/60 px-3 py-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">
            {task.pillLabel}
          </span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Step {task.order} of 38
        </p>
      </header>

      <div className="space-y-2">
        <h3 className="font-display text-xl italic leading-tight text-ink sm:text-2xl">
          {task.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-relaxed text-ink/70">
          {task.whyItMatters}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2 text-[11px] text-ink/55">
        <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
        <span className="font-mono uppercase tracking-[0.12em]">Up next</span>
      </div>
    </article>
  );
}

/**
 * Preview card for an UPCOMING task whose prerequisites aren't met.
 * Darkened · unactionable · surfaces the FIRST unmet prereq title so
 * the host knows what they need to complete to unlock this card.
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] · brand-voice
 * "Locked until {X}" copy — no engineering jargon.
 */
function PeekLockedPreview({
  task,
  blockingPrereq,
}: {
  task: WizardTask;
  blockingPrereq: WizardTask | null;
}) {
  return (
    <article className="relative flex h-full flex-col gap-4 rounded-2xl border border-ink/10 bg-ink/[0.04] p-5 opacity-60 sm:p-6">
      <span className="sr-only">Locked task.</span>
      <header className="flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/40 px-3 py-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {task.pillLabel}
          </span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
          Step {task.order} of 38
        </p>
      </header>

      <div className="space-y-2">
        <h3 className="font-display text-xl italic leading-tight text-ink/60 sm:text-2xl">
          {task.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-ink/45">
          {task.whyItMatters}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2 rounded-lg border border-ink/10 bg-white/40 px-3 py-2 text-xs text-ink/65">
        <Lock aria-hidden className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} />
        <span className="leading-snug">
          {blockingPrereq ? (
            <>
              Locked until <strong className="font-medium text-ink/85">{blockingPrereq.title}</strong>{' '}
              is done.
            </>
          ) : (
            <>Locked — a prior step needs to wrap first.</>
          )}
        </span>
      </div>
    </article>
  );
}
