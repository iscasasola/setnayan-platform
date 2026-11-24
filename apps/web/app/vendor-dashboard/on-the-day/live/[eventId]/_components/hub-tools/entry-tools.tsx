'use client';

/**
 * THE FOUR ROW TEMPLATES — Checklist · Per-person sheet · Counter · Ordered list — one component each, ONE shared row
 * store, drawn for any hub tool record whose template they are (DECISION_LOG 2026-10-28 "HUB TOOLS (8 TEMPLATES)": "8
 * components fed by Admin › Categories › Hub tools, never per-service copies"; drawing `prototypes/hub_tools_working_2026-10-28/`).
 * 23 Nov: Tech rider (checklist) · Personalisation list (per-person) · Quantity vs guests (counter). 24 Nov: the Ordered
 * list (Chair schedule · Reservation slots · Brackets & scoring), ▲ ▼ like the Set list; Brackets keeps a score.
 *
 * Every press writes through the ONE dispatcher (`hubToolEntry`, on-the-day/actions.ts) at once; the row moves first and
 * comes back with a plain reason when the write is refused. A row leaves by its swipe, with Undo (owner 2026-11-03:
 * "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). `save` is the dispatcher unless a lab hands one in.
 */
import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { ArrowDown, ArrowUp, Check, Minus, Pencil, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { setTwo } from '@/app/vendor-dashboard/_components/set-two/parts';
import { formatCount } from '@/lib/format-number';
import {
  ENTRY_LABEL_MAX,
  ENTRY_NOTE_MAX,
  ENTRY_QTY_MAX,
  checklistProgress,
  counterModel,
  initialsOf,
  type HubToolEntry,
} from '@/lib/hub-tool-entries';
import { hubToolEntry, type HubToolEntryResult } from '../../../../actions';

type Icon = ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number | string }>;
export type HubToolSave = (eventId: string, input: unknown) => Promise<HubToolEntryResult>;

type Common = {
  eventId: string;
  toolKey: string;
  title: string;
  icon: Icon;
  initial: readonly HubToolEntry[];
  /** The dispatcher; a lab hands in its own so the tool runs on sample data. */
  save?: HubToolSave;
};

const tempId = () => `tmp_${Math.random().toString(36).slice(2, 10)}`;

/** The row store every template shares: optimistic, reverting, with one plain error line. */
function useEntries(eventId: string, initial: readonly HubToolEntry[], save: HubToolSave) {
  const [rows, setRows] = useState<HubToolEntry[]>(() => [...initial]);
  const [error, setError] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  async function write(input: Record<string, unknown>, undo: () => void): Promise<HubToolEntryResult> {
    setError(null);
    let res: HubToolEntryResult;
    try {
      res = await save(eventId, input);
    } catch {
      res = { ok: false, error: 'That didn’t save — check your signal and try again.' };
    }
    if (!res.ok) {
      undo();
      setError(res.error);
    }
    return res;
  }

  function add(fields: { toolKey: string; label: string; note?: string; qty?: number }) {
    const id = tempId();
    const row: HubToolEntry = { id, label: fields.label, note: fields.note ?? '', done: false, qty: fields.qty ?? 0 };
    setRows((r) => [...r, row]);
    void write({ op: 'add', ...fields }, () => setRows((r) => r.filter((x) => x.id !== id))).then((res) => {
      if (res.ok && res.entryId) setRows((r) => r.map((x) => (x.id === id ? { ...x, id: res.entryId! } : x)));
    });
  }

  function patch(id: string, next: Partial<HubToolEntry>, input: Record<string, unknown>) {
    const before = rowsRef.current.find((x) => x.id === id);
    if (!before || id.startsWith('tmp_')) return;
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...next } : x)));
    void write({ ...input, entryId: id }, () => setRows((r) => r.map((x) => (x.id === id ? before : x))));
  }

  function remove(row: HubToolEntry) {
    if (row.id.startsWith('tmp_')) return;
    let at = -1;
    deleteWithUndo({
      label: `“${row.label}” removed`,
      hide: () => {
        at = rowsRef.current.findIndex((x) => x.id === row.id);
        setRows((r) => r.filter((x) => x.id !== row.id));
      },
      restore: () =>
        setRows((r) => {
          if (r.some((x) => x.id === row.id)) return r;
          const next = [...r];
          next.splice(at < 0 ? next.length : Math.min(at, next.length), 0, row);
          return next;
        }),
      commit: () => save(eventId, { op: 'remove', entryId: row.id }),
      failed: `Couldn’t remove “${row.label}”. It’s back — try again.`,
    });
  }

  return { rows, setRows, error, write, add, patch, remove };
}

