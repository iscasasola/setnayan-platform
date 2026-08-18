/**
 * leaked-password.ts — refuse a password that is already published in a breach.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Somebody could create a Setnayan account with a password already known to be
 * stolen, and nothing warned them. The database provider ships this check as a
 * dashboard toggle, and the security advisor has flagged it as OFF since at
 * least 2026-08-05. Owner 2026-08-18, told the toggle was out of my reach:
 * "create a way".
 *
 * So this is the app-side equivalent, and it works whatever the toggle says.
 * ⚠ IT IS NOT A REPLACEMENT FOR THE TOGGLE. The toggle also covers password
 * changes made through the provider's own flows, which never reach our code.
 * Turning it on remains worth doing; this closes the paths we own.
 *
 * ── THE PASSWORD NEVER LEAVES THIS PROCESS ──────────────────────────────────
 * k-anonymity, which is the only reason this is safe to do at all:
 *   1. SHA-1 the password locally.
 *   2. Send the FIRST FIVE hex characters of that hash. Nothing else.
 *   3. The service returns every suffix it holds under that prefix — hundreds of
 *      them — and we match locally.
 * The service cannot tell which of those hundreds was ours, and never sees the
 * password, the full hash, the email, or who is asking.
 * 🔒 SHA-1 IS CORRECT HERE AND NOWHERE ELSE. It is the index the corpus is
 * published under, not a security choice. Nothing is stored under it.
 *
 * ── IT FAILS OPEN, DELIBERATELY ─────────────────────────────────────────────
 * If the service is slow, down, or blocked, the password is ACCEPTED.
 * A breached password is a risk. Refusing every signup on the planet because a
 * third party is having an outage is a certainty — and today the site had four
 * separate GitHub outages, so "the network is fine" is not an assumption worth
 * betting a customer on. The cost of the two failures is not close.
 * 🔑 CHOOSE THE FAILURE DIRECTION BY WHAT IT COSTS, and say which you chose.
 */
import { createHash } from 'node:crypto';

/** How long to wait before giving up and letting the password through. */
const TIMEOUT_MS = 2_500;

export type LeakedCheck =
  | { leaked: true; count: number }
  | { leaked: false; checked: true }
  /** The service could not be reached. The password is allowed — see the header. */
  | { leaked: false; checked: false };

/** SHA-1, uppercase hex — the form the published corpus is indexed by. */
export function sha1Hex(password: string): string {
  return createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
}

/** The 5-character prefix that is the ONLY thing sent over the network. */
export function rangePrefix(password: string): string {
  return sha1Hex(password).slice(0, 5);
}

/**
 * Pure: given the service's response body and the password's own hash, decide.
 * Split out from the fetch so the decision is testable without a network.
 */
export function matchInRange(body: string, fullHash: string): { leaked: boolean; count: number } {
  const suffix = fullHash.slice(5);
  for (const line of body.split('\n')) {
    const [candidate, countText] = line.trim().split(':');
    if (!candidate) continue;
    if (candidate.toUpperCase() === suffix) {
      const count = Number.parseInt(countText ?? '0', 10);
      return { leaked: true, count: Number.isFinite(count) ? count : 0 };
    }
  }
  return { leaked: false, count: 0 };
}

export async function isPasswordLeaked(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LeakedCheck> {
  if (!password) return { leaked: false, checked: false };

  const full = sha1Hex(password);
  const prefix = full.slice(0, 5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    });
    // ⚠ A NON-OK RESPONSE IS NOT AN ANSWER. Treat it exactly like an outage
    // rather than reading an error body as "not found" — that is the rejected
    // -query-reads-as-empty trap this codebase has met five times.
    if (!res.ok) return { leaked: false, checked: false };
    const body = await res.text();
    const hit = matchInRange(body, full);
    return hit.leaked ? { leaked: true, count: hit.count } : { leaked: false, checked: true };
  } catch {
    return { leaked: false, checked: false };
  } finally {
    clearTimeout(timer);
  }
}
