/**
 * password-strength.ts — the weak / okay / strong bar and the three rules shown
 * under every box where a person CREATES a password (owner 2026-11-06, during the
 * live walk of /open-shop: *"password strength test for all password creation
 * text boxes … only if they create their own password"*).
 *
 * PURE and client-safe: no `node:crypto`, no network. The component
 * (`app/_components/password-field.tsx`, `mode="new"`) calls it on every
 * keystroke, so it must stay cheap.
 *
 * ── THE THREE RULES (PLAN B1, verbatim) ────────────────────────────────────
 *   1. 8+ characters.
 *   2. Not your name or email.
 *   3. Not a known leaked password — checked when the person continues, by the
 *      server action, through `lib/leaked-password.ts`. This file never decides
 *      that one: it only carries the server's answer through to the bar.
 *
 * ── NO FORCED SYMBOLS OR CAPITALS ──────────────────────────────────────────
 * Composition rules ("one capital, one symbol") make passwords harder to
 * remember and barely harder to guess. Length is what counts, so a long
 * lowercase phrase reaches Strong on its own. The bar rewards variety only by
 * what it adds to the guess space, never as a requirement.
 */

/** The shortest password any create-password door accepts. */
export const NEW_PASSWORD_MIN = 8;

/**
 * The sentence every door shows when the breach check refuses a password. One
 * copy, so a page can tell "refused as leaked" from any other error by equality
 * (reset-password and profile pass the sentence itself in `?error=`).
 */
export const LEAKED_PASSWORD_MESSAGE =
  'This password has appeared in a known data breach. Please choose a different one — it only takes a moment and it protects your account.';

export type StrengthLevel = 'empty' | 'weak' | 'okay' | 'strong';

/** pending = nothing to judge yet · ok = met · fail = broken. */
export type RuleState = 'pending' | 'ok' | 'fail';

export type NewPasswordAssessment = {
  level: StrengthLevel;
  rules: {
    length: RuleState;
    personal: RuleState;
    /** Only the server can answer this one; `pending` until it has. */
    leaked: RuleState;
  };
};

/**
 * The handful of passwords that top every published list and are long enough
 * to pass the length rule. Not the leak check (that is the real corpus, on the
 * server) — only so the bar never paints one of these "Okay" while the person
 * is still typing.
 */
const COMMON = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  'qwertyui',
  'qwertyuiop',
  'qwerty123',
  'asdfghjk',
  'asdfghjkl',
  'iloveyou',
  'iloveyou1',
  'abc12345',
  'abcd1234',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'welcome1',
  'letmein1',
  'admin123',
  'setnayan',
  'setnayan1',
  'setnayan123',
]);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function unleet(s: string): string {
  return s.replace(/[013457@$]/g, (c) => LEET[c] ?? c);
}

/**
 * The pieces of a person's name and email worth refusing inside a password:
 * the whole email, its local part, and every name / local-part word of 4+
 * letters (shorter words — "ana", "jo" — hide inside too many real passwords to
 * be fair to flag).
 */
export function personalTokens(values: ReadonlyArray<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const raw of values) {
    if (!raw) continue;
    const v = fold(raw.trim());
    if (!v) continue;
    const at = v.indexOf('@');
    if (at > 0) {
      out.add(v);
      const local = v.slice(0, at);
      if (local.length >= 3) out.add(local);
      for (const word of local.split(/[^a-z]+/)) if (word.length >= 4) out.add(word);
    } else {
      for (const word of v.split(/[^a-z0-9]+/)) if (word.length >= 4) out.add(word);
    }
  }
  return [...out];
}

/** Does the password contain the person's name or email (also in 1337-speak)? */
export function mentionsPersonal(password: string, values: ReadonlyArray<string | null | undefined>): boolean {
  const pw = fold(password);
  if (!pw) return false;
  const plain = pw.replace(/[^a-z0-9@.]/g, '');
  const leet = unleet(pw).replace(/[^a-z0-9@.]/g, '');
  return personalTokens(values).some((t) => {
    const tok = t.replace(/[^a-z0-9@.]/g, '');
    return tok.length > 0 && (plain.includes(tok) || leet.includes(tok));
  });
}

/** One character over and over, or a straight run (abcdefgh, 12345678, 98765432). */
function isRunOrRepeat(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true;
  let up = true;
  let down = true;
  for (let i = 1; i < pw.length; i += 1) {
    const d = pw.charCodeAt(i) - pw.charCodeAt(i - 1);
    if (d !== 1) up = false;
    if (d !== -1) down = false;
  }
  return up || down;
}

/** log2 of the guess space a password of this length and alphabet spans. */
export function guessBits(password: string): number {
  if (!password) return 0;
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 33;
  // Long stretches of one repeated character add almost nothing.
  const effective = password.replace(/(.)\1{2,}/g, '$1$1').length;
  return effective * Math.log2(Math.max(pool, 1));
}

/** Below this the bar says Weak even at 8+ characters (8 lowercase letters ≈ 37.6). */
const WEAK_BELOW_BITS = 40;
/** At or above this, and 12+ characters, the bar says Strong (14 lowercase ≈ 65.8). */
const STRONG_FROM_BITS = 64;
const STRONG_MIN_LENGTH = 12;

export function assessNewPassword(
  password: string,
  opts: { personal?: ReadonlyArray<string | null | undefined>; leaked?: boolean } = {},
): NewPasswordAssessment {
  const leakedRule: RuleState = opts.leaked ? 'fail' : 'pending';
  if (!password) {
    return { level: 'empty', rules: { length: 'pending', personal: 'pending', leaked: leakedRule } };
  }
  const longEnough = [...password].length >= NEW_PASSWORD_MIN;
  const personal = mentionsPersonal(password, opts.personal ?? []);
  const rules = {
    // Short-while-typing is "not yet", never red: the person has not finished.
    length: (longEnough ? 'ok' : 'pending') as RuleState,
    personal: (personal ? 'fail' : 'ok') as RuleState,
    leaked: leakedRule,
  };

  const folded = fold(password);
  const weak =
    !longEnough ||
    personal ||
    opts.leaked === true ||
    COMMON.has(folded) ||
    COMMON.has(unleet(folded)) ||
    isRunOrRepeat(password) ||
    guessBits(password) < WEAK_BELOW_BITS;
  if (weak) return { level: 'weak', rules };

  const strong = [...password].length >= STRONG_MIN_LENGTH && guessBits(password) >= STRONG_FROM_BITS;
  return { level: strong ? 'strong' : 'okay', rules };
}
