/**
 * lib/palette-fill-write.ts — APPLY WRITES A THEME'S COLOURS INTO THE MOOD BOARD,
 * and never over anything the couple made (owner 2026-10-05, DECISION_LOG "THE
 * MOOD BOARD PALETTE IS THE PRIORITY" · *"New theme refills them"*).
 *
 * The plan (`planHubDraftApply`) already refuses a fill onto a board the couple
 * made, from the board it READ. Between that read and this write the couple can
 * paint the board in another tab — so the write is a compare-and-swap on the
 * board as read:
 *
 *   · the new value is that board with its main colours replaced
 *     (`boardWithFill`) — never the column replaced;
 *   · the UPDATE only matches the row while the board is still exactly what was
 *     read: `IS NULL`, or jsonb containment both ways (`@>` and `<@` = equal) —
 *     never a JSON string compared to a JSONB column;
 *   · the rows it changed are counted. Zero rows → the board moved: re-read it.
 *     Now the couple's → nothing to write, and that is success. Still not the
 *     couple's → the write did not land: "Press Apply again".
 *
 * Takes the couple's own session client (the Mood Board page's own writer).
 */
import { logQueryError } from '@/lib/supabase/error-detect';
import { boardIsTheCouples, boardWithFill } from '@/lib/mood-board-palette-set';

/** The slice of a Supabase query builder this write needs — narrow, so a test can stand in for it. */
export type PaletteFillFilter = {
  is(column: 'role_palette', value: null): PaletteFillFilter;
  contains(column: 'role_palette', value: Record<string, unknown>): PaletteFillFilter;
  containedBy(column: 'role_palette', value: Record<string, unknown>): PaletteFillFilter;
  select(columns: 'event_id'): PromiseLike<{ data: unknown[] | null; error: unknown }>;
};
export type PaletteFillClient = {
  from(table: 'events'): {
    update(patch: { role_palette: Record<string, unknown> }): { eq(column: 'event_id', value: string): PaletteFillFilter };
    select(columns: 'role_palette'): {
      eq(column: 'event_id', value: string): { maybeSingle(): PromiseLike<{ data: { role_palette?: unknown } | null; error: unknown }> };
    };
  };
};

export type PaletteFillOutcome =
  /** The fill is on the board. */
  | { ok: true; wrote: true }
  /** The board is the couple's (now or already) — nothing written, by the rule. */
  | { ok: true; wrote: false }
  /** The write did not land and the board is still not the couple's — Apply again. */
  | { ok: false };

export async function writePaletteFill(
  client: PaletteFillClient,
  eventId: string,
  read: unknown,
  seed: { reception: string[] },
): Promise<PaletteFillOutcome> {
  const next = boardWithFill(read, seed);
  if (!next) return { ok: true, wrote: false };

  const row = client.from('events').update({ role_palette: next }).eq('event_id', eventId);
  const asRead =
    read === null || read === undefined
      ? row.is('role_palette', null)
      : row
          .contains('role_palette', read as Record<string, unknown>)
          .containedBy('role_palette', read as Record<string, unknown>);
  const { data, error } = await asRead.select('event_id');
  if (error) logQueryError('writePaletteFill.write', error, { event_id: eventId });
  if (!error && Array.isArray(data) && data.length > 0) return { ok: true, wrote: true };

  // Zero rows (or a refusal): what is on the board now?
  const { data: now, error: nowErr } = await client.from('events').select('role_palette').eq('event_id', eventId).maybeSingle();
  if (nowErr) logQueryError('writePaletteFill.reread', nowErr, { event_id: eventId });
  if (!nowErr && now && boardIsTheCouples(now.role_palette)) return { ok: true, wrote: false };
  return { ok: false };
}
