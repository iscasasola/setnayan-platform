/**
 * Should `next build` generate source maps for Sentry?
 *
 * Only when they can actually be UPLOADED. The Sentry webpack plugin needs an
 * auth token AND a project slug; with a token alone it builds every map and
 * then logs "No project provided. Will not upload source maps."
 *
 * Measured 2026-10-01: Vercel Production has had SENTRY_AUTH_TOKEN for 138 days
 * and never SENTRY_PROJECT, so every production build paid for ~2,100 maps it
 * threw away — compile 14.7 min instead of 6.8 min on the same machine, and a
 * `.next` of 8.5 GB instead of 4.7 GB. Full numbers:
 * lib/the-build-has-headroom-ci-cannot-prove.test.ts.
 *
 * SENTRY_ORG is not required here: an org-scoped token carries its org (the
 * Vercel log complains only about the project). If the owner ever adds a
 * user token instead, the plugin will say "No org provided" — still no crash.
 *
 * Plain module, no imports: next.config.ts loads it before anything else.
 */
export function sentrySourcemapsCanUpload(
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(env.SENTRY_AUTH_TOKEN?.trim() && env.SENTRY_PROJECT?.trim());
}
