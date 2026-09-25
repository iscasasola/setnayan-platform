import 'server-only';

import { publicUrlForStoredAsset } from '@/lib/uploads';
import { hubLegibility } from '@/lib/hub-legibility';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';

/**
 * theme-ground.ts — WHAT A THEME LAYS BEHIND EVERY GUEST PAGE: its loop, its
 * still, and the scrim that keeps the words readable over them.
 *
 * Owner, 2026-09-24: *"all event hub themes use video. the image can be used for
 * the invitations, tickets, and poster"* · *"classic has no photo or video"*.
 *
 * 🔑 THE LOOP IS NOT THE COUPLE'S. It is Setnayan's own theme art, public by
 * design, on the public media bucket (build plan D11: egress-free R2, never
 * `public/`, because Vercel bandwidth is the bill). That is why the guest-tree
 * layout MAY draw it — the layout wraps the private landing and must never
 * resolve the couple's reveal photo (`resolveHubTheme`), but a stock loop every
 * Luxe couple shares discloses nothing about anyone.
 *
 * 🔑 THE SCRIM COMES FROM THE LEGIBILITY RULE, NOT FROM A NUMBER HERE.
 * `hubLegibility(theme, {kind:'theme'})` starts at the spec's measured panel or
 * scrim and strengthens it until body text clears AA over the loop's measured
 * lightest AND darkest clusters. Free: nothing here reads an entitlement — the
 * theme was already gated by `resolveHubTheme` before it got here.
 *
 * ⚠ BEST-EFFORT. With no public R2 host configured the URL cannot be built;
 * the theme then renders on its plain canvas (still fully readable — the scrim
 * colour IS the canvas), never a broken video box.
 */
export type ThemeGround = {
  /** The loop's public URL, or null (Classic, or no public host). */
  loop: string | null;
  /** The still, shown before the loop plays and under reduced motion. */
  poster: string | null;
  /** 0…1 — the canvas laid over the media so text reads. */
  scrim: number;
  /** Gold-foil names (Luxe, Great Gatsby) — only over the theme's OWN ground. */
  foil: boolean;
};

/** An `r2://setnayan-media/…` ref → its public URL, through the storage layer's one resolver. */
function publicUrl(ref: string): string | null {
  try {
    return publicUrlForStoredAsset(ref);
  } catch {
    return null;
  }
}

export function resolveThemeGround(
  theme: InviteThemeId,
  input: {
    /**
     * The couple set their own palette or hex colours. The foil is measured
     * against the THEME's canvas; over a ground the couple chose it could fall
     * under the readable tone, so it steps aside (the legibility rule: an accent
     * stays on-brand only when it passes).
     */
    ownColours: boolean;
  },
): ThemeGround | null {
  const t = INVITE_THEMES[theme];
  if (!t.media) return null;
  const legible = hubLegibility(t, { kind: 'theme' });
  return {
    loop: publicUrl(t.media.loop),
    poster: publicUrl(t.media.poster),
    scrim: legible.scrim.opacity,
    foil: t.foilNames && !input.ownColours,
  };
}
