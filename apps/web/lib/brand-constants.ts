/**
 * Built-in gold default brand-asset URLs.
 *
 * Single source of truth for the canonical gold mark + icon paths, safe to
 * import from BOTH server and client modules (no `server-only`, no DB/Buffer
 * deps). Server code that also needs the cached DB read imports these via
 * `lib/brand-settings.ts` (which re-exports them); the client BrandProvider
 * imports them straight from here.
 *
 * Every surface falls back to these whenever no admin brand icon is set, so the
 * admin default-icon feature is purely additive.
 */
export const DEFAULT_BRAND_MARK_SVG = '/brand/setnayan-mark.svg';
export const DEFAULT_APPLE_TOUCH = '/brand/setnayan-app-icon-512.png';
export const DEFAULT_ICON_SVG_192 = '/icon-192.svg';
export const DEFAULT_ICON_SVG_512 = '/icon-512.svg';
