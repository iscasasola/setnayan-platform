import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Guest invite-CLAIM helpers (migration 20261021_guest_invite_claim).
 *
 * The "Reverse Contact-Drop" matching done the Setnayan-native, privacy-first
 * way: a signed-in guest whose email does NOT exactly match the couple's seed
 * list (public.guests) is fuzzy-matched by NAME against unclaimed seed rows.
 *
 *   - exactly one confident, unambiguous match WITH a seed email → email-OTP
 *   - one confident match but no seed email                       → couple review
 *   - ambiguous (same-name collision) or no match                 → couple review
 *
 * There is NO public guest search field anywhere — matching only ever runs for
 * an authenticated user who already holds a valid universal join token, against
 * their OWN presented name. We surface only the single best candidate's masked
 * email, never a directory.
 *
 * All of this is server-only: the OTP code is HMAC'd with a server secret so it
 * never travels to or is computable by the client (a 6-digit SHA-256 is
 * trivially brute-forced; an HMAC with a secret is not).
 */

// ── Tunables ────────────────────────────────────────────────────────────────
/** Score at/above which a single candidate is "confident enough" to claim. */
export const CONFIDENT_MATCH = 0.86;
/** Top-1 must beat top-2 by this margin, else it's an ambiguous collision. */
export const UNAMBIGUOUS_MARGIN = 0.08;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5; // mirrored as a literal in register_guest_claim_otp_attempt()
/** Don't re-send a fresh code more often than this. */
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
/** Anti-enumeration / anti-email-bomb: min gap between claim submissions per (user,event). */
export const CLAIM_COOLDOWN_SECONDS = 20;
/** Hard cap on claim submissions per (user,event); beyond it we stop matching/emailing and route to review. */
export const CLAIM_MAX_ATTEMPTS = 15;
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

// ── OTP (HMAC-stored) ─────────────────────────────────────────────────────────

function otpSecret(): string {
  // Dedicated secret if set; else fall back to the service-role key (always
  // present server-side, never shipped to the client). Final fallback is a
  // dev-only constant so local builds without secrets still function.
  return (
    process.env.GUEST_CLAIM_OTP_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'setnayan-dev-otp-secret'
  );
}

/** A fresh 6-digit numeric code (crypto-strong, leading zeros preserved). */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hmacOtp(code: string): string {
  return createHmac('sha256', otpSecret()).update(code).digest('hex');
}

/** Constant-time HMAC compare. */
export function verifyOtp(code: string, storedHmac: string | null): boolean {
  if (!storedHmac) return false;
  const a = Buffer.from(hmacOtp(code), 'hex');
  const b = Buffer.from(storedHmac, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** "maria@gmail.com" → "m••••a@gmail.com" (enough to recognize, not to reveal). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : '';
  return `${head}${'•'.repeat(Math.max(2, local.length - 2))}${tail}@${domain}`;
}
