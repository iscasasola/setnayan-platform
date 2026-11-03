/**
 * apps/web/lib/sample-event/gate.ts
 *
 * 🎭 Who the sample opens for — the pure rule. The request half that gathers
 * the three facts is `./switch.server.ts`.
 *
 *   · Wherever Discover (`/`) does not open — CLOSED, whatever the switch says
 *     (`discoverOpensHere()`, lib/request-platform.ts). While Apple reviewed 1.0
 *     that was the native app shell, and middleware bounced the sample out of
 *     it too. Since the owner's 2026-11-02 ruling ("let everything go live")
 *     Discover opens in the app, so the sample does as well — under the switch
 *     below, like on the web. `webShell` keeps its name: it is that question.
 *   · Switch on — OPEN for everyone, signed in or not.
 *   · Switch off (the default) — open only for an internal (§10a) account, so
 *     the owner can walk it before he flips it; everyone else gets a 404, the
 *     same page as an address that never existed.
 *
 * A failed switch read is "off" (the resolver falls back to the env var, unset
 * = off): a dark launch fails closed, never open.
 */
export type SampleGateFacts = {
  /** Does this request come from a browser (not the native app shell)? */
  webShell: boolean;
  /** `platform_settings.sample_event_enabled`, resolved (tri-state → boolean). */
  switchOn: boolean;
  /** Is the viewer an internal account? Asked only when the switch is off. */
  internal: boolean;
};

export function sampleOpensFor(facts: SampleGateFacts): boolean {
  if (!facts.webShell) return false;
  if (facts.switchOn) return true;
  return facts.internal;
}
