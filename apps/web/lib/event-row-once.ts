import { cache } from 'react';
import { isServiceRoleClient } from '@/lib/request-once';

/**
 * apps/web/lib/event-row-once.ts — THE EVENT'S ROW IS READ ONCE PER RENDER.
 *
 * ── WHY (measured on production, 2026-10-11) ───────────────────────────────
 * One view of a guest page read the SAME `events` row eleven times: once for
 * the page, and then once more for every fact somebody wanted from it — is the
 * camera on, the couple's words for the roles, the name style, the watch
 * link, the reply card's backdrop, the event's date (again), the face-tagging
 * mode. Each was its own request to the database, for one row the page was
 * already holding. Owner, verbatim: "the key was to lessen the requests".
 *
 * ── WHAT THIS DOES ─────────────────────────────────────────────────────────
 * The guest tree's ONE reader of the event (`loadEventShell`,
 * `app/[slug]/_lib/loaders.ts`) asks for its own columns AND the handful
 * below in the same request, and leaves the row here for the rest of that
 * render (`holdEventRow`). A reader that used to ask the database for a few
 * columns of that row now asks here first (`eventRowOnce`) and sends its own
 * request only when the row is not in hand.
 *
 * ── 🔑 EVERY READER KEEPS ITS OWN FAILURE ──────────────────────────────────
 * A reader's original read stays where it was, as the `read` it hands in. It
 * is what runs whenever the row is not in hand — outside the guest tree, in an
 * action, for another event, for a column this file does not carry — so a
 * reader that degraded on a refused read still degrades, and one that threw
 * still throws. When the row IS in hand the reader receives exactly what its
 * own read would have returned: `{ data: { …the columns it named }, error: null }`,
 * the values as the database stored them (never the page's own adjustments —
 * the shell's `withPickedDate` is applied to the page's copy, not to this one).
 *
 * And the one read cannot take the page down for a column: if the database
 * does not know one of the extra columns (a deploy ahead of its migration —
 * the case every one of those separate reads was written for), the shell reads
 * its own columns alone, exactly as it always did, nothing is held, and every
 * reader asks for itself as before.
 *
 * ── 🔒 NEVER ACROSS AUTHORITIES, NEVER ACROSS RENDERS ──────────────────────
 *   · The row is read by the service role. Only a service-role client is ever
 *     answered from it (`isServiceRoleClient`); a signed-in viewer's client
 *     always sends its own read, under its own RLS.
 *   · The row lives in a Map React hands out once per server render
 *     (`cache(() => new Map())`) — the same scope as `lib/request-once.ts`,
 *     for the same reasons. Outside a render (an action, a route handler, a
 *     job) every call gets a new, empty Map: nothing is held and every reader
 *     reads. Nothing here outlives the render that read it, so a couple who
 *     presses ✓ is shown the new row by the very next render.
 *   · ⛔ NEVER a module-level Map — that would be one couple's row served to
 *     the next request on the instance.
 *
 * Held by `lib/event-row-once.test.ts` and counted, per viewer, by
 * `lib/guest-page-reads.test.ts` (`events` reads per view = 1).
 */

/**
 * What the one read brings along BESIDES the shell's own columns. Each is a
 * plain column of `public.events` that exists in production
 * (`supabase/security/prod-schema.snapshot.txt` — `lib/event-row-once.test.ts`
 * fails if one is not there: an unknown column would send every view down the
 * "read the shell alone" path and cost a request instead of saving ten).
 *
 * ⚠ NOT HERE, ON PURPOSE: `live_studio_roam_manifest` /
 * `live_studio_guest_pick_enabled`. Their reader (`fetchRoamViewerState`,
 * `lib/live-studio-roam.ts`) lives in a module the BROWSER also imports, so it
 * cannot import this server-side one; it is asked only while the Roam flag is
 * on (off in production). With the flag on, a view reads the row twice.
 *
 * ⚠ These never reach the page's own event row: `loadEventShell` returns the
 * shell's columns only, as before, so nothing here is handed to a component.
 */
