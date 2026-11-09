/**
 * access-answer-notice.ts — THE IN-APP NOTICE A SUPPLIER GETS WHEN THEIR ACCESS ASK IS ANSWERED (owner 8 Nov 2026), and
 * the database's refusals in words. Pure, so a unit test executes both. In-app only: `access_answered` is not on
 * EMAIL_ENABLED_TYPES (owner: in-app notices only, never email).
 */
import { FLOOR_AREA_LABEL, GRANT_WORDS, type AreaVerdict } from './floor-command';
import type { DelegateArea } from './delegate-areas';

export function accessAnswerNotice(input: {
  eventId: string;
  eventName: string | null;
  decisions: Partial<Record<DelegateArea, AreaVerdict>>;
  askerIsCoordinator: boolean;
}): { title: string; body: string; relatedUrl: string } {
  const who = input.eventName?.trim() || 'The couple';
  const shared = (Object.keys(input.decisions) as DelegateArea[]).filter((a) => input.decisions[a] === 'granted');
  const declined = (Object.keys(input.decisions) as DelegateArea[]).filter((a) => input.decisions[a] === 'declined');
  const title =
    shared.length === 0
      ? `${who} did not share what you asked for`
      : `${who} shared ${shared.map((a) => FLOOR_AREA_LABEL[a]).join(', ')} with you`;
  const parts: string[] = [];
  if (shared.length > 0) {
    parts.push(input.askerIsCoordinator ? `You ${GRANT_WORDS.edit}.` : `You ${GRANT_WORDS.view}.`);
  }
  if (declined.length > 0) parts.push(`Not shared: ${declined.map((a) => FLOOR_AREA_LABEL[a]).join(', ')}.`);
  return {
    title: title.slice(0, 160),
    body: parts.join(' ').slice(0, 200),
    relatedUrl: `/vendor-dashboard/clients/${input.eventId}`,
  };
}

/** `answer_area_access_request`'s refusals, in the words a person reads. Nothing changed in any of them. */
export function areaAnswerRefusal(message: string): string {
  if (/already answered/.test(message)) return 'That request was already answered.';
  if (/no such ask/.test(message)) return 'Could not find that request.';
  if (/their own ask/.test(message)) return 'You cannot answer your own request. The host decides it.';
  if (/do not hold/.test(message)) return 'You can only share a part the host shared with you. Nothing has changed.';
  if (/only a host or the coordinator/.test(message)) return 'Only the host or the coordinator can answer this. Nothing has changed.';
  if (/at least one part/.test(message)) return 'Choose share or decline for at least one thing.';
  return 'We could not record that just now. Nothing has changed. Please try again.';
}
