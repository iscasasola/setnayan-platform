import type { EventWords } from '@/app/[slug]/_lib/event-words';
import type { GuestLook } from '@/app/[slug]/_lib/loaders';
import { renderableImageSrc } from '@/lib/event-card-art';
import { resolveHero } from '@/lib/event-hero';
import { sceneCoverFor } from '@/lib/event-poster';
import { eventPosterGiven, type PosterLook } from '@/lib/event-poster-given';
import { resolveMonogram } from '@/lib/monogram';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { coupleLogoPlays } from '@/lib/couple-logo-plays';
import { guestMainGround } from '@/lib/guest-main-ground';
import { mainGroundIsNone, hubMainGround } from '@/lib/hub-canvas';
import { heroGroundNeedsOwnership, pageGround } from '@/lib/page-ground';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import type { InviteThemeId } from '@/lib/invite-themes';
import { hubLookDrawsOwnPhoto, hubThemeGiven, wantsProTheme, type HubThemeGiven } from '@/lib/hub-look-given';
import { paperGroundOf, type DiscoverPaper, type DiscoverScene } from '@/lib/discover-events-core';
import type { CoverRow } from '@/lib/home-public-reads-core';

/**
 * event-cover-given.ts — 🖼 ONE EVENT'S COVER, as the guest's Event Hub draws
 * it, WITH EVERYTHING IT ASKS OF THE OUTSIDE WORLD HANDED IN.
 *
 * This is the body `dressEventCover` (`lib/discover-events.ts`) always ran,
 * moved here so that ONE body serves two askers and they cannot disagree:
 *
 *   • AS A VIEWER IS SHOWN IT — the event Home's header, and Discover for an
 *     internal viewer who is viewing as a free couple. The readers are the ones
 *     this body always called: `websiteProActiveFor` (which honours that
 *     switch), `eventWordsFor`, `logoPlaysFor`.
 *   • FROM REMEMBERED PUBLIC FACTS — every other Discover card. The readers
 *     hand back answers that were read once, with the service client, for
 *     everybody (`lib/home-public-reads-core.ts`): whether the event owns Event
 *     Hub Pro, whether its logo animation is on, its event type's words. No
 *     read, no cookie and no session is asked for on the way to the card.
 *
 * The rules themselves did not move and are not copied: the theme gate
 * (`hubThemeGiven`), the Main background (`guestMainGround`), the poster
 * (`eventPosterGiven`), the paper ground (`paperGroundOf`).
 *
 * ⛔ THIS FILE REACHES NOTHING ON ITS OWN — every read, every signed address
 * and the two helpers that live beside the guest page arrive through `CoverIo`.
 * Its import graph is held free of the session by
 * `lib/home-reads-remember-nobody.test.ts`, and `lib/event-cover-given.test.ts`
 * runs it and counts what it asks.
 */

/** What one event's cover wears — Discover's card and the event Home's header (owner 2026-10-07). */
export type DressedEventCover = {
  scene: DiscoverScene | null;
  paper: DiscoverPaper | null;
  /** The Main background's measured frame (`tint.frame`) when the scene IS it; [] = never measured. */
  mainFrame: string[] | null;
  /** The theme the hub wears (`resolveHubTheme`), or null when it could not be read. */
  theme: InviteThemeId | null;
};

/** Everything the cover asks of the outside world. */
export type CoverIo = {
  /** Is Event Hub Pro live for this event? Asked only where it can change the answer. */
  ownsPro: () => Promise<boolean>;
  /** The event type's words, or null when they could not be resolved. */
  words: () => Promise<EventWords | null>;
  /** Is the logo animation on for this event? Asked only for a logo that moves. */
  logoAnimationOn: () => Promise<boolean>;
  /** A stored ref → an address a browser can load (`displayUrlForStoredAsset`). */
  sign: (ref: string | null | undefined) => Promise<string | null>;
  /** The Save-the-Date background, signed (`resolveInviteGround(…).photo`). */
  backgroundPhoto: (stdBackground: unknown) => Promise<string | null>;
  /** The paper the hub paints (`guestLookFrom(row, hub, false)`). */
  guestLook: (row: CoverRow, hub: HubThemeGiven) => GuestLook;
  /** The theme's still (`posterThemeStill`, `lib/event-poster.server.ts`). */
  themeStill: (theme: InviteThemeId) => string | null;
};

/**
 * Published values only: the event's columns and the live hero row's
 * `config_json`. The order of the questions is the order they were always asked.
 */
