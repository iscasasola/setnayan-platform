import 'server-only';

/**
 * The two annual anniversary emails, behind the `server-only` guard the other
 * email modules wear. Every line of copy lives in `anniversary-emails-core.ts`,
 * which carries no `server-only` and is therefore unit-testable — the same
 * split, for the same reason, as `papic-fullres-drop-core.ts`.
 *
 * 🔒 Both builders return `null` for the solemn register (a wake), and the job
 * treats `null` as "do not send". The selector refuses solemn types first
 * (migration 20271174085072); this is the second gate. See the core module's
 * header for why the fence is in two places.
 */
export {
  ANNIVERSARY_SUPPORT_EMAIL,
  buildAnniversaryEmail,
  buildAnniversaryHeadsupEmail,
  anniversaryUnsubscribeHeaders,
} from '@/lib/anniversary-emails-core';

export type {
  AnniversaryEmail,
  AnniversaryEmailParts,
  AnniversaryWords,
} from '@/lib/anniversary-emails-core';
