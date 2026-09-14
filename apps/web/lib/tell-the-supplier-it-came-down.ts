import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { emitNotification } from '@/lib/notification-emit';
import {
  isSupplierOwned,
  supplierTakedownNotice,
  type ReportedPhotoTable,
} from '@/lib/hide-a-reported-photo';

/**
 * TELL THE SUPPLIER THAT A PHOTOGRAPH OF THEIRS CAME DOWN.
 *
 * ⚖ A PHOTO VANISHING WITH NO EXPLANATION IS ITS OWN DEFECT. The owner's ruling
 * (2026-09-14) is that a guest's takedown reaches the supplier's copy — so the
 * supplier's "What you've shot" strip and their portfolio album both lose a
 * tile, silently, with no error and no entry anywhere they can read. That is
 * the same shape as the bug this whole lane exists to end: a change that looks
 * exactly like nothing having happened.
 *
 * 🔑 THE NOTIFICATION AND THE EMAIL ALLOWLIST ARE TWO HALVES OF ONE MECHANISM.
 * `guest_takedown_honored` is on `EMAIL_ENABLED_TYPES` in notification-emit.ts;
 * without that line this is a tray badge that reaches nobody who is not already
 * looking at the console, which is indistinguishable from shipping neither.
 * Deliberately NOT in `MARKETING_GATED_EMAIL_TYPES` — that set suppresses
 * unless `users.marketing_opt_in = TRUE` (NOT NULL DEFAULT FALSE), the mistake
 * that silenced all six `lock_request_*` types for every user. Deliberately NOT
 * in `PUSH_ENABLED_TYPES`: this is not a 2am buzz.
 *
 * ⛔ THE GUEST IS NEVER NAMED — see `supplierTakedownNotice`, which is where the
 * words live and where a unit test can read them. Nothing here touches the
 * report, the reporter, or the reason.
 *
 * Fail-soft in every arm: the photograph is ALREADY down by the time this runs,
 * and a failed notice must never look like a failed takedown.
 */
export async function tellTheSupplierItCameDown(
  admin: SupabaseClient,
  table: ReportedPhotoTable | null,
  photoId: string,
  eventId: string,
): Promise<void> {
  if (!isSupplierOwned(table) || !photoId || !eventId) return;
  const hit = table as 'vendor_papic_captures' | 'vendor_papic_portfolio_photos';

  try {
    /*
      ⚠ TWO LITERAL BRANCHES, NOT ONE `.from(variable)`. The column scanner
      (`lib/security/select-column-scan.test.ts`) resolves a select's columns
      only when the table is a literal; a computed one joins a capped list of
      selects NOTHING can check for a missing GRANT, and that ceiling is there
      to shrink. The two tables also disagree on their id column, so the branch
      was going to exist either way — it may as well be the checkable shape.
    */
    const found =
      hit === 'vendor_papic_captures'
        ? await admin
            .from('vendor_papic_captures')
            .select('vendor_profile_id')
            .eq('capture_id', photoId)
            .eq('event_id', eventId)
            .maybeSingle()
        : await admin
            .from('vendor_papic_portfolio_photos')
            .select('vendor_profile_id')
            .eq('photo_id', photoId)
            .eq('event_id', eventId)
            .maybeSingle();
    if (found.error) {
      console.error('[takedown] could not find the supplier to tell:', found.error.message);
      return;
    }
    const vendorProfileId = (found.data as { vendor_profile_id?: string | null } | null)
      ?.vendor_profile_id;
    if (!vendorProfileId) return;

    const { data: profile } = await admin
      .from('vendor_profiles')
      .select('user_id')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const userId = (profile as { user_id?: string | null } | null)?.user_id;
    // An unclaimed shop has no account to reach. Nothing to do, nothing wrong.
    if (!userId) return;

    const notice = supplierTakedownNotice(hit);
    await emitNotification({
      userId,
      type: 'guest_takedown_honored',
      title: notice.title,
      body: notice.body,
      // Both the "What you've shot" strip and the portfolio album render on
      // this one page, so a single link lands the supplier where the tile was.
      relatedUrl: `/vendor-dashboard/on-the-day/live/${eventId}`,
    });
  } catch (e) {
    console.error('[takedown] supplier notice threw:', e);
  }
}
