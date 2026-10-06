/**
 * lib/guest-main-ground.ts — WHAT THE GUEST'S EVENT HUB SHOWS BEHIND THE EVENT.
 *
 * The ONE answer, lifted out of `app/[slug]/_lib/main-ground-layer.tsx`
 * (2026-10-03) so a second surface can ask it without a second opinion: the
 * Event Hub's page ground (`mainGroundLayerFor`) and Discover's event card
 * (`dressCards` in `lib/discover-events.ts`, owner 2026-10-03: *"if they
 * customized it and changed its main background, it should also adjust"*).
 *
 * The couple's Main background — their hero by default, or their own "different
 * clip or photo" (`resolveMainGround`) — is EVENT HUB PRO media, laid only where
 * the page-ground rule allows it (`heroMayBePageGround`): a Pro theme, or a free
 * theme (Classic included — the old "no photo or video" rule was dropped
 * 2026-10-06) while the event owns Event Hub Pro.
 *
 * Pure. The caller hands in the theme (`resolveHubTheme`'s answer), the
 * ownership (`websiteProActiveFor`, read only where `heroGroundNeedsOwnership`
 * says it can change the answer), and the PUBLISHED hero row's `config_json`
 * — a guest is never shown an unapplied draft.
 */
import type { InviteThemeId } from '@/lib/invite-themes';
import { heroMayBePageGround } from '@/lib/page-ground';
import { hubMainGround, resolveMainGround, type ResolvedMainGround } from '@/lib/hub-canvas';
import { resolveHero, type HeroEventInput } from '@/lib/event-hero';
import { mainGroundClipRefForGuests } from '@/lib/guest-hero-video';

export function guestMainGround(
  theme: InviteThemeId,
  ownsPro: boolean,
  heroConfig: unknown,
  event: HeroEventInput,
): ResolvedMainGround | null {
  return heroMayBePageGround(theme, ownsPro)
    ? resolveMainGround(hubMainGround(heroConfig), resolveHero(event), mainGroundClipRefForGuests)
    : null;
}
