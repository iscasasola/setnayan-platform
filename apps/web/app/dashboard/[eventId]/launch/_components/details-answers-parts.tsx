import type { ReactNode } from 'react';
import { Camera, Gift } from 'lucide-react';
import type { GiftsMode } from '@/lib/event-type-profile';
import type { AnswerItemKey, DetailsItemModel } from '@/lib/maker-details-items';
import {
  LOGO_QUESTION,
  answerKeyOf,
  answerSub,
  coverChoices,
  coverQuestion,
  giftsChoices,
  giftsLabel,
  giftsQuestion,
  logoChoices,
  papicChoices,
  papicLabel,
  papicQuestion,
  type AnswerChoice,
  type EventAnswerColumn,
} from '@/lib/event-answers';
import { NOT_SET_YET } from '@/lib/event-details-sheet';
/* ⚡ The dropdowns load when Details is opened — never with the Maker. */
import { AnswerPicker } from './details-lazy';

/**
 * 🗂 YOUR INFO › THE ANSWERS — the rows, pictures and editors for
 * `maker-details.tsx` (owner 2026-10-02, DECISION_LOG "EVERY ANSWER ABOUT AN
 * EVENT LIVES IN EVENT DETAILS ("YOUR INFO") — ONE HOME, MAPPED"), composed the
 * way `details-your-event-parts.tsx` composes Your event: per item, the
 * navigator row, the body and the editor.
 *
 *   · (Event settings left the Maker 2026-10-02 — it saves live; it lives on
 *     the Event Details page, `details/page.tsx`.)
 *   · Photos from guests · Gifts — one dropdown each over their column.
 *   · The logo and the event-photo answers ride on the items they are about
 *     (Logo · Hero): `logoAnswer` / `coverAnswer`, and their line under the row.
 *
 * Every word shown is read from data: the answer is the stored column (the
 * draft over live), the words are the onboarding card's own
 * (`lib/event-answers.ts`). Nothing here names a wedding: the gift word, the
 * solemn register and the one-or-two names come from the event type.
 */
export type AnswersInput = {
  solemn: boolean;
  /** Two named people (the logo's "No, use our names"). */
  twoPeople: boolean;
  giftsMode: GiftsMode;
  /** Offered = the type has a camera (`cameraDefault !== 'off'`). */
  papic: { offered: boolean; value: boolean | null };
  /** Offered = the type takes gifts (`giftsMode !== 'none'`). */
  gifts: { offered: boolean; value: boolean | null };
  logo: boolean | null;
  cover: boolean | null;
};

type NavRow = Omit<DetailsItemModel, 'key' | 'group'> & { icon: ReactNode };

/** The answer as one card — the question, and what was answered, from the stored value. */
function AnswerCard({ question, answer }: { question: string; answer: string }) {
  return (
    <section className="sn-tile w-full max-w-sm p-5" data-answer-card="">
      <p className="text-sm font-semibold text-ink">{question}</p>
      <p className="mt-2 font-serif text-2xl text-ink">{answer || NOT_SET_YET}</p>
    </section>
  );
}

function answerOf(column: EventAnswerColumn, value: boolean | null, choices: readonly AnswerChoice[]): string {
  return answerSub(choices, answerKeyOf(column, value));
}

export function answerParts({
  eventId,
  answers,
}: {
  eventId: string;
  answers: AnswersInput | null;
}): {
  keys: AnswerItemKey[];
  rows: Partial<Record<AnswerItemKey, NavRow>>;
  bodies: Partial<Record<AnswerItemKey, ReactNode>>;
  editors: Partial<Record<AnswerItemKey, ReactNode>>;
} {
  const keys: AnswerItemKey[] = [];
  const rows: Partial<Record<AnswerItemKey, NavRow>> = {};
  const bodies: Partial<Record<AnswerItemKey, ReactNode>> = {};
  const editors: Partial<Record<AnswerItemKey, ReactNode>> = {};

  if (answers?.papic.offered) {
    const choices = papicChoices();
    const answer = answerOf('papic_on', answers.papic.value, choices);
    const question = papicQuestion(answers.solemn);
    keys.push('papic');
    rows.papic = { label: papicLabel(answers.solemn), sub: answer, icon: <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} /> };
    bodies.papic = <AnswerCard question={question} answer={answer} />;
    editors.papic = <AnswerPicker eventId={eventId} column="papic_on" label={question} choices={choices} saved={answers.papic.value} />;
  }

  if (answers?.gifts.offered) {
    const choices = giftsChoices();
    const answer = answerOf('gifts_on', answers.gifts.value, choices);
    const question = giftsQuestion(answers.giftsMode);
    keys.push('gifts');
    rows.gifts = { label: giftsLabel(answers.giftsMode), sub: answer, icon: <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} /> };
    bodies.gifts = <AnswerCard question={question} answer={answer} />;
    editors.gifts = <AnswerPicker eventId={eventId} column="gifts_on" label={question} choices={choices} saved={answers.gifts.value} />;
  }

  return { keys, rows, bodies, editors };
}

/** "Do you want a logo?" — on the Logo item, with its line for the navigator row. */
export function logoAnswer(eventId: string, answers: AnswersInput): { node: ReactNode; sub: string } {
  const choices = logoChoices(answers.twoPeople);
  return {
    node: <AnswerPicker eventId={eventId} column="logo_wanted" label={LOGO_QUESTION} choices={choices} saved={answers.logo} />,
    sub: answerOf('logo_wanted', answers.logo, choices),
  };
}

/** "Event photo" — on the Hero item, with its line for the navigator row. */
export function coverAnswer(eventId: string, answers: AnswersInput): { node: ReactNode; sub: string } {
  const choices = coverChoices(answers.solemn);
  return {
    node: (
      <AnswerPicker eventId={eventId} column="cover_photo_wanted" label={coverQuestion(answers.solemn)} choices={choices} saved={answers.cover} />
    ),
    sub: answerOf('cover_photo_wanted', answers.cover, choices),
  };
}
