/**
 * env-flag.ts — ONE way to read a boolean env flag.
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * This repo reads boolean flags two different ways, and which one a given flag
 * got is pure accident of who wrote it:
 *
 *   strict  → `process.env.X === 'true'`                  (~20 flags)
 *   lenient → `v === 'true' || v === '1' || v === 'TRUE'` (~10 flags)
 *
 * So `TRUE` turns some features on and silently does nothing for others. On
 * 2026-08-01 the owner set `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED`, redeployed,
 * and the login wall stayed up — with no error anywhere, because a flag that
 * fails to parse is indistinguishable from a flag that is off.
 *
 * **A flag whose "off" and whose "malformed" look identical costs a deploy
 * cycle every time someone guesses the casing wrong.** This is the shared
 * reader that ends that.
 *
 * ── WHAT COUNTS AS ON ────────────────────────────────────────────────────────
 * `true` · `1` · `yes` · `on`, case-insensitive, surrounding whitespace ignored
 * (a trailing space is invisible in a dashboard input and has cost people
 * hours). Everything else — including unset, empty, `false`, `0`, `no`, `off`
 * and any typo — is OFF.
 *
 * FAIL-CLOSED is deliberate and must stay: these flags gate unfinished or
 * compliance-sensitive features, so an unrecognised value must never be read as
 * permission. Widening the ON set is a decision; narrowing it is a bugfix.
 *
 * ── STILL NOT A MASS MIGRATION ───────────────────────────────────────────────
 * ⚠ The adoption pass on 2026-08-09 was done ONE FLAG AT A TIME, not as a
 * find-and-replace, because widening a reader **silently activates** whatever
 * the flag gates if some environment already holds a variant like `TRUE`. Five
 * env flags were therefore left strict ON PURPOSE, each with a one-line note at
 * its own reader saying why:
 *
 *   CSAM_HASH_MATCH_ENABLED                  contract-gated (NPC Circular 16-02)
 *   NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED biometric — DPO decision
 *   NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED   new collection — DPO decision
 *   PAPIC_CLIP_DROP_ENABLED (×2 readers)     arms an irreversible drop
 *
 * Converting any of those is a compliance/owner decision, not a bugfix. The
 * same rule binds the next one: read the site, then convert.
 *
 * ── THE 2026-09-22 PASS (W1 / register LAU-36) ───────────────────────────────
 * Four more readers had drifted in since 2026-08-09 and were converted:
 *   CATEGORY_PROPOSAL_DRAFT_ENABLED · SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED
 *   VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED · NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION
 *
 * 🔑 THEY DRIFTED IN BECAUSE THE GUARD WAS AN ALLOWLIST, NOT A CLOSED SET.
 * `env-flag.test.ts` checked that every REGISTERED flag behaved, and ended with
 * an "inventory" test whose final assertion was `assert.ok(Array.isArray(...))`
 * — always true, so it could never fail. It also walked only `lib/` (one level)
 * and matched only `NEXT_PUBLIC_*`, so three server-side flags were outside its
 * pattern and the fourth hand-rolled its own lenient set and matched nothing.
 *
 * That test is now a closed-set gate: it walks the whole tree (~4,100 files),
 * matches both operand orders, and FAILS when a strict reader is in neither
 * CONVERTED nor HELD_STRICT. Adding a strict reader is now a deliberate act.
 *
 * ⚠ The fourth one is why this matters beyond tidiness. It gates whether a new
 * account must confirm its email, and its hand-rolled set
 * (`'true' || '1' || 'TRUE'`) did not trim whitespace. A trailing space is
 * invisible in the Vercel dashboard, and would have read as OFF.
 *
 * ── WHAT THIS IS NOT FOR ─────────────────────────────────────────────────────
 * Kill-switches written `!== 'false'` (default ON) are a DIFFERENT shape, and
 * running them through this reader would INVERT their default. And form-field
 * comparisons (`formData.get('x') === 'true'`) read values this app itself
 * emitted — nobody types those, so there is nothing to be forgiving about.
 */

/** The values that mean ON. Case-insensitive, trimmed. */
const TRUTHY = new Set(['true', '1', 'yes', 'on']);

/**
 * Read a boolean env flag. Unset / empty / unrecognised ⇒ false.
 *
 * @param raw pass `process.env.NEXT_PUBLIC_X` directly — NOT the variable NAME.
 *   `NEXT_PUBLIC_*` values are inlined at BUILD time by static analysis of the
 *   literal `process.env.NEXT_PUBLIC_X` expression, so a dynamic lookup
 *   (`process.env[name]`) would read `undefined` in the browser and quietly
 *   disable the feature. That is why this takes the value, not the key.
 */
export function envFlagEnabled(raw: string | undefined | null): boolean {
  if (typeof raw !== 'string') return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}
