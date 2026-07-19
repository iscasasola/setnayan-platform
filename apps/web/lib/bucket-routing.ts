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
export function bucketForPrefix(pathPrefix: string): R2BucketKey {
  const normalized = pathPrefix.replace(/^\/+/, '');
  if (normalized.startsWith('merchant-qr/')) return 'media';
  if (normalized.startsWith('vendor-logo/')) return 'media';
  if (normalized.startsWith('profile-photo/')) return 'media';
  // Plural first — this is the prefix both payment-proof writers actually use.
  if (normalized.startsWith('payment-screenshots/')) return 'threadFiles';
  if (normalized.startsWith('payment-screenshot/')) return 'threadFiles';
  return 'media';
}
