'use client';

/**
 * Concierge Active Wizard · IN-FLIGHT TRAY surface.
 *
 * Renders below the WizardHero focus card when one or more wizard tasks
 * are marked in_flight (host signaled the process is running externally
 * but hasn't marked done yet). Per CLAUDE.md 2026-05-23 Sixth row + owner
 * decision 2026-05-24 picking option 2A: slow paperwork shouldn't block
 * the wizard, so the resolver skips in-flight tasks · this tray gives the
 * host one-click access to mark done when the process lands (PSA returned ·
 * Pre-Cana attended · render finished).
 *
 * Pattern per [[feedback_setnayan_concierge_wizard_ux]] — NO LINKS, all
 * actions complete inline. Each in-flight row has a `[Mark done]` form
 * button that fires `markTaskDone` server action. Cards stay accessible
 * here until the host completes them.
 */

import { useTransition, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { WIZARD_TASKS, type WizardTaskId } from '@/lib/wizard';
import { markTaskDone } from '../wizard-actions';

type Props = {
  eventId: string;
  taskIds: ReadonlyArray<WizardTaskId>;
};

export function InFlightTray({ eventId, taskIds }: Props) {
  if (taskIds.length === 0) return null;

  const taskMap = new Map(WIZARD_TASKS.map((t) => [t.id, t]));

  return (
    <section
      aria-labelledby="wizard-in-flight-heading"
      className="space-y-2"
    >
      <header className="flex items-baseline gap-2">
        <Clock3
          aria-hidden
          className="h-3.5 w-3.5 text-ink/55"
          strokeWidth={1.75}
        />
        <h2
          id="wizard-in-flight-heading"
          className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink/55"
        >
          In flight
        </h2>
      </header>

      <ul className="overflow-hidden rounded-xl border border-ink/10 bg-cream/40">
        {taskIds.map((taskId) => {
          const task = taskMap.get(taskId);
          if (!task) return null;
          return (
            <InFlightRow
              key={taskId}
              eventId={eventId}
              taskId={taskId}
              title={task.title}
            />
          );
        })}
      </ul>

      <p className="text-[11px] leading-relaxed text-ink/45">
        These are running in the background. Come back to mark them done when ready.
      </p>
    </section>
  );
}

function InFlightRow({
  eventId,
  taskId,
  title,
}: {
  eventId: string;
  taskId: WizardTaskId;
  title: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't mark this done. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 border-b border-ink/10 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{title}</p>
        {errorMessage ? (
          <p role="alert" className="mt-0.5 text-xs text-rose-800">
            {errorMessage}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleMarkDone}
        disabled={isPending}
        className="inline-flex min-h-[32px] flex-shrink-0 items-center gap-1.5 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-cream focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {isPending ? 'Marking…' : 'Mark done'}
      </button>
    </li>
  );
}
