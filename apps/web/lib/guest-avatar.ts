/**
 * guest-avatar — ONE resolver for a stored `guests.avatar_config`, whatever
 * style it is. Every reader of a config (the walk's own figure, the seated
 * crowd, a remote mover, the maker) and the one writer (avatar-actions) go
 * through here, so "which style is this?" is decided in exactly one place.
 *
 *   · no `style` key  → chibi (v1 shipped without one; every stored row today)
 *   · style 'heritage' → the mannequin rig with its look fields
 *   · style 'blocky'   → the same rig, rounded-box parts (the Blocky Kit)
 *
 * The chibi path is `selfFigureAvatar` unchanged — the fallback rule that
 * lib/venue-avatars.test.ts pins (flag off / null / junk ⇒ null ⇒ the blob) is
 * not re-implemented here, it is called. Pure.
 */
import { selfFigureAvatar } from './venue-avatars';
import type { ChibiAvatarConfig } from './chibi-config';
import { validateChibiConfig, CHIBI_CONFIG_KEYS } from './chibi-config';
import {
  isHeritageStored,
  resolveHeritageConfig,
  validateHeritageConfig,
  HERITAGE_CONFIG_KEYS,
  type HeritageAvatarConfig,
} from './heritage-config';

export type GuestAvatar =
  | { style: 'chibi'; config: ChibiAvatarConfig }
  | { style: 'heritage' | 'blocky'; config: HeritageAvatarConfig };

export function resolveGuestAvatar(stored: unknown, id: string, enabled: boolean): GuestAvatar | null {
  if (!enabled || stored == null) return null;
  if (isHeritageStored(stored)) {
    const config = resolveHeritageConfig(id, stored);
    return { style: config.style, config };
  }
  const chibi = selfFigureAvatar({ avatarConfig: stored }, id, true);
  return chibi ? { style: 'chibi', config: chibi } : null;
}

/** The write gate: strict per style. A heritage claim is validated as heritage;
 *  everything else is validated as a chibi (which rejects a stray `style`). */
export function validateGuestAvatar(input: unknown): string[] {
  return isHeritageStored(input) ? validateHeritageConfig(input) : validateChibiConfig(input);
}

/** Whitelist-ordered copy — only known keys reach the row. */
export function canonicalGuestAvatar(input: Record<string, unknown>): Record<string, unknown> {
  const keys: readonly string[] = isHeritageStored(input) ? HERITAGE_CONFIG_KEYS : CHIBI_CONFIG_KEYS;
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = input[k];
  return out;
}
