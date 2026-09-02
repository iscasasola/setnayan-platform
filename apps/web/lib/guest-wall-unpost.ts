/**
 * lib/guest-wall-unpost.ts — A GUEST TAKES HER OWN PHOTOGRAPH OFF THE WALL.
 *
 * Owner ruling 2026-09-02 (DECISION_LOG), settling item 6: a guest controls
 * **the photos she SHOT and the photos she is TAGGED in — both** — and nobody
 * else's. On the wall, when her photo is posted she can un-post it. She does
 * NOT get per-audience consent switches, and she does NOT get to remove other
 * people's photos.
 *
 * ── WHAT ALREADY SHIPPED, AND WHY THIS IS SMALL ────────────────────────────
 * The kill switch is old. `wall_hidden_at` is documented in 20261104000959 as
 * the *"transient wall-only kill switch (reversible)"*, distinct from
 * `hidden_at` (*"durable gallery/recap suppression"*), and `wall_visible_photos`
 * already refuses to project a row carrying one. What was missing was a
 * WRITER for the person in the photograph: the only writers were admin
 * moderation and the couple's console (`wall_retract` / `wall_unhide`, gated on
 * `event_members`). This module is that writer, and nothing else.
 *
 * ⚖ IT IS THE WALL, AND ONLY THE WALL. `hidden_at` is never touched here. The
 * photograph stays in the couple's album and in the guest's own gallery; what
 * she is pressing is *"stop projecting this on the screen in this room"*, which
 * is what the wall is and what she was actually asking for. Deleting somebody
 * else's photograph is a different act with a different door
 * (`askToTakeMyPhotoDown` → a person reads it), and it stays that way.
 *
 * ── THE SCOPE, WHICH IS THE ONLY RISKY PART OF THIS FILE ────────────────────
 * Every caller of this module is reachable by ANYBODY WITH A LINK — an event
 * page is public and a guest has no account. The identity is the signed
 * guest-session cookie, resolved by the caller; the `guestId` here is never a
 * form field. That gate says WHO she is. This module answers the second
 * question, which is the one a scoping mistake would get wrong: WHICH
 * photographs are hers to pull.
 *
 * She controls exactly two sets, and the union of them is the whole rule:
 *
 *   SHOT   · `papic_guest_captures.guest_id` is her (her phone, the guest
 *            camera), OR `papic_photos.paparazzi_seat_id` points at a
 *            `paparazzi_seats` row whose `guest_id` is her (her Limited roll
 *            camera — her personal QR IS that camera's credential, so photos
 *            taken on it are as much hers as a phone capture).
 *   TAGGED · a LIVE `photo_tags` row (`removed_at IS NULL`) says she is in it.
 *            A tombstoned tag is not a tag: a guest who pressed "Not me" has
 *            said the photograph is not of her, and it must stop being hers to
 *            control in the same breath.
 *
 * 🔒 EVERY PREDICATE IS RE-CHECKED IN TYPESCRIPT after the query returns it.
 * The `.eq()` filters stay — they keep the read narrow — but the DECISION is
 * made on the returned row's own `event_id` / `guest_id` / `removed_at`. A
 * filter that silently stops being applied (a typo'd column name is a PostgREST
 * ERROR, but a dropped `.eq()` chain link is not) would otherwise widen the
 * scope with nothing going red. This shape is also what makes the refusals
 * testable against a stub client, which a pure-`.eq()` version is not.
 *
 * 🚪 A REFUSED READ REFUSES THE ACTION. PostgREST answers a missing grant or a
 * phantom column with `{ data: null, error }` and never throws, so an
 * unreadable row would otherwise look exactly like "not hers" — or, worse in
 * the other direction, like "hers". It resolves to `unreadable`, the caller
 * says so out loud, and she can press again. Fail-closed, and NAMED as closed
 * rather than dressed up as a "no".
 *
 * ⚠ TWO GUESTS IN ONE PHOTO CAN EACH PULL IT, and the owner accepted that
 * explicitly: being able to remove a picture of yourself outranks the other
 * guest's wish to keep it. It is reversible and wall-only, which is why that
 * trade is affordable here and was NOT affordable for withdrawn consent
 * (20271159728048 — that one blurs and keeps, precisely so one person cannot
 * delete a group shot of ten).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type WallSourceTable = 'papic_photos' | 'papic_guest_captures';

/** WHY the photograph is hers — recorded so a refusal can be explained. */
export type WallScope = 'shot' | 'tagged';

export type WallControlTarget = {
  eventId: string;
  /** From the signed guest-session cookie. NEVER from a form field. */
  guestId: string;
  sourceTable: WallSourceTable;
  sourceId: string;
};