/** The tool's head: its mark, its name, and its one count. */
function ToolHead({ icon: Ic, title, end }: { icon: Icon; title: string; end?: string }) {
  return (
    <h3 className="flex items-center gap-2">
      <Ic aria-hidden className="h-5 w-5 text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">{title}</span>
      {end ? <span className="text-sn-md font-semibold tabular-nums text-[color:var(--m-slate-2)]">{end}</span> : null}
    </h3>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="!mb-1 !mt-2 !text-[color:rgb(var(--color-danger))]" data-hub-tool-error="">
      {error}
    </p>
  ) : null;
}

/**
 * The add box every template ends with — the ONE Field template (`TypedRow`, owner 1 Nov 2026), as the domain and
 * category add boxes draw it: it follows what is typed (`onType`), ⏎ ENTER ADDS (`onEnter`, "ENTER STILL ADDS IN ONE-LINE
 * ADD BOXES"), and the button beside it adds too. A per-person sheet asks a second line (what to write).
 */
function AddRow({
  name,
  placeholder,
  second,
  onAdd,
  addWord = 'Add',
}: {
  name: string;
  placeholder: string;
  /** A second line (the per-person sheet's "what to write"). */
  second?: string;
  onAdd: (label: string, note: string) => void;
  addWord?: string;
}) {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [round, setRound] = useState(0);
  const submit = (typed?: string) => {
    const l = (typed ?? label).trim();
    if (!l) return;
    onAdd(l, note.trim());
    setLabel('');
    setNote('');
    setRound((n) => n + 1); // a fresh, empty row for the next one
  };
  return (
    <div className="mt-3" data-hub-tool-add="">
      <FormRows width="wide" key={round}>
        <TypedRow
          name={name}
          value={label}
          empty={placeholder}
          placeholder={placeholder}
          maxLength={ENTRY_LABEL_MAX}
          onType={setLabel}
          onKeep={(t) => setLabel(t)}
          onEnter={second ? undefined : (t) => submit(t)}
          data="hub-tool-add-label"
        />
        {second ? (
          <TypedRow
            name={second}
            value={note}
            empty="Optional"
            placeholder={second}
            maxLength={ENTRY_NOTE_MAX}
            onType={setNote}
            onKeep={(t) => setNote(t)}
            onEnter={() => submit()}
            data="hub-tool-add-note"
          />
        ) : null}
      </FormRows>
      <div className="mt-2 flex justify-end">
        <ActionButton tone="brand" icon={Plus} label={addWord} onClick={() => submit()} disabled={!label.trim()} data-hub-tool-add-button="" />
      </div>
    </div>
  );
}

/** The tick every checklist and per-person row leads with (44 px press). */
function Tick({ done, label, onPress }: { done: boolean; label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={done}
      aria-label={done ? `Mark “${label}” not done` : `Mark “${label}” done`}
      className="grid h-11 w-11 shrink-0 place-items-center"
      data-hub-tool-tick={done ? 'on' : 'off'}
    >
      <span
        className={`grid h-6 w-6 place-items-center rounded-md border transition-colors duration-sn-micro ${
          done ? 'border-transparent bg-sn-accent text-sn-on-accent' : 'border-[color:var(--m-line)] text-transparent'
        }`}
      >
        <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
      </span>
    </button>
  );
}

