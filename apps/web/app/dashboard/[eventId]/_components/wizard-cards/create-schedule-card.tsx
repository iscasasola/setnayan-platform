'use client';

/**
 * Card 15 Create Schedule · Programming tier.
 *
 * Inline schedule block editor INSIDE the wizard card (NO LINK to
 * /dashboard/[eventId]/schedule). Surfaces 6 default Filipino-wedding
 * blocks with editable start/end times · host can adjust each pair +
 * mark done.
 *
 * V1 limitation: this card writes a single "rough schedule" payload to
 * wizard_state.create_schedule meta rather than the full
 * event_schedule_blocks table — the full editor stays at /schedule
 * for granular blocks (rehearsal · processional · cord ceremony · etc.).
 * Card 15's job is to give the host the LOAD-BEARING first pass so the
 * wizard advances; the schedule page picks up the refinement work.
 *
 * Brand voice per [[feedback_setnayan_no_dev_text_post_launch]] — copy
 * reads as polite editorial Filipino, no engineering jargon.
 */

import { useState, useTransition } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { markTaskDone } from '../../wizard-actions';

type ScheduleBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
};

const DEFAULT_BLOCKS: ReadonlyArray<ScheduleBlock> = [
  { id: 'preparation', title: 'Preparation', start: '08:00', end: '13:00' },
  { id: 'ceremony', title: 'Ceremony', start: '14:00', end: '15:30' },
  { id: 'cocktails', title: 'Cocktail hour', start: '16:00', end: '17:00' },
  { id: 'reception_program', title: 'Reception · program', start: '17:00', end: '20:00' },
  { id: 'first_dance', title: 'First dance + open floor', start: '20:00', end: '21:00' },
  { id: 'send_off', title: 'Send-off', start: '22:00', end: '23:00' },
];

type Props = {
  eventId: string;
};

export function CreateScheduleCard({ eventId }: Props) {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([...DEFAULT_BLOCKS]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateBlock(idx: number, field: 'start' | 'end', value: string) {
    setBlocks((bs) => bs.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  }

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'create_schedule');
    // Stamp the rough schedule into wizard_state meta — the full editor
    // at /schedule reads from event_schedule_blocks for granular blocks.
    formData.set(
      'meta_rough_schedule',
      blocks
        .map((b) => `${b.title}: ${b.start}–${b.end}`)
        .join(' · '),
    );
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your schedule. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm leading-relaxed text-ink/75">
        Sketch out the spine of your wedding day. You can refine the
        granular blocks later — this is the load-bearing first pass that
        keeps your vendors aligned on timing.
      </p>

      <div className="space-y-2">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            className="flex items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-2.5 sm:gap-3"
          >
            <Clock
              aria-hidden
              className="h-3.5 w-3.5 flex-shrink-0 text-ink/40"
              strokeWidth={2}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {block.title}
            </span>
            <input
              type="time"
              value={block.start}
              onChange={(e) => updateBlock(idx, 'start', e.target.value)}
              className="w-[88px] rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:text-sm"
            />
            <span aria-hidden className="text-xs text-ink/40">
              →
            </span>
            <input
              type="time"
              value={block.end}
              onChange={(e) => updateBlock(idx, 'end', e.target.value)}
              className="w-[88px] rounded border border-ink/15 bg-cream px-2 py-1 text-xs sm:text-sm"
            />
          </div>
        ))}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
        {isPending ? 'Saving…' : 'Lock the rough schedule'}
      </button>

      <p className="text-xs text-ink/55">
        Finer-grained blocks (rehearsal · processional · cord ceremony ·
        cake cutting · etc.) live on your Schedule page for later
        refinement.
      </p>
    </form>
  );
}
