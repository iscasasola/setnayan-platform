/**
 * 🏠 THE INVITATION'S WELCOME PAGE IS THE GUEST'S OWN (owner 2026-09-30, verbatim:
 * *"on invitation we can set the reminders. Home is their personalization.
 * customized mood board. reminders. also E-Gifts should already show."* — and the
 * same day, the page's name: *"on Invitation, the menu is Welcome - Details - Our
 * Love Story - Me"*). DECISION_LOG "THE INVITATION'S HOME IS THE GUEST'S OWN PAGE".
 *
 * After the reply, the Welcome page carries three things, in this order:
 *
 *   1. `look`      — what THIS guest wears: the dress code's "you" block (their
 *                    role, outfit, colours, the figure, the Do's & Don'ts), read
 *                    from the couple's Mood Board. Everyone's palette stays on
 *                    Details.
 *   2. `reminders` — the couple's own lines ("Arrive by 2:30", "Bring your
 *                    ticket"). NOT a new store: the shipped `what_to_bring` scene
 *                    (`events.what_to_bring`), written in the Maker in place and
 *                    called "Reminders" to guests.
 *   3. `gifts`     — the E-Gifts door, shown NOW rather than at the foot of the
 *                    page, whenever the couple has at least one gift method on.
 *
 * 🔑 NOTHING EMPTY. For a guest a part is listed only when it has something to
 * say: no reminders written → no Reminders; no gift method → no E-Gifts (never a
 * "no gifts yet" block). The Maker's canvas is the one exception — there the
 * couple sees each place so they can fill it (the house rule for empty scenes).
 *
 * 🔑 ONE ANSWER, THREE READERS. The guest tree, the stranger's tree and the
 * Maker's navigator (`lib/maker-scene-list.ts`) all ask THIS function, so the
 * navigator's Welcome group and the page's Welcome can never disagree.
 *
 * Pure: no React, no DB.
 */
import type { LifecyclePhase } from './invitation-widgets';

export const WELCOME_PARTS = ['look', 'reminders', 'gifts'] as const;
export type WelcomePart = (typeof WELCOME_PARTS)[number];

/** The scene each Welcome part is drawn from, when it is one (the gift door is not). */
export const WELCOME_PART_SCENE: Readonly<Record<WelcomePart, 'dress_code' | 'what_to_bring' | null>> = {
  look: 'dress_code',
  reminders: 'what_to_bring',
  gifts: null,
};

export type WelcomeInput = {
  /** The stage the page is showing (`pageStageFor`). Welcome is the Invitation's. */
  stage: LifecyclePhase;
  /** `plan.body === 'normal'` — the Save the Date film and the after-day story have no Welcome. */
  bodyNormal: boolean;
  /** The scene types this page draws, from the page's own plan (hidden ones are absent). */
  scenes: readonly string[];
  /** The reader is an invited guest (only a guest has a role to dress for). */
  identified: boolean;
  /** `events.what_to_bring` — the couple's reminders. */
  reminders: string | null | undefined;
  /** `resolveGuestDoorways(...).pabuya` — null when the gift page would turn this reader away or has nothing on it. */
  giftHref: string | null;
  /** The Maker's canvas: draw each place, filled or not, so the couple can fill it. */
  maker: boolean;
};

/** Which Welcome parts this page draws, in order. Empty off the Invitation. */
export function welcomeParts(input: WelcomeInput): WelcomePart[] {
  if (input.stage !== 'rsvp' || !input.bodyNormal) return [];
  const out: WelcomePart[] = [];
  if (input.scenes.includes('dress_code') && (input.identified || input.maker)) out.push('look');
  if (input.scenes.includes('what_to_bring') && (input.maker || (input.reminders ?? '').trim().length > 0)) {
    out.push('reminders');
  }
  if (welcomeCarriesGifts(input)) out.push('gifts');
  return out;
}

/**
 * Does the Welcome page carry the E-Gifts door? Asked on its own by the page's
 * foot strip (`GuestDoorwayStrip`), which draws the same door on every other
 * stage — so there is ONE gift door on a page, never two. Identity plays no
 * part: the door is the gift page's own gate (`giftHref`), for every reader.
 */
export function welcomeCarriesGifts(input: Pick<WelcomeInput, 'stage' | 'bodyNormal' | 'giftHref' | 'maker'>): boolean {
  return input.stage === 'rsvp' && input.bodyNormal && (Boolean(input.giftHref) || input.maker);
}

/**
 * The Maker canvas keys that leave the page WITH a scene. The guest's look is
 * the dress code's own half, so taking the dress code off the page takes the
 * look with it — the eye hides both at once, and the canvas hold expects the
 * render without both (`editor-shell.tsx` `hideOnCanvas`), so it never reloads.
 */
export function keysLeavingWith(sceneKey: string): string[] {
  return sceneKey === 'w:dress_code' ? [sceneKey, 'f:look'] : [sceneKey];
}

/** The scenes Details still draws once Welcome has taken its own (Reminders moves; the dress code stays for everyone). */
export function scenesLeftForDetails<T extends { widget_type: string }>(widgets: readonly T[], parts: readonly WelcomePart[]): T[] {
  return parts.includes('reminders') ? widgets.filter((w) => w.widget_type !== 'what_to_bring') : [...widgets];
}
