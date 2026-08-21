import { isFinishedEvent, manilaTodayISO } from '@/lib/event-board';

/**
 * story-opens-when-untold.ts — a story cannot be told before the day happens.
 *
 * Owner 2026-08-21: *"editorial will unlock only after the event"*, and the
 * story lives on the **Untold** shelf of My Events — the place a celebration
 * lands once it leaves *Coming up*.
 *
 * 🔑 THE GATE IS THE SHELF, NOT A SEPARATE DATE RULE. `isFinishedEvent` is what
 * moves a card from *Coming up* to the finished shelf; reusing it means the
 * board and the story can never disagree about whether a celebration is over.
 * A second date comparison written here would be a second answer to the same
 * question, and this repo has paid for that shape more than once.
 *
 * ⚠ AND IT MUST BE THE PH-LOCAL DAY. `manilaTodayISO` collapses "now" in
 * Asia/Manila; the server's clock is UTC on Vercel. Between Manila midnight and
 * 8am the two disagree by a whole day — which is exactly the morning after a
 * wedding, the moment this gate decides.
 */

export type StoryGate =
  | { open: true }
  | { open: false; reason: 'not_yet'; opensAfter: string | null };

/**
 * May this celebration's story be written yet?
 *
 * An ARCHIVED event counts as finished — `isFinishedEvent` says so, and a couple
 * who put a celebration away has finished with it either way.
 *
 * A DATELESS event is open. There is no day to wait for, so refusing would be a
 * wait with no end: prod carries such events ("Movie Night" had no date for a
 * while), and telling somebody "come back after the day" when there is no day is
 * a door that never opens.
 */
export function storyGate(
  event: {
    event_date: string | null;
    event_end_date?: string | null;
    archived?: boolean | null;
  },
  now: Date = new Date(),
): StoryGate {
  // A DATELESS celebration is open. There is no day to wait for, so refusing
  // would be a wait with no end — prod carries such events, and telling somebody
  // "come back after the day" when there is no day is a door that never opens.
  if (!event.event_date && !event.event_end_date) return { open: true };

  /*
    🔑 THE WHOLE QUESTION IS DELEGATED. `isFinishedEvent` already knows that an
    archived event counts as finished and that a multi-day celebration ends on
    `event_end_date`, not its first morning. The first draft of this file
    re-collapsed the end date itself — a second answer to a question the board
    already answers, which is the shape that puts a card on one shelf while the
    story believes another.
  */
  const finished = isFinishedEvent(
    {
      event_date: event.event_date,
      event_end_date: event.event_end_date ?? null,
      archived: event.archived ?? false,
    } as Parameters<typeof isFinishedEvent>[0],
    manilaTodayISO(now),
  );

  return finished
    ? { open: true }
    : {
        open: false,
        reason: 'not_yet',
        opensAfter: event.event_end_date ?? event.event_date,
      };
}
