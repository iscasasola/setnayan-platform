/**
 * apps/web/lib/kwento-moderation.ts
 *
 * Kwento Tier-1 text moderation (0012 § Kwento) — the synchronous,
 * un-disableable gate every guest message passes BEFORE the submit RPC.
 * Pure function, zero deps, fully unit-tested (scripts/test-kwento.ts).
 *
 * Three verdicts:
 *   blocked  — hard slurs / explicit sexual terms → rejected inline at the
 *              editor ("Let's keep it sweet 💛"); NEVER inserted.
 *   flagged  — profanity (EN + Tagalog + Cebuano) or PH PII (phone/email) →
 *              inserted as pending+flagged; couple-only until they approve;
 *              NEVER wall-eligible (DB CHECK backstops).
 *   clean    — proceeds as pending; one-tap approvable to the wall.
 *
 * Tier-2 (an async multilingual classifier) is deliberately OFF in V1 per the
 * data-residency recommendation (PII-redact + no-retention + self-host
 * pending owner sign-off); this lexicon + the couple review queue are the V1
 * moderation surface. Lists are intentionally measured: catch real abuse, not
 * affectionate Taglish banter ("grabe", "loka", "baliw na 'to") — when in
 * doubt, prefer 'flagged' (a human decides) over 'blocked'.
 */

export type KwentoVerdict = 'clean' | 'flagged' | 'blocked';

export interface KwentoModerationResult {
  state: KwentoVerdict;
  labels: string[];
}

/** Hard-blocked: slurs + explicit sexual content. Word-boundary matched. */
const BLOCKED_TERMS = [
  // EN slurs / explicit
  'nigger', 'nigga', 'faggot', 'retard', 'cunt',
  'blowjob', 'cumshot', 'gangbang',
  // TL/CEB explicit-sexual
  'kantot', 'kantutan', 'iyot', 'iyutan', 'jakol', 'chupa',
  'burat', 'kepyas', 'bilat', 'otin',
];

/** Flagged: profanity a tito MIGHT type in banter — a human reviews it. */
const FLAGGED_TERMS = [
  // EN
  'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'bastard', 'whore', 'slut',
  'dick', 'pussy',
  // Tagalog
  'putangina', 'putang ina', 'tangina', 'tang ina', 'punyeta', 'pakshet',
  'gago', 'gaga', 'tarantado', 'tarantada', 'ulol', 'hinayupak', 'leche',
  'lintik', 'puta', 'pokpok', 'hayop ka',
  // Cebuano / Bisaya
  'yawa', 'pisti', 'piste', 'buang', 'animal ka', 'giatay', 'atay ka',
  'bogo', 'yati',
];

/** PH phone numbers: +63 / 0 9xx with 7+ trailing digits, separators tolerated. */
const PH_PHONE_RE = /(\+?63|0)\s*9\d{2}[\s\-.]?\d{3}[\s\-.]?\d{4}/;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * Normalize for matching: lowercase, strip diacritics (ñ→n so "putañg…"
 * tricks still match), collapse 3+ repeated letters ("gagooo" → "gago"),
 * leetspeak basics (0→o, 1→i, 3→e, @→a, $→s).
 */
export function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/(.)\1{2,}/g, '$1');
}

function containsTerm(normalized: string, term: string): boolean {
  // Word-boundary match; multi-word terms match across single spaces.
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(normalized);
}

/** Tier-1 gate. Runs on the ORIGINAL text for PII, normalized for lexicon. */
export function moderateKwentoText(text: string): KwentoModerationResult {
  const labels: string[] = [];
  const normalized = normalizeForModeration(text);

  for (const term of BLOCKED_TERMS) {
    if (containsTerm(normalized, term)) {
      return { state: 'blocked', labels: ['explicit'] };
    }
  }

  for (const term of FLAGGED_TERMS) {
    if (containsTerm(normalized, term)) {
      labels.push('profanity');
      break;
    }
  }
  // PII runs on the RAW text (normalization mangles digits deliberately —
  // 0/1/3 substitutions — so test the original).
  if (PH_PHONE_RE.test(text)) labels.push('pii_phone');
  if (EMAIL_RE.test(text)) labels.push('pii_email');

  return labels.length > 0 ? { state: 'flagged', labels } : { state: 'clean', labels: [] };
}
