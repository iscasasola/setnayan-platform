import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import {
  INVITE_THEMES,
  isInviteThemeId,
  resolveInviteTheme,
  type InviteThemeId,
} from '@/lib/invite-themes';
import { resolveInviteGround } from '@/lib/invite-ground';
import { resolveMonogram } from '@/lib/monogram';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';

/**
 * hub-look.ts — WHICH THEME THIS EVENT IS WEARING, and the two things every
 * surface needs to paint it.
 *
 * ─── WHY THIS WAS LIFTED OUT OF `invite/_lib/load-invite-look.ts` ────────────
 * Owner, 2026-09-22: the Event Hub pages wear the theme the couple already
 * picked for their invite door. That makes the resolution a TWO-SURFACE fact,
 * and it is not a simple one — a Pro theme needs the unlock to be live now AND
 * the celebration to be a kind that carries a Save-the-Date film (owner Q7 = A,
 * 2026-09-11), and either can lapse after the couple saved.
 *
 * 🔑 SO IT LIVES IN EXACTLY ONE PLACE. A second copy on the site would be a
 * second opinion about who owns what: a couple whose unlock lapsed could get
 * House on their door and Capiz on their page, or the reverse — and each
 * surface would pass its own tests. `loadInviteLook` now calls this and adds
 * only the door's skin on top.
 *
 * ⚠ THE EXPENSIVE READS STILL RUN ONLY FOR A PRO THEME. The ownership check is
 * a chain of order / bundle / grant lookups; every House event — which is almost
 * every event — pays nothing, exactly as before the lift.
 */

/**
 * The event columns any surface needs to dress itself.
 *
 * ⚠ `event_type` IS IN HERE, so do NOT also name it in a caller's own select —
 * this string is interpolated into several `.select()` calls and PostgREST would
 * be handed the column twice. It is here because the Pro themes are
 * weddings-only and EVERY surface has to be able to answer that.
 *
 * Every caller reads these through the ADMIN client, so no per-column `events`
 * grant is involved; a SESSION read of an ungranted column is what refuses a
 * whole query, and none of these is one.
 */
export const HUB_LOOK_COLUMNS =
  'invite_theme, std_background, monogram_text, monogram_color, site_button_color, event_type' as const;

export type HubLookEvent = {
  event_id: string;
  display_name: string | null;
  invite_theme?: string | null;
  std_background?: unknown;
  monogram_text?: string | null;
  monogram_color?: string | null;
  site_button_color?: string | null;
  event_type?: string | null;
};

export type HubLook = {
  /** Already gated. 'house' means "render exactly today's page". */
  theme: InviteThemeId;
  /** The couple's reveal background, presigned, or null. */
  photo: string | null;
  /** The couple's colour. Ornament only — it never carries a word. */
  accent: string;
  /** Their mark, e.g. "C & I". The door seals with it; the page heads with it. */
  monogram: string;
};

/**
 * House unless the couple SAVED a shipped theme, the event TYPE may carry the
 * Save-the-Date film, and — for a Pro theme — the event holds Event Hub Pro
 * right now. A lapse of either falls back to House with NO write, so the choice
 * comes back the moment the unlock or the event type does.
 */
export async function resolveHubLook(event: HubLookEvent): Promise<HubLook> {
  const saved = event.invite_theme ?? null;
  const wantsPro = isInviteThemeId(saved) && INVITE_THEMES[saved].tier === 'pro';

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
  const mark = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text ?? null,
    monogram_color: event.monogram_color ?? null,
  });

  if (theme === 'house') {
    // No presign for a House event — the ground is never drawn, and signing a
    // URL nothing renders is a round trip per page view for nothing.
    return { theme, photo: null, accent: mark.color, monogram: mark.text };
  }

  const ground = await resolveInviteGround(event.std_background);
  return { theme, photo: ground.photo, accent: mark.color, monogram: mark.text };
}
