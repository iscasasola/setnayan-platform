/**
 * lib/print-details-write.ts — EVERY WRITE OF `events.print_details`, ONE AT A TIME (owner 2026-10-18, two hosts never
 * overwrite — round 2).
 *
 * `print_details` is one JSON value with seven owners: the words form (opening line · reply line · switches), the Menu,
 * the Our Story poster's photo, the name style, the guest list's invite message, and Apply (name style · pass look ·
 * opening line). Each read the value, changed its own keys and wrote the WHOLE value back — so two of them at once
 * (two hosts, or one host's menu autosave beside the poster photo, which holds its read for seconds while it measures
 * the picture) silently put the other's keys back to what they were. Now each one's change is applied to the value AS
 * IT IS when the write lands (`updateJsonColumn`, lib/update-json-column.ts): built again if another write landed
 * between. Callers pass a CHANGE, never a value they read earlier.
 *
 * Server-only by use (it is handed the admin client); no `server-only` import, so the route and the actions share it.
 */
import { parsePrintDetails, serializePrintDetails, type StoredPrintDetails } from './print-pieces';
import { updateJsonColumn, type JsonColumnClient } from './update-json-column';

export async function updatePrintDetails(
  admin: unknown,
  eventId: string,
  change: (stored: StoredPrintDetails) => StoredPrintDetails,
): Promise<{ ok: true; details: StoredPrintDetails } | { ok: false; error: string }> {
  try {
    let details: StoredPrintDetails | null = null;
    const r = await updateJsonColumn(
      admin as JsonColumnClient,
      { table: 'events', row: { event_id: eventId }, column: 'print_details', what: 'Your print details' },
      (current) => {
        details = change(parsePrintDetails(current));
        return { next: serializePrintDetails(details) };
      },
    );
    if (!r.written || !details) return { ok: false, error: 'Your print details could not be saved.' };
    return { ok: true, details };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
