// The nav/icon/menu registry's ICON ALLOWLIST — the names an admin may pick for a menu slot
// (/admin/menus) or a taxonomy node (/admin/categories), and the components they draw.
//
// ⚠ BRAND REFRESH STEP 3 (owner 2026-10-26): this file no longer imports an icon library. The list
// lives in app/_components/icon/legacy-icon-names.ts (stored lucide name → glyph name, SAME order —
// the admin picker lists it as written) and every glyph is drawn by app/_components/icon/icon-map.ts,
// the one file that imports icons. Same components as before (`lib/icon-map-is-the-one-source.test.ts`
// proves identity name by name), so nothing on screen moves — and when the icon set changes, a row
// that stores "Users" follows icon-map.ts with no data migration.
//
// Custom (non-icon) marks like SetnayanMark and uploaded images are handled in <DynamicIcon> /
// navIconComponent, not here. Client-safe, no hooks.

import type { IconComponent } from '@/app/_components/icon/icon-map';
import { LEGACY_ICON_NAMES, glyphForStoredName } from '@/app/_components/icon/legacy-icon-names';

/** name -> component for every allowlisted icon name (read through the icon map). */
export const NAV_ICON_COMPONENTS: Record<string, IconComponent> = Object.fromEntries(
  Object.keys(LEGACY_ICON_NAMES).map((name) => [name, glyphForStoredName(name)!]),
);

/** Sorted list of pickable icon names (drives the admin picker search). */
export const NAV_ICON_NAMES: readonly string[] = Object.keys(LEGACY_ICON_NAMES);

/** Resolve a stored icon name to a component, or null if not allowlisted. */
export function getLucideIcon(name: string | null | undefined): IconComponent | null {
  return glyphForStoredName(name);
}
