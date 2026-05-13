/**
 * Single source of truth for the currently shipped Setnayan desktop release.
 *
 * The `/api/download/<platform>` routes 302 to these GitHub Release URLs so
 * we can rotate the underlying asset (new dmg / new tag) without touching
 * every link on the site.
 *
 * Update this file on every desktop release.
 */

export const DESKTOP_RELEASE = {
  version: '0.0.1',
  tag: 'v0.0.1',
  releaseUrl: 'https://github.com/iscasasola/setnayan-platform/releases/tag/v0.0.1',
  publishedAt: '2026-05-14',
  mac: {
    aarch64: {
      filename: 'Setnayan_0.0.1_aarch64.dmg',
      url: 'https://github.com/iscasasola/setnayan-platform/releases/download/v0.0.1/Setnayan_0.0.1_aarch64.dmg',
      sizeBytes: 1_446_653,
    },
  },
} as const;
