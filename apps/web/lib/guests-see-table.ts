/**
 * apps/web/lib/guests-see-table.ts
 *
 * 🗂 "WHAT GUESTS SEE" — THE TABLE, AS DATA (owner 2026-10-10, DECISION_LOG "WHAT
 * GUESTS SEE": *"i like the 5 columns."* · *"give them freedom to pick what they
 * want to add. but have our recommendation as the checked one"*; prototype
 * `maker_what_guests_see_2026-10-10.html`, case A).
 *
 * Rows = pieces of information, in the prototype's groups. Columns = Save the
 * Date · RSVP · Invitation · The Day · Post Event. THREE KINDS OF CELL:
 *
 *   · `box`    — the couple's to tick. ONLY where a tick really changes the page:
 *                a scene row (`invitation_widgets`) on one of the four lifecycle
 *                stages. Read from `sceneOnStage` (`lib/what-guests-see.ts`) —
 *                the table keeps no idea of its own of what is drawn.
 *   · `dash`   — it cannot be there at that time; a tap says why, in one line.
 *   · `locked` — shown in its current state (a tick where guests see it, a quiet
 *                dash where not) and not changed here yet: every row that is not
 *                a scene, and every scene's RSVP column. A tap says so.
 *
 * WHAT A TICK WRITES is one entry of `config_json.stage_show` (`guestsSeeToggle`):
 * the wanted state when it differs from what the stage would show with no
 * choice (`base`), otherwise `null` — the choice is taken back, never stored
 * twice. So a row switched off for the whole event keeps meaning "hidden
 * everywhere": its boxes are empty, and one tick shows it on THAT stage only.
 *
 * Pure and serializable: the server builds it (`lib/guests-see-build.ts`, from
 * `buildMakerNavigatorData`), the sheet draws it and runs the handlers below.
 * THIS file imports no rule of the page — it is what the sheet's own chunk
 * carries — so the table can only show what the builder read.
 */
import type { LifecyclePhase, WidgetType } from './invitation-widgets';
import { formatCount } from './format-number';

/** The five columns, in order. `stage` null = the RSVP reply screens (no scene is drawn there yet). */
export const GUESTS_SEE_COLUMNS = [
  { key: 'save_the_date', label: 'Save the Date', stage: 'save_the_date' },
  { key: 'rsvp_screens', label: 'RSVP', stage: null },
  { key: 'rsvp', label: 'Invitation', stage: 'rsvp' },
  { key: 'event', label: 'The Day', stage: 'event' },
  { key: 'editorial', label: 'Post Event', stage: 'editorial' },
] as const satisfies ReadonlyArray<{ key: string; label: string; stage: LifecyclePhase | null }>;

export type GuestsSeeCell =
  | {
      kind: 'box';
      /** Guests meet it on this stage now (`sceneOnStage().drawn`). */
      on: boolean;
      /** OUR pick for this stage — the small mark; it stays when the couple changes the box. */
      ourPick: boolean;
      /** What this stage shows with NO choice stored for it (our pick and the event-wide eye). */
      base: boolean;
      /** The stored choice for this stage (`stage_show[stage]`), or null. */
      choice: boolean | null;
    }
  | { kind: 'dash'; why: string }
  | { kind: 'locked'; on: boolean; why: string };

export type GuestsSeeRow = {
  key: string;
  /** The scene this row is, or null for a row that is not an `invitation_widgets` scene. */
  scene: WidgetType | null;
  label: string;
  /** A second, quiet line under the name. */
  note: string | null;
  /** The scene has nothing in it yet — guests are not shown an empty scene. */
  empty: boolean;
  cells: GuestsSeeCell[];
};
export type GuestsSeeGroup = { title: string; rows: GuestsSeeRow[] };
export type GuestsSeeTable = { groups: GuestsSeeGroup[] };

/** Every line the sheet says. One place, so the owner can read them together. */
export const GUESTS_SEE_WORDS = {
  title: 'What guests see',
  menuLine: 'What shows at each stage',
  shownAt: 'Shown at',
  quiet: 'Nothing changed yet — our picks do the work.',
  locked: 'This one cannot be changed here yet.',
  replyScreens: 'Not on the reply screens yet.',
  emptyNote: 'Nothing written yet — guests will not see it.',
  emptyTail: ' Nothing written yet — guests will not see it until you write it.',
  placeNote: 'The address and map open once a guest has replied.',
  rsvpCaption: 'The RSVP column is the reply screens. Nothing can be changed there yet.',
  ownScenes: 'Your own scenes',
  ownScene: 'Your own scene',
  back: 'Back to our picks',
  alreadyOurs: 'These are our picks already.',
  apply: 'Apply',
  nothingToApply: 'Nothing to apply yet.',
  kept: 'Kept in your draft — guests see it once you publish with ✓.',
  notKept: 'That could not be kept. Please try again — nothing was lost.',
  undo: 'Undo',
  undone: 'Undone.',
  nothingToUndo: 'Nothing to undo.',
  close: 'Close',
  leaveTitle: 'Leave without applying?',
  keepEditing: 'Keep editing',
  leave: 'Leave',
  legendOn: 'Guests see it',
  legendOff: 'Hidden',
  legendPick: 'Our pick',
  /* The tap line's own idea ("This one cannot be changed here yet.") — never "Not changed here yet", which read as
     "you have not changed it". (The prototype's word here is "Always shown": untrue of a row that is merely locked.) */
  legendLocked: 'Cannot be changed here yet',
  legendDash: 'Not possible yet',
  ourPick: 'our pick',
} as const;