/**
 * A row being edited in place — the ONE Field template again: each line keeps (and saves) when it is kept, and Done
 * closes the editor.
 */
function EditRow({
  row,
  first,
  second,
  onSave,
  onDone,
}: {
  row: HubToolEntry;
  /** The first line's name (default: Name beside a second line, else Item). */
  first?: string;
  second?: string;
  onSave: (label: string, note: string) => void;
  onDone: () => void;
}) {
  return (
    <div className="px-3 py-2" data-hub-tool-edit="">
      <FormRows width="wide">
        <TypedRow
          name={first ?? (second ? 'Name' : 'Item')}
          value={row.label}
          maxLength={ENTRY_LABEL_MAX}
          required
          onKeep={(t) => {
            if (t.trim() && t.trim() !== row.label) onSave(t.trim(), row.note);
          }}
          data="hub-tool-edit-label"
        />
        {second ? (
          <TypedRow
            name={second}
            value={row.note}
            empty="Optional"
            maxLength={ENTRY_NOTE_MAX}
            onKeep={(t) => {
              if (t.trim() !== row.note) onSave(row.label, t.trim());
            }}
            data="hub-tool-edit-note"
          />
        ) : null}
      </FormRows>
      <div className="mt-2 flex justify-end">
        <ActionButton tone="ok" icon={Check} label="Done" onClick={onDone} data-hub-tool-edit-done="" />
      </div>
    </div>
  );
}

// ── ① CHECKLIST ────────────────────────────────────────────────────────────

export function ChecklistTool({ eventId, toolKey, title, icon, initial, save = hubToolEntry, placeholder, empty }: Common & { placeholder: string; empty: string }) {
  const { rows, error, add, patch, remove } = useEntries(eventId, initial, save);
  const [editing, setEditing] = useState<string | null>(null);
  const { done, total } = checklistProgress(rows);
  return (
    <div data-hub-tool={toolKey} data-hub-template="checklist">
      <ToolHead icon={icon} title={title} end={total > 0 ? `${formatCount(done)} of ${formatCount(total)} ready` : undefined} />
      {rows.length === 0 ? <p data-hub-tool-empty="">{empty}</p> : null}
      <ul className="-mx-3">
        {rows.map((r) =>
          editing === r.id ? (
            <li key={r.id}>
              <EditRow
                row={r}
                onDone={() => setEditing(null)}
                onSave={(label) => patch(r.id, { label }, { op: 'edit', label, note: r.note })}
              />
            </li>
          ) : (
            <SwipeToDelete key={r.id} as="li" label={`Remove “${r.label}”`} word="Remove" onDelete={() => remove(r)} radiusClass="" surfaceClass="bg-frame">
              <div className={`${setTwo.row} !gap-1 !py-0`} data-hub-tool-row="">
                <Tick done={r.done} label={r.label} onPress={() => patch(r.id, { done: !r.done }, { op: 'tick', done: !r.done })} />
                <span className={`min-w-0 flex-1 text-sn-lg ${r.done ? 'text-[color:var(--m-slate-2)] line-through' : 'text-ink'}`}>{r.label}</span>
                <ActionButton tone="neutral" iconOnly icon={Pencil} label="Edit" name={`Edit “${r.label}”`} onClick={() => setEditing(r.id)} />
              </div>
            </SwipeToDelete>
          ),
        )}
      </ul>
      <ErrorLine error={error} />
      <AddRow name="What you need" placeholder={placeholder} onAdd={(label) => add({ toolKey, label })} />
    </div>
  );
}

// ── ② PER-PERSON SHEET ─────────────────────────────────────────────────────

