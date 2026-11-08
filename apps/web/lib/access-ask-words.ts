/**
 * access-ask-words.ts — THE WORDS OF A SUPPLIER'S ACCESS ASK (owner 8 Nov 2026), pure so a unit test executes them.
 *
 * Who decides an ask: a host — or, for a supplier who is not the coordinator, the booked coordinator too. A
 * coordinator's own ask is the hosts' alone (never self-approval), so the waiting line names exactly who decides.
 */
import { FLOOR_AREA_LABEL, type AreaVerdict } from './floor-command';
import type { DelegateArea } from './delegate-areas';

/** The last answered ask, line by line — what they asked and what they got. */
export type LastAccessAnswer = {
  requestedAreas: DelegateArea[];
  decisions: Partial<Record<string, AreaVerdict>>;
};

/** Who decides this person's ask — the waiting line's words. */
export function whoDecides(askerIsCoordinator: boolean): string {
  return askerIsCoordinator ? 'the host' : 'the host or the coordinator';
}

/** "Guest list: shared · Budget & payments: declined" — the answer, line by line. */
export function answerLines(answer: LastAccessAnswer): string {
  return answer.requestedAreas
    .map((a) => {
      const v = answer.decisions[a];
      return `${FLOOR_AREA_LABEL[a]}: ${v === 'granted' ? 'shared' : v === 'declined' ? 'declined' : 'no answer'}`;
    })
    .join(' · ');
}
