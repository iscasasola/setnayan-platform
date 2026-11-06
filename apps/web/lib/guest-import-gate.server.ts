import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { guestImportRefusal } from '@/lib/event-date-floor';
import { eventDateFloorExempt } from '@/lib/event-date-floor.server';
import { manilaToday } from '@/lib/std-views';

/**
 * 📥 GUEST IMPORT OPENS DECEMBER 19 (DECISION_LOG 2026-11-02 "GUEST IMPORT OPENS DECEMBER 19, LIKE EVENT CREATION" —
 * the event floor's rule, `lib/event-date-floor.ts`, for importing). Asked by the import page (it shows the message in
 * place of the upload) and FIRST by `importGuestsCsv` on both steps (the backstop: a preview reads nothing and an Add
 * writes nothing). The founders' accounts — the viewer is `is_internal`, or the event's host is — are exempt. Who is
 * exempt is asked only before the day, so after it this costs no read; a read that does not answer is "not exempt".
 * Held by `guest-import-opens-dec-19.test.ts`.
 */
export async function guestImportGate(
  eventId: string,
  opts: { today?: string; isExempt?: () => Promise<boolean> } = {},
): Promise<string | null> {
  const today = opts.today ?? manilaToday();
  if (!guestImportRefusal(today, false)) return null;
  const isExempt = opts.isExempt ?? (async () => eventDateFloorExempt(await createClient(), { eventId }));
  const exempt = await isExempt().catch(() => false);
  return guestImportRefusal(today, exempt);
}
