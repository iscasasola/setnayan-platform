import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { CONNECTION_REQUEST_RETENTION_DAYS } from '@/lib/connection-request-expiry-core';

/**
 * connection-request-expiry.ts — the job that keeps a printed promise.
 *
 * `/privacy` tells the public: *"Requests do not linger. A request nobody
 * answers, and a connection that is declined, are both deleted after 30 days."*
 * Until this shipped, nothing deleted them — the sentence was live and unbacked.
 * Under RA 10173 we are bound by the retention period we DECLARE, so the copy
 * was not merely optimistic; it was the obligation.
 *
 * ⚠ THE NUMBER LIVES HERE AND THE COPY IS DERIVED FROM IT, never the reverse.
 * Two hand-typed numbers agreeing today is how `llms.txt` drifted for three
 * weeks with green CI.
 *
 * Cron-free, like every other periodic job in this codebase: one visitor's
 * request per day does the work, claim-gated in `daily-email-jobs.ts`. The
 * deletion itself is one SECURITY DEFINER function so it can be exercised
 * against real rows in the PGlite replay rather than mocked.
 */

export { CONNECTION_REQUEST_RETENTION_DAYS };

export async function runConnectionRequestExpiry(): Promise<{ deleted: number | null }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('expire_stale_connection_requests', {
      p_days: CONNECTION_REQUEST_RETENTION_DAYS,
    });
    if (error) {
      // A failed sweep is a broken promise, not a blank one — say so loudly in
      // the logs rather than returning a confident zero.
      console.error('[connection-expiry] sweep failed:', error.message);
      return { deleted: null };
    }
    return { deleted: typeof data === 'number' ? data : 0 };
  } catch (e) {
    console.error('[connection-expiry] sweep threw:', e);
    return { deleted: null };
  }
}
