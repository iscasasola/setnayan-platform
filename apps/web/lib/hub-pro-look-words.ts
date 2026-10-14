/**
 * lib/hub-pro-look-words.ts — what Event Hub Pro has unlocked ON THIS EVENT, in
 * words, for its Home row and band: "Pro on · Vintage theme · video background"
 * (owner "approve all", 2026-10-14, services prototype — the Event Hub Pro row).
 *
 * 🔑 Read from what the Event Hub WEARS — the hub's theme (`resolveHubTheme`,
 * already on Home's cover read) and the live hero row's Main background
 * (`hubMainGround`, the same row) — so it costs no read. The vocabulary is the
 * Look › Background panel's own sources (`backgroundSourceOf`): the couple's
 * clip or photo, a scene, the theme's moving loop, a pattern, the colour.
 *
 * Pure.
 */
import { hubMainGround, isHubMainChoice, isHubMainFollow, isHubMainLoop, isHubMainOwn } from '@/lib/hub-canvas';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { isStdLibrarySrc } from '@/lib/std-backgrounds';

export type HubProLookWords = { theme: string | null; background: string | null };

export function hubProLookWords(input: { theme: unknown; heroConfig: unknown }): HubProLookWords {
  const id = normalizeThemeId(input.theme);
  const theme = id ? INVITE_THEMES[id]?.name ?? null : null;
  const themeMoves = Boolean(id && INVITE_THEMES[id]?.media);
  const main = hubMainGround(input.heroConfig);
  let background: string | null;
  if (isHubMainOwn(main)) {
    background = main.kind === 'snippet' ? 'video background' : isStdLibrarySrc(main.media) ? 'scene background' : 'photo background';
  } else if (isHubMainFollow(main)) {
    background = 'cover photo background';
  } else if (isHubMainLoop(main)) {
    background = 'moving background';
  } else if (isHubMainChoice(main) && main.ground === 'pattern') {
    background = 'pattern background';
  } else if (isHubMainChoice(main) && main.ground === 'none') {
    background = 'colour background';
  } else {
    // The theme's own ground — its loop when it has one.
    background = id ? (themeMoves ? 'moving background' : 'colour background') : null;
  }
  return { theme, background };
}
