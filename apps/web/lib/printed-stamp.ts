/**
 * lib/printed-stamp.ts — 🖨 "CHANGED SINCE YOU PRINTED" (owner 2026-09-29,
 * DECISION_LOG "OWNER ANSWERS — TEN OPEN QUESTIONS" (5): YES).
 *
 * WHAT IT REUSES — there was no printed-at stamp anywhere (no column, no log);
 * the one thing that already names "what this paper was drawn from" is
 * `printInputsVersion` (lib/print-set.server.ts), the hash the Maker's print
 * previews carry as `v`. So:
 *
 *   · a PRINT download answers with that hash in `X-Print-Version`;
 *   · the Save button keeps `{ version, at }` for that piece, in THIS browser
 *     (localStorage — a per-couple convenience, never a record);
 *   · the piece's panel compares it to the version the Maker has now and, when
 *     they differ, says "Changed since you printed on 29 Sep".
 *
 * A browser that never saved the piece (or cleared its storage) says nothing —
 * never a false "changed". Pure except the two guarded storage calls.
 */
export const PRINT_VERSION_HEADER = 'x-print-version';

export type PrintedStamp = { version: string; at: string };

export function printedStampKey(eventId: string, piece: string): string {
  return `sn-printed:${eventId}:${piece}`;
}

/** `/api/hub-print/<piece>?event=<id>&…` → its event and piece, or null. */
export function printedTarget(href: string): { eventId: string; piece: string } | null {
  const m = /\/api\/hub-print\/([a-z0-9-]+)\?(?:.*&)?event=([0-9a-f-]{36})/i.exec(href);
  return m ? { piece: m[1]!, eventId: m[2]! } : null;
}

export function changedSincePrinted(stamp: PrintedStamp | null, current: string | null | undefined): boolean {
  return Boolean(stamp && current && stamp.version !== current);
}

/** "29 Sep" — the day the paper was saved, in Manila. */
export function printedDayLabel(at: string): string {
  const d = new Date(at);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' })
    : '';
}

export const PRINTED_CHANGED_EVENT = 'sn-printed-changed';

export function readPrintedStamp(eventId: string, piece: string): PrintedStamp | null {
  try {
    const raw = window.localStorage.getItem(printedStampKey(eventId, piece));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<PrintedStamp>;
    return typeof v.version === 'string' && typeof v.at === 'string' ? { version: v.version, at: v.at } : null;
  } catch {
    return null;
  }
}

export function writePrintedStamp(eventId: string, piece: string, version: string, at = new Date().toISOString()): void {
  try {
    window.localStorage.setItem(printedStampKey(eventId, piece), JSON.stringify({ version, at }));
    window.dispatchEvent(new CustomEvent(PRINTED_CHANGED_EVENT));
  } catch {
    /* storage refused — the notice simply never shows */
  }
}
