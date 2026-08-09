/**
 * Types for the reserved-slug generator, which is authored in plain `.mjs` so
 * `node scripts/gen-reserved-slugs.mjs` runs without a TypeScript step.
 * `lib/reserved-slugs.test.ts` imports the reader to re-derive the route list
 * from disk and compare it against the committed block.
 */
export declare const APP_DIR: string;

/** Top-level folders under `apps/web/app` that serve a URL and could be typed as a slug. */
export declare function routeSlugsFromDisk(appDir?: string): string[];
