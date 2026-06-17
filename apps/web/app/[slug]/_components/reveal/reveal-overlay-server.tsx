import type { ComponentProps } from 'react';
import { fetchRevealConfig } from '@/lib/reveal-config';
import { RevealOverlay } from './reveal-overlay';

type Props = Omit<ComponentProps<typeof RevealOverlay>, 'config'>;

/**
 * Server wrapper that resolves the admin Reveal Studio config (the single
 * `reveal_studio_config` row) and feeds it to the client RevealOverlay: master
 * on/off · default template · veil look knobs · per-feature toggles ·
 * house-default petal colour. This lets the couple page mount the reveal without
 * threading the config through its sub-components — the read is cached, so the
 * two mount sites (PublicLanding + InvitationSite) share one query per request.
 */
export async function RevealOverlayServer(props: Props) {
  const config = await fetchRevealConfig();
  return <RevealOverlay {...props} petalsColor={props.petalsColor ?? config.petalsColor} config={config} />;
}
