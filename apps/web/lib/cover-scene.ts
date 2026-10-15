/**
 * lib/cover-scene.ts — 🖼 THE COVER SCENE: the cover's words as ONE group, filling the whole first screen.
 *
 * Owner-approved 2026-10-15 on `Setnayan/prototypes/maker_cover_group_background_2026-10-14_fable.html`
 * (DECISION_LOG 2026-10-15 "COVER SCENE APPROVED"): *"Cover scene will take up the whole screen initially whatever
 * screen type it is"* · *"Call it Cover Scene"* · Framed = the first screen inset with a rounded margin on the page
 * colour, Full width = edge to edge — "Yes" · the Hero folds into the Cover Scene's Background — "Yes, one
 * background" · Scene ◆ moving backgrounds stay Pro — "Pro".
 *
 * The part (its key, its door, its three grey lines) is `lib/maker-parts.ts` `MAKER_COVER_SCENE`. This module is
 * what the GUEST's page needs of it — so it imports nothing of the Maker and stays out of the Maker's bytes.
 *
 * Pure. No I/O, no React.
 */

/**
 * 📐 THE WHOLE FIRST SCREEN, ON ANY DEVICE: `100svh` — the SMALL viewport, so a phone's browser bars never cut the
 * words — and `100dvh` where the browser has it (the prototype's own rule). The words are centred in it (The Letter
 * keeps its own foot-of-the-screen column); the page's first scroll begins under it.
 */
export const COVER_SCENE_SCREEN = 'min-h-[100svh] supports-[height:100dvh]:min-h-[100dvh]';
/** …the centred column every design but The Letter lays its words in. */
export const COVER_SCENE_CENTRED = `${COVER_SCENE_SCREEN} flex flex-col justify-center`;

/** The attribute the cover's first screen carries — the guard and the Maker find the Cover Scene by it. */
export const COVER_SCENE_ATTR = 'data-cover-scene';
