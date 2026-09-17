/**
 * turnstile-verdict.ts — the fail-closed DECISION, alone and testable.
 *
 * `lib/turnstile-verify.ts` is `server-only` (it holds the secret and does the
 * fetch), so a guard can only ever grep it. The part that can actually be got
 * wrong is not the fetch — it is what we conclude from each outcome — so it
 * lives here, where a test EXECUTES it.
 *
 * ⚖ Two directions, and they are not symmetric:
 *   • NO SECRET  → inert, allow. Identical to the behaviour before any of this
 *     shipped; the owner has not switched the check on, so there is nothing to
 *     enforce and refusing would take a working page down.
 *   • SECRET SET → refuse anything that is not an explicit success. A missing
 *     token, a malformed one, a rejection, an HTTP error, a Cloudflare outage.
 *     A captcha that passes when its verifier is unreachable protects nobody,
 *     and "we couldn't check, so we let it through" is the same sentence as
 *     having no check at all.
 */

export type TurnstileOutcome =
  | { kind: 'no_secret' }
  | { kind: 'no_token' }
  | { kind: 'http_error'; status: number }
  | { kind: 'network_error' }
  | { kind: 'answered'; success: boolean };

export type TurnstileVerdict = {
  /** False when no secret is set — the check is switched OFF, not passed. */
  configured: boolean;
  /** May this request proceed? */
  ok: boolean;
};

export function turnstileVerdict(outcome: TurnstileOutcome): TurnstileVerdict {
  if (outcome.kind === 'no_secret') return { configured: false, ok: true };
  if (outcome.kind === 'answered') return { configured: true, ok: outcome.success };
  // no_token · http_error · network_error — every one of them is a refusal.
  return { configured: true, ok: false };
}
