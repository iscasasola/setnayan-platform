/**
 * Pure, client-safe R2 bucket routing (NO `server-only`, NO SDK, NO I/O).
 *
 * Extracted from `lib/storage.ts` so the mapping can be unit-tested under the
 * Node test runner (`pnpm test:unit` → `tsx --test`). Importing `storage.ts`
 * into a node:test file fails on its top-of-file `import 'server-only'`
 * (that package throws outside an RSC context), so the house pattern — mirrored
 * from `lib/review-fraud-scoring.ts` (pure) vs `lib/review-fraud-screener.ts`
 * (server-only I/O) — is to keep the deterministic logic in its own module and
 * test THAT. `storage.ts` re-exports `bucketForPrefix` from here, so every
 * existing call site is unchanged.
 */
import { type R2BucketKey } from '@/lib/r2';

/**
 * Routes a `pathPrefix` to one of the R2 buckets.
 *
 * V1 rules (mirror the spec in the PR body):
 *   - merchant-qr/*          → media
 *   - vendor-logo/*          → media
 *   - profile-photo/*        → media
 *   - payment-screenshots/*  → thread-files  (PLURAL — what the writers use)
 *   - payment-screenshot/*   → thread-files  (SINGULAR — legacy, kept for safety)
 *   - everything else        → media (safe default for public assets)
 *
 * ⚠ Privacy-critical: payment proofs are private and MUST land in the private
 * `thread-files` bucket (read only via short-lived presigned GETs), never the
 * public `media` bucket. Both server-side writers pass the PLURAL prefix
 * `payment-screenshots/…` (checkout/actions.ts + orders/actions.ts), so the
 * plural mapping is the one that actually fires. The singular `payment-screenshot/`
 * is retained purely so any legacy caller can't regress into the public bucket.
 */
/**
 * The bucket Mood Board renders live in (MB8).
 *
 * Here rather than in `render-actions.ts` for two reasons, one mechanical and
 * one that matters more:
 *   · a `'use server'` file may export ONLY async functions — Next fails the
 *     production build on anything else, and neither `tsc` nor the unit suites
 *     can see it (caught by `use-server-exports-only-functions.test.ts`);
 *   · it belongs NEXT TO the `renders/` prefix rule below. The constant and
 *     the routing rule are two statements of one fact, and a fact stated twice
 *     in two files is a fact that can disagree with itself.
 *
 * 🔒 `threadFiles` is the PRIVATE bucket. See the `renders/` rule below.
 */
export const RENDER_BUCKET_KEY: R2BucketKey = 'threadFiles';

export function bucketForPrefix(pathPrefix: string): R2BucketKey {
  const normalized = pathPrefix.replace(/^\/+/, '');
  if (normalized.startsWith('merchant-qr/')) return 'media';
  if (normalized.startsWith('vendor-logo/')) return 'media';
  if (normalized.startsWith('profile-photo/')) return 'media';
  // Plural first — this is the prefix both payment-proof writers actually use.
  if (normalized.startsWith('payment-screenshots/')) return 'threadFiles';
  if (normalized.startsWith('payment-screenshot/')) return 'threadFiles';
  // Off-platform vendor-payment receipts (2026-07-30). Same PII class as the
  // checkout proofs above: bank-transfer screenshots with reference numbers and
  // partial account numbers. The client passes bucket="thread-files" explicitly,
  // so this rule is defence-in-depth — it makes the PREFIX alone sufficient, so
  // a future server-side writer that routes by prefix cannot land these in the
  // public bucket by omission. That omission is exactly how they got there.
  if (normalized.startsWith('payment-proof/')) return 'threadFiles';
  // Mood Board "Make it real" renders (MB8). PRIVATE: a render is the couple's
  // own creation and is theirs alone until an admin FEATURES it, which is
  // itself gated on their explicit share consent. The public `media` bucket
  // would make every render readable by URL to anyone who guessed one, which
  // would hand the consent decision to whoever found the link first.
  //
  // This rule is defence-in-depth exactly as `payment-proof/` above is: MB8's
  // writer names the bucket explicitly, so what this line really does is make
  // the PREFIX alone sufficient — a later prefix-routing writer cannot land a
  // couple's render in the public bucket by omission. That omission is how the
  // payment proofs got there.
  if (normalized.startsWith('renders/')) return 'threadFiles';
  // MB9's WATERMARKED gallery copy of a render. PRIVATE for the same reason
  // `renders/` is, and this rule is NOT redundant with it: `render-gallery/`
  // does not start with `renders/`, so without this line it would fall through
  // to the public `media` default and put every render — consented or not —
  // behind a plain URL at the moment it was created. Consent gates
  // publication; a routing default must not pre-empt it.
  if (normalized.startsWith('render-gallery/')) return 'threadFiles';
  return 'media';
}
