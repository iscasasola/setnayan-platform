/**
 * lib/ugat/fields.ts — the FIELDS layer of the Root map (slice 2), its shape and
 * its pure helpers.
 *
 * Owner, 2026-10-02 (DECISION_LOG "ONE MAP OF THE APP", "EVERY ANSWER ABOUT AN
 * EVENT LIVES IN EVENT DETAILS — ONE HOME, MAPPED", "THE ROOT MAP ALSO CATCHES
 * 'PRESSED BUT WENT TO THE WRONG PLACE' AND 'FILLED IN BUT NOT SAVED'", "…A
 * NUMBER THAT LOOKS LIVE BUT IS TYPED IN"): every screen's facts — what it
 * READS and what it WRITES — named as the one `table.column` that holds each,
 * and every number it computes named as a calculation over those columns.
 *
 * 🔑 EXTEND, NEVER A FOURTH MAP. The fields attach to the screen ids of the
 * Screens layer (`screens.generated.json`, part 1) — `id` here is the same
 * route pattern. Nothing in this file touches the filesystem; the scanner that
 * fills it is `scan-fields.ts` and the committed result is
 * `fields.generated.json`.
 *
 * ── WHAT A "HOME" IS ────────────────────────────────────────────────────────
 * The place a fact is stored, written the way the code writes it:
 *   `events.event_date`                    a column
 *   `events.style_preferences.setup.papic` a key inside a jsonb column
 *   `rpc:save_answers.p_date`              a parameter handed to a database function
 *   `store:localStorage.<key>`             a browser store
 */

/** One server action (or any function that takes a FormData) and what it saves. */
export interface ActionFacts {
  /** `app/…/actions.ts#createGuest` — file relative to apps/web, then the export. */
  ref: string;
  /** Every form field name it reads (`formData.get('x')`). A template key reads as `invited_*`. */
  fields: string[];
  /** True when it reads the whole FormData (`Object.fromEntries(formData)` …) — no field can be judged dropped. */
  readsAll: boolean;
  /** Every home it writes, sorted. */
  writes: string[];
  /** field → the homes its value reaches. A field missing here reached no write. */
  saves: Record<string, string[]>;
  /** Fields read whose value reaches no write, no key filter, no call and no return — "filled but dropped". */
  dropped: string[];
}

/** A `<form>` found in a component and the action it posts to. */
export interface FormFacts {
  /** The component file the `<form>` is written in. */
  from: string;
  /** The action refs it resolves to (more than one when a prop is passed by several callers). */
  actions: string[];
  /** Static `name=` inputs inside the form, sorted. */
  inputs: string[];
  /** Inputs that no resolved action reads — "filled but dropped" on the form side. */
  notRead: string[];
}

export interface ScreenFacts {
  /** The Screens-layer id (route pattern) this attaches to. */
  id: string;
  /** `table.column` (or `table.*`) read by the screen and what it imports. */
  reads: string[];
  /** Homes written by the actions this screen can call. */
  writes: string[];
  /** Action refs reachable from the screen. */
  actions: string[];
  /** Calculation ids (see `CALCULATIONS`) this screen computes. */
  calcs: string[];
}

export interface UgatFieldsMap {
  version: 1;
  screens: ScreenFacts[];
  actions: ActionFacts[];
  forms: FormFacts[];
  /** Every write site in the app (actions, route handlers, lib) — `file → homes`. */
  writers: Array<{ from: string; homes: string[] }>;
  /** Browser-store writes: `localStorage.setItem('k')`. */
  stores: Array<{ from: string; key: string }>;
}

/* ═══════════════════════════ calculations ═══════════════════════════ */

/**
 * A number a screen SHOWS that is not a column but a calculation over columns.
 * Each is named once here, with the inputs it is computed from and the code
 * that computes it. `anchors` are function names; the scanner records a
 * calculation on every screen whose code calls one, and
 * `calculations-are-real.test.ts` fails if an anchor stops existing — so this
 * list cannot quietly describe code that is gone.
 *
 * `renders` are the words a screen draws next to the number. The duplicate
 * check (one fact shown twice on one screen — the Home case, DECISION_LOG
 * "REPLACE MEANS REMOVE, CHECKED") counts the distinct files on a screen that
 * draw them.
 */
