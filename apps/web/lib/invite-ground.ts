import 'server-only';

import { displayUrlForStdBackground } from '@/lib/std-bg-image';
import { groundFromBackground, type InviteGround } from '@/lib/invite-ground-rule';

export type { InviteGround };

/**
 * The ground a Pro invite theme is painted on — the couple's REVEAL BACKGROUND
 * (owner 2026-09-10: *"background will use the reveal background photo. So our
 * cinematic reveal is also integrated as one whole concept design"*).
 *
 * It is `events.std_background`, the same field the save-the-date reveal opens
 * onto, resolved EXACTLY as the site resolves it (app/[slug]/_lib/loaders.ts):
 *   realistic → the public scene · upload → the screen-sized WebP of the
 *   couple's own photo · plain → a colour · paper → no photo (the theme's own
 *   ground shows).
 *
 * 🔒 ONE STRICTER RULE THAN THE SITE, ON PURPOSE. `displayUrlForStdBackground`
 * falls back to `displayUrlForStoredAsset`, which returns any non-`r2://` value
 * VERBATIM as a URL — the trap SEC-6 closed on the save-the-date video path,
 * because the value is host-writable. On a door every guest meets, an uploaded
 * background is honoured only if it is a genuine `r2://` object; anything else
 * shows the theme's own ground. A real upload is always `r2://`, so no couple
 * loses a photo to this.
 */

/** The rule (lib/invite-ground-rule.ts) with the real, server-only presign. */
export function resolveInviteGround(raw: unknown): Promise<InviteGround> {
  return groundFromBackground(raw, displayUrlForStdBackground);
}
