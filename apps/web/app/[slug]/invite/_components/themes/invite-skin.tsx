import type { DoorSkin } from '@/app/_components/door/door-shell';
import type { InviteDoorId } from '@/lib/invite-themes';
import { abacaSkin } from './abaca';
import { capizSkin } from './capiz';
import { galeriyaSkin } from './galeriya';
import { velvetSkin } from './velvet';

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
 * The skin for a door COMPOSITION — `inviteDoorFor(resolvedTheme)`. Ten themes
 * open through these four (lib/invite-themes.ts `door`); House is the bare door
 * and has no skin.
 */
export function inviteSkin(door: InviteDoorId, input: InviteSkinInput): DoorSkin | undefined {
  switch (door) {
    case 'capiz':
      return capizSkin(input);
    case 'velvet':
      return velvetSkin(input);
    case 'galeriya':
      return galeriyaSkin(input);
    case 'abaca':
      return abacaSkin(input);
    default:
      return undefined;
  }
}
