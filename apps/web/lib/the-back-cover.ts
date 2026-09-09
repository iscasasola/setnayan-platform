/**
 * THE BACK COVER — the door after The End.
 *
 * `01_The_Story.md` §3.9 · `08` step 2.7. It sits AFTER the colophon, the way a
 * series page sits after the last chapter, which is precisely why it does not
 * break the locked close: the host's last word and their song are still the last
 * things IN the story. The back cover is outside it.
 *
 * ⚖ THE OWNER'S RULING IS THE SHAPE OF THIS FILE. "A story is finished on its
 * own. Most end here, and that is a whole story." So this returns `null` far
 * more often than not, and a `null` draws NOTHING — no dashed placeholder, no
 * "coming soon", no door. **The back cover is ABSENT, not empty.**
 *
 * ⛔ AND IT NEVER OFFERS A READER A MENU OF EVENT KINDS. Choosing what comes
 * next happens in the Story Maker and nowhere else (owner, 2026-09-07). A reader
 * sees the one sentence the host chose, or sees nothing at all.
 *
 * ── THE WORDS ARE NOT WRITTEN HERE ──────────────────────────────────────────
 * `backCoverOf` in `lib/whats-next.ts` already resolves the title/when/sub, and
 * the Story Maker's live preview renders them from that same function. This file
 * adds only WHOSE DOOR IT IS. A second copy of the sentence is how a preview and
 * a published page come to describe one choice differently.
 */
import { backCoverOf, type NextAnnouncement, type NextCandidate } from './whats-next';
import type { StoryViewer } from './who-can-see-your-story';

/**
 * The one control under the announcement, or `null` for "say the sentence and
 * offer nothing".
 */
export type BackCoverDoor = { label: string; href: string };

export type BackCover = {
  title: string;
  when: string;
  sub: string | null;
  /** `null` for a guest — see THE MISSING DOOR below. */
  door: BackCoverDoor | null;
};

/**
 * 🔴 THE MISSING DOOR, AND WHY IT IS MISSING — do not "finish" this without
 * building the thing first.
 *
 * `01` §3.9 gives the guest the door *"Tell me when there's more"*. **Measured
 * against production on 2026-09-09: nothing can honour it.** There is no
 * event-follow table of any name (`event_follows` · `event_watchers` ·
 * `story_subscriptions` all absent), and `push_subscriptions` holds ZERO rows —
 * web push is built and mounted and has never had a single subscriber.
 *
 * A control that records nothing and notifies nobody is a FAKE DOOR, and this
 * repo has paid for that shape more than once. So the guest gets the sentence
 * and no button, and this constant records the reason where the next person
 * looks. **When a follow mechanism exists, give the guest their door here — and
 * only then.**
 */
export const GUEST_DOOR_IS_UNBUILT =
  'no event-follow table and zero push subscribers — a notify button would record nothing';

/**
 * Compose the back cover for one reader.
 *
 * `null` when the host announced nothing, when the announcement names a kind the
 * screen would never offer (a retired type, a solemn one), or when the words
 * cannot be resolved — every one of those is "draw nothing", never a placeholder.
 */
export function backCoverFor(args: {
  announcement: NextAnnouncement | null;
  offered: readonly NextCandidate[];
  viewer: StoryViewer;
  eventId: string;
}): BackCover | null {
  const words = backCoverOf(args.announcement, args.offered);
  if (!words) return null;

  return { ...words, door: doorFor(args.viewer, args.eventId) };
}

/**
 * Three readers, three answers — and the middle one is deliberately empty.
 *
 * The host is the only reader who can act on this today: it is their own choice,
 * and the desk is where they made it and where they can change it.
 */
export function doorFor(viewer: StoryViewer, eventId: string): BackCoverDoor | null {
  if (viewer.isHost) {
    return { label: 'Open the story maker', href: `/dashboard/${eventId}/story` };
  }
  if (viewer.belongsToEvent) {
    return null; // GUEST_DOOR_IS_UNBUILT
  }
  /*
   * ⚠ `/dashboard/create-event`, NOT `/create`. There is no `/create` route in
   * this app — the first draft of this file invented one, which is the same fake
   * door the guest arm above refuses to ship. This is the address the shipped
   * public pages already send a stranger to for exactly this act; a signed-out
   * visitor meets the sign-in door and lands here afterwards, which is the
   * app's own established behaviour and not a promise this line is making.
   */
  return { label: 'Start your story · free', href: '/dashboard/create-event' };
}