export const EVENT_ROW_ONCE_EXTRA_COLUMNS = [
  // The host's switches and words.
  'papic_on',
  'entourage_section_order',
  'role_names',
  'print_details',
  'rsvp_backdrop',
  // Watch live.
  'panood_watch_url',
  'panood_watch_url_facebook',
  // The guest camera, its window, the shared gallery and face tagging.
  'pool_gallery_open',
  'papic_style',
  'papic_face_mode',
  'face_tagging_declined_by_couple',
  'papic_guest_capture_early',
  'papic_window_start',
  'papic_window_end',
  // The live photo wall.
  'live_photo_wall_visibility',
  'live_mode_override',
  'archived',
  // Last year's edition.
  'previous_event_id',
] as const;

const EXTRA = new Set<string>(EVENT_ROW_ONCE_EXTRA_COLUMNS);

type Row = Record<string, unknown>;

/** One Map per server render. A fresh one on every call outside a render. */
const renderRows = cache((): Map<string, Row> => new Map());

/** Set only by `withEventRowScopeForTest` — a test's stand-in for one render. */
let testRows: Map<string, Row> | null = null;

function rows(): Map<string, Row> {
  return testRows ?? renderRows();
}

/**
 * Called by the ONE reader (`loadEventShell`) with the row exactly as the
 * database returned it — its own columns and the extras. Nobody else may call
 * this: a row built anywhere else is not what a read would have returned.
 */
export function holdEventRow(eventId: string, row: Row): void {
  if (eventId) rows().set(eventId, row);
}

/** The page's own copy of a row the one read returned: the shell's columns, without the extras. */
export function withoutOnceExtras<T extends Row>(row: T): T {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) if (!EXTRA.has(key)) out[key] = value;
  return out as T;
}

/** Plain column names only — an alias, a cast, an embed or `*` is always read from the database. */
function plainColumns(select: string): string[] | null {
  const columns = select.split(',').map((c) => c.trim());
  return columns.length > 0 && columns.every((c) => /^[a-z_][a-z0-9_]*$/.test(c)) ? columns : null;
}

/**
 * A few columns of one event's row — from the row this render already holds,
 * else from `read`, the reader's own request, unchanged.
 *
 *     const { data, error } = await eventRowOnce(admin, eventId, 'role_names', () =>
 *       admin.from('events').select('role_names').eq('event_id', eventId).maybeSingle(),
 *     );
 *
 * `columns` MUST be the same list `read` selects (held for every call site by
 * `lib/event-row-once.test.ts`), and `read` MUST be the single-row read of
 * that event by `event_id` — that is the question the held row answers.
 */
export function eventRowOnce<R>(
  client: object,
  eventId: string,
  columns: string,
  read: () => PromiseLike<R>,
): Promise<R> {
  const held = isServiceRoleClient(client) ? rows().get(eventId) : undefined;
  const wanted = held ? plainColumns(columns) : null;
  if (held && wanted && wanted.every((c) => c in held)) {
    const data: Row = {};
    // A copy per reader, as a read of its own would have been — no reader can change another's.
    for (const c of wanted) data[c] = structuredClone(held[c]);
    return Promise.resolve({ data, error: null, count: null, status: 200, statusText: 'OK' } as R);
  }
  return new Promise<R>((resolve, reject) => {
    read().then(resolve, reject);
  });
}

/**
 * TEST ONLY — run `fn` as if it were one server render: a held row is in hand
 * for its duration and gone after. (Plain node resolves `react` to the build
 * whose `cache()` never memoizes, so a test has no render of its own.)
 */
export async function withEventRowScopeForTest<T>(fn: () => Promise<T>): Promise<T> {
  const before = testRows;
  testRows = new Map();
  try {
    return await fn();
  } finally {
    testRows = before;
  }
}
