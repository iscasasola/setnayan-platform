/**
 * WHICH MY-SHOP PANEL A LINK POINTS AT — AREA-VENDOR, 2026-09-19.
 *
 * The four My Shop panels (Profile · Website · Team · Branch) always started
 * CLOSED, and nothing read the address. So a link into a panel landed on a
 * page whose target was folded to height 0:
 *   · Instagram's OAuth callback redirects to `/vendor-dashboard/shop#gallery-media`
 *     with `?ig_connected` / `?ig_error` — the section AND the result message
 *     both live inside the closed Website panel, so a supplier who connected
 *     Instagram was told nothing either way;
 *   · the Website tab's "Edit page" and Performance's "Add recent photos" both
 *     landed on My Shop with every panel shut.
 *
 * Pure, so the mapping is tested directly; `ManageTiles` applies it on mount
 * and on every `hashchange`.
 */
export type ToolKey = 'profile' | 'website' | 'team' | 'branch';

/** Every in-panel anchor a link may point at, and the panel that holds it. */
export const PANEL_FOR_HASH: Readonly<Record<string, ToolKey>> = {
  profile: 'profile',
  website: 'website',
  // The Instagram / gallery section inside the Website editor.
  'gallery-media': 'website',
  team: 'team',
  branch: 'branch',
};

/** `#gallery-media` / `gallery-media` → 'website'; anything else → null. */
export function panelForHash(hash: string | null | undefined): ToolKey | null {
  if (!hash) return null;
  const key = decodeURIComponent(hash.replace(/^#/, '')).trim();
  return Object.prototype.hasOwnProperty.call(PANEL_FOR_HASH, key) ? PANEL_FOR_HASH[key]! : null;
}
