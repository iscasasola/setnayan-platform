// Pure, dependency-free core for the guest-list name matcher — no `server-only`,
// so it is unit-testable (guest-claim-core.test.ts). guest-claim.ts re-exports
// these and keeps the server-only guard for its callers.
//
// Guest-list name matcher (Invite/Join v2 · 0000 ADDENDUM 2026-06-25).
//
// A signed-in or accountless joiner's presented name is fuzzy-matched by NAME
// against the couple's unclaimed seed rows (public.guests). A confident,
// unambiguous match links them (inheriting the host-assigned role); anything
// else is optimistically admitted + flagged for the couple to reconcile.
//
// There is NO public guest search field anywhere — matching only ever runs for a
// visitor who already holds a valid universal join token, against their OWN
// presented name. Pure + deterministic; no I/O.
//
// (The former privacy-first email-OTP claim path — generateOtpCode / hmacOtp /
// verifyOtp / maskEmail + the guest_claims ledger — was retired with the move to
// optimistic admit; only the matcher remains.)

// ── Tunables ────────────────────────────────────────────────────────────────
/** Score at/above which a single candidate is "confident enough" to claim. */
export const CONFIDENT_MATCH = 0.86;
/** Top-1 must beat top-2 by this margin, else it's an ambiguous collision. */
export const UNAMBIGUOUS_MARGIN = 0.08;
/** Cap attacker-controlled name length before the O(n·m) match (DoS guard). */
export const MAX_NAME_LENGTH = 120;

// ── Name normalization + similarity ──────────────────────────────────────────

/**
 * Lowercase, strip diacritics, drop punctuation/symbols, collapse whitespace.
 * Keeps letters + digits of ALL scripts (so 上海 / Москва / José survive — only
 * pure punctuation/emoji normalizes away, which then fails the !na guard in
 * nameSimilarity and safely routes to couple review). Input is capped first to
 * bound the O(n·m) Levenshtein against an attacker-supplied name (DoS guard).
 */
export function normalizeName(raw: string): string {
  return raw
    .slice(0, MAX_NAME_LENGTH)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // combining diacritical marks
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ') // punctuation + symbols → space (Unicode-aware)
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  let prev = Array.from({ length: bl + 1 }, (_, i) => i);
  let curr = new Array<number>(bl + 1).fill(0);
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl] ?? 0;
}

function levRatio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/**
 * 0..1 name similarity, order-independent ("Maria Santos" ≈ "Santos, Maria").
 * Takes the better of a straight ratio and a token-sorted ratio.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  const sortTokens = (s: string) => s.split(' ').sort().join(' ');
  return Math.max(levRatio(na, nb), levRatio(sortTokens(na), sortTokens(nb)));
}

export type SeedCandidate = {
  guestId: string;
  name: string;
  email: string | null;
};

export type ClaimMatchResult =
  | { kind: 'confident'; candidate: SeedCandidate; score: number }
  | { kind: 'ambiguous'; topScore: number } // same-name collision → couple review
  | { kind: 'none' };

/**
 * Rank seed rows against the claimer's presented name and classify the outcome.
 * `confident` only when the single best beats the runner-up by UNAMBIGUOUS_MARGIN.
 */
export function classifyClaimMatch(
  claimerName: string,
  seeds: SeedCandidate[],
): ClaimMatchResult {
  const scored = seeds
    .map((s) => ({ s, score: nameSimilarity(claimerName, s.name) }))
    .sort((x, y) => y.score - x.score);

  const top = scored[0];
  if (!top || top.score < CONFIDENT_MATCH) return { kind: 'none' };

  const second = scored[1];
  if (second && second.score >= CONFIDENT_MATCH && top.score - second.score < UNAMBIGUOUS_MARGIN) {
    return { kind: 'ambiguous', topScore: top.score };
  }
  return { kind: 'confident', candidate: top.s, score: top.score };
}

/**
 * ── SELF-JOIN HARDENING (2026-08-01) ────────────────────────────────────────
 * May a `confident` match be used to BIND the joiner to an EXISTING seed row —
 * i.e. to hand them another human's identity (that row's host-assigned role and
 * seat, and on the accountless path that row's `qr_token` guest session)?
 *
 * `classifyClaimMatch` above answers a RANKING question and is deliberately
 * fuzzy: CONFIDENT_MATCH = 0.86 Levenshtein ratio admits ~1.7 character edits
 * on a 12-character name, so "Marla Santos", "Maria Santoz" and "Mario Santos"
 * all "confidently" resolve to *Maria Santos*. That fuzz is right for deciding
 * *"is this probably the same person, so don't mint a duplicate row?"*. It is
 * NOT right for deciding *"may this browser become that person?"* — and until
 * this gate the two questions shared one answer.
 *
 * Why it matters more than it used to: the join token is printed on a POSTER
 * and is public by design, so the presented name is the only thing standing
 * between an anonymous scanner and a named guest's session. Poster-QR self-join
 * became the PRIMARY entry path for eight more event types on 2026-08-01
 * (`lib/papic-event-access.ts` — reunion · celebration · gala_night · corporate ·
 * tournament · date · hangout · Samahan-owned anniversary), which is exactly
 * the "self-join hardening" precondition that widening waived.
 *
 * The bar chosen is the one this codebase ALREADY ships for the same gesture:
 * `public_seat_lookup()` (the free public seat finder, where an anonymous
 * visitor types a name into a box) is EXACT full-name match after case +
 * whitespace normalization — "no substring, no enumeration" — plus a rate
 * limit. That surface returns a table LABEL. This one returns a SESSION, so it
 * must be at least as strict.
 *
 * Order-independence is KEPT ("Santos, Maria" == "Maria Santos"), because it
 * admits no edit-distance slack at all: it is exact equality of the token
 * multiset. A pair of guests who are exact token-permutations of each other
 * both score 1.0 and are already caught upstream as `ambiguous`.
 *
 * ⚠ NOBODY IS BLOCKED BY THIS. A near-miss simply falls through to the
 * optimistic-admit path that already exists for `none`/`ambiguous`: the joiner
 * is admitted as `self_added_unlisted` and the couple is NOTIFIED to reconcile
 * (Link / Keep / Delete). So this gate does not reject a real guest — it turns
 * a SILENT identity transfer into a visible, host-reviewed one. The optimistic
 * -admit decision (0000 ADDENDUM 2026-06-25, "a name isn't a secret") is
 * untouched; only the fuzz band on the identity-transfer step is removed.
 */
export function seedBindAllowed(presentedName: string, candidateName: string): boolean {
  const a = normalizeName(presentedName);
  const b = normalizeName(candidateName);
  if (!a || !b) return false;
  if (a === b) return true;
  const sortTokens = (s: string) => s.split(' ').sort().join(' ');
  return sortTokens(a) === sortTokens(b);
}
