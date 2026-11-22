/**
 * 🪪 THE ＋ NEEDS A VERIFIED SHOP (UNICHAT ＋ P1 · owner 21 Nov, the v2 drawing's "Gates": *"every ＋ tool needs the
 * shop at least Verified, with a server check on every send"*).
 *
 * The pure half: what a gate verdict SAYS. The I/O half is `shop-plus-gate.server.ts`. Three verdicts, never two —
 * a refused read is "couldn't check", not "not verified" (the 20 Aug disease), and an action REFUSES on it: a send
 * fails closed, so an unknown shop never slips a tool through.
 */
export type PlusGate = 'open' | 'unverified' | 'unknown';

export const PLUS_NEEDS_VERIFIED = 'Chat tools open once your shop is verified.';
export const PLUS_GATE_UNKNOWN = 'We couldn’t check your shop’s verification just now — try again in a moment.';

/** The words a refused send shows, or `null` when the gate is open. */
export function plusGateRefusal(gate: PlusGate): string | null {
  if (gate === 'open') return null;
  return gate === 'unverified' ? PLUS_NEEDS_VERIFIED : PLUS_GATE_UNKNOWN;
}
