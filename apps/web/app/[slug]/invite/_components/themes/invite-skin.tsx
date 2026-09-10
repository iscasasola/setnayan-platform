import type { DoorSkin } from '@/app/_components/door/door-shell';
import type { InviteThemeId } from '@/lib/invite-themes';
import { capizSkin } from './capiz';

/** What every skin is built from — all of it the couple's own. */
export type InviteSkinInput = {
  /** Their reveal background, resolved (lib/invite-ground.ts), or null. */
  photo: string | null;
  /** Their colour — `resolveMonogram(event).color`. Ornament only. */
  accent: string;
  /** Their mark — `resolveMonogram(event).text`, e.g. "C & I". */
  monogram: string;
};

/**
 * The skin for a RESOLVED theme (lib/invite-themes.ts `resolveInviteTheme`).
 * House is the bare door — no skin — and so is any theme whose skin has not
 * shipped, which `resolveInviteTheme` already turns into House.
 */
export function inviteSkin(theme: InviteThemeId, input: InviteSkinInput): DoorSkin | undefined {
  switch (theme) {
    case 'capiz':
      return capizSkin(input);
    default:
      return undefined;
  }
}