/**
 * `unreadable` is NOT a polite 'no' — it means we could not tell, and the
 * caller must say so. Collapsing it into `not_yours` would tell a guest her own
 * photograph is not hers.
 */
export type WallControlRefusal = 'not_yours' | 'unreadable' | 'not_your_pull' | 'write_failed';

export type WallControlResult =
  | { ok: true; state: 'off_the_wall' | 'on_the_wall'; scope: WallScope }
  | { ok: false; reason: WallControlRefusal };

/** The wall-relevant state of one capture row, as this module needs it. */
type SourceRow = {
  eventId: string | null;
  /** `papic_guest_captures.guest_id` — the guest whose phone took it. */
  capturedByGuestId: string | null;
  /** `papic_photos.paparazzi_seat_id` — resolved to a guest separately. */
  seatId: string | null;
  wallHiddenAt: string | null;
  wallHiddenByGuestId: string | null;
};

const ID_COLUMN: Record<WallSourceTable, string> = {
  papic_photos: 'photo_id',
  papic_guest_captures: 'capture_id',
};

async function readSourceRow(
  client: SupabaseClient,
  sourceTable: WallSourceTable,
  sourceId: string,
): Promise<SourceRow | 'unreadable' | null> {
  const columns =
    sourceTable === 'papic_guest_captures'
      ? 'event_id, guest_id, wall_hidden_at, wall_hidden_by_guest_id'
      : 'event_id, paparazzi_seat_id, wall_hidden_at, wall_hidden_by_guest_id';
  const { data, error } = await client
    .from(sourceTable)
    .select(columns)
    .eq(ID_COLUMN[sourceTable], sourceId)
    .maybeSingle();
  if (error) return 'unreadable';
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  return {
    eventId: (row.event_id as string | null) ?? null,
    capturedByGuestId: (row.guest_id as string | null) ?? null,
    seatId: (row.paparazzi_seat_id as string | null) ?? null,
    wallHiddenAt: (row.wall_hidden_at as string | null) ?? null,
    wallHiddenByGuestId: (row.wall_hidden_by_guest_id as string | null) ?? null,
  };
}

/**
 * Did this guest SHOOT it? True for her own guest-camera capture, and for a
 * seat photo taken on the Limited roll camera that belongs to her.
 *
 * A REVOKED seat still counts: the couple ending her camera does not un-take
 * the photographs she took with it.
 */
async function guestShotIt(
  client: SupabaseClient,
  row: SourceRow,
  target: WallControlTarget,
): Promise<boolean | 'unreadable'> {
  if (row.capturedByGuestId && row.capturedByGuestId === target.guestId) return true;
  if (!row.seatId) return false;
  const { data, error } = await client
    .from('paparazzi_seats')
    .select('event_id, guest_id')
    .eq('seat_id', row.seatId)
    .maybeSingle();
  if (error) return 'unreadable';
  if (!data) return false;
  const seat = data as unknown as { event_id?: string | null; guest_id?: string | null };
  return seat.guest_id === target.guestId && seat.event_id === target.eventId;
}

/** Is she LIVE-tagged in it? A `removed_at` tombstone is not a tag. */
async function guestIsTaggedIn(
  client: SupabaseClient,
  target: WallControlTarget,
): Promise<boolean | 'unreadable'> {
  const { data, error } = await client
    .from('photo_tags')
    .select('event_id, guest_id, removed_at')
    .eq('event_id', target.eventId)
    .eq('source_table', target.sourceTable)
    .eq('source_id', target.sourceId)
    .eq('guest_id', target.guestId)
    .maybeSingle();
  if (error) return 'unreadable';
  if (!data) return false;
  const tag = data as unknown as {
    event_id?: string | null;
    guest_id?: string | null;
    removed_at?: string | null;
  };
  // Re-checked here, not merely filtered above — see the module header.
  return (
    tag.guest_id === target.guestId &&
    tag.event_id === target.eventId &&
    (tag.removed_at ?? null) === null
  );
}

/**
 * WHICH photographs are hers to pull — the whole scope decision, in one place
 * so one test can hold it.
 */
