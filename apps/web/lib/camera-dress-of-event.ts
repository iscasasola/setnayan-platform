/**
 * lib/camera-dress-of-event.ts — 📷 the Pro dress's colour for an EVENT, one rule
 * for both camera mounts (/papic/guest and the Event Hub's inline camera —
 * controller review of #6865: "It's one camera, so read the same entitlement").
 *
 * The theme the couple picked (`events.invite_theme`, house when unknown), its
 * accent through the Mood Board's dressing (`themeColours`), on a Pro event only
 * (`cameraDressTint`). Kept out of `lib/camera-dress.ts`, which the camera's
 * client chunk carries, so the theme tables stay on the server.
 *
 * Pure. No I/O.
 */
import { cameraDressTint } from '@/lib/camera-dress';
import { isInviteThemeId } from '@/lib/invite-themes';
import { themeColours } from '@/lib/theme-colours';

export function cameraDressTintOfEvent(
  pro: boolean,
  event: { invite_theme?: string | null; role_palette?: unknown } | null | undefined,
): string {
  const themeId = isInviteThemeId(event?.invite_theme) ? event!.invite_theme! : 'house';
  return cameraDressTint(pro, themeColours(themeId, (event?.role_palette ?? null) as never).colours.accent);
}
