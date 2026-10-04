/**
 * 📄 THE GUEST'S PAGES, AS THE MAKER'S "PAGE ▾" (owner 2026-09-30, pointing at
 * the guest Event Hub's bottom bar, verbatim: *"on the navigator, there should
 * be Home, Details, Story, Me on top dropdown so we can fix and improve the
 * event hub itself for invitation"* — and, the same day, naming each stage's
 * menu: *"on Invitation, the menu is Welcome - Details - Our Love Story - Me"*,
 * *"Live - Welcome - Camera - Gallery - Me"* for The Day).
 *
 * A guest moves through the Event Hub from the bar at the bottom of their
 * phone. The Maker's navigator opens with ONE dropdown offering exactly the
 * pages that bar offers on the stage being edited, in its order and in its
 * words, so the couple picks which page they are looking at and fixing.
 *
 * 🔑 ONE SOURCE FOR THE WORDS. Nothing here names a page. The pages ARE
 * `resolveSiteNav` — the same function that draws the guest's bar — asked for a
 * guest holding their key who has answered (so Me stands where RSVP stood), on
 * this stage's allow-list (`STAGE_BAR`). Rename a tab there and the Maker
 * follows; the two cannot disagree. `the-page-dropdown-is-the-guest-bar.test.ts`
 * holds it.
 *
 * 🧭 A PICK JUMPS, IT NEVER FILTERS (owner 2026-09-27,
 * `every-scene-is-in-the-navigator.test.ts`). Every scene of the stage stays
 * listed; each page only knows which scenes sit under it (`tiles`, the same
 * grouping the navigator's headers are drawn from — `navigatorTabs`), so a
 * pick scrolls the navigator to that group and the canvas to that page.
 *
 * 🚪 A PAGE THAT LEAVES (the Camera — a page of its own, not a part of this
 * one) lists no scenes; picking it says so rather than pretending.
 *
 * 👤 ME IS EACH GUEST'S OWN. It carries no scenes the couple arranges — it is
 * drawn from the guest list, and the host's own editing canvas never draws a
 * guest's Me (`app/[slug]/page.tsx` builds `meSlot` only for a real guest).
 * 👁 SEE AS (PR-10, 2026-10-04) DRAWS IT FOR A SAMPLE GUEST: with a guest
 * state picked (`SEE_AS`, lib/see-as.ts), the canvas is the guest page as that sample guest
 * (`lib/simulated-guest-preview.ts`), Me included — their ticket, from the
 * guest page's own `GuestTicket`. `seeAsDrawsMe` (lib/see-as.ts) says when; otherwise
 * `ME_NOT_ON_CANVAS` says so in the navigator rather than leaving a pick that
 * silently does nothing.
 *
 * Pure: no DOM, no React.
 */
import { navPhaseFor, resolveSiteNav, type NavPhase, type NavSlotKey } from '../app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';
import type { LifecyclePhase } from './invitation-widgets';
import { navigatorTabs } from './maker-navigator-tabs';

/** The moment each stage is previewed at — how `?phase=` forces the clock (page.tsx). */
const STAGE_NAV_PHASE: Readonly<Record<LifecyclePhase, NavPhase>> = {
  save_the_date: navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: false }),
  rsvp: navPhaseFor({ dayOfPhase: 'inactive', isRecapBody: false }),
  event: navPhaseFor({ dayOfPhase: 'live', isRecapBody: false }),
  editorial: navPhaseFor({ dayOfPhase: 'post', isRecapBody: true }),
};

export type MakerGuestPage = {
  key: NavSlotKey;
  /** The guest bar's own word for it. */
  label: string;
  /** It opens a page of its own (the Camera) — no scenes here. */
  leaves: boolean;
  /** The navigator tiles under this page, in page order — never a filter. */
  tiles: string[];
};

/** What the navigator says under "Me" while the canvas is the host's own (no See as guest picked). */
export const ME_NOT_ON_CANVAS = {
  label: 'Me is each guest’s own page',
  body:
    'Each guest’s Me holds their name, their own ticket and the guests they bring — made from your guest list, so every guest sees their own. Pick a guest in Preview › See as to see one here.',
} as const;

/**
 * The bar a guest holding their key sees on this stage once they have answered.
 * `hasStory` — whether this event draws a story at all (a birthday has no "Our
 * Love Story" page: `resolveWeddingOnlyParts` love_story, read by the scene list).
 */
export function guestBarForStage(stage: LifecyclePhase, hasStory = true) {
  return resolveSiteNav({
    viewer: { kind: 'guest' },
    phase: STAGE_NAV_PHASE[stage],
    hostAllowsCamera: true,
    anyChapterPublic: true,
    hasStory,
    hasDetails: true,
    hasSchedule: true,
    hasWelcome: true,
    liveBroadcast: false,
    // Present so no page is drawn LOCKED for want of an address; where each
    // one goes is the guest page's business, never the Maker's.
    destinations: { camera: '/camera', watch: '/watch', join: '/join' },
    stageSlots: STAGE_BAR[stage].slots,
  });
}

/**
 * The pages this stage's guest bar offers, each with the scenes under it.
 * `hasStory` false (a type with no two people — `MakerNavigatorData.hasStory`)
 * drops "Our Love Story" from Page ▾, as it is dropped from the guest's bar.
 */
export function makerGuestPages(
  stage: LifecyclePhase,
  tileKeysInPageOrder: readonly string[],
  hasStory = true,
): MakerGuestPage[] {
  const bar = guestBarForStage(stage, hasStory);
  const tabs = navigatorTabs(
    bar.map(({ key, label, href, state }) => ({ key, label, href, state })),
    tileKeysInPageOrder,
  );
  return tabs.map((t) => ({ key: t.key as NavSlotKey, label: t.label, leaves: t.leaves, tiles: t.tiles }));
}
