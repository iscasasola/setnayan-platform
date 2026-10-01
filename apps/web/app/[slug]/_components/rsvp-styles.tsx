import type { ReactNode } from 'react';
import { formatCount } from '@/lib/format-number';

/**
 * THE RSVP'S OTHER TWO STYLES — B · The question and C · The ticket
 * (prototype `every_scene_three_styles_2026-09-29.html` §11). A · The reply
 * card is `RsvpWidget`'s own header and answers.
 *
 * 🔒 SAME FIELDS, SAME ORDER, SAME ACTION. A style replaces exactly two
 * things in `RsvpWidget` — the card's header and the look of the three
 * answers — and nothing else: every question the couple switched on, the
 * selfie, the terms tick and the Privacy Notice line, the "one question at a
 * time" switch and the form's own server action all stay the widget's. The
 * answers here are the SAME radio group (`name="rsvp_status"`, the same three
 * values, the same labels, the same `required`) inside the same
 * `data-rsvp-step` fieldset the one-at-a-time walker steps through, so the
 * `:has(…attending:checked)` rule still reveals the rest after "yes".
 */

/** Yes or no — a guest is never offered "maybe" (main, owner 2026-09-30). */
export type RsvpAnswerOption = { key: 'attending' | 'declined'; label: string };

/** B's header — the one question, by the guest's name. */
export function RsvpQuestionHeader({
  firstName,
  question,
  admitCount,
  pill,
}: {
  firstName: string;
  /** "Will you be there?" — the widget's own words for the event's register. */
  question: string;
  admitCount: number;
  pill: ReactNode;
}) {
  const lowered = question.charAt(0).toLowerCase() + question.slice(1);
  return (
    <header className="space-y-3" data-scene-style="question">
      <div className="flex items-start justify-between gap-4">
        <p className="pahina-eyebrow">
          <span>Reply</span>
        </p>
        {pill}
      </div>
      <p className="font-pahina text-[2.4rem] font-light leading-[1.05] tracking-tight text-ink">
        {firstName ? `${firstName}, ${lowered}` : question}
      </p>
      {admitCount > 1 ? (
        <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">{formatCount(admitCount)} seats are yours</p>
      ) : null}
    </header>
  );
}

/** C's header — a tear-off ticket: the guest's name, the admit count and their number on the stub. */
export function RsvpTicketHeader({
  guestName,
  stubNumber,
  admitCount,
  pill,
}: {
  guestName: string;
  stubNumber: string;
  admitCount: number;
  pill: ReactNode;
}) {
  return (
    <header className="space-y-3" data-scene-style="ticket">
      <div className="flex items-start justify-between gap-4">
        <p className="pahina-eyebrow">
          <span>Reply</span>
        </p>
        {pill}
      </div>
      <div className="flex items-stretch border border-ink/20 bg-paper-deep">
        <div className="min-w-0 flex-1 px-4 py-3">
          <p className="font-sans text-xs uppercase tracking-[0.28em] text-ink/60">Admit {formatCount(admitCount)}</p>
          <p className="mt-1 truncate font-pahina text-2xl font-light leading-tight text-ink">{guestName}</p>
        </div>
        <div className="flex w-24 shrink-0 flex-col items-center justify-center border-l border-dashed border-ink/30 px-2 py-3 text-center">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-ink/60">Nº</p>
          <p className="font-mono text-base tabular-nums text-gild">{stubNumber}</p>
        </div>
      </div>
    </header>
  );
}

/**
 * The answers, as B's big buttons or C's stamps. The same radio group
 * the reply card draws; only the shape of each label changes.
 */
export function RsvpStyledAnswers({
  sceneStyle,
  legend,
  options,
  current,
  required,
  legendShown = false,
}: {
  sceneStyle: 'question' | 'ticket';
  /** The question's own header says it, so B hides its legend visually — unless there is no header (the Reply door). */
  legendShown?: boolean;
  legend: string;
  options: readonly RsvpAnswerOption[];
  /** The guest's stored answer, pre-checked. */
  current: string | null;
  required: boolean;
}) {
  const stamp = sceneStyle === 'ticket';
  return (
    <fieldset data-rsvp-step data-scene-style={sceneStyle} className="space-y-2">
      <legend
        className={
          stamp
            ? 'mb-2 font-sans text-xs uppercase tracking-[0.28em] text-ink/60'
            : legendShown
              ? 'mb-2 font-serif text-xl text-ink'
              : 'sr-only'
        }
      >
        {stamp ? 'Stamp your answer' : legend}
      </legend>
      <div className={stamp ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
        {options.map((option) => (
          <label
            key={option.key}
            className={
              stamp
                ? 'flex min-h-16 min-w-0 cursor-pointer items-center justify-center break-words rounded-md border-2 border-dashed border-ink/25 px-1 text-center font-sans text-xs font-semibold uppercase leading-tight tracking-[0.04em] text-ink/70 transition-colors has-[:checked]:-rotate-2 has-[:checked]:border-solid has-[:checked]:border-terracotta has-[:checked]:text-terracotta-700'
                : 'flex min-h-14 cursor-pointer items-center justify-center rounded-full bg-ink/[0.05] px-5 font-pahina text-xl italic leading-tight text-ink transition-colors has-[:checked]:bg-ink has-[:checked]:text-cream'
            }
          >
            <input
              type="radio"
              name="rsvp_status"
              value={option.key}
              defaultChecked={current === option.key}
              required={required || undefined}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
