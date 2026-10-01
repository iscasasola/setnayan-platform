/**
 * apps/web/lib/patiktok-access.ts
 *
 * PATIKTOK: FREE TO MAKE, PAID TO TAKE OUT.
 *
 * Owner, verbatim (2026-09-29), answering "can we finish tiktok later or hide
 * it.": *"yes use for free. but pay to save and share"*.
 *
 *   FREE  — record booth clips, queue a render, render and WATCH the reel on
 *           screen (a preview carrying a light watermark).
 *   PAID  — anything that takes a reel OUT of the preview: storing the clean
 *           MP4, downloading it, a share/open link, the recap page showing it,
 *           connecting TikTok and posting to it. Paid means the event holds an
 *           ADMIN-APPROVED `PATIKTOK_COMPILER` (`eventSkuActive`), checked on
 *           the SERVER by `patiktokSaveUnlocked()` in `lib/patiktok-save-gate.ts`.
 *
 * This file is the pure half — the list of actions and which side of the line
 * each one sits on — so a client component can read the watermark text and the
 * refusal wording without importing the server gate, and so the rule is one
 * table that `lib/patiktok-pay-to-save.test.ts` pins.
 *
 * ⚠ THE WATERMARK IS NOT THE FENCE. The render runs in the couple's browser, so
 * the preview's bytes are on their device and a determined person can keep
 * them. What the server refuses is everything durable: the clean upload, the
 * stored copy, the download link, the recap, TikTok. The watermark only makes
 * sure a screen recording of the preview is visibly not the product.
 */

export type PatiktokAction =
  | 'record_clip'
  | 'queue_render'
  | 'preview'
  | 'save_reel'
  | 'download'
  | 'share'
  | 'connect_tiktok'
  | 'post_tiktok';

/** The half of Patiktok anyone on the event may use without paying. */
export const PATIKTOK_FREE_ACTIONS: ReadonlySet<PatiktokAction> = new Set<PatiktokAction>([
  'record_clip',
  'queue_render',
  'preview',
]);

/** The half that takes a reel out — paid (`PATIKTOK_COMPILER`, admin-approved). */
export const PATIKTOK_PAID_ACTIONS: ReadonlySet<PatiktokAction> = new Set<PatiktokAction>([
  'save_reel',
  'download',
  'share',
  'connect_tiktok',
  'post_tiktok',
]);

/**
 * May this action run? `saveUnlocked` MUST be the server's measured answer
 * (`patiktokSaveUnlocked`), never a default or a client-sent value.
 */
export function patiktokActionAllowed(
  action: PatiktokAction,
  { saveUnlocked }: { saveUnlocked: boolean },
): boolean {
  if (PATIKTOK_FREE_ACTIONS.has(action)) return true;
  return saveUnlocked === true;
}

/** What a refused save / share / post tells the couple — the preview is not lost. */
export const PATIKTOK_SAVE_REFUSAL =
  'Saving and sharing a reel comes with Patiktok. Your preview is still here — add Patiktok to save it.';

/** Burned into every frame of an unpaid preview. */
export const PATIKTOK_PREVIEW_WATERMARK = 'PREVIEW · SETNAYAN';