export function PerPersonTool({
  eventId,
  toolKey,
  title,
  icon,
  initial,
  save = hubToolEntry,
  second,
  empty,
}: Common & { second: string; empty: string }) {
  const { rows, error, add, patch, remove } = useEntries(eventId, initial, save);
  const [editing, setEditing] = useState<string | null>(null);
  const { done, total } = checklistProgress(rows);
  return (
    <div data-hub-tool={toolKey} data-hub-template="per_person">
      <ToolHead icon={icon} title={title} end={total > 0 ? `${formatCount(done)} of ${formatCount(total)} done` : undefined} />
      {rows.length === 0 ? <p data-hub-tool-empty="">{empty}</p> : null}
      <ul className="-mx-3">
        {rows.map((r) =>
          editing === r.id ? (
            <li key={r.id}>
              <EditRow
                row={r}
                second={second}
                onDone={() => setEditing(null)}
                onSave={(label, note) => patch(r.id, { label, note }, { op: 'edit', label, note })}
              />
            </li>
          ) : (
            <SwipeToDelete key={r.id} as="li" label={`Remove ${r.label}`} word="Remove" onDelete={() => remove(r)} radiusClass="" surfaceClass="bg-frame">
              <div className={`${setTwo.row} !gap-1 !py-0`} data-hub-tool-row="">
                <Tick done={r.done} label={r.label} onPress={() => patch(r.id, { done: !r.done }, { op: 'tick', done: !r.done })} />
                <span aria-hidden className={`${setTwo.rowIcon} mr-2 text-sn-sm font-bold`}>
                  {initialsOf(r.label)}
                </span>
                <span className={setTwo.rowBody}>
                  <b className={`${setTwo.rowTitle} ${r.done ? 'text-[color:var(--m-slate-2)] line-through' : ''}`}>{r.label}</b>
                  {r.note ? <span className={setTwo.rowSub}>{r.note}</span> : null}
                </span>
                <ActionButton tone="neutral" iconOnly icon={Pencil} label="Edit" name={`Edit ${r.label}`} onClick={() => setEditing(r.id)} />
              </div>
            </SwipeToDelete>
          ),
        )}
      </ul>
      <ErrorLine error={error} />
      <AddRow name="Name" placeholder="Their name" second={second} addWord="Add person" onAdd={(label, note) => add({ toolKey, label, note })} />
    </div>
  );
}

// ── ④ COUNTER — against the guests coming ──────────────────────────────────

/** How long a run of ＋ / − presses waits before it is written as one number. */
const COUNT_SETTLE_MS = 400;

/**
 * ＋ / − on a row's count — the Counter's and a scored Ordered list's: the number moves at once and is written ONCE the
 * presses settle; a refused write puts the last saved number back.
 */
function useCountSteps(
  initial: readonly HubToolEntry[],
  setRows: (f: (r: HubToolEntry[]) => HubToolEntry[]) => void,
  write: (input: Record<string, unknown>, undo: () => void) => Promise<HubToolEntryResult>,
) {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const settled = useRef(new Map<string, number>(initial.map((r) => [r.id, r.qty])));
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => clearTimeout(x));
  }, []);

  return function step(row: HubToolEntry, by: number) {
    if (row.id.startsWith('tmp_')) return;
    const next = Math.max(0, Math.min(ENTRY_QTY_MAX, row.qty + by));
    if (next === row.qty) return;
    setRows((r) => r.map((x) => (x.id === row.id ? { ...x, qty: next } : x)));
    const t = timers.current.get(row.id);
    if (t) clearTimeout(t);
    timers.current.set(
      row.id,
      setTimeout(() => {
        timers.current.delete(row.id);
        const saved = settled.current.get(row.id) ?? 0;
        settled.current.set(row.id, next);
        void write({ op: 'count', entryId: row.id, qty: next }, () => {
          settled.current.set(row.id, saved);
          setRows((r) => r.map((x) => (x.id === row.id ? { ...x, qty: saved } : x)));
        });
      }, COUNT_SETTLE_MS),
    );
  };
}