export async function guestScopeForPhoto(
  client: SupabaseClient,
  target: WallControlTarget,
  preloaded?: SourceRow | 'unreadable' | null,
): Promise<WallScope | 'not_yours' | 'unreadable'> {
  /*
    ⚠ `=== undefined`, NOT `??`. `null` is a REAL answer here — "there is no
    such row" — and `preloaded ?? read()` would silently re-read on it, which
    is both a wasted query and a decision made on a second, possibly different
    read. Only an omitted argument means "go and look".
  */
  const row =
    preloaded === undefined
      ? await readSourceRow(client, target.sourceTable, target.sourceId)
      : preloaded;
  if (row === 'unreadable') return 'unreadable';
  // No row, or a row belonging to a DIFFERENT celebration. The event comes from
  // her cookie; a photograph from someone else's wedding is never hers, however
  // she came by its id.
  if (!row || row.eventId !== target.eventId) return 'not_yours';

  const shot = await guestShotIt(client, row, target);
  if (shot === 'unreadable') return 'unreadable';
  if (shot) return 'shot';

  const tagged = await guestIsTaggedIn(client, target);
  if (tagged === 'unreadable') return 'unreadable';
  return tagged ? 'tagged' : 'not_yours';
}

/**
 * TAKE IT OFF THE WALL.
 *
 * The SOURCE row is stamped first and the `wall_feed` mirror second, and that
 * order is load-bearing: `wall_visible_photos` requires BOTH the feed row's
 * `wall_hidden_at` to be null AND the source row's, so the first write alone
 * already stops the projection. If the mirror write is the one that fails, the
 * photograph is still off the wall — the failure direction is her photo staying
 * down, never going back up.
 *
 * Already off the wall ⇒ success, and NOTHING is written. Re-stamping would
 * overwrite whoever pulled it (possibly the couple, mid-moderation) with her.
 */
export async function takePhotoOffTheWall(
  client: SupabaseClient,
  target: WallControlTarget,
): Promise<WallControlResult> {
  const row = await readSourceRow(client, target.sourceTable, target.sourceId);
  const scope = await guestScopeForPhoto(client, target, row);
  if (scope === 'unreadable') return { ok: false, reason: 'unreadable' };
  if (scope === 'not_yours') return { ok: false, reason: 'not_yours' };
  // Narrowed by the guard above: `scope` proves the row was read.
  const source = row as SourceRow;

  if (source.wallHiddenAt) return { ok: true, state: 'off_the_wall', scope };

  const now = new Date().toISOString();
  const { error } = await client
    .from(target.sourceTable)
    .update({ wall_hidden_at: now, wall_hidden_by_guest_id: target.guestId })
    .eq(ID_COLUMN[target.sourceTable], target.sourceId)
    .eq('event_id', target.eventId);
  if (error) return { ok: false, reason: 'write_failed' };

  // The mirror. Best-effort by design — see the docblock: the projection is
  // already stopped by the write above, so a failure here costs a stale row in
  // the couple's control strip, never a photograph back on the screen.
  await client
    .from('wall_feed')
    .update({ wall_hidden_at: now })
    .eq('event_id', target.eventId)
    .eq('source_table', target.sourceTable)
    .eq('source_id', target.sourceId);

  return { ok: true, state: 'off_the_wall', scope };
}

/**
 * PUT IT BACK — and only ever HER OWN pull.
 *
 * 🔑 `wall_hidden_by_guest_id` is the whole gate. If the couple, a coordinator
 * or an admin took the photograph off the wall, that decision is not hers to
 * reverse and this refuses with `not_your_pull` so the caller can say which of
 * the two happened. A pull with no recorded author (a hide from before this
 * shipped) is somebody else's by default — fail-closed.
 */
export async function putPhotoBackOnTheWall(
  client: SupabaseClient,
  target: WallControlTarget,
): Promise<WallControlResult> {
  const row = await readSourceRow(client, target.sourceTable, target.sourceId);
  const scope = await guestScopeForPhoto(client, target, row);
  if (scope === 'unreadable') return { ok: false, reason: 'unreadable' };
  if (scope === 'not_yours') return { ok: false, reason: 'not_yours' };
  const source = row as SourceRow;

  if (!source.wallHiddenAt) return { ok: true, state: 'on_the_wall', scope };
  if (source.wallHiddenByGuestId !== target.guestId) {
    return { ok: false, reason: 'not_your_pull' };
  }

  const { error } = await client
    .from(target.sourceTable)
    .update({ wall_hidden_at: null, wall_hidden_by_guest_id: null })
    .eq(ID_COLUMN[target.sourceTable], target.sourceId)
    .eq('event_id', target.eventId)
    // Belt and braces: the decision above is the one under test, and this
    // keeps the statement itself unable to clear anybody else's pull.
    .eq('wall_hidden_by_guest_id', target.guestId);
  if (error) return { ok: false, reason: 'write_failed' };

  await client
    .from('wall_feed')
    .update({ wall_hidden_at: null })
    .eq('event_id', target.eventId)
    .eq('source_table', target.sourceTable)
    .eq('source_id', target.sourceId);

  return { ok: true, state: 'on_the_wall', scope };
}

