/**
 * lib/part-editor-lock.ts — ✍️ ONE EDITOR PER PART, the pure half (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW
 * + ONE EDITOR PER PART — APPROVED TO BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/
 * desktop_split_view_v2_fable.html`, frames 3–5).
 *
 *   · one editor per part; the others see a quiet bar "<Name> is editing <Part>." and the part is read-only for them;
 *   · it frees itself 5 seconds after the editor stops (SERVER clock — `acquire_part_editor_lock`, migration
 *     20271360932916; {@link PART_FREES_AFTER_MS} is its twin for the words and the timers, never the decision);
 *   · a host can always take over; the bumped person is told "<Host> took over <Part>." and their unsaved change is
 *     kept, then offered back as a DRAFT on top of the host's latest ({@link draftOnLatest}): items the host also
 *     changed are marked "<Host> changed this too" and picked one by one; nothing saves until Confirm.
 *
 * No imports, no React: the gate (`app/_components/part-edit/part-edit-gate.tsx`) and the hook
 * (`app/_components/part-edit/use-part-editor-lock.ts`) draw and call; this decides the words and the merge.
 * 🔒 lib/part-editor-lock.test.ts · tests/db/one-editor-per-part.db.test.ts
 */

/** The parts one editor holds at a time. The SQL twin is the CHECK on `event_part_editor_locks.part`. */
export type EditPart = 'guests' | 'seats' | 'march' | 'schedule' | 'hub' | 'event_details' | 'suppliers' | 'mood_board';

export const EDIT_PARTS: readonly EditPart[] = ['guests', 'seats', 'march', 'schedule', 'hub', 'event_details', 'suppliers', 'mood_board'];

/** One set of names — the hosts' dashboard tab names (controller call (6), 21 Nov). */
export const EDIT_PART_NAME: Readonly<Record<EditPart, string>> = {
  guests: 'Guests',
  seats: 'Seats',
  march: 'March',
  schedule: 'Schedule',
  hub: 'Hub',
  event_details: 'Event Details',
  suppliers: 'Suppliers',
  mood_board: 'Mood Board',
};

/** The part frees itself this long after the editor's last edit. SQL twin: `INTERVAL '5 seconds'` (the server decides). */
export const PART_FREES_AFTER_MS = 5_000;
/** The editor's touches are at most this often — well inside the 5 s window. */
export const TOUCH_EVERY_MS = 1_500;
/** A person looking at the part asks who is editing this often (tab visible only). */
export const WATCH_EVERY_MS = 2_000;
/** The "is free" moment stays this long, then the bar goes quiet. */
export const FREE_MOMENT_MS = 8_000;

export const isEditPart = (v: unknown): v is EditPart => typeof v === 'string' && (EDIT_PARTS as readonly string[]).includes(v);

// ── the lock as the person looking at it is told ─────────────────────────────────────────────────────────────────────

export type PartLockState = {
  /** `unknown` = not asked yet, or the read failed — never drawn as "free". */
  status: 'free' | 'mine' | 'held' | 'not_authorized' | 'unknown';
  holderLabel: string | null;
  holderIsHost: boolean;
  /** This person may hold the part (a host, or an edit-level helper / coordinator). */
  canEdit: boolean;
  /** This person is a host and someone else holds it. */
  canTakeOver: boolean;
  /** A host took the part from THIS person: the host's name, and when. */
  takenByLabel: string | null;
  bumpedAt: string | null;
};