export function CounterTool({
  eventId,
  toolKey,
  title,
  icon,
  initial,
  save = hubToolEntry,
  attending,
  placeholder,
  empty,
}: Common & {
  /** The coming guests — the page's ONE headcount read (the Headcount row's own number); null = couldn't read. */
  attending: number | null;
  placeholder: string;
  empty: string;
}) {
  const { rows, setRows, error, write, add, remove } = useEntries(eventId, initial, save);
  const step = useCountSteps(initial, setRows, write);

  return (
    <div data-hub-tool={toolKey} data-hub-template="counter">
      {/* The coming count is drawn ONCE, in the page's Headcount row; the counter compares against it and never repeats it (root map: one fact, shown once). */}
      <ToolHead icon={icon} title={title} end={attending == null ? 'guests: couldn’t read' : undefined} />
      {rows.length === 0 ? <p data-hub-tool-empty="">{empty}</p> : null}
      <ul className="-mx-3">
        {rows.map((r) => {
          const m = counterModel(r.qty, attending);
          return (
            <SwipeToDelete key={r.id} as="li" label={`Remove ${r.label}`} word="Remove" onDelete={() => remove(r)} radiusClass="" surfaceClass="bg-frame">
              <div className="px-3 py-3" data-hub-tool-row="" data-hub-counter={r.qty}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sn-lg">{r.label}</b>
                    <span className="block text-sn-md text-[color:var(--m-slate-2)]" data-hub-counter-gap={m.gap?.kind ?? 'unread'}>
                      {m.base == null
                        ? 'Guests coming couldn’t be read — the count is still yours.'
                        : m.gap!.kind === 'even'
                          ? 'Exactly one each for the guests coming'
                          : m.gap!.kind === 'short'
                            ? `${formatCount(m.gap!.by)} short of the guests coming`
                            : `${formatCount(m.gap!.by)} more than the guests coming`}
                    </span>
                  </span>
                  <span className={`${setTwo.big} tabular-nums`} aria-live="polite">
                    {formatCount(r.qty)}
                  </span>
                </div>
                {m.pct != null ? (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--m-line)]" aria-hidden>
                    <div
                      className="h-full rounded-full bg-sn-accent transition-[width] duration-sn-micro"
                      style={{ width: `${m.pct}%` }}
                    />
                  </div>
                ) : null}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <ActionButton tone="neutral" icon={Minus} label="Less" name={`One less ${r.label}`} disabled={r.qty === 0} onClick={() => step(r, -1)} data-hub-counter-step="minus" />
                  <ActionButton tone="brand" filled icon={Plus} label="More" name={`One more ${r.label}`} onClick={() => step(r, 1)} data-hub-counter-step="plus" />
                </div>
              </div>
            </SwipeToDelete>
          );
        })}
      </ul>
      <ErrorLine error={error} />
      <AddRow name="What you’re counting" placeholder={placeholder} addWord="Count it" onAdd={(label) => add({ toolKey, label, qty: 0 })} />
    </div>
  );
}

// ── ⑤ ORDERED LIST — rows in order, one place up or down (the Set list's ▲ ▼) ────────────────────────────────────

