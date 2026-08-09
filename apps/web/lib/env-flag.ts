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
