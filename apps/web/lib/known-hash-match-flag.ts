/**
 * CSAM known-hash matching — the hook's kill switch. DEFAULT OFF.
 *
 * `CSAM_HASH_MATCH_ENABLED=true` turns on the per-upload hook in
 * lib/known-hash-match.ts: compute a perceptual hash of the still, ask the
 * configured provider, and RECORD the outcome in `media_hash_checks`.
 *
 * ⚠ TURNING THIS ON DOES NOT TURN ON PROTECTION. There is no provider wired
 * (see `resolveKnownHashProvider`), so with the flag on every upload records
 * `not_enrolled` — an honest audit trail of an absent control, not the control.
 * The control arrives only when the owner enrols with a hash provider
 * (PhotoDNA / NCMEC / IWF) and signs the NPC Circular 16-02 processor
 * agreement. Both are owner/DPO acts; neither is code.
 *
 * NOT `NEXT_PUBLIC_` — this never runs in the browser, and the client has no
 * business knowing whether the check is on.
 */
export function knownHashMatchEnabled(): boolean {
  return process.env.CSAM_HASH_MATCH_ENABLED === 'true';
}