const joinAnd = (a: readonly string[]) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
export const guestsSeeApplyLabel = (n: number) => (n > 0 ? `${GUESTS_SEE_WORDS.apply} · ${plural(n, 'change', 'changes')}` : GUESTS_SEE_WORDS.apply);
export const guestsSeeLeaveLine = (n: number) => `${plural(n, 'change', 'changes')} will be lost.`;

/* ── the sheet's handlers (pure) ─────────────────────────────────────────── */

/** The entries the sheet will write, by cell: `"<scene>:<stage>"` → the `stage_show` value (null = take the choice back). */
export type GuestsSeeWrites = Readonly<Record<string, boolean | null>>;

const rowsOf = (table: GuestsSeeTable) => table.groups.flatMap((g) => g.rows);
const cellId = (row: GuestsSeeRow, col: number) => `${row.scene}:${GUESTS_SEE_COLUMNS[col]!.stage}`;

/** Is this cell ticked, with the sheet's pending ticks laid over the table? */
export function guestsSeeOn(row: GuestsSeeRow, col: number, writes: GuestsSeeWrites): boolean {
  const cell = row.cells[col]!;
  if (cell.kind === 'dash') return false;
  if (cell.kind === 'locked') return cell.on;
  const id = cellId(row, col);
  return id in writes ? (writes[id] ?? cell.base) : cell.on;
}

export type GuestsSeeTap = { writes: GuestsSeeWrites; line: string; changed: boolean };

/**
 * ONE TAP ON A CELL. A box flips, and says what that means in the prototype's
 * words; a dash and a locked cell write NOTHING and answer with their one line.
 */
export function guestsSeeToggle(table: GuestsSeeTable, writes: GuestsSeeWrites, rowKey: string, col: number): GuestsSeeTap {
  const row = rowsOf(table).find((r) => r.key === rowKey);
  const cell = row?.cells[col];
  if (!row || !cell) return { writes, line: GUESTS_SEE_WORDS.locked, changed: false };
  if (cell.kind !== 'box') return { writes, line: cell.why, changed: false };
  const stage = GUESTS_SEE_COLUMNS[col]!.label;
  const want = !guestsSeeOn(row, col, writes);
  // What to store: the wanted state — or nothing, when the stage shows that anyway.
  const value = want === cell.base ? null : want;
  const id = cellId(row, col);
  const next: Record<string, boolean | null> = { ...writes };
  if (value === cell.choice) delete next[id];
  else next[id] = value;
  let line: string;
  if (want) {
    line = `${cell.ourPick ? `Shown on ${stage} again.` : `Added to ${stage}.`}${row.empty ? GUESTS_SEE_WORDS.emptyTail : ''}`;
  } else if (cell.ourPick) {
    const others = GUESTS_SEE_COLUMNS.flatMap((c, i) => (i !== col && guestsSeeOn(row, i, next) ? [c.label] : []));
    line = `Hidden on ${stage}. ${others.length > 0 ? `Still shown on ${joinAnd(others)}.` : 'Not shown on any other stage either.'}`;
  } else {
    line = `Removed from ${stage}.`;
  }
  return { writes: next, line, changed: true };
}

/**
 * "BACK TO OUR PICKS" — every stored per-stage choice is taken back (`null`), so
 * our picks and the event-wide eye decide again. Pending ticks are dropped.
 */
export function guestsSeeBackToPicks(table: GuestsSeeTable, writes: GuestsSeeWrites): GuestsSeeTap {
  const next: Record<string, boolean | null> = {};
  let boxes = 0;
  for (const row of rowsOf(table)) {
    row.cells.forEach((cell, col) => {
      if (cell.kind !== 'box') return;
      if (cell.choice !== null) next[cellId(row, col)] = null;
      if (guestsSeeOn(row, col, writes) !== cell.base) boxes += 1;
    });
  }
  if (boxes === 0) return { writes, line: GUESTS_SEE_WORDS.alreadyOurs, changed: false };
  return { writes: next, line: `${GUESTS_SEE_WORDS.back}. ${plural(boxes, 'box', 'boxes')} changed — Apply to keep it.`, changed: true };
}

/** How many entries Apply would write. */
export const guestsSeeChanges = (writes: GuestsSeeWrites): number => Object.keys(writes).length;

/**
 * THE DRAFT PATCH for the pending ticks — exactly one `stage_show` entry per
 * changed cell, merged stage by stage by the draft (`mergeHubDraft`). Null when
 * there is nothing to write.
 */
export function guestsSeePatch(writes: GuestsSeeWrites): { widgets: Record<string, { stage_show: Record<string, boolean | null> }> } | null {
  const widgets: Record<string, { stage_show: Record<string, boolean | null> }> = {};
  for (const [id, value] of Object.entries(writes)) {
    const at = id.lastIndexOf(':');
    const type = id.slice(0, at);
    (widgets[type] ??= { stage_show: {} }).stage_show[id.slice(at + 1)] = value;
  }
  return Object.keys(widgets).length > 0 ? { widgets } : null;
}

/**
 * THE TABLE AFTER ITS PENDING TICKS WERE KEPT — each written cell now stores that
 * choice and shows what it asked for (`value ?? base`). The sheet lays this over
 * the table it was handed until the Maker's next render brings the server's own.
 */
export function guestsSeeKept(table: GuestsSeeTable, writes: GuestsSeeWrites): GuestsSeeTable {
  return {
    groups: table.groups.map((g) => ({
      ...g,
      rows: g.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell, col) => {
          if (cell.kind !== 'box') return cell;
          const id = cellId(row, col);
          if (!(id in writes)) return cell;
          const value = writes[id] ?? null;
          return { ...cell, choice: value, on: value ?? cell.base };
        }),
      })),
    })),
  };
}
