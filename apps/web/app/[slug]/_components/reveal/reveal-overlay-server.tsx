import { cache, type ComponentProps } from 'react';
import { fetchRevealConfig } from '@/lib/reveal-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventStdOpeningsActive } from '@/lib/std-openings';
import { RevealOverlay } from './reveal-overlay';
import { StdTouchGlow } from './std-touch-glow';

type Props = Omit<ComponentProps<typeof RevealOverlay>, 'config' | 'premiumUnlocked'> & {
  /** Event whose premium-openings ownership gates the reveal (PR4 P5). */
  eventId?: string;
};

/**
 * Server wrapper that resolves the admin Reveal Studio config (the single
 * `reveal_studio_config` row) and feeds it to the client RevealOverlay: master
 * on/off · default template · veil look knobs · per-feature toggles ·
 * house-default petal colour. This lets the couple page mount the reveal without
 * threading the config through its sub-components — the read is cached, so the
 * two mount sites (PublicLanding + InvitationSite) share one query per request.
 *
 * ⚠ THE OWNERSHIP READ IS NO LONGER RARE, AND THE OLD COMMENT SAYING SO WAS
 * CORRECTED RATHER THAN LEFT (2026-08-29). It used to claim "zero extra queries
 * on the common paths" because it only fired in the Save-the-Date window — a
 * stage most visitors never see. The reveal now also plays over the INVITATION
 * (owner ruling, same day), which is the busiest stage of the hub, so this read
 * happens on ordinary guest traffic. `eventSkuActive` is a CHAIN (direct order →
 * bundles → onboarding basket → promo window → comp grant → internal host →
 * founder seat) and it runs to the end for an event that owns nothing, which is
 * the common case. It is wrapped in React `cache()` below — the same pattern
 * `fetchRevealConfig` already uses — so it resolves once per request no matter
 * how many times the overlay is mounted.
 */
const stdOpeningsActiveCached = cache(async (eventId: string) =>
  eventStdOpeningsActive(createAdminClient(), eventId),
);
export async function RevealOverlayServer({ eventId, ...props }: Props) {
  const config = await fetchRevealConfig();
  // Fires when the reveal is enabled for this phase (`enabled` — now the
  // Save-the-Date window OR the invitation) AND the admin global toggle is not
  // already unlocking openings for everyone. Cached per request; see above.
  const premiumUnlocked =
    props.enabled && !config.enabled && eventId
      ? await stdOpeningsActiveCached(eventId)
      : false;
  const glow = config.touchGlow;
  return (
    <>
      {/* Press-to-glow runs wherever the reveal is enabled (`enabled`) when the
          admin has it on — independent of whether the premium reveal shows, so
          it brightens both the reveal and the bare film underneath. Since
          2026-08-29 that is the Save-the-Date window AND the invitation. */}
      {props.enabled && glow.enabled ? (
        <StdTouchGlow
          color={glow.color}
          intensity={glow.intensity}
          size={glow.size}
        />
      ) : null}
      <RevealOverlay
        {...props}
        petalsColor={props.petalsColor ?? config.petalsColor}
        config={config}
        premiumUnlocked={premiumUnlocked}
      />
    </>
  );
}
