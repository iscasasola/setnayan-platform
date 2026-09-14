import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * HIDE A REPORTED PHOTOGRAPH — whichever capture table holds it.
 *
 * ── WHAT WAS TRUE BEFORE THIS FILE (found by the Story's step-8 drive, 2026-09-11) ──
 * A guest who asks, from the story, for a photograph of themselves to come down
 * (`askToTakeMyPhotoDown`) files a `user_reports` row whose `target_id` is the
 * capture's id — from EITHER `papic_photos` (a seat camera: every photograph the
 * Story's pages are built from) or `papic_guest_captures` (the guest camera). The
 * moderator's "Hide" only ever updated `papic_guest_captures`. So for a seat
 * photograph — the only kind the story shows — Hide matched NO row, the report was
 * stamped `actioned` with *"Content hidden by Setnayan moderator."*, and the
 * photograph stayed on the story, the recap, both prints and the share card.
 * No error anywhere: the only symptom was an absence.
 *
 * ── AND THEN IT HAPPENED A SECOND TIME (TD-1, 2026-09-14) ──────────────────
 * 🔴 THE LIST WAS FIXED; THE FACT THAT IT IS A LIST WAS NOT. Two capture tables
 * were written here in September and TWO MORE already existed beside them —
 * `vendor_papic_captures` (a supplier shooting somebody else's wedding on the
 * Papic camera) and `vendor_papic_portfolio_photos` (that supplier's own
 * marketing album). Both carry `hidden_at`, both have real readers that filter
 * on it, and NOTHING had ever written it as a takedown. So the identical
 * absence — hidden nowhere, reported "hidden" — was waiting on the supplier
 * side the whole time this file claimed to be the fix for it.
 *
 * ⚖ THE OWNER SETTLED THE QUESTION THIS RAISES. Asked whether a supplier who
 * photographs a guest keeps that photograph when the guest asks for it to come
 * down, he had earlier said *"that's their own copy, they get to keep it for
 * portfolio"* — and on 2026-09-14 (`DECISION_LOG.md`, "decision (DPO): a guest
 * takedown reaches the supplier's copy") he overrode himself: **"no. we will
 * honour the guest."** The portfolio album is named in the position he
 * overrode, which is exactly why it is on this list and not left for later.
 *
 * 🔒 THE SET IS GUARDED, NOT REMEMBERED. `tests/db/a-takedown-reaches-every-
 * suppliers-copy.db.test.ts` asks the REPLAYED SCHEMA which tables hold a
 * captured file at a celebration with a takedown switch — `event_id` +
 * `r2_object_key` + `hidden_at` — and goes red naming any table missing from
 * `REPORTED_PHOTO_TABLES` below. A fifth capture table added next month turns
 * it red with nobody remembering this paragraph. A guard that merely asserted
 * "these four are hidden correctly" would have passed in September too.
 *
 * 🔑 THE ID DECIDES, NOT THE REPORT'S NOTE. The reporting action writes the table
 * name into `details`, but that is free text a person reads, older reports carry
 * none, and a note is not a key. Capture ids are random UUIDs, so the
 * photograph is found by looking in each table — every look bound to the
 * report's own event, so an id from another celebration matches nothing.
 *
 * ⚖ SEAT PHOTOS FIRST, because they are what the story prints; the order cannot
 * change the answer (an id lives in one table), only which read comes first.
 *
 * Returns WHICH table held it, or `null` when none did — so the caller can say
 * "nothing was hidden" instead of claiming a hide that never happened. Hiding
 * something already hidden keeps its original moment (`hidden_at` is not moved).
 * A rejected query THROWS: an unanswered question must never read as "not found".
 */
export type ReportedPhotoTable =
  | 'papic_photos'
  | 'papic_guest_captures'
  | 'vendor_papic_captures'
  | 'vendor_papic_portfolio_photos';

export type ReportedPhotoLocation = {
  table: ReportedPhotoTable;
  id: 'photo_id' | 'capture_id';
};

/**
 * Every table a reported photograph can live in.
 *
 * ⚠ EXPORTED SO THE GUARD READS THE REAL LIST, not a copy of it. A db test that
 * re-typed these four names would keep agreeing with itself forever.
 */
export const REPORTED_PHOTO_TABLES: ReadonlyArray<ReportedPhotoLocation> = [
  { table: 'papic_photos', id: 'photo_id' },
  { table: 'papic_guest_captures', id: 'capture_id' },
  // The supplier's copies (TD-1). Same shape, same switch, same ruling.
  { table: 'vendor_papic_captures', id: 'capture_id' },
  { table: 'vendor_papic_portfolio_photos', id: 'photo_id' },
];

/**
 * The two tables whose rows belong to a SUPPLIER rather than to the couple —
 * the ones whose owner has to be told that a photograph of theirs came down.
 * Both carry `vendor_profile_id`; the couple-side tables do not.
 */
export const SUPPLIER_OWNED_PHOTO_TABLES: ReadonlySet<ReportedPhotoTable> = new Set([
  'vendor_papic_captures',
  'vendor_papic_portfolio_photos',
]);

export function isSupplierOwned(table: ReportedPhotoTable | null): boolean {
  return table != null && SUPPLIER_OWNED_PHOTO_TABLES.has(table);
}

/**
 * What the supplier is told. PURE, and separated from the send on purpose: the
 * emit lives in a `server-only` module a unit test cannot import, and the half
 * that can be got wrong is the WORDS.
 *
 * ⛔ THE GUEST IS NEVER NAMED. They asked for less of themselves to be visible,
 * not to be introduced to the person holding the photograph — and the supplier
 * has no need for the name in order to act on this. Nothing in here is derived
 * from the reporter.
 */
export function supplierTakedownNotice(table: ReportedPhotoTable): {
  title: string;
  body: string;
} {
  const where =
    table === 'vendor_papic_portfolio_photos'
      ? 'your portfolio album'
      : 'what you shot on the day';
  return {
    title: 'A photo was taken down at a guest’s request',
    body:
      `A guest asked for a photograph they appear in to be taken down, and we have ` +
      `honoured that request. The photo has been removed from ${where}. ` +
      `Nothing else of yours is affected, and you do not need to do anything.`,
  };
}

export async function hideReportedPhoto(
  admin: SupabaseClient,
  eventId: string,
  photoId: string,
  at: string = new Date().toISOString(),
): Promise<ReportedPhotoTable | null> {
  if (!eventId || !photoId) return null;
  for (const { table, id } of REPORTED_PHOTO_TABLES) {
    const found = await admin
      .from(table)
      .select(`${id}, hidden_at`)
      .eq(id, photoId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (found.error) throw new Error(`[hideReportedPhoto] ${table}: ${found.error.message}`);
    if (!found.data) continue;
    if ((found.data as { hidden_at: string | null }).hidden_at == null) {
      const hid = await admin
        .from(table)
        .update({ hidden_at: at })
        .eq(id, photoId)
        .eq('event_id', eventId)
        .is('hidden_at', null);
      if (hid.error) throw new Error(`[hideReportedPhoto] ${table}: ${hid.error.message}`);
    }
    return table;
  }
  return null;
}
