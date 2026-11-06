/**
 * lib/theme-loop-refs.ts — 🎞 OUR VIDEOS AS A PART'S OWN BACKGROUND (Look restudy row 7).
 *
 * Owner-approved 2026-10-08 (BACKGROUND_RESTUDY_2026-10-08_fable.md § 2.4: a part's background "Its own" opens "the
 * SAME Source ▾ + cards" as the main background) and locked again 2026-10-09 (`Maker_Two_Bars_LOCKED_2026-10-09.md`
 * § BACKGROUND, row 1: *"The Event Hub's · Colour · Scene ◆ · Video ◆ · Upload ◆"*). The toolbar shipped every source
 * but Video; this is Video's half: Setnayan's own theme loops (`INVITE_THEMES[id].media`, the 2026-09-24 uploads) as
 * cards a part may wear.
 *
 * 🔑 NO NEW SHAPE. A part's background already stores a clip — `{ kind: 'snippet', media, poster }`
 * (`HubSectionCanvas.background`), drawn for guests by the shipped scene clip. A theme loop is stored the SAME way,
 * by its public ref; this file is the CLOSED LIST that says which refs are ours — the way `isStdLibrarySrc` is for the
 * ready-made scenes — so Apply can admit them (`hub-draft-actions.ts` `sceneIsOwn`) without admitting any other ref.
 *
 * Pure. Held by `lib/a-part-wears-our-videos.test.ts`.
 */
import { INVITE_THEMES, type InviteThemeId } from './invite-themes';
import { hubMovingBackgroundIds } from './hub-canvas';

export type ThemeLoopChoice = { id: InviteThemeId; name: string; loop: string; poster: string };

/** Every loop a part may wear, in THE one theme order (`hubMovingBackgroundIds`). */
export function themeLoopChoices(): ThemeLoopChoice[] {
  return hubMovingBackgroundIds().flatMap((id) => {
    const media = INVITE_THEMES[id].media;
    return media ? [{ id, name: INVITE_THEMES[id].name, loop: media.loop, poster: media.poster }] : [];
  });
}

/** The theme whose loop (or its still) this ref is — null for any other ref. */
export function themeLoopOf(ref: unknown): InviteThemeId | null {
  if (typeof ref !== 'string') return null;
  return themeLoopChoices().find((c) => c.loop === ref || c.poster === ref)?.id ?? null;
}

/** Is this ref one of OUR loops or their stills (a closed list — never a pattern match on a folder)? */
export function isThemeLoopRef(ref: unknown): boolean {
  return themeLoopOf(ref) !== null;
}
