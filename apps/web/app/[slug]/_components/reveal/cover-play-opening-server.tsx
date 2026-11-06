import type { ComponentProps } from 'react';
import { fetchRevealConfig } from '@/lib/reveal-config';
import { CoverPlayOpening } from './cover-play-opening';

/**
 * 🎬 The Maker canvas's ▶ opening (`CoverPlayOpening`) with the admin Reveal Studio config the guests' overlay reads
 * (`RevealOverlayServer` — the same cached read, so the veil's look, petals and logo are the guests' own).
 */
export async function CoverPlayOpeningServer(props: Omit<ComponentProps<typeof CoverPlayOpening>, 'config'>) {
  const config = await fetchRevealConfig();
  return <CoverPlayOpening {...props} petalsColor={props.petalsColor ?? config.petalsColor} config={config} />;
}
