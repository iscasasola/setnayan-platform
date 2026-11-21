/**
 * 💸 "REMIND THE HOSTS" — the words of the coordinator's one money verb (owner 2026-11-21, DECISION_LOG "COORDINATOR:
 * DUE PAYMENTS VIEWABLE + 'REMIND THE HOSTS', NOT LOGGABLE"). The press calls the database's ONE door,
 * `remind_the_hosts_of_a_payment` (migration 20271357113669), which checks the caller holds Payments at View, logs
 * nothing, pays nothing, and tells every host in the app. PURE — the refusals as words, so a refusal is never silent.
 */
export const REMIND_THE_HOSTS = 'Remind the hosts';
export const REMINDED = 'Reminded';

export function remindRefusalWords(status: string | null | undefined): string {
  switch (status) {
    case 'already_reminded':
      return 'You reminded them about this today.';
    case 'is_host':
      return 'You are a host — pay it from Budget.';
    case 'not_a_helper':
    case 'no_payments_access':
      return 'Payments are not shared with you.';
    case 'not_this_event':
      return 'That supplier is not on this event.';
    case 'no_hosts':
      return 'There is no other host to remind.';
    case 'not_signed_in':
      return 'Please sign in again.';
    default:
      return 'That did not send. Nothing changed — try again.';
  }
}

/** "Due Dec 1" — read off the calendar day itself, in UTC, so no timezone moves it. */
export function dueWord(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return 'Due';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
}
