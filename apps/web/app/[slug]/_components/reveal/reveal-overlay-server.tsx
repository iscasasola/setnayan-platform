import type { ComponentProps } from 'react';
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
 */
export async function RevealOverlayServer({ eventId, ...props }: Props) {
  const config = await fetchRevealConfig();
  // The ownership read fires ONLY in the Save-the-Date phase (`enabled`) AND
  // when the admin global toggle isn't already unlocking openings for everyone —
  // zero extra queries on the common paths, a no-op until the SKU sells (P5).
  const premiumUnlocked =
    props.enabled && !config.enabled && eventId
      ? await eventStdOpeningsActive(createAdminClient(), eventId)
      : false;
  const glow = config.touchGlow;
  return (
    <>
      {/* Press-to-glow runs for the whole Save-the-Date phase (`enabled`) when
          the admin has it on — independent of whether the premium reveal shows,
          so it brightens both the reveal and the bare film underneath. */}
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
