/**
 * lib/event-hero.ts — THE ONE HERO. Made once, used everywhere.
 *
 * Owner, 2026-09-24 (DECISION_LOG "ONE HERO FOR SAVE THE DATE · INVITATION · ON
 * THE DAY · THE POSTER"): *"hero widget applies to save the date, invitation, on
 * the day and the thumbnail poster"*. And 2026-09-25, on the Maker bar: *"along
 * with the Logo, Love Story, Reveal, add the Hero. so on the different stages, we
 * just get the design created from the hero."*
 *
 * So there is ONE question — "what is this event's hero?" — and this file is the
 * only place it is answered. Every surface that draws a hero asks HERE:
 *
 *   · the Event Hub's hero on every stage   — `app/[slug]/_lib/loaders.ts` `loadMedia`
 *   · the home board's poster / event card   — `app/dashboard/(launcher)/page.tsx`
 *   · the celebration poster sheet           — `lib/celebration-poster.ts`
 *   · the celebration card's identity        — `lib/celebration-card-identity.ts`
 *   · Post Event's cover, until a post-event photo is chosen — `lib/story-cover.ts`
 *   · Prints & Tickets (Phase 9)             — call `resolveHero(event)`, nothing else
 *
 * `lib/every-hero-reads-the-one-resolver.test.ts` holds that list: a surface that
 * reads `landing_page_hero_image_url` for itself is how the poster and the hub
 * came to disagree before.
 *
 * ── WHAT A HERO IS ───────────────────────────────────────────────────────────
 *   'photo' — the couple's own hero photo (`landing_page_hero_image_url`), a ref
 *             in the ONE public media bucket (`siteMediaServeRef` — a private
 *             bucket's ref is refused, never signed).
 *   'card'  — no photo: the written invitation card (`invitation-card.ts` —
 *             eyebrow · monogram · names · line · date), dressed by the theme.
 *             That is a real hero, not an absence; free couples get it.
 *
 * The hero VIDEO (`landing_page_hero_video_r2_key`) is reported for the couple's
 * own editors (`videoRef`) and, separately, for guests (`guestVideoRef`) — the
 * latter is null while `GUEST_HERO_VIDEO_PLAYBACK` is closed (SEC-6: the clip is
 * unscreened). A poster never draws a video; it draws the photo or the card.
 *
 * ⚠ NOT FOLDED YET (build plan Phase 6, deferred): the Save-the-Date film still
 * reads its own `std_background` / `std_media` ground. The owner moved the Save
 * the Date to "tomorrow" (2026-09-25 tonight's target), so the `std_film_*` fold
 * and its migration wait; the film is the one surface not on this resolver.
 *
 * PURE. No I/O, no `server-only` — the Node test runner loads it, and so can a
 * client component that needs to say which hero is showing.
 */
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { heroVideoRefForGuests } from '@/lib/guest-hero-video';
import type { LifecyclePhase } from '@/lib/invitation-widgets';

/** The `events` columns the hero is made of. Select exactly these. */
export const HERO_EVENT_COLUMNS = ['landing_page_hero_image_url', 'landing_page_hero_video_r2_key'] as const;

export type HeroEventInput = {
  landing_page_hero_image_url?: unknown;
  landing_page_hero_video_r2_key?: unknown;
};

export type ResolvedHero = {
  /** 'photo' when the couple's own photo is the hero, else the written card. */
  kind: 'photo' | 'card';
  /** The photo's serve-ref (sign it with `displayUrlForStoredAsset`), or null. */
  photoRef: string | null;
  /** The couple's own hero clip, for THEIR editors only. */
  videoRef: string | null;
  /** The same clip for a GUEST surface — null while guest playback is closed. */
  guestVideoRef: string | null;
};

function videoOf(value: unknown): string | null {
  return siteMediaServeRef(typeof value === 'string' ? value : null);
}

/** What this event's hero is. The one answer — see the file note. */
export function resolveHero(event: HeroEventInput | null | undefined): ResolvedHero {
  const photoRef = siteMediaServeRef(event?.landing_page_hero_image_url ?? null);
  const videoRef = videoOf(event?.landing_page_hero_video_r2_key);
  return {
    kind: photoRef ? 'photo' : 'card',
    photoRef,
    videoRef,
    guestVideoRef: videoOf(heroVideoRefForGuests(videoRef)),
  };
}

/**
 * Where the one hero is shown — the Maker's Hero panel names these, so a couple
 * knows one edit changes all of them. The four stages of the public link in
 * their order, then the poster. Post Event is listed apart: it STARTS from the
 * hero and keeps it until the couple chooses a post-event cover (owner 09-25).
 */
export const HERO_STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event'] as const;
export const HERO_ALSO_ON = ['poster'] as const;
export const HERO_STARTS = ['editorial'] as const;
