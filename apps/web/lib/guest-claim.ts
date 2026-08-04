import 'server-only';

/**
 * Guest-list name matcher (Invite/Join v2 · 0000 ADDENDUM 2026-06-25) —
 * SERVER-ONLY façade.
 *
 * The logic moved to `guest-claim-core.ts` on 2026-08-01, following the shipped
 * `<x>` / `<x>-core` convention (drive-copy, face-match, add-single-guest, …):
 * the core is pure and has no `server-only` guard, so it can carry a unit suite
 * — which this matcher had none of, despite deciding whether an anonymous
 * poster-QR scanner inherits an existing guest's identity.
 *
 * This module keeps the `server-only` guard for the existing import sites and
 * re-exports the core verbatim. NO behavior changed in the move.
 */

export {
  CONFIDENT_MATCH,
  UNAMBIGUOUS_MARGIN,
  MAX_NAME_LENGTH,
  normalizeName,
  nameSimilarity,
  classifyClaimMatch,
  seedBindAllowed,
} from './guest-claim-core';

export type { SeedCandidate, ClaimMatchResult } from './guest-claim-core';