/** Swap two rows by id — the move, and its undo. */
function swapIds(rows: readonly HubToolEntry[], a: string, b: string): HubToolEntry[] {
  const i = rows.findIndex((x) => x.id === a);
  const j = rows.findIndex((x) => x.id === b);
  if (i < 0 || j < 0) return [...rows];
  const next = [...rows];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function OrderedListTool({
  eventId,
  toolKey,
  title,
  icon,
  initial,
  save = hubToolEntry,
  first,
  placeholder,
  second,
  empty,
  scored = false,
}: Common & {
  /** The add box's first line (what a row is: a name, a slot, a team). */
  first: string;
  placeholder: string;
  /** The second line (a call time, a note, a group). */
  second: string;
  empty: string;
  /** Brackets & scoring: each row keeps a score (`qty`) with ＋ / −. */
  scored?: boolean;
}) {
  const { rows, setRows, error, write, add, patch, remove } = useEntries(eventId, initial, save);
  const step = useCountSteps(initial, setRows, write);
  const [editing, setEditing] = useState<string | null>(null);

  /** One place up or down: the row moves at once; a refused write moves it back. */
  function move(row: HubToolEntry, dir: 'up' | 'down') {
    if (row.id.startsWith('tmp_')) return;
    const i = rows.findIndex((x) => x.id === row.id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const other = rows[j]!.id;
    setRows((r) => swapIds(r, row.id, other));
    void write({ op: 'move', entryId: row.id, dir }, () => setRows((r) => swapIds(r, row.id, other)));
  }

  return (
    <div data-hub-tool={toolKey} data-hub-template="ordered_list">
      <ToolHead icon={icon} title={title} end={rows.length > 0 ? `${formatCount(rows.length)} in order` : undefined} />
      {rows.length === 0 ? <p data-hub-tool-empty="">{empty}</p> : null}
      <ul className="-mx-3">
        {rows.map((r, i) =>
          editing === r.id ? (
            <li key={r.id}>
              <EditRow
                row={r}
                first={first}
                second={second}
                onDone={() => setEditing(null)}
                onSave={(label, note) => patch(r.id, { label, note }, { op: 'edit', label, note })}
              />
            </li>
          ) : (
            <SwipeToDelete key={r.id} as="li" label={`Remove “${r.label}”`} word="Remove" onDelete={() => remove(r)} radiusClass="" surfaceClass="bg-frame">
              <div className="px-3 py-1" data-hub-tool-row="" data-hub-order={i + 1}>
                <div className="flex min-h-14 min-w-0 items-center gap-2">
                  <span aria-hidden className={`${setTwo.rowIcon} text-sn-sm font-bold tabular-nums`}>
                    {formatCount(i + 1)}
                  </span>
                  <span className={setTwo.rowBody}>
                    <b className={setTwo.rowTitle}>{r.label}</b>
                    {r.note ? <span className={setTwo.rowSub}>{r.note}</span> : null}
                  </span>
                  {scored ? (
                    <span className={`${setTwo.big} tabular-nums`} aria-live="polite" data-hub-score={r.qty}>
                      {formatCount(r.qty)}
                    </span>
                  ) : null}
                  {!scored ? <MoveButtons row={r} first={i === 0} last={i === rows.length - 1} onMove={move} /> : null}
                  {!scored ? <ActionButton tone="neutral" iconOnly icon={Pencil} label="Edit" name={`Edit “${r.label}”`} onClick={() => setEditing(r.id)} /> : null}
                </div>
                {scored ? (
                  <div className="flex items-center justify-end gap-2 pb-2">
                    <ActionButton tone="neutral" iconOnly icon={Minus} label="Less" name={`One point less for ${r.label}`} disabled={r.qty === 0} onClick={() => step(r, -1)} data-hub-score-step="minus" />
                    <ActionButton tone="brand" filled iconOnly icon={Plus} label="More" name={`One point more for ${r.label}`} onClick={() => step(r, 1)} data-hub-score-step="plus" />
                    <MoveButtons row={r} first={i === 0} last={i === rows.length - 1} onMove={move} />
                    <ActionButton tone="neutral" iconOnly icon={Pencil} label="Edit" name={`Edit “${r.label}”`} onClick={() => setEditing(r.id)} />
                  </div>
                ) : null}
              </div>
            </SwipeToDelete>
          ),
        )}
      </ul>
      <ErrorLine error={error} />
      <AddRow name={first} placeholder={placeholder} second={second} addWord="Add" onAdd={(label, note) => add({ toolKey, label, note, qty: scored ? 0 : undefined })} />
    </div>
  );
}

function MoveButtons({ row, first, last, onMove }: { row: HubToolEntry; first: boolean; last: boolean; onMove: (row: HubToolEntry, dir: 'up' | 'down') => void }) {
  return (
    <>
      <ActionButton tone="neutral" iconOnly icon={ArrowUp} label="Up" name={`Move “${row.label}” up`} disabled={first} onClick={() => onMove(row, 'up')} data-hub-move="up" />
      <ActionButton tone="neutral" iconOnly icon={ArrowDown} label="Down" name={`Move “${row.label}” down`} disabled={last} onClick={() => onMove(row, 'down')} data-hub-move="down" />
    </>
  );
}
