/**
 * Single source of truth for the currently shipped Setnayan desktop release.
 *
 * The `/api/download/<platform>` routes 302 to these GitHub Release URLs so
 * we can rotate the underlying asset (new dmg / new tag) without touching
 * every link on the site.
 *
 * Update this file on every desktop release.
 */

// We host the .dmg directly under the Vercel /public folder (served as
// /downloads/<file>) so the link works for anonymous visitors. The repo is
// private, so GitHub Release asset URLs require auth and return 404 to the
// public — Vercel /public has no such restriction.
export const DESKTOP_RELEASE = {
  version: '0.0.1',
  tag: 'v0.0.1',
  publishedAt: '2026-05-14',
  releaseNotesUrl: 'https://setnayan.com/download',
  mac: {
    aarch64: {
      filename: 'Setnayan_0.0.1_aarch64.dmg',
      url: '/downloads/Setnayan_0.0.1_aarch64.dmg',
      sizeBytes: 1_446_653,
    },
  },
} as const;
