import 'server-only';

import { cache } from 'react';
import { logQueryError } from '@/lib/supabase/error-detect';

import { permissionsWithinWindow } from './delegate-access-window';

/**
 * The MINIMUM this module needs from a client: the ability to start a query.
 *
 * ⚠ NOT `SupabaseClient`. `run-of-show-advance.ts` injects a duck-typed client
 * (`{ from, rpc }`) so it can be tested without a real connection, and
 * demanding the full type there would have forced a cast at the call site —
 * which is how a test seam quietly becomes untestable. Asking for only what is
 * used keeps both the real client and the fake one valid.
 */
type QueryableClient = {
  // Shape copied verbatim from `AdvanceClients` in run-of-show-advance.ts,
  // including the bare `any`: this project does not configure
  // `@typescript-eslint/no-explicit-any`, so a disable comment for it is
  // itself a lint ERROR ("Definition for rule … was not found"). Matching the
  // existing declaration is both correct and the thing CI accepts.
  from: (table: string) => any;
};

/**
 * delegate-access-window.server.ts — the one read behind the access window.
 *
 * The RULE is pure and lives in `delegate-access-window.ts`. This is the thin
 * server half: fetch the three date columns the rule needs, and hand every
 * reader the same one-line way to apply it.
 *
 * 🔑 IT EXISTS SO THE RULE CANNOT BE APPLIED FIVE SLIGHTLY DIFFERENT WAYS.
 * Five separate files read `event_moderators.permissions_json`. If each wrote
 * its own date read and its own comparison, they would drift the first time one
 * of them forgot `event_end_date` — and a window that four surfaces honour and
 * one does not is indistinguishable from no window, except that it LOOKS
 * closed. `delegate-access-window.test.ts` asserts all five import this module.
 *
 * `cache()` per request, so the extra read costs one round trip on a page that
 * resolves permissions more than once — not one per reader.
 */
const readEventWindowRow = cache(
  async (
    supabase: QueryableClient,
    eventId: string,
  ): Promise<{
    event_date: string | null;
    event_end_date: string | null;
    event_date_precision: string | null;
  } | null> => {
    const { data, error } = await supabase
      .from('events')
      .select('event_date, event_end_date, event_date_precision')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) {
      logQueryError(
        'delegateAccessWindow.eventDates',
        error,
        { event_id: eventId },
        'graceful_degrade',
      );
      return null;
    }
    return (data as {
      event_date: string | null;
      event_end_date: string | null;
      event_date_precision: string | null;
    } | null) ?? null;
  },
);

/**
 * A delegate's permissions, or null once their window has closed.
 *
 * ⚠ A REFUSED DATE READ LEAVES THE WINDOW OPEN. `readEventWindowRow` returns
 * null on failure, and the rule treats "no date" as NOT expired — so a
 * transient failure cannot lock a coordinator out of a wedding they are running
 * that week. Being one read late to revoke is recoverable; being locked out
 * mid-event is not. This is the opposite of the fail-closed instinct that
 * governs the identity reads, and the asymmetry is the reason.
 */
export async function applyDelegateAccessWindow<T>(
  supabase: QueryableClient,
  eventId: string,
  permissions: T | null | undefined,
  isCouple: boolean,
): Promise<T | null> {
  if (!permissions) return null;
  // The couple never expire; skip the read entirely for them.
  if (isCouple) return permissions;

  const row = await readEventWindowRow(supabase, eventId);
  return permissionsWithinWindow(permissions, {
    isCouple,
    eventDate: row?.event_date ?? null,
    eventEndDate: row?.event_end_date ?? null,
    precision: row?.event_date_precision ?? null,
    now: new Date(),
  });
}
