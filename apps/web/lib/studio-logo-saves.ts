/**
 * lib/studio-logo-saves.ts — WHAT STUDIO › LOGO SENDS, as a pure function (2026-10-09, "the remaining Studio pages wear the
 * templates", Logo after Mood Board).
 *
 * The Logo page has ONE write: the composed logo and its layers, into the couple's DRAFT (`hubDraftAction`, published by ✓ Apply),
 * after a pause and only when the logo really changed (`lib/maker-logo-save-gate.ts`). Moving its controls onto the templates must
 * not change one byte of it, so the fields are built HERE and `maker-logo.tsx` posts exactly these — which lets
 * `studio-logo-posts-the-same.test.ts` hold them against the payloads recorded from the page before it moved.
 *
 * Pure: no React, no I/O, no server import (it rides the lazy `maker-details` chunk with its caller, never the Maker's first load).
 */

/** The draft door's two fields. (`events.monogram_custom_svg` + `events.monogram_studio_config`.) */
export function logoDraftFields(a: { svg: string; layers: unknown[]; anim?: unknown | null }): { intent: 'save'; patch: string } {
  return {
    intent: 'save',
    patch: JSON.stringify({
      events: {
        monogram_custom_svg: a.svg,
        monogram_studio_config: {
          layers: a.layers,
          ...(a.anim ? { anim: a.anim } : {}),
        },
      },
    }),
  };
}

/** What the page says when the draft write was refused or dropped (a refusal's own words are shown only when they are a plain sentence). */
export const LOGO_NOT_SAVED = 'Your logo could not be saved to your draft. Keep this open and try again.';
