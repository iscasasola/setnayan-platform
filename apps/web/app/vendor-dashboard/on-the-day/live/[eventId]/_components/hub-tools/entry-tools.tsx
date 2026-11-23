'use client';

/**
 * THE THREE ROW TEMPLATES — Checklist · Per-person sheet · Counter — one component each, ONE shared row store, drawn
 * for any hub tool record whose template they are (DECISION_LOG 2026-10-28 "HUB TOOLS (8 TEMPLATES)": "8 components fed
 * by Admin › Categories › Hub tools, never per-service copies"; drawing `prototypes/hub_tools_working_2026-10-28/`).
 * Today: Tech rider (checklist) · Personalisation list (per-person) · Quantity vs guests (counter), 23 Nov.
 *
 * Every press writes through the ONE dispatcher (`hubToolEntry`, on-the-day/actions.ts) at once; the row moves first and
 * comes back with a plain reason when the write is refused. A row leaves by its swipe, with Undo (owner 2026-11-03:
 * "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"). `save` is the dispatcher unless a lab hands one in.
 */
import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { Check, Minus, Pencil, Plus, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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

/** One line in, one button out — the add row every template ends with. */
function AddRow({
  placeholder,
  second,
  onAdd,
  addWord = 'Add',
}: {
  placeholder: string;
  /** A second box (the per-person sheet's "what to write"). */
  second?: string;
  onAdd: (label: string, note: string) => void;
  addWord?: string;
}) {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const submit = () => {
    const l = label.trim();
    if (!l) return;
    onAdd(l, note.trim());
    setLabel('');
    setNote('');
  };
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-hub-tool-add=""
    >
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={ENTRY_LABEL_MAX}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input-field min-w-0 flex-1"
      />
      {second ? (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={ENTRY_NOTE_MAX}
          placeholder={second}
          aria-label={second}
          className="input-field min-w-0 flex-1 basis-full sm:basis-auto"
        />
      ) : null}
      <ActionButton tone="brand" type="submit" icon={Plus} label={addWord} disabled={!label.trim()} />
    </form>
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

/** A row being edited in place: its words, Save, Cancel. */
function EditRow({
  row,
  second,
  onSave,
  onCancel,
}: {
  row: HubToolEntry;
  second?: string;
  onSave: (label: string, note: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [note, setNote] = useState(row.note);
  return (
    <form
      className="flex flex-wrap items-center gap-2 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (label.trim()) onSave(label.trim(), note.trim());
      }}
      data-hub-tool-edit=""
    >
      <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={ENTRY_LABEL_MAX} aria-label="Name" className="input-field min-w-0 flex-1" />
      {second ? (
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={ENTRY_NOTE_MAX} aria-label={second} placeholder={second} className="input-field min-w-0 flex-1 basis-full sm:basis-auto" />
      ) : null}
      <ActionButton tone="ok" type="submit" icon={Check} label="Save" main disabled={!label.trim()} />
      <ActionButton tone="neutral" quiet icon={X} label="Cancel" onClick={onCancel} />
    </form>
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
                onCancel={() => setEditing(null)}
                onSave={(label) => {
                  setEditing(null);
                  patch(r.id, { label }, { op: 'edit', label, note: r.note });
                }}
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
      <AddRow placeholder={placeholder} onAdd={(label) => add({ toolKey, label })} />
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
                onCancel={() => setEditing(null)}
                onSave={(label, note) => {
                  setEditing(null);
                  patch(r.id, { label, note }, { op: 'edit', label, note });
                }}
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
      <AddRow placeholder="Name" second={second} addWord="Add person" onAdd={(label, note) => add({ toolKey, label, note })} />
    </div>
  );
}

// ── ④ COUNTER — against the guests coming ──────────────────────────────────

/** How long a run of ＋ / − presses waits before it is written as one number. */
const COUNT_SETTLE_MS = 400;

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
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const settled = useRef(new Map<string, number>(initial.map((r) => [r.id, r.qty])));
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => clearTimeout(x));
  }, []);

  /** Move the number at once; write it once the presses settle. A refused write puts the last saved number back. */
  function step(row: HubToolEntry, by: number) {
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
  }

  return (
    <div data-hub-tool={toolKey} data-hub-template="counter">
      <ToolHead icon={icon} title={title} end={attending == null ? 'guests: couldn’t read' : `${formatCount(attending)} coming`} />
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
                          ? `Exactly one each for ${formatCount(m.base)} coming`
                          : m.gap!.kind === 'short'
                            ? `${formatCount(m.gap!.by)} short of ${formatCount(m.base)} coming`
                            : `${formatCount(m.gap!.by)} more than ${formatCount(m.base)} coming`}
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
      <AddRow placeholder={placeholder} addWord="Count it" onAdd={(label) => add({ toolKey, label, qty: 0 })} />
    </div>
  );
}
