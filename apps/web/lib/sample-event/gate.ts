/**
 * apps/web/lib/sample-event/gate.ts
 *
 * 🎭 Who the sample opens for — the pure rule. The request half that gathers
 * the three facts is `./switch.server.ts`.
 *
 *   · The native app shell (Apple reviewing 1.0) — CLOSED, whatever the switch
 *     says. The middleware bounces it first; this is the same answer again for
 *     a render that got past it (`discoverOpensHere()`, lib/request-platform.ts).
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
