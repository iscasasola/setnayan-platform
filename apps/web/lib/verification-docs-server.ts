import 'server-only';

import { R2_BUCKETS, r2List } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  VERIFICATION_PREFIX,
  buildVerificationDocsReportWith,
  readAllReferenceSources,
  type ReferenceQueryClient,
  type VerificationDocsReport,
} from '@/lib/verification-docs';

/**
 * The server half: a database client, a bucket listing, and nothing else.
 *
 * ── THIS MODULE DECIDES NOTHING, AND NOW IT WIRES NOTHING EITHER ────────────
 * It opens with `import 'server-only'`, which is not installed here, so no
 * `node:test` can load it. Anything it holds can be guarded only by reading its
 * source as TEXT, and this page has now watched **nine** such guards fall:
 *
 * Round 2 — two guards that asserted a literal appeared:
 *   · both `referencedKeysFrom(` call sites kept, their results thrown away
 *     (`keys.add(key)` 2 → 0). The reference set was empty by construction —
 *     the original defect, restored. GREEN at 32/32.
 *   · the block-reason expression replaced while both asserted literals stayed
 *     in place. Gate gone. GREEN at 32/32.
 * Round 3 — the query this module built for itself:
 *   · the range window shifted by one row, skipping the FIRST row of the table
 *     and offering its five documents for deletion. GREEN at 55/55.
 *   · `.order()` deleted — the line the code's own comment called "what makes
 *     paging meaningful". GREEN at 55/55.
 * Round 4 — three conditions round 3 put back into this file:
 *   · `if (read.error) return …` → `if (false) return …`. GREEN at 72/72.
 *   · `complete = complete && read.complete;` → `complete = complete;`. GREEN.
 *   · `complete: complete && !truncated` → `complete: complete`. GREEN.
 * Round 5 — the WIRING round 4 left behind, found by two reviewers, independently:
 *   · the source loop `.slice(0, 1)`, dropping the in-progress-intake source
 *     entirely — a live government ID offered for permanent deletion, suite
 *     GREEN at 85/85.
 *   · the fold's verdict destructured and re-shaped on the way out with `||`,
 *     which no deny-list of literals can name. GREEN at 85/85.
 *   · `referencesComplete: complete` → `referencesComplete: Boolean(1)`, one
 *     token away from the exact literal round 3's bill forbade. GREEN at 85/85.
 *
 * 🔑 **THE PATTERN IS UNAMBIGUOUS AFTER FIVE ROUNDS: WHATEVER IS LEFT IN THIS
 * FILE IS THE NEXT DEFECT.** So what is left is a client, a listing closure,
 * and one `return` each. The loop over the reference sources, the fold, the
 * listing `try/catch` and the report's argument object all live in
 * `verification-docs.ts`, where a test CALLS them and a fake client records
 * what was asked for.
 *
 * 🛡 **AND THE BILL OVER THIS FILE IS NO LONGER A DENY-LIST.** Round 4 enumerated
 * three forbidden literals (`if (`, `complete =`, `&&`) and two reviewers each
 * walked past it on their first try with a fourth spelling. This repo's own rule
 * is that a deny-list is a bill you have to keep paying. The guard now pins this
 * module's ENTIRE comment-stripped body against an exact expected text: any edit
 * at all — a new spelling, a changed argument, a moved literal — fails, and the
 * author has to update the pin on purpose. See
 * `R5 · the server module's whole body is pinned` in `verification-docs.test.ts`.
 *
 * ── FAIL CLOSED, LOUDLY ─────────────────────────────────────────────────────
 * If either reference source cannot be read, or cannot be read TO THE END, or
 * the walk over a stored value hit its depth ceiling, the report comes back
 * `referencesComplete: false` and the page refuses to offer deletion at all. A
 * partial reference set would mark a LIVE government ID as left over — and the
 * button next to that label is irreversible.
 */

export type { VerificationDocsReport };

/** How many rows one reference page asks for. See `readAllPages`. */
const REFERENCE_PAGE_SIZE = 500;

/** The set of referenced keys, for a delete action to re-derive at press time. */
export async function referencedVerificationKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
  complete: boolean;
}> {
  return readAllReferenceSources(createAdminClient() as unknown as ReferenceQueryClient, {
    pageSize: REFERENCE_PAGE_SIZE,
  });
}

export async function buildVerificationDocsReport(): Promise<VerificationDocsReport> {
  return buildVerificationDocsReportWith({
    client: createAdminClient() as unknown as ReferenceQueryClient,
    listObjects: () =>
      r2List({ bucket: R2_BUCKETS.vendorVerification, prefix: VERIFICATION_PREFIX }),
    pageSize: REFERENCE_PAGE_SIZE,
  });
}
