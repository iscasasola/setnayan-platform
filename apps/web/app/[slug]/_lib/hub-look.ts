import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import {
  INVITE_THEMES,
  normalizeThemeId,
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
 * Is Event Hub Pro (COUPLE_WEBSITE_PRO) live for this event RIGHT NOW — asked
 * ONCE per request, however many surfaces ask.
 *
 * 🔑 THREE READERS, ONE ANSWER. The theme gate below, the guest-tree layout's
 * Pro colours and face, and `loadMedia`'s watermark all ask this same question
 * of the same event on the same request. Uncached, `[slug]/page.tsx` would pay
 * for the order / bundle / grant chain once per reader from the day the layout
 * started dressing every page. `cache()` keys on the event id alone and the
 * admin client is built inside, so every caller lands on one key.
 */
export const websiteProActiveFor = cache(
  async (eventId: string): Promise<boolean> =>
    eventCoupleWebsiteProActive(createAdminClient(), eventId),
);

/** The Pro-theme gate's two reads, once per request, keyed on primitives. */
const proThemeGate = cache(
  async (eventId: string, eventType: string): Promise<[boolean, boolean]> =>
    Promise.all([
      websiteProActiveFor(eventId).catch(() => false),
      resolveProfile(eventType)
        .then((p) => resolveWeddingOnlyParts(p).save_the_date_film)
        // A profile that cannot be read is not a wedding. An unmeasured type
        // must fall to the free door, never open a paid one.
        .catch(() => false),
    ]),
);

/**
 * WHICH theme is live — everything `resolveHubLook` answers except the photo.
 *
 * ⛔ THE GUEST-TREE LAYOUT CALLS THIS, NOT `resolveHubLook`, ON PURPOSE. The
 * layout wraps every page of the tree — the private landing and the 404
 * included — and it must never be the thing that hands a stranger the couple's
 * presigned reveal photo. It draws no photo, so it never asks for one, and no
 * URL is signed for a page that would not show it.
 */
export async function resolveHubTheme(event: HubLookEvent): Promise<Omit<HubLook, 'photo'>> {
  const saved = event.invite_theme ?? null;
  // A RETIRED id is read as its alias BEFORE the Pro question is asked — the
  // owner's own page is saved as `capiz`, which now means Vintage (Pro). Asking
  // `isInviteThemeId('capiz')` here would skip the ownership read and render a
  // paid theme as House.
  const wanted = normalizeThemeId(saved);
  const wantsPro = wanted !== null && INVITE_THEMES[wanted].tier === 'pro';

  const [ownsPro, mayShowStdFilm] = wantsPro
    ? await proThemeGate(event.event_id, event.event_type ?? '')
    : [false, false];

  const theme = resolveInviteTheme({ saved, ownsPro, mayShowStdFilm });
  const mark = resolveMonogram({
    display_name: event.display_name,
    monogram_text: event.monogram_text ?? null,
    monogram_color: event.monogram_color ?? null,
  });
  return { theme, accent: mark.color, monogram: mark.text };
}

/**
 * House unless the couple SAVED a shipped theme, the event TYPE may carry the
 * Save-the-Date film, and — for a Pro theme — the event holds Event Hub Pro
 * right now. A lapse of either falls back to House with NO write, so the choice
 * comes back the moment the unlock or the event type does.
 */
export async function resolveHubLook(event: HubLookEvent): Promise<HubLook> {
  const look = await resolveHubTheme(event);

  if (look.theme === 'house') {
    // No presign for a House event — the ground is never drawn, and signing a
    // URL nothing renders is a round trip per page view for nothing.
    return { ...look, photo: null };
  }

  const ground = await resolveInviteGround(event.std_background);
  return { ...look, photo: ground.photo };
}
