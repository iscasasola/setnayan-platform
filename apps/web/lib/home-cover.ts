/**
 * lib/home-cover.ts — THE EVENT HOME'S HEADER WEARS THE EVENT HUB'S MAIN BACKGROUND.
 *
 * Owner 2026-10-07, on the Home card's plain mulberry block: *"i thought this
 * will use the main background image of the event hub maker?"* The header
 * (`data-home-event-details`'s block, `home-first-screen.tsx`) now wears what
 * the guest's Event Hub draws behind the event, asked of the ONE answer Discover's
 * card already asks (`dressEventCover` → `guestMainGround` · `resolveEventPoster`
 * → `sceneCoverFor` · `guestLookFrom` → `paperGroundOf`), in this order:
 *
 *   1 · the Main background (Look › Background: their photo, a video's still);
 *   2 · the hub cover (the hero photo → Save-the-Date background → the theme's still);
 *   3 · the couple's background colour or ombré (free);
 *   4 · today's colour (mulberry) — `null` here.
 *
 * 🔑 THE WORDS STAY LEGIBLE BY THE HUB'S OWN RULE (`hubLegibility`, the AA
 * contrast floor): over a picture, the ink and the veil come from the hub's
 * measurement — the cover's own `legibility`, or the Main background's measured
 * frame. An UNMEASURED frame is never read as a calm one: it is veiled for the
 * worst case (white AND black), exactly as `mainGroundLegibility` refuses to.
 *
 * Pure. Published values only (the caller reads the live row, never a draft).
 */
import { INVITE_THEMES, isInviteThemeId } from '@/lib/invite-themes';
import { hubLegibility, hubLegibilityVars } from '@/lib/hub-legibility';

export type HomeCover =
  /** A picture under a veil: `ink` for the words, `scrim` laid over the whole picture. */
  | { kind: 'image'; src: string; ink: string; scrim: string }
  /** The couple's own colour or ombré — `background` is a CSS value, `ink` the hub's ink on it. */
  | { kind: 'paper'; background: string; ink: string };

/** What `dressEventCover` hands back — the fields this reads. */
export type HomeCoverInput = {
  scene:
    | { kind: 'quiet' }
    | { kind: 'photo' | 'theme'; src: string; ground: string; legibility: Record<string, string> | null }
    | null;
  paper: { ground: { cream: string | null; ink: string | null; ombre: string | null } | null } | null;
  mainFrame: string[] | null;
  theme: string | null;
};

/** Unknown footage is veiled for the worst it could hold. */
const UNMEASURED: readonly string[] = ['#ffffff', '#000000'];

function veilFor(theme: string | null, samples: readonly string[]): { ink: string; scrim: string } {
  // The hub's own theme inks; an unread theme measures with the house theme's.
  const t = INVITE_THEMES[isInviteThemeId(theme) ? theme : 'house'];
  const vars = hubLegibilityVars(hubLegibility(t, { kind: 'media', samples: samples.length ? samples : UNMEASURED }));
  return { ink: vars['--hub-ink']!, scrim: vars['--hub-scrim']! };
}

/** The header's ground, or null for today's colour. */
export function homeCoverOf(d: HomeCoverInput | null): HomeCover | null {
  if (!d) return null;
  const scene = d.scene;
  if (scene && scene.kind !== 'quiet') {
    // 1 · The Main background: veiled by its own measured frame.
    if (scene.ground === 'main') return { kind: 'image', src: scene.src, ...veilFor(d.theme, d.mainFrame ?? []) };
    // 2 · The hub cover: the poster's own legibility, measured for that ground.
    const ink = scene.legibility?.['--hub-ink'];
    const scrim = scene.legibility?.['--hub-scrim'];
    if (ink && scrim) return { kind: 'image', src: scene.src, ink, scrim };
    return { kind: 'image', src: scene.src, ...veilFor(d.theme, []) };
  }
  // 3 · Their colour or ombré — the hub's own paper and ink (`r g b` channels).
  const g = d.paper?.ground;
  if (g && (g.cream || g.ombre)) {
    const ink = g.ink ? `rgb(${g.ink})` : null;
    if (ink) return { kind: 'paper', background: g.ombre ?? `rgb(${g.cream})`, ink };
  }
  // 4 · Today's colour.
  return null;
}
