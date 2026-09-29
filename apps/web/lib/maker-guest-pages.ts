/**
 * 📄 THE GUEST'S PAGES, AS THE MAKER'S "PAGE ▾" (owner 2026-09-30, pointing at
 * the guest Event Hub's bottom bar, verbatim: *"on the navigator, there should
 * be Home, Details, Story, Me on top dropdown so we can fix and improve the
 * event hub itself for invitation. This is considering we will make invitation
 * with Home, Details Story and Me"*).
 *
 * Before the day a guest moves through four pages of the Event Hub —
 * **Home · Details · Story · Me** — from the bar at the bottom of their phone.
 * The Maker's navigator opens with ONE dropdown offering exactly those pages,
 * with the bar's own words, so the couple picks which page they are looking at
 * and fixing. The words are not typed twice: they are the guest bar's labels,
 * held equal to `resolveSiteNav` by `the-page-dropdown-is-the-guest-bar.test.ts`,
 * and a page is offered only on a stage whose bar carries it (`STAGE_BAR`) —
 * the Save the Date has no Details, so it offers Home · Story · Me.
 *
 * 🧭 A PICK JUMPS, IT NEVER FILTERS (owner 2026-09-27,
 * `every-scene-is-in-the-navigator.test.ts`). Every scene of the stage stays
 * listed; each page only knows which scenes sit under it (`tiles`, the same
 * grouping the navigator's headers are drawn from — `navigatorTabs`), so a
 * pick can scroll the navigator to that group and the canvas to that page.
 *
 * 👤 ME IS EACH GUEST'S OWN. It carries no scenes the couple arranges — it is
 * drawn from the guest list, and the canvas (the host's own render) never
 * draws a guest's Me: `app/[slug]/page.tsx` builds `meSlot` only for a real
 * guest and leaves it null in the canvas, and the sample-guest preview
 * (`?as=replied`, `lib/simulated-guest-preview.ts`) renders the page without
 * it. `ME_NOT_ON_CANVAS` says so in the navigator rather than leaving a pick
 * that silently does nothing. Drawing Me for a sample guest is a change to the
 * guest route and follows the Digital-ticket-on-Me work.
 *
 * Pure: no DOM, no React.
 */
import { STAGE_BAR } from '../app/[slug]/_lib/stage-bar';
import type { LifecyclePhase } from './invitation-widgets';
import { navigatorTabs, type NavigatorBarItem } from './maker-navigator-tabs';

/** The guest's pages before the day, in the order their bar draws them. */
export const GUEST_PAGE_KEYS = ['home', 'details', 'story', 'me'] as const;
export type GuestPageKey = (typeof GUEST_PAGE_KEYS)[number];

/** The bar's own words for them (a guest holding their key, before the day). */
export const GUEST_PAGE_LABEL: Readonly<Record<GuestPageKey, string>> = {
  home: 'Home',
  details: 'Details',
  story: 'Story',
  me: 'Me',
};

/** The stages whose guest bar is these pages — before the day. On the day the
 *  bar is Now · Schedule · Camera…, after it Recap…; those keep the stage menu. */
export const GUEST_PAGE_STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp'];

export type MakerGuestPage = {
  key: GuestPageKey;
  label: string;
  /** The navigator tiles under this page, in page order — never a filter. */
  tiles: string[];
};

/** What the navigator says under "Me" — it has no scenes to arrange here. */
export const ME_NOT_ON_CANVAS = {
  label: 'Me is each guest’s own page',
  body:
    'Each guest’s Me holds their name, their own QR and the guests they bring — made from your guest list, so every guest sees their own. It can’t be shown on this canvas yet; the canvas stays where it was.',
} as const;

/**
 * The pages this stage's guest bar offers, each with the scenes under it, or
 * null when the stage's bar is not the guest's four pages (On the Day, Post
 * Event) — the navigator then keeps the stage's own menu.
 */
export function makerGuestPages(stage: LifecyclePhase, tileKeysInPageOrder: readonly string[]): MakerGuestPage[] | null {
  if (!GUEST_PAGE_STAGES.includes(stage)) return null;
  const slots = STAGE_BAR[stage].slots as readonly string[];
  const keys = GUEST_PAGE_KEYS.filter((k) => slots.includes(k));
  if (keys.length === 0) return null;
  // The pages as in-page anchors, so `navigatorTabs` groups the scenes under
  // them exactly as the navigator's headers are grouped.
  const bar: NavigatorBarItem[] = keys.map((k) => ({ key: k, label: GUEST_PAGE_LABEL[k], href: `#${k}`, state: 'live' }));
  const tabs = navigatorTabs(bar, tileKeysInPageOrder);
  return keys.map((k) => ({ key: k, label: GUEST_PAGE_LABEL[k], tiles: tabs.find((t) => t.key === k)?.tiles ?? [] }));
}
