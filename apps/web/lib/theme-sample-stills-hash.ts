/**
 * The look hash of a theme's sample still — see `theme-sample-stills.ts`.
 * Node only (the capture script and the currency test), never the browser.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';

/** Keys sorted at every level, so the same definition always hashes alike. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = stable((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

/** The door's CSS module text (`app/[slug]/invite/_components/themes/<door>.module.css`), or null. */
export function doorCssOf(id: InviteThemeId, webRoot: string): string | null {
  const file = join(webRoot, 'app', '[slug]', 'invite', '_components', 'themes', `${INVITE_THEMES[id].door}.module.css`);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** What shapes a theme's still in code: its definition and its door's CSS. */
/**
 * 🎨 THE CAPTURE'S OWN TERMS — part of every still's hash. `palette=none`: a
 * still is the sample in each theme's OWN colours (owner 2026-10-05, "THE MOOD
 * BOARD PALETTE IS THE PRIORITY"; `scripts/capture-theme-samples.ts`). A still
 * captured under any other terms (before this, the sample wore its own board)
 * hashes differently, so `theme-sample-stills-are-current.test.ts` goes red and
 * names the re-capture. Change it whenever what a capture asks for changes.
 */
export const THEME_STILL_CAPTURE_TAG = 'palette=none';

export function themeLookHash(id: InviteThemeId, doorCss: string | null): string {
  return createHash('sha256')
    .update(JSON.stringify(stable({ theme: INVITE_THEMES[id], doorCss, capture: THEME_STILL_CAPTURE_TAG })))
    .digest('hex')
    .slice(0, 16);
}