export const UNKNOWN_LOCK: PartLockState = {
  status: 'unknown',
  holderLabel: null,
  holderIsHost: false,
  canEdit: false,
  canTakeOver: false,
  takenByLabel: null,
  bumpedAt: null,
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

/** `part_editor_lock_state`'s envelope → the state. Anything unreadable is `unknown`, never `free`. */
export function readPartLockState(raw: unknown): PartLockState {
  if (!raw || typeof raw !== 'object') return UNKNOWN_LOCK;
  const r = raw as Record<string, unknown>;
  const status = r.status;
  if (status !== 'free' && status !== 'mine' && status !== 'held' && status !== 'not_authorized') return UNKNOWN_LOCK;
  return {
    status,
    holderLabel: status === 'held' ? str(r.holder_label) ?? 'Someone' : null,
    holderIsHost: r.holder_is_host === true,
    canEdit: r.can_edit === true,
    canTakeOver: r.can_take_over === true,
    takenByLabel: str(r.taken_by_label),
    bumpedAt: str(r.bumped_at),
  };
}

/** The part is read-only for this person right now: someone else holds it. */
export const lockedForMe = (s: PartLockState): boolean => s.status === 'held';

/**
 * What changed between two reads, for the bar:
 *   · `became_free` — someone was editing and stopped: "<Part> is free. You can edit now. <Name>'s changes are in."
 *   · `taken_over` — a host took the part from this person (a take-over we have not told them yet).
 */
export type LockMoment = { kind: 'became_free'; lastEditor: string | null } | { kind: 'taken_over'; by: string; at: string | null } | null;

export function lockMoment(prev: PartLockState, next: PartLockState, toldBumpAt: string | null): LockMoment {
  if (next.takenByLabel && next.bumpedAt !== toldBumpAt) return { kind: 'taken_over', by: next.takenByLabel, at: next.bumpedAt };
  if (prev.status === 'held' && (next.status === 'free' || next.status === 'mine')) return { kind: 'became_free', lastEditor: prev.holderLabel };
  return null;
}

// ── the words (drawing frames 3 and 4, verbatim where it can be; never a pronoun guessed from a name) ──────────────────

export type BarWords = { lead: string; rest: string };

export function editingWords(holder: string, part: EditPart): BarWords {
  return { lead: `${holder} is editing ${EDIT_PART_NAME[part]}.`, rest: `You can look. It frees itself when ${holder} stops.` };
}

export function freeWords(part: EditPart, lastEditor: string | null): BarWords {
  return {
    lead: `${EDIT_PART_NAME[part]} is free.`,
    rest: lastEditor ? `You can edit now. ${possessive(lastEditor)} changes are in.` : 'You can edit now.',
  };
}

export function takenOverWords(host: string, part: EditPart, kept: boolean): BarWords {
  return {
    lead: `${host} took over ${EDIT_PART_NAME[part]}.`,
    rest: kept ? `${host} is a host, so a host goes first. Your change was not saved. It is kept below.` : `${host} is a host, so a host goes first.`,
  };
}

export const KEPT_TITLE = 'Your unsaved change';
export const putItBackLabel = (part: EditPart, free: boolean): string => (free ? 'Put it back' : `Put it back · when ${EDIT_PART_NAME[part]} is free`);
export const TAKE_OVER = 'Take over';

export function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

// ── the draft on top of the host's latest (frame 5) ───────────────────────────────────────────────────────────────────

/** One unsaved change, as it was when the host took over: the field, what it said before, what this person typed. */
export type DraftItem = { key: string; label: string; from: string; to: string };

export type DraftRow = DraftItem & {
  /** The host's latest value of the same field. */
  theirs: string;
  /** The host changed it too, to something else — this person picks. */
  conflict: boolean;
};

/**
 * The kept change, laid on the host's latest version. A field the host already set to this person's value has nothing
 * left to do and drops; a field the host left alone is "Your change"; a field the host changed too is a pick.
 */
export function draftOnLatest(items: readonly DraftItem[], latest: Readonly<Record<string, string | undefined>>): DraftRow[] {
  const rows: DraftRow[] = [];
  for (const it of items) {
    const theirs = latest[it.key] ?? it.from;
    if (theirs === it.to) continue;
    rows.push({ ...it, theirs, conflict: theirs !== it.from });
  }
  return rows;
}

export type DraftPick = 'mine' | 'theirs';

/** The values Confirm writes: every plain change, and each pick that chose "Yours" (the default). "Theirs" writes nothing. */
export function resolveDraft(rows: readonly DraftRow[], picks: Readonly<Record<string, DraftPick>>): Array<{ key: string; value: string }> {
  return rows.filter((r) => !r.conflict || (picks[r.key] ?? 'mine') === 'mine').map((r) => ({ key: r.key, value: r.to }));
}

/** "This is a draft on top of Claire's latest version." · "2 changes. 1 needs your pick." */
export function draftWords(host: string | null, rows: readonly DraftRow[]): BarWords {
  const n = rows.length;
  const picks = rows.filter((r) => r.conflict).length;
  return {
    lead: host ? `This is a draft on top of ${possessive(host)} latest version.` : 'This is a draft on top of the latest version.',
    rest: `${n} ${n === 1 ? 'change' : 'changes'}.${picks ? ` ${picks} ${picks === 1 ? 'needs' : 'need'} your pick.` : ''}`,
  };
}

export const confirmLabel = (rows: readonly DraftRow[], picks: Readonly<Record<string, DraftPick>>): string => {
  const n = resolveDraft(rows, picks).length;
  return n === 0 ? 'Keep their version' : `Confirm ${n} ${n === 1 ? 'change' : 'changes'}`;
};

/** "Table: Table 4 → Table 6" — one kept change, said. */
export const draftItemLine = (it: Pick<DraftItem, 'label' | 'from' | 'to'>): string =>
  `${it.label}: ${it.from || '—'} → ${it.to || '—'}`;
