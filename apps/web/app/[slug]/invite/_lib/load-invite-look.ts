import 'server-only';

import type { DoorSkin } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { INVITE_THEMES, isInviteThemeId, resolveInviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { resolveInviteGround } from '@/lib/invite-ground';
import { resolveMonogram } from '@/lib/monogram';
import { inviteSkin } from '../_components/themes/invite-skin';

/** The event columns a door needs to dress itself. */
export const INVITE_LOOK_COLUMNS = 'invite_theme, std_background, monogram_text, monogram_color' as const;

export type InviteLookEvent = {
  event_id: string;
  display_name: string | null;
  invite_theme?: string | null;
  std_background?: unknown;
  monogram_text?: string | null;
  monogram_color?: string | null;
};

/**
 * How a door of the invite arrival looks for this event — its theme, and the
 * DoorShell skin that paints it. House (the bare door) unless the couple SAVED
 * a shipped theme and, for a Pro theme, the event holds Event Hub Pro now.
 *
 * The ownership read is the expensive part (a chain of order / bundle / grant
 * checks), so it runs ONLY when the saved theme is Pro — every House event,
 * which is almost every event, pays nothing. Each door calls this once.
 */
export async function loadInviteLook(event: InviteLookEvent): Promise<{
  theme: InviteThemeId;
  skin: DoorSkin | undefined;
}> {
  const saved = event.invite_theme ?? null;
  const wantsPro = isInviteThemeId(saved) && INVITE_THEMES[saved].tier === 'pro';
  const ownsPro = wantsPro
    ? await eventCoupleWebsiteProActive(createAdminClient(), event.event_id).catch(() => false)
    : false;
  const theme = resolveInviteTheme({ saved, ownsPro });
  if (theme === 'house') return { theme, skin: undefined };

  const ground = await resolveInviteGround(event.std_background);
  const mark = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text ?? null,
    monogram_color: event.monogram_color ?? null,
  });
  return {
    theme,
    skin: inviteSkin(theme, { photo: ground.photo, accent: mark.color, monogram: mark.text }),
  };
}
