/** Types for `write-app-code-map.mjs` (the build step) — so its guard can import it under `allowJs: false`. */
export function buildVersion(env?: Record<string, string | undefined>): string;
export function urlRouteOf(manifestRoute: string): string;
export function appCodeMap(pages: Record<string, string[]>): { v: 1; chunks: string[]; routes: Record<string, number[]> };
