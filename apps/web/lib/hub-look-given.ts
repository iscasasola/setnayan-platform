import { INVITE_THEMES, normalizeThemeId, resolveInviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { heroGroundNeedsOwnership, heroMayBePageGround } from '@/lib/page-ground';
import { resolveMonogram } from '@/lib/monogram';

/**
 * hub-look-given.ts — WHICH THEME AN EVENT WEARS, GIVEN WHETHER IT OWNS EVENT
 * HUB PRO. The viewer-free half of `app/[slug]/_lib/hub-look.ts`.
 *
 * ─── WHY A SECOND FILE, WHEN THAT ONE SAYS "EXACTLY ONE PLACE" ───────────────
 * `resolveHubTheme` / `resolveHubLook` decide the theme AND ask who owns what —
 * through `websiteProActiveFor`, which answers AS THE VIEWER IS SHOWN IT (the
 * owner's "view as a free couple" cookie). That is right for a page somebody is
 * looking at, and it is exactly what a remembered, same-for-everyone card may
 * never reach. So the DECISION is written here with the ownership handed in:
 * public inputs only (the event's own columns and one boolean), no read, no
 * cookie, no session — and nothing in this file's import graph can reach one
 * (`lib/home-reads-remember-nobody.test.ts`).
 *
 * 🔒 IT IS THE SAME RULE, NOT A SECOND OPINION. Each function below is that
 * file's function with its one read lifted out into an argument, composed from
 * the same three rules (`resolveInviteTheme`, `heroGroundNeedsOwnership`,
 * `heroMayBePageGround`). `lib/hub-look-given.test.ts` pins the text of the two
 * originals: change either there and that test fails until this file is changed
 * with it. (The originals were not made to call these — they live under
 * `app/[slug]`, which this change was told not to edit. That is the follow-up.)
 *
 * ⚠ `theme_try_on` IS NOT HERE. It is set only by the guest page for a host
 * trying a theme on their own canvas; a card on a shelf never tries a theme on.
 */

export type HubThemeEvent = {
  display_name: string | null;
  invite_theme?: string | null;
  monogram_text?: string | null;
  monogram_color?: string | null;
};

export type HubThemeGiven = {
  /** Already gated. 'house' means "render exactly today's page". */
  theme: InviteThemeId;
  accent: string;
  monogram: string;
};

/** Did the couple SAVE a Pro theme? Only then does ownership decide the theme. */
export function wantsProTheme(saved: unknown): boolean {
  const wanted = normalizeThemeId(saved);
  return wanted !== null && INVITE_THEMES[wanted].tier === 'pro';
}

/**
 * `resolveHubTheme`, with its answer to "is Event Hub Pro live for this event?"
 * handed in. `owned` is consulted only for a saved Pro theme, exactly as the
 * original only ASKS for one.
 */
export function hubThemeGiven(event: HubThemeEvent, owned: boolean): HubThemeGiven {
  const saved = event.invite_theme ?? null;
  const ownsPro = wantsProTheme(saved) ? owned : false;
  const theme = resolveInviteTheme({ saved, ownsPro });
  const mark = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text ?? null,
    monogram_color: event.monogram_color ?? null,
  });
  return { theme, accent: mark.color, monogram: mark.text };
}

/**
 * `resolveHubLook`'s gate on the couple's own photo behind the door: may this
 * theme draw it, given ownership? (The photo itself is signed by the caller.)
 */
export function hubLookDrawsOwnPhoto(theme: InviteThemeId, owned: boolean): boolean {
  const ownsPro = heroGroundNeedsOwnership(theme) ? owned : false;
  return heroMayBePageGround(theme, ownsPro);
}

/**
 * Can ownership change ANYTHING about this event's cover? True when the saved
 * theme is Pro (ownership decides the theme) or when the theme it would wear
 * unowned draws the couple's own background only for an owner. False means no
 * reader of the cover ever asks — so nobody needs to look it up.
 *
 * (An owned Pro theme with its own loop never asks the second question, and an
 * unowned one falls to House, which does — both are covered by the first arm.)
 */
export function ownershipCanChangeTheCover(saved: unknown): boolean {
  if (wantsProTheme(saved)) return true;
  return heroGroundNeedsOwnership(resolveInviteTheme({ saved, ownsPro: false }));
}