export interface Calculation {
  id: string;
  /** What a person reads it as. */
  name: string;
  /** The calculation, in words, over fields. */
  formula: string;
  inputs: string[];
  anchors: string[];
  renders: RegExp[];
}

export const CALCULATIONS: readonly Calculation[] = [
  {
    id: 'days-to-go',
    name: 'Days to go',
    formula: 'events.event_date − today (both midnights in the event’s timezone)',
    inputs: ['events.event_date', 'events.event_date_precision', 'events.timezone', 'today'],
    anchors: ['daysUntil', 'daysUntilEvent', 'glanceDays'],
    renders: [/\bdays? to go\b/i],
  },
  {
    id: 'guests-coming',
    name: 'Guests coming',
    formula: 'count(guests where rsvp_status = attending) for the event',
    inputs: ['guests.rsvp_status', 'guests.event_id'],
    anchors: ['computeGuestStats'],
    // `#` marks a run-time value (see scan-shown-values): "# attending".
    renders: [/^coming$/i, /#\s*(?:attending|coming)\b/i],
  },
  {
    id: 'guests-no-reply',
    name: 'Guests with no reply',
    formula: 'count(guests where rsvp_status = pending) for the event',
    inputs: ['guests.rsvp_status', 'guests.event_id'],
    anchors: ['computeGuestStats'],
    renders: [/^no reply$/i, /#\s*(?:still to reply|no reply|haven.t replied)/i],
  },
  {
    id: 'money-owing',
    name: 'Still owing',
    formula: 'Σ(supplier totals + line items + own costs) − Σ(payments made), per lib/budget-truth.ts',
    inputs: [
      'event_vendors.total_cost_php',
      'event_vendor_line_items.amount_php',
      'event_costs.amount_php',
      'event_costs.paid_php',
      'event_vendor_payments.amount_php',
    ],
    anchors: ['resolveEventMoney', 'buildBudgetLiveSummary', 'glanceMoney'],
    renders: [/\bstill owing\b/i],
  },
  {
    id: 'locked-in-share',
    name: 'Share of the plan locked in',
    formula: 'locked supplier categories ÷ lockable categories × 100 (lib/setnayan-ai-cockpit.ts)',
    inputs: ['event_vendors.status', 'event_vendors.category'],
    anchors: ['buildCockpitModel'],
    renders: [/%?\s*locked in\b/i],
  },
];

/* ═══════════════════════════ fact names ═══════════════════════════ */

/**
 * The last segment of a home, as a fact name: `events.style_preferences.setup.guestWord`
 * → `guest_word`. camelCase and snake_case are one name.
 */
export function factOf(home: string): string {
  const leaf = home.replace(/^rpc:[^.]+\./, '').split('.').pop() ?? home;
  return leaf
    .replace(/^p_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Names that are not facts about anything in particular — every table has an
 * `id`, a `status`, a `created_at`. Two homes sharing one of these names are
 * two different facts, so the one-home check skips them. Reasoned, not
 * exhaustive: a name earns a place here only if it is a bookkeeping column or
 * a word too generic to identify one fact.
 */
export const GENERIC_FACTS: ReadonlySet<string> = new Set([
  // bookkeeping
  'id', 'created_at', 'updated_at', 'deleted_at', 'archived_at', 'created_by', 'updated_by',
  'sort_order', 'position', 'order', 'index', 'version', 'source', 'metadata', 'meta', 'data',
  // words that name a kind of value, not a fact
  'status', 'state', 'name', 'title', 'label', 'notes', 'note', 'description', 'kind', 'type',
  'value', 'key', 'enabled', 'active', 'is_active', 'url', 'text', 'body', 'message', 'reason',
  'amount', 'amount_php', 'amount_centavos', 'count', 'quantity', 'email', 'mobile', 'phone',
  'role', 'slug', 'mode', 'config', 'settings', 'payload', 'result', 'error', 'items', 'tags',
  'first_name', 'last_name', 'display_name', 'image_url', 'photo_url', 'r2_key', 'storage_key',
]);

/** A fact name is an id/foreign key — the thing a row is about, not a fact on it. */
export function isKeyFact(fact: string): boolean {
  return fact === 'id' || /_id$/.test(fact) || /_ids$/.test(fact) || /_at$/.test(fact);
}

/**
 * Two names for one fact. Reasoned: each group is ONE thing a person answers
 * once, that the code has spelled differently in different places. Only names
 * seen in this codebase are listed.
 */
export const FACT_SYNONYMS: ReadonlyArray<readonly string[]> = [
  ['estimated_pax', 'pax', 'guest_count', 'expected_guests', 'guest_estimate'],
  ['event_date', 'wedding_date', 'date'],
  ['budget_amount_centavos', 'budget_target_php', 'budget_target', 'budget_php'],
  ['venue_name', 'venue'],
  ['who_can_rsvp', 'guests_get_in', 'guest_entry', 'entry'],
];

export function canonicalFact(fact: string): string {
  for (const g of FACT_SYNONYMS) if (g.includes(fact)) return g[0]!;
  return fact;
}

/**
 * Where an event fact is shown and changed. Owner 2026-10-02: "every answer
 * about an event lives in Event Details (Your info) — one home, mapped". The
 * read-out and its editor are one home (the editor folds into it, #6247).
 */
export const EVENT_FACT_HOME_SCREENS: readonly string[] = [
  '/dashboard/[eventId]/details',
  '/dashboard/[eventId]/details/change',
];

/**
 * `events` columns that are not answers a person gives about the event — the
 * record's own lifecycle and the app's bookkeeping. A screen writing one of
 * these is not "keeping its own copy of an answer". Reasoned per family.
 */
export const EVENT_BOOKKEEPING_COLUMNS: ReadonlySet<string> = new Set([
  // lifecycle
  'archived', 'archived_at', 'deleted_at', 'updated_at', 'created_at', 'status', 'finalized_at',
  'guest_list_finalized_at', 'pax_finalized_at', 'published_at', 'unpublished_at',
  // who owns it
  'owner_user_id', 'created_by', 'host_user_id',
  // the app's own counters and caches
  'last_activity_at', 'last_viewed_at', 'view_count', 'cached_summary',
]);

/**
 * Families of `events` columns that hold the APP's state about the event, not
 * an answer a person gave: a job's progress (`photo_delivery_status`,
 * `…_progress_pct`, `…_failed_count`), a generated token, a wizard's place,
 * a dismissed hint. Reasoned by suffix so a new one of the same family is
 * recognised without editing this list.
 */
export function isEventBookkeeping(col: string): boolean {
  return (
    EVENT_BOOKKEEPING_COLUMNS.has(col) ||
    /_status$|_progress_pct$|_failed_count$|_token$|_state$|^dismissed_|_seen_at$|_sent_at$|_count$/.test(col)
  );
}

/* ═══════════════════════════ serialization ═══════════════════════════ */

/**
 * ONE ROW PER LINE, for the reason `serializeScreensMap` gives: this file
 * changes whenever a form or a select does, so two branches touching it is
 * normal, and a line per screen/action/form merges cleanly.
 */
export function serializeFieldsMap(map: UgatFieldsMap): string {
  const block = (items: unknown[]) =>
    items.length ? `[\n${items.map((x) => JSON.stringify(x)).join(',\n')}\n]` : '[]';
  return (
    `{\n"version": ${map.version},\n` +
    `"screens": ${block(map.screens)},\n` +
    `"actions": ${block(map.actions)},\n` +
    `"forms": ${block(map.forms)},\n` +
    `"writers": ${block(map.writers)},\n` +
    `"stores": ${block(map.stores)}\n}\n`
  );
}
