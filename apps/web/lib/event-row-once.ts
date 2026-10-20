import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorityOf, isServiceRoleClient } from '@/lib/request-once';
import { logQueryError } from '@/lib/supabase/error-detect';

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

/** The held row's key for "the event whose slug matches <slug>" — the question the one reader asked. */
const bySlug = (slug: string) => `slug ilike ${slug}`;

/**
 * Called by the ONE reader (`loadEventShell`) with the row exactly as the
 * database returned it — its own columns and the extras — and the slug it
 * asked by. Nobody else may call this: a row built anywhere else is not what a
 * read would have returned.
 */
export function holdEventRow(eventId: string, row: Row, askedBySlug?: string): void {
  if (!eventId) return;
  rows().set(eventId, row);
  if (askedBySlug) rows().set(bySlug(askedBySlug), row);
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

/** The answer a read of its own would have given: exactly these columns, each a copy. */
function answerFrom<R>(held: Row, wanted: string[]): R {
  const data: Row = {};
  // A copy per reader, as a read of its own would have been — no reader can change another's.
  for (const c of wanted) data[c] = structuredClone(held[c]);
  return { data, error: null, count: null, status: 200, statusText: 'OK' } as R;
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
  // 👤 A signed-in viewer's own client, on the couple's dashboard: the one read
  // AS THAT VIEWER (`openDashboardEventRow`), when this render opened it.
  if (!isServiceRoleClient(client)) {
    const viewerHeld = viewerRows().get(viewerKey(client, eventId));
    const asked = viewerHeld ? plainColumns(columns) : null;
    if (viewerHeld && asked && asked.every((c) => DASHBOARD.has(c))) {
      return viewerHeld.then((h) => (h.ok ? (h.row ? answerFrom<R>(h.row, asked) : noRow<R>()) : read()));
    }
  }
  const held = isServiceRoleClient(client) ? rows().get(eventId) : undefined;
  const wanted = held ? plainColumns(columns) : null;
  if (held && wanted && wanted.every((c) => c in held)) return Promise.resolve(answerFrom<R>(held, wanted));
  return new Promise<R>((resolve, reject) => {
    read().then(resolve, reject);
  });
}

/**
 * The same, for a page that finds its event BY SLUG — the guest's two invite
 * doors (`app/[slug]/invite/enter`, `…/reply`), which each read the event with
 * a column list of their own while the layout, the metadata and the look read
 * it too (`loadEventShell`). The door's read stays where it was, untouched, as
 * `read`:
 *
 *     await loadEventShell(slug).catch(() => null);   // the tree's one read — after it the row is in hand
 *     const { data, error } = await eventRowOnceBySlug(admin, slug, () =>
 *       admin.from('events').select(`…`).ilike('slug', slug).maybeSingle(),
 *     );
 *
 * `read` is BUILT but not sent (a PostgREST query leaves only when it is
 * awaited), and what it would have asked is read off it: a GET of `events`,
 * one row at most, filtered by `slug ilike <this slug>` and nothing else,
 * naming plain columns. When that is exactly the question the one reader asked
 * and every column is in hand, the answer comes from the held row and the
 * query is never sent. ANYTHING else — a different filter, a column not held,
 * a query this cannot read (a library that changed its shape) — and the query
 * is sent as it is: the door's own read, its own failure, as before.
 * (`lib/event-row-once.test.ts` holds it against the installed client.)
 */
export function eventRowOnceBySlug<R>(client: object, slug: string, read: () => PromiseLike<R>): Promise<R> {
  let query: PromiseLike<R>;
  try {
    query = read();
  } catch (error) {
    return Promise.reject(error);
  }
  const held = isServiceRoleClient(client) ? rows().get(bySlug(slug)) : undefined;
  const wanted = held ? plainColumns(askedOfEventsBySlug(query, slug) ?? '') : null;
  if (held && wanted && wanted.every((c) => c in held)) return Promise.resolve(answerFrom<R>(held, wanted));
  return new Promise<R>((resolve, reject) => {
    query.then(resolve, reject);
  });
}

/** The `select` of an un-sent query, when it is exactly "one row of events whose slug matches" — else null. */
function askedOfEventsBySlug(query: unknown, slug: string): string | null {
  try {
    const q = query as { url?: unknown; method?: unknown; isMaybeSingle?: unknown };
    if (!(q.url instanceof URL) || q.method !== 'GET' || q.isMaybeSingle !== true) return null;
    if (!q.url.pathname.endsWith('/rest/v1/events')) return null;
    const keys = [...q.url.searchParams.keys()].sort();
    if (keys.length !== 2 || keys[0] !== 'select' || keys[1] !== 'slug') return null;
    if (q.url.searchParams.get('slug') !== `ilike.${slug}`) return null;
    return q.url.searchParams.get('select');
  } catch {
    return null;
  }
}

/**
 * TEST ONLY — run `fn` as if it were one server render: a held row is in hand
 * for its duration and gone after. (Plain node resolves `react` to the build
 * whose `cache()` never memoizes, so a test has no render of its own.)
 */
export async function withEventRowScopeForTest<T>(fn: () => Promise<T>): Promise<T> {
  const before = testRows;
  const beforeViewer = testViewerRows;
  testRows = new Map();
  testViewerRows = new Map();
  try {
    return await fn();
  } finally {
    testRows = before;
    testViewerRows = beforeViewer;
  }
}

// ── 👤 THE COUPLE'S DASHBOARD: THE EVENT'S ROW, ONCE, AS THE VIEWER ─────────
/*
  WHY (measured 2026-10-20, owner: "why is it still loading slow even if we
  already went pro on supabase?"). One render of a couple's Guests tab read the
  SAME `events` row NINE times — the layout's chrome, the menu's needs, the
  page's palette and date, the share link's visibility, the invite's words, the
  role words, the access window — each its own request, as the signed-in
  couple, a few columns at a time. Production's log: `events` 18k reads a day,
  split into `select=event_date` 1,807 · `event_type` 1,691 · … .

  WHAT THIS DOES. The dashboard OPENS the row for its viewer once per render
  (`openDashboardEventRow`, called first thing by the event layout and by the
  pages whose reads it carries): ONE request, as the viewer's own client, for
  every column in `DASHBOARD_ROW_CARRIES`. Every `eventRowOnce` asker using
  that same client, for that event, naming only those columns, is answered
  from it; its own read is not sent.

  🔒 THE SAME THREE RULES AS THE GUEST TREE'S ROW, plus one:
    · NEVER ACROSS AUTHORITIES. Keyed by the asking client's authority
      (`authorityOf` — one session client object = one viewer). The service
      role is never answered from it, and a viewer is never answered from the
      service role's row. RLS is not bypassed: the viewer's own client read it,
      under the viewer's own policies and column grants — exactly the read each
      asker would have sent, with more columns.
    · NEVER ACROSS RENDERS. The Map is React's per-render `cache()`; outside a
      render (an action, a route, a job) nothing is opened and every asker
      reads for itself — a gate there still reads fresh.
    · EVERY ASKER KEEPS ITS OWN FAILURE. If the one read fails for ANY reason —
      refused, a column production does not know yet, the network — nothing
      is answered from it: every asker sends its own read, exactly as before,
      and degrades or throws on its own terms. A failure is never handed out
      as a row, and never as "no row".
    · "NO ROW" IS AN ANSWER ONLY WHEN THE READ SUCCEEDED. Then each asker gets
      `{ data: null, error: null }` — what its own maybeSingle read would have
      returned under the same client.

  Held by `lib/event-row-once.test.ts` (8–10) and counted by the lab note in
  `app/dashboard/[eventId]/guests/the-guests-page-asks-once.test.ts`.
*/

/**
 * The columns the dashboard's one read carries. Every one is a plain column of
 * `public.events` in production AND granted SELECT to `authenticated` — each is
 * read today by a signed-in couple's own client somewhere on the dashboard.
 * ⛔ NEVER a host-only private column (`estimated_budget_centavos`,
 * `wizard_state`, …, the `private_columns` list in migration 20271025120000):
 * it is not granted on `events`, so the one read would be refused on every
 * view — every asker would fall back, a request ADDED, not saved.
 * `lib/event-row-once.test.ts` fails on either.
 *
 * 🔑 NOT A CANONICAL SELECT, and named so (not `*_COLUMNS`). It is the UNION of
 * what many dashboard readers each want — no reader is meant to ask for all of
 * it, and a reader that names fewer (the account switcher's own list of events,
 * a three-column access window) is not "dropping" any of it. `lint:dup-rule`'s
 * omitted-column guard is for lists every caller should reproduce whole.
 */
export const DASHBOARD_ROW_CARRIES = [
  // The event layout's own row (the rail, the menu, the monogram, the phase).
  'event_id',
  'public_id',
  'display_name',
  'event_date',
  'archived',
  'event_type',
  'slug',
  'monogram_text',
  'monogram_color',
  'monogram_frame_key',
  'monogram_font_key',
  'monogram_style',
  'monogram_custom_svg',
  'monogram_uploaded_svg',
  'cleared_at',
  'timezone',
  'event_end_date',
  'community_id',
  'date_candidates',
  // What this event needs (the menu's Level 1).
  'guest_list_on',
  'suppliers_on',
  'hub_details_on',
  // The access window (`fetchEventViewer`) and the invite's words.
  'event_date_precision',
  'print_details',
  // The couple's role words.
  'role_names',
  // The Guests tab, and a guest's open card.
  'role_palette',
  'estimated_pax',
  'ceremony_type',
  'secondary_ceremony_type',
  'dress_code_config',
  // The share link's door.
  'landing_page_visibility',
  'scheduled_launch_at',
  'std_launched_at',
  // Home's own row (the day-of takeover, the cultural and set-date overlays, the Papic glance).
  'venue_latitude',
  'venue_longitude',
  'region',
  'mahr_description',
  'gender_separation',
  'created_at',
  'setnayan_ai_active',
  'setnayan_ai_active_until',
  'planning_mode',
  'papic_on',
  'papic_window_start',
  'papic_window_end',
  // The head count the Suppliers and Budget tabs plan for (`readFinalizeState`, lib/pax.ts).
  'headcount_basis',
  'guest_count_locked_at',
  'final_pax',
] as const;

const DASHBOARD = new Set<string>(DASHBOARD_ROW_CARRIES);

type ViewerHeld = { ok: true; row: Row | null } | { ok: false };

/** One Map per server render. A fresh one on every call outside a render. */
const renderViewerRows = cache((): Map<string, Promise<ViewerHeld>> => new Map());
let testViewerRows: Map<string, Promise<ViewerHeld>> | null = null;

function viewerRows(): Map<string, Promise<ViewerHeld>> {
  return testViewerRows ?? renderViewerRows();
}

const viewerKey = (client: object, eventId: string) => `${authorityOf(client)} ${eventId}`;

/** What a one-row read that found no row returns (postgrest-js maybeSingle). */
function noRow<R>(): R {
  return { data: null, error: null, count: null, status: 200, statusText: 'OK' } as R;
}

/**
 * Start the dashboard's one read of this event AS THIS VIEWER, for the rest of
 * this render. Idempotent per (viewer, event, render); a no-op for the service
 * role and outside a render (nothing would be kept, so nothing is sent).
 * Call it BEFORE the first `eventRowOnce` asker — an asker that came first sent
 * its own read, as before.
 */
export function openDashboardEventRow(client: SupabaseClient, eventId: string): void {
  if (!eventId || isServiceRoleClient(client)) return;
  const map = viewerRows();
  if (!testViewerRows && map !== renderViewerRows()) return; // not inside a render
  const key = viewerKey(client, eventId);
  if (map.has(key)) return;
  map.set(
    key,
    Promise.resolve(
      client.from('events').select(DASHBOARD_ROW_CARRIES.join(', ')).eq('event_id', eventId).maybeSingle(),
    ).then(
      (res): ViewerHeld => {
        if (res.error) {
          // Every asker now reads for itself (and logs its own failure). This line is what tells a
          // refused ONE read — which costs a request on every view — from a calm one.
          logQueryError('openDashboardEventRow', res.error, { event_id: eventId }, 'graceful_degrade');
          return { ok: false };
        }
        return { ok: true, row: (res.data as Row | null) ?? null };
      },
      (): ViewerHeld => ({ ok: false }),
    ),
  );
}
