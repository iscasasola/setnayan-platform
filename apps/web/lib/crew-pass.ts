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

/** What the role opens on the crew's Event Hub — said the same way on the supplier's list and on the crew's phone.
 *  These are a COORDINATOR shop's words: only there does the scanner open (see `crewRoleOpens`). */
export const CREW_ROLE_TOOLS_WORDS: Readonly<Record<CrewRole, string>> = {
  member: 'run of show + scanner',
  helper: 'scanner only',
};

/** The same, for a shop that is NOT the coordinator trade — no scanner, so it is never named. */
export const CREW_ROLE_TOOLS_WORDS_NO_SCANNER: Readonly<Record<CrewRole, string>> = {
  member: 'run of show',
  helper: 'day and place only',
};

export const crewToolsWords = (role: CrewRole, coordinator: boolean): string =>
  (coordinator ? CREW_ROLE_TOOLS_WORDS : CREW_ROLE_TOOLS_WORDS_NO_SCANNER)[role];

/**
 * The one rule: which tools a role opens.
 *
 * 🚪 THE SCANNER OPENS ONLY FOR A COORDINATOR SHOP'S CREW. Its door (`crew_seat_by_guest_qr`) refuses every shop that
 * is not booked carrying the coordinator trade (`services_make_a_coordinator`) — so for any other shop it would be a
 * button that always answers "Finding seats is for the coordinator's crew". A door that never opens is not drawn;
 * the crew phone says in words what the pass DOES give (`CREW_NO_SCANNER_LINE`). `coordinator` is the shop's trade,
 * `isCoordinatorTrade(vendor_profiles.services)` — the TS copy of the database's own list.
 */
export function crewRoleOpens(role: CrewRole, coordinator: boolean): { runOfShow: boolean; scanner: boolean } {
  return { runOfShow: crewRoleReadsRunOfShow(role), scanner: coordinator };
}

/** The run of show is the role's alone (a Member's), whatever the shop's trade — so the page can ask it before it
 *  has read the shop. */
export const crewRoleReadsRunOfShow = (role: CrewRole): boolean => role === 'member';

/** On the crew phone, where the scanner would be, for a shop that is not the coordinator. */
export const CREW_NO_SCANNER_LINE = (shop: string, role: CrewRole): string =>
  `Finding guests’ seats is for the coordinator’s crew. ${shop} tells you where you’re needed on the day — this page holds your pass${
    role === 'member' ? ' and the run of show' : ', the event’s day and place'
  }.`;

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
export const CREW_STATUS_WORDS: Readonly<Record<Exclude<CrewRequestStatus, 'allowed' | 'needs_name'> | 'locked', { title: string; line: string }>> = {
  locked: { title: 'Not open yet', line: 'The shop’s Event Hub for this event opens once their booking is settled. Ask them — there is nothing for you to pay.' },
  waiting: { title: 'Waiting for the Allow', line: 'The shop sees your name now. This page opens the Event Hub the moment they tap Allow.' },
  removed: { title: 'Not on the crew', line: 'The shop took this phone off the crew for this event. Ask them if that is a mistake.' },
  ended: { title: 'This event is over', line: 'Crew passes end after the event. Thank you for helping.' },
  invalid: { title: 'This QR does not open anything', line: 'Ask the shop for their crew QR for this event — it may have been replaced.' },
  team: { title: 'You are on this shop’s team', line: 'Open the Event Hub from your own dashboard — you do not need a crew pass.' },
  full: { title: 'Too many phones are waiting', line: 'Ask the shop to Allow or remove the phones waiting first, then scan again.' },
};

/** The line under a crew member on the supplier's list. */
export function crewRowLine(status: CrewStatus, role: CrewRole, coordinator: boolean): string {
  const tools = `${CREW_ROLE_LABEL[role]} · ${crewToolsWords(role, coordinator)}`;
  if (status === 'waiting') return `Wants to join · ${tools}`;
  if (status === 'removed') return `Removed · ${tools}`;
  return `${tools} · in`;
}
