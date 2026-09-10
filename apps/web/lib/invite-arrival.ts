/**
 * lib/invite-arrival.ts
 *
 * THE INVITE LINK IS AN ARRIVAL, NOT A FORM (owner 2026-09-10).
 *
 * A guest who opens `/{slug}/invite` walks through three doors:
 *
 *   Name  → they type their name; it is matched against the couple's list
 *           (name-as-answer-key) or they are admitted anyway (optimistic admit).
 *   Reply → they complete their own guest record. The email they give there is
 *           also their login, and Google / Apple sit at the top of the door.
 *   Enter → the hand-off, then the Event Hub itself (`/{slug}` — the couple's
 *           site IS the Event Hub; see EVENT_HUB_CONTROLLER_DESIGN_2026-09-02 §1).
 *
 * The owner cut a fourth "offer an account" step on 2026-09-10: the email on
 * Reply already is the account, so asking for it twice was the step that read
 * like a sign-up pitch. `/join/[eventId]/set-password` survives only as the
 * RETURN leg of the emailed link, not as a step of this arrival.
 *
 * 🔑 THE BEADS ARE DECISIONS, NOT STAGES. DoorShell's StepRail rule: a bead
 * carries a decision name, never a number or a percent; exactly one is current.
 */

/** The three doors of the arrival, in walking order. */
export type ArrivalDoor = 'name' | 'reply' | 'enter';

const ARRIVAL: readonly { door: ArrivalDoor; label: string }[] = [
  { door: 'name', label: 'Name' },
  { door: 'reply', label: 'Reply' },
  { door: 'enter', label: 'Enter' },
];

/**
 * The rail for one door — structurally a `DoorStep[]` (door-shell.tsx), kept
 * as a local shape so this pure module never imports a component file.
 */
export function arrivalSteps(
  current: ArrivalDoor,
): { label: string; done?: boolean; current?: boolean }[] {
  const at = ARRIVAL.findIndex((d) => d.door === current);
  return ARRIVAL.map((d, i) => ({
    label: d.label,
    ...(i < at ? { done: true } : {}),
    ...(i === at ? { current: true } : {}),
  }));
}

/**
 * What a form posts to say "send me on through the arrival" — a KEYWORD, never
 * a path. Every destination below is built from the event's slug as read from
 * the DATABASE by the action, so no caller can steer a redirect. That is the
 * open-redirect lesson `[slug]/redeem` paid for on live prod (2026-08-06).
 */
export const INVITE_RETURN = 'invite' as const;

/** True only for the exact keyword — anything else keeps an action's old behaviour. */
export function isInviteReturn(value: unknown): boolean {
  return value === INVITE_RETURN;
}

/** The keyword `/join/[eventId]/connect` accepts to come back to the Reply door. */
export const CONNECT_THEN_REPLY = 'reply' as const;

/** Door 02. `slug` must come from the database, never from input. */
export function inviteReplyPath(slug: string): string {
  return `/${slug}/invite/reply`;
}

/** Door 03. `slug` must come from the database, never from input. */
export function inviteEnterPath(slug: string): string {
  return `/${slug}/invite/enter`;
}

/**
 * Set by the Reply door's save when it emails a sign-in link, and read by the
 * Enter door so "your sign-in link is on its way" is only ever said when a link
 * actually went. Holds the EVENT id (not the address), so a guest invited to two
 * weddings is never told about a link for the other one — and it doubles as the
 * de-dupe: a guest who saves their reply three times gets one email, not three.
 */
export const INVITE_LINK_SENT_COOKIE = 'sn_invite_link_sent';
