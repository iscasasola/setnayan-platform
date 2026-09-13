import 'server-only';

import type { DoorSkin } from '@/app/_components/door/door-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { INVITE_THEMES, isInviteThemeId, resolveInviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { resolveInviteGround } from '@/lib/invite-ground';
import { resolveInviteButton } from '@/lib/invite-button-color';
import { resolveMonogram } from '@/lib/monogram';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { inviteSkin } from '../_components/themes/invite-skin';

/**
 * The event columns a door needs to dress itself.
 *
 * ⚠ `event_type` IS IN HERE, so do NOT also name it in a caller's own select —
 * this one string is interpolated into three `.select()` calls and Postgrest
 * would be handed the column twice. It is here because the Pro themes are
 * weddings-only (owner Q7 = A, 2026-09-11) and EVERY door has to be able to
 * answer that, not just the one that happened to already read the type.
 *
 * `site_button_color` is here for Q2 = A — the couple's own colour on the one
 * button. Every caller reads these through the ADMIN client, so no per-column
 * `events` grant is involved; a SESSION read of an ungranted column is what
 * refuses a whole query, and none of these is one.
 */
export const INVITE_LOOK_COLUMNS =
  'invite_theme, std_background, monogram_text, monogram_color, site_button_color, event_type' as const;

export type InviteLookEvent = {
  event_id: string;
  display_name: string | null;
  invite_theme?: string | null;
  std_background?: unknown;
  monogram_text?: string | null;
  monogram_color?: string | null;
  site_button_color?: string | null;
  event_type?: string | null;
};

/**
 * How a door of the invite arrival looks for this event — its theme, and the
 * DoorShell skin that paints it. House (the bare door) unless the couple SAVED
 * a shipped theme, the event TYPE may carry the Save-the-Date film, and — for a
 * Pro theme — the event holds Event Hub Pro now.
 *
 * 🔒 WEDDINGS ONLY (owner Q7 = A, 2026-09-11): the four Pro themes belong *"only
 * where the event type may show the Save-the-Date film"*. That is not a new
 * fence — it is `resolveWeddingOnlyParts(profile).save_the_date_film`, the SAME
 * question `lib/invite-reveal.ts` already asks before the reveal opens this
 * door. Asking it here too is what makes an already-saved value harmless: a
 * couple who picked Capiz and then changed their celebration's type gets House,
 * with no write, exactly as a lapsed unlock does.
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
  // Both reads are skipped entirely for a House event — the common case.
  const [ownsPro, mayShowStdFilm] = wantsPro
    ? await Promise.all([
        eventCoupleWebsiteProActive(createAdminClient(), event.event_id).catch(() => false),
        resolveProfile(event.event_type ?? '')
          .then((p) => resolveWeddingOnlyParts(p).save_the_date_film)
          // A profile that cannot be read is not a wedding. An unmeasured type
          // must fall to the free door, never open a paid one.
          .catch(() => false),
      ])
    : [false, false];
  const theme = resolveInviteTheme({ saved, ownsPro, mayShowStdFilm });
  if (theme === 'house') return { theme, skin: undefined };

  const ground = await resolveInviteGround(event.std_background);
  const mark = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text ?? null,
    monogram_color: event.monogram_color ?? null,
  });
  const skin = inviteSkin(theme, { photo: ground.photo, accent: mark.color, monogram: mark.text });
  return {
    theme,
    /*
      THE BUTTON, ONCE, FOR EVERY PRO THEME (owner Q2 = A). Resolved here rather
      than inside a skin, so a theme shipping tomorrow wears the couple's colour
      without having to remember to — and so no theme can paint a different one.
      The fill and its label come back as a PAIR: `lib/invite-button-color.ts`
      falls back to #C24E25 whenever the couple's colour cannot carry a label
      anybody can read, which is the owner's safety floor.
    */
    skin: skin ? { ...skin, action: resolveInviteButton(event.site_button_color) } : skin,
  };
}
