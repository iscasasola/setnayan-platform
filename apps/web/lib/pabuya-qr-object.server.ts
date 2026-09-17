import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { pabuyaQrScope } from '@/lib/cleanup-delete-scope';

/**
 * lib/pabuya-qr-object.server.ts — a gift QR object does not outlive its row.
 *
 * ── WHAT WAS TRUE ──────────────────────────────────────────────────────────
 * Nothing in the tree ever deleted a Pabuya QR. `deleteEgiftMethod` removed the
 * row; the edit path overwrote `qr_r2_key` and abandoned the displaced object;
 * the event media sweep never named the column. Every QR ever uploaded — every
 * retired account, every replaced image, every deleted celebration — was still
 * an object, and (until the bucket move) an anonymously readable one.
 *
 * 🔑 THE PRIVACY PAGE ALREADY PROMISED OTHERWISE, in writing: "Gift-receiving
 * details (Pabuya) … You can edit or remove these details at any time, and they
 * are deleted with your event." This module is what makes that sentence true.
 *
 * ── THE ORDER IS THE WHOLE THING ───────────────────────────────────────────
 * Callers must delete the object ONLY AFTER the row write is confirmed to have
 * affected a row, and only for a key that is genuinely displaced:
 *
 *   1. capture the PREVIOUS key before writing;
 *   2. write, and COUNT the affected rows (a zero-row write is success-shaped);
 *   3. delete the previous object only if the write moved a row AND the key
 *      actually changed.
 *
 * Deleting first would destroy a live QR whenever the write then failed or
 * matched nothing. Deleting an unchanged key would destroy the object the row
 * still points at — the couple's page would go blank on a no-op save.
 */

/**
 * Delete one displaced gift-QR object. Returns whether the object was removed.
 *
 * ⚠ THROUGH THE HOUSE CHOKE POINT, NOT `r2Delete`. A first cut called the raw
 * primitive after its own check and `every-cleanup-delete-is-pinned.test.ts`
 * refused it, correctly: this key is read from a column a non-admin can write,
 * so it must be PLANNED with a `CleanupScope` and EXECUTED by
 * `cleanupDelete`. That is what makes "delete only this celebration's own
 * pabuya object" a rule the repo enforces in one place rather than a check I
 * wrote here and somebody else forgets to write next time.
 *
 * Without it, a host could park another bucket's key in their own row and have
 * the platform delete somebody else's object — a cleanup turned into a
 * destruction primitive. `pabuyaQrScope` refuses anything outside
 * `events/<id>/pabuya/`, in either bucket while the migration is in flight.
 *
 * ⚠ FAIL-SOFT, ALWAYS. The row write has already happened and the couple has
 * already been told it worked; throwing here would paint a red error over a
 * successful save. A missed object is a leak we can sweep later — a false
 * failure is somebody re-entering their bank details. Reported so "later" is
 * findable.
 */
export async function deleteDisplacedPabuyaQr(args: {
  previousKey: string | null | undefined;
  nextKey: string | null | undefined;
  eventId: string;
}): Promise<boolean> {
  const { previousKey, nextKey, eventId } = args;
  if (!previousKey) return false;
  // Never delete the key the row now points at.
  if (nextKey && nextKey === previousKey) return false;

  try {
    const outcome = await cleanupDelete(previousKey, pabuyaQrScope(eventId));
    if (outcome === 'refused') {
      // Not this celebration's own object. Refusing is correct — say so, because
      // it means the row held a key we would never have served either.
      Sentry.captureMessage('pabuya: refused to delete a non-conforming qr_r2_key', {
        level: 'warning',
        extra: { event_id: eventId },
      });
      return false;
    }
    return true;
  } catch (err) {
    Sentry.captureException(err, {
      extra: { call_site: 'deleteDisplacedPabuyaQr', event_id: eventId },
    });
    return false;
  }
}