/**
 * WHAT THE TILE SHOULD SAY — the read half, for a guest looking at her own
 * gallery.
 *
 *   'posted'         · it is on the wall right now ⇒ offer the un-post.
 *   'pulled_by_me'   · she took it off ⇒ offer to put it back.
 *   'pulled_by_host' · somebody else took it off ⇒ say so, offer nothing. Her
 *                      pull is hers to reverse; the couple's is not.
 *   'off'            · the wall never had it (no `wall_feed` row). No control —
 *                      a wall button on a photograph that was never projected
 *                      is noise, and on an event with no wall it is every tile.
 *   'unknown'        · THE READ FAILED. The control is still offered, and this
 *                      is deliberate: the un-post is idempotent and safe on a
 *                      photograph that is not projecting (`wall_ingest` refuses
 *                      to post a row already carrying `wall_hidden_at`, so
 *                      pressing it early is a pre-emptive no, not a no-op).
 *                      Hiding a guest's only privacy control because a
 *                      SECONDARY read failed is the failure-renders-as-emptiness
 *                      defect this codebase keeps paying for.
 *
 * Best-effort throughout: nothing here may fail the gallery it decorates.
 */
export type WallTileState = 'posted' | 'pulled_by_me' | 'pulled_by_host' | 'off' | 'unknown';

export function wallTileKey(sourceTable: WallSourceTable, sourceId: string): string {
  return `${sourceTable}:${sourceId}`;
}

export async function readGuestWallStates(
  client: SupabaseClient,
  eventId: string,
  guestId: string,
  tiles: { sourceTable: WallSourceTable; sourceId: string }[],
): Promise<Map<string, WallTileState>> {
  const out = new Map<string, WallTileState>();
  if (tiles.length === 0) return out;
  const allUnknown = () => {
    for (const t of tiles) out.set(wallTileKey(t.sourceTable, t.sourceId), 'unknown');
    return out;
  };

  try {
    // 1. WAS IT EVER POSTED? A `wall_feed` row exists only after the whole
    //    ingest gate cleared, so its existence is the question "is this a wall
    //    photograph at all" — and its absence is why most tiles show nothing.
    const { data: feed, error: feedError } = await client
      .from('wall_feed')
      .select('source_table, source_id')
      .eq('event_id', eventId)
      .in(
        'source_id',
        tiles.map((t) => t.sourceId),
      );
    if (feedError) return allUnknown();

    const onTheWall = new Set(
      ((feed ?? []) as { source_table: string; source_id: string }[]).map((r) =>
        wallTileKey(r.source_table as WallSourceTable, r.source_id),
      ),
    );
    const wallTiles = tiles.filter((t) => onTheWall.has(wallTileKey(t.sourceTable, t.sourceId)));
    for (const t of tiles) {
      out.set(
        wallTileKey(t.sourceTable, t.sourceId),
        onTheWall.has(wallTileKey(t.sourceTable, t.sourceId)) ? 'posted' : 'off',
      );
    }
    if (wallTiles.length === 0) return out;

    // 2. IS IT DOWN, AND WHOSE DOING? The source row is the authority: the
    //    projector requires ITS `wall_hidden_at` to be null too, so this is the
    //    same fact the wall reads, not a second opinion.
    for (const table of ['papic_photos', 'papic_guest_captures'] as WallSourceTable[]) {
      const ids = wallTiles.filter((t) => t.sourceTable === table).map((t) => t.sourceId);
      if (ids.length === 0) continue;
      const { data, error } = await client
        .from(table)
        .select(`${ID_COLUMN[table]}, wall_hidden_at, wall_hidden_by_guest_id`)
        .eq('event_id', eventId)
        .in(ID_COLUMN[table], ids);
      if (error) {
        // We know these are wall photographs; we could not learn whether they
        // are down. 'unknown' keeps the un-post offered, which is the safe
        // direction — the alternative is a guest with no control at all.
        for (const id of ids) out.set(wallTileKey(table, id), 'unknown');
        continue;
      }
      for (const raw of (data ?? []) as unknown as Record<string, unknown>[]) {
        const id = raw[ID_COLUMN[table]] as string;
        const hidden = (raw.wall_hidden_at as string | null) ?? null;
        const by = (raw.wall_hidden_by_guest_id as string | null) ?? null;
        out.set(
          wallTileKey(table, id),
          !hidden ? 'posted' : by === guestId ? 'pulled_by_me' : 'pulled_by_host',
        );
      }
    }
    return out;
  } catch {
    return allUnknown();
  }
}
