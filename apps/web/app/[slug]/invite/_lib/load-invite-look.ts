import 'server-only';

import type { DoorSkin } from '@/app/_components/door/door-shell';
import { inviteDoorFor, type InviteThemeId } from '@/lib/invite-themes';
import { resolveInviteButton } from '@/lib/invite-button-color';
import { heroMarkSvg } from '@/lib/hero-monogram-data';
import { resolveHubLook, HUB_LOOK_COLUMNS, type HubLookEvent } from '../../_lib/hub-look';
import { resolveMonogram } from '@/lib/monogram';
import { inviteSkin } from '../_components/themes/invite-skin';

/**
 * ⚠ THE RESOLUTION MOVED TO `app/[slug]/_lib/hub-look.ts` (2026-09-22) and this
 * file now adds only the DOOR's half on top of it.
 *
 * It had to move: the Event Hub pages behind this door wear the same theme now
 * (owner, that date), so "which theme is this event wearing" became a
 * two-surface fact. It is not a simple one — a Pro theme needs the unlock live
 * NOW and a celebration type that carries the Save-the-Date film, and either can
 * lapse after the couple saved. A second copy on the site would have been a
 * second opinion about who owns what: House on the door and Capiz on the page,
 * each passing its own tests.
 *
 * Re-exported here under their old names so nothing that already imports them
 * moves. `INVITE_LOOK_COLUMNS` is `HUB_LOOK_COLUMNS` — the same string, not a
 * copy of it.
 */
export const INVITE_LOOK_COLUMNS = HUB_LOOK_COLUMNS;

/**
 * THE COUPLE'S LOGO — the three columns the crest needs, selected by every door
 * beside `INVITE_LOOK_COLUMNS` (owner 2026-09-28: *the logo did not adapt*).
 *
 * ⚠ A SEPARATE LIST, NOT PART OF `HUB_LOOK_COLUMNS`. That list is read by every
 * page of the guest tree to pick a theme; the logo is ~13 KB of SVG only a door
 * draws. A door that forgets these gets its crest in initials, silently —
 * `the-door-wears-the-hub.test.ts` holds that every door selects them.
 */
export const INVITE_MARK_COLUMNS = 'monogram_custom_svg, monogram_uploaded_svg, role_palette' as const;

export type InviteLookEvent = HubLookEvent & {
  monogram_custom_svg?: string | null;
  monogram_uploaded_svg?: string | null;
  role_palette?: unknown;
};

/**
 * The couple's mark for a door's crest: their LOGO (the one sanitised mark the
 * Event Hub hero draws — `heroMarkSvg`), and their initials for when they have
 * none. Pure; draft-aware for free, because the Maker's RSVP canvas hands in
 * the row with the draft already laid over it (`overlayHubDraftEvent` carries
 * `monogram_custom_svg`).
 */
export function doorMarkFor(event: InviteLookEvent): { mark: string | null; monogram: string } {
  return {
    mark: heroMarkSvg(event),
    monogram: resolveMonogram({
      display_name: event.display_name,
      monogram_text: event.monogram_text ?? null,
      monogram_color: event.monogram_color ?? null,
    }).text,
  };
}

/**
 * How a door of the invite arrival looks for this event — its theme, and the
 * DoorShell skin that paints it. The gating (shipped theme · weddings-only
 * fence · Event Hub Pro held right now) all happens in `resolveHubLook`; what is
 * left here is the door's own dressing.
 */
export async function loadInviteLook(event: InviteLookEvent): Promise<{
  theme: InviteThemeId;
  skin: DoorSkin | undefined;
}> {
  const look = await resolveHubLook(event);
  if (look.theme === 'house') return { theme: look.theme, skin: undefined };

  /*
    Ten THEMES open through four door COMPOSITIONS (capiz · velvet · galeriya ·
    abaca — owner-approved card-on-a-ground designs). The theme names its door
    (`INVITE_THEMES[id].door`); the page behind the door wears the theme itself.
  */
  const skin = inviteSkin(inviteDoorFor(look.theme), {
    photo: look.photo,
    accent: look.accent,
    monogram: look.monogram,
    // Their LOGO in the seal, as the Event Hub hero draws it; initials only
    // when there is none (owner 2026-09-28).
    mark: doorMarkFor(event).mark,
  });
  return {
    theme: look.theme,
    /*
      THE BUTTON, ONCE, FOR EVERY PRO THEME (owner Q2 = A). Resolved here rather
      than inside a skin, so a theme shipping tomorrow wears the couple's colour
      without having to remember to — and so no theme can paint a different one.
      The fill and its label come back as a PAIR: `lib/invite-button-color.ts`
      falls back to #C24E25 whenever the couple's colour cannot carry a label
      anybody can read, which is the owner's safety floor.

      ⚠ STAYS ON THE DOOR. The page has no single action to colour, and pushing
      this into the shared resolver would make every Event Hub page pay for a
      decision only a door uses.
    */
    skin: skin ? { ...skin, action: resolveInviteButton(event.site_button_color) } : skin,
  };
}
