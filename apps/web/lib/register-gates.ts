/**
 * Register-gates flag (the free/login boundary · owner-locked 2026-06-21).
 *
 * The locked boundary: a couple can USE + PREVIEW the free planning tools
 * anonymously, but creating their PUBLIC IDENTITY (monogram studio + website
 * builder), taking a file out (downloading a planning PDF), or anything outbound
 * requires a (free) registered account. Securing the account at those moments is
 * the deliberate capture point — every serious couple becomes a reachable
 * account, which is the active demand that attracts vendors.
 *
 * When ON, the gated surfaces require a secured (non-anonymous) account:
 *   - the public /monogram studio (owner "login to use it too — maximum capture;
 *     every visitor registers first")
 *   - the in-app monogram studio + the website builder (register to use)
 *   - planning-PDF downloads (register to download)
 *
 * Default OFF → every surface behaves exactly as today (no gate). NEXT_PUBLIC_ so
 * client + server read the SAME flag (it gates both a build-time page branch and
 * client/route checks). Parked until the owner flips it alongside the anon-draft
 * rollout (the gates lean on the anonymous-session model — see lib/anon-onboarding).
 */
export function registerGatesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_REGISTER_GATES_ENABLED === 'true';
}