export async function dressEventCoverGiven(
  r: CoverRow,
  heroConfig: unknown,
  io: CoverIo,
): Promise<DressedEventCover> {
  // Ownership is asked at most once, and a read that fails is "not owned" —
  // the default every one of its three askers always took.
  let asked: Promise<boolean> | null = null;
  const owned = (): Promise<boolean> => (asked ??= io.ownsPro().catch(() => false));

  // The theme the hub wears — the one gate (`hubThemeGiven`). Ownership is
  // read only for a saved Pro theme.
  let hub: HubThemeGiven | null;
  try {
    hub = hubThemeGiven(r, wantsProTheme(r.invite_theme) ? await owned() : false);
  } catch {
    hub = null;
  }

  // 1 · THE MAIN BACKGROUND, as the guest's Event Hub draws it. Ownership
  //     is read only where it can change the answer, as the page reads it.
  if (hub) {
    const ownsPro = heroGroundNeedsOwnership(hub.theme) ? await owned() : false;
    const main = guestMainGround(hub.theme, ownsPro, heroConfig, r);
    const mainSrc = main?.stillRef
      ? renderableImageSrc(await io.sign(siteMediaServeRef(main.stillRef)).catch(() => null))
      : null;
    if (mainSrc) {
      return { scene: { kind: 'photo', src: mainSrc, ground: 'main', legibility: null }, paper: null, mainFrame: main?.tint?.frame ?? [], theme: hub.theme };
    }
  }

  // The paper the hub paints: their colour or ombré (free). `proActive`
  // only adds the Pro face (`proSiteVarsFor`), which the card never reads.
  const look = hub ? io.guestLook(r, hub) : null;

  // The column is host-writable; only a real image URL reaches an <img>.
  const heroSrc = renderableImageSrc(await io.sign(resolveHero(r).photoRef).catch(() => null));

  // The poster: the event type's words and the hub's look, asked side by side
  // (as `resolveEventPoster` asks them), then the one rule.
  const [words, posterLook] = await Promise.all([
    io.words().catch(() => null),
    (async (): Promise<PosterLook | null> => {
      if (!hub) return null;
      // Ownership only where it can change the answer — never an extra read.
      const own = heroGroundNeedsOwnership(hub.theme) ? await owned() : false;
      const photo = hubLookDrawsOwnPhoto(hub.theme, own) ? await io.backgroundPhoto(r.std_background) : null;
      return { theme: hub.theme, photo };
    })().catch(() => null),
  ]);
  let poster;
  try {
    poster = eventPosterGiven(
      {
        event_id: r.event_id,
        display_name: r.display_name ?? '',
        event_date: r.event_date,
        venue_name: r.venue_name,
        event_type: r.event_type ?? '',
        monogram_text: r.monogram_text,
        monogram_color: r.monogram_color,
        invite_theme: r.invite_theme,
        std_background: r.std_background,
        role_palette: r.role_palette,
      },
      heroSrc,
      { words, look: posterLook, themeStill: io.themeStill },
    );
  } catch {
    poster = null;
  }
  let scene = sceneCoverFor(poster);
  let paperPoster = poster?.kind === 'invitation' ? poster : null;
  // 2 · NO THEME LOOP WHERE THE HUB DRAWS NONE — under an ombré
  //     (`pageGround`) or "None — just the colour": the card is then the
  //     invitation card, which `posterFor` words identically.
  if (
    poster &&
    scene?.kind === 'theme' &&
    hub &&
    (mainGroundIsNone(hubMainGround(heroConfig)) ||
      !pageGround({ theme: hub.theme, ombre: Boolean(look?.ombre), heroGround: false }).themeLoop)
  ) {
    scene = null;
    paperPoster = { ...poster, kind: 'invitation', dark: false, photoSrc: null, ground: null, legibility: null };
  }
  if (scene) return { scene, paper: null, mainFrame: null, theme: hub?.theme ?? null };
  if (paperPoster) {
    // SEC-3: both logo columns are host-writable — read through the gate.
    const markSvg = resolveEventMonogramSvg(r);
    const paper: DiscoverPaper = {
      poster: paperPoster,
      ground: paperGroundOf(look),
      markText: resolveMonogram(r).text,
      markSvg,
      // A logo that does not move costs no read (`coupleLogoPlays`).
      markPlays: coupleLogoPlays(markSvg, true) ? await io.logoAnimationOn().catch(() => false) : false,
    };
    return { scene: null, paper, mainFrame: null, theme: hub?.theme ?? null };
  }
  return { scene: null, paper: null, mainFrame: null, theme: hub?.theme ?? null };
}
