/**
 * 📱 CREW PASSES — the words and the one rule for what a crew role opens (owner 2026-10-29, DECISION_LOG "CREW JOIN
 * THE SUPPLIER'S EVENT HUB BY QR — AND SEE ONLY THE EVENT HUB"; prototype `hubCrew`: "Member = run of show + scanner ·
 * Helper = scanner only. No Today, Customers, Shop or money. A new phone waits for your Allow; the pass ends after the
 * event."). The access itself is the database's (`vendor_crew_passes` · `current_vendor_crew_pass` ·
 * `crew_seat_by_guest_qr`); this file only names it. Pure — no imports.
 */

export type CrewRole = 'member' | 'helper';
export type CrewStatus = 'waiting' | 'allowed' | 'removed';

export const CREW_ROLES: readonly CrewRole[] = ['member', 'helper'];

export const CREW_ROLE_LABEL: Readonly<Record<CrewRole, string>> = { member: 'Member', helper: 'Helper' };

/** What the role opens on the crew's Event Hub — said the same way on the supplier's list and on the crew's phone. */
export const CREW_ROLE_TOOLS_WORDS: Readonly<Record<CrewRole, string>> = {
  member: 'run of show + scanner',
  helper: 'scanner only',
};

/** The one rule: which tools a role opens. */
export function crewRoleOpens(role: CrewRole): { runOfShow: boolean; scanner: boolean } {
  return { runOfShow: role === 'member', scanner: true };
}

export const crewRoleOf = (raw: unknown): CrewRole => (raw === 'member' ? 'member' : 'helper');

/** Where a crew QR sends a phone. Outside the supplier dashboard on purpose: crew have no shop. */
export const crewJoinPath = (token: string) => `/join/crew/${token}`;

/** A crew QR token is 32 lowercase hex characters (the table's CHECK). */
export const isCrewToken = (raw: string): boolean => /^[0-9a-f]{32}$/.test(raw);

/** What `crew_pass_request` answers. */
export type CrewRequestStatus = 'needs_name' | 'waiting' | 'allowed' | 'removed' | 'ended' | 'invalid' | 'team' | 'full';

const STATUSES: readonly CrewRequestStatus[] = ['needs_name', 'waiting', 'allowed', 'removed', 'ended', 'invalid', 'team', 'full'];
export const crewRequestStatusOf = (raw: unknown): CrewRequestStatus =>
  (STATUSES as readonly unknown[]).includes(raw) ? (raw as CrewRequestStatus) : 'invalid';

/** The crew phone's one line for every state that is not the Event Hub itself. */
export const CREW_STATUS_WORDS: Readonly<Record<Exclude<CrewRequestStatus, 'allowed' | 'needs_name'>, { title: string; line: string }>> = {
  waiting: { title: 'Waiting for the Allow', line: 'The shop sees your name now. This page opens the Event Hub the moment they tap Allow.' },
  removed: { title: 'Not on the crew', line: 'The shop took this phone off the crew for this event. Ask them if that is a mistake.' },
  ended: { title: 'This event is over', line: 'Crew passes end after the event. Thank you for helping.' },
  invalid: { title: 'This QR does not open anything', line: 'Ask the shop for their crew QR for this event — it may have been replaced.' },
  team: { title: 'You are on this shop’s team', line: 'Open the Event Hub from your own dashboard — you do not need a crew pass.' },
  full: { title: 'Too many phones are waiting', line: 'Ask the shop to Allow or remove the phones waiting first, then scan again.' },
};

/** The line under a crew member on the supplier's list. */
export function crewRowLine(status: CrewStatus, role: CrewRole): string {
  const tools = `${CREW_ROLE_LABEL[role]} · ${CREW_ROLE_TOOLS_WORDS[role]}`;
  if (status === 'waiting') return `Wants to join · ${tools}`;
  if (status === 'removed') return `Removed · ${tools}`;
  return `${tools} · in`;
}
