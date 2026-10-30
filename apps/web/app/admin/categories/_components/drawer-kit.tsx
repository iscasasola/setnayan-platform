'use client';

/**
 * drawer-kit.tsx — the Admin › Categories drawer SAVES IN PLACE (owner 2026-10-29, panels approved — prototype
 * `carry-2026-10-29/admin-categories-proto`, shot `save-in-place-390-light.png`).
 *
 *   · every TEXT field saves on blur or Enter — no Save button (the black "Save" pill is gone);
 *   · every switch saves on press, every picker on pick (`pickers.tsx` / `in-place.tsx` answer here too);
 *   · each says "Saved — <what>" in the house toast (`PeekToast`, peeking from the top) with an Undo that writes the
 *     previous value back through the same door;
 *   · the screen never resets — the doors answer JSON (`mapWriteForm` / `mapWrite`, `four-level-actions.ts`), and
 *     the write's own revalidatePath redraws the drawer around the person, folds and scroll where they were.
 *
 * Nothing here decides which record is edited: the server panel hands every control its door (`kind`) and the
 * record's hidden fields.
 */
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { mapWrite, mapWriteForm, type ShippedFormKind } from '../four-level-actions';

export type WriteResult = { ok: true; message: string; id?: string; previous?: string } | { ok: false; error: string };
type Said = { n: number; text: string; tone: 'ok' | 'bad'; undo?: () => void };
type Say = (s: Omit<Said, 'n'>) => void;

const SayContext = createContext<Say | null>(null);

/** The drawer's one toast — drawn on <body> (a portal, like the sheet), so it is never painted under the sheet. */
export function DrawerSayProvider({ children }: { children: ReactNode }) {
  const [said, setSaid] = useState<Said | null>(null);
  const n = useRef(0);
  const say: Say = (s) => setSaid({ ...s, n: ++n.current });
  return (
    <SayContext.Provider value={say}>
      {children}
      {said && typeof document !== 'undefined'
        ? createPortal(
        <PeekToast
          key={said.n}
          tone={said.tone}
          data="categories-drawer"
          action={said.undo ? { label: 'Undo', onPress: () => { const u = said.undo; setSaid(null); u?.(); } } : undefined}
          onGone={() => setSaid((cur) => (cur?.n === said.n ? null : cur))}
        >
          {said.text}
        </PeekToast>,
            document.body,
          )
        : null}
    </SayContext.Provider>
  );
}

/** The drawer's toast, or null outside a drawer (a control then says it beside itself). */
export function useSay(): Say | null {
  return useContext(SayContext);
}

/** What a write answered, said beside the control when there is no drawer toast to say it. */
export function SaidLine({ said }: { said: { ok: boolean; text: string } | null }) {
  if (!said) return null;
  return (
    <p role={said.ok ? 'status' : 'alert'} className={`mt-1 text-xs ${said.ok ? 'text-success-700' : 'text-danger-700'}`}>
      {said.ok ? '✓ ' : '⚠ '}
      {said.text}
    </p>
  );
}

/**
 * Run one write in place. `what` names it in the toast ("Saved — Name"); `undo` writes the old value back.
 * A "No change." answer says nothing.
 */
export function useInPlace() {
  const say = useSay();
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<{ ok: boolean; text: string } | null>(null);
  function tell(text: string, ok: boolean, undo?: () => void) {
    if (say) say({ text, tone: ok ? 'ok' : 'bad', undo });
    else setLocal({ ok, text });
  }
  function run(
    fn: () => Promise<WriteResult>,
    opts: { what: string; said?: string | ((message: string) => string); undo?: () => Promise<WriteResult>; onDone?: (r: WriteResult) => void },
  ) {
    start(async () => {
      let r: WriteResult;
      try {
        r = await fn();
      } catch {
        r = { ok: false, error: 'That could not be saved just now. Please try again.' };
      }
      opts.onDone?.(r);
      if (!r.ok) return tell(r.error, false);
      if (r.message === 'No change.') return;
      const undo = opts.undo;
      tell(
        typeof opts.said === 'function' ? opts.said(r.message) : opts.said ?? `Saved — ${opts.what}`,
        true,
        undo
          ? () =>
              start(async () => {
                const back = await undo().catch(() => ({ ok: false as const, error: 'Undo failed — try again.' }));
                tell(back.ok ? `Undone — ${opts.what}` : back.error, back.ok);
              })
          : undefined,
      );
    });
  }
  return { pending, run, local };
}

const formOf = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

/** Post one shipped form through the in-place door. */
export function postForm(kind: ShippedFormKind | 'rename-part', fields: Record<string, string>): Promise<WriteResult> {
  return mapWriteForm(kind, formOf(fields)) as Promise<WriteResult>;
}

export const INPUT_IN_PLACE = 'min-h-11 w-full min-w-0 rounded-lg border border-ink/15 bg-raised px-3 py-2 text-[15px] text-ink outline-none focus:border-terracotta focus:ring-[3px] focus:ring-terracotta/20 aria-[invalid=true]:border-danger-700'; // no-card-ok: the class of a text <input> (a field, not a box)

/** A label on the left, its control on the right — the drawer's one row shape (the live KeyRow, label column fixed). */
export function Row({ label, children, tip }: { label: ReactNode; children: ReactNode; tip?: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[132px_minmax(0,1fr)]" data-drawer-row="">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink/70">
        {label}
        {tip}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export type FieldSpec = {
  name: string;
  label: string;
  value: string;
  /** "Name", "Tagalog name" — the toast's words. */
  what: string;
  placeholder?: string;
  maxLength?: number;
  numeric?: boolean;
  tip?: ReactNode;
};

/**
 * Text fields that save on blur or Enter. Every save posts EVERY field's last-saved value with the changed one
 * swapped in — a form that writes two columns (English + Short) never blanks the one the person did not touch.
 * A refused save keeps the words typed and says why.
 */
export function InPlaceFields({
  kind,
  hidden,
  fields,
}: {
  kind: ShippedFormKind | 'rename-part';
  hidden: Record<string, string>;
  fields: readonly FieldSpec[];
}) {
  const saved = useRef<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.name, f.value])));
  const [now, setNow] = useState<Record<string, string>>(() => ({ ...saved.current }));
  const [bad, setBad] = useState<string | null>(null);
  const { run } = useInPlace();
  // A save elsewhere (or an Undo) redraws the panel with new values — follow them unless the person is mid-edit.
  const sig = fields.map((f) => `${f.name}=${f.value}`).join('\u0001');
  useEffect(() => {
    saved.current = Object.fromEntries(fields.map((f) => [f.name, f.value]));
    setNow((cur) => {
      const active = typeof document !== 'undefined' ? (document.activeElement as HTMLInputElement | null)?.name : undefined;
      return Object.fromEntries(fields.map((f) => [f.name, f.name === active ? cur[f.name] ?? f.value : f.value]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the server's values change
  }, [sig]);
  function commit(f: FieldSpec) {
    const v = (now[f.name] ?? '').trim();
    if (v === (saved.current[f.name] ?? '')) return;
    const before = { ...saved.current };
    const after = { ...saved.current, [f.name]: v };
    run(() => postForm(kind, { ...hidden, ...after }), {
      what: f.what,
      undo: () => postForm(kind, { ...hidden, ...before }),
      onDone: (r) => {
        if (r.ok) {
          saved.current = after;
          setBad(null);
        } else setBad(f.name);
      },
    });
  }
  return (
    <>
      {fields.map((f) => (
        <Row key={f.name} label={f.label} tip={f.tip}>
          <input
            name={f.name}
            value={now[f.name] ?? ''}
            placeholder={f.placeholder}
            maxLength={f.maxLength ?? 80}
            inputMode={f.numeric ? 'numeric' : undefined}
            aria-label={f.label}
            aria-invalid={bad === f.name}
            data-saves-in-place={f.name}
            className={INPUT_IN_PLACE}
            onChange={(e) => setNow((cur) => ({ ...cur, [f.name]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') setNow((cur) => ({ ...cur, [f.name]: saved.current[f.name] ?? '' }));
            }}
            onBlur={() => commit(f)}
          />
        </Row>
      ))}
    </>
  );
}

type SwitchDoor =
  | { form: ShippedFormKind; hidden: Record<string, string>; field: string; onValue?: string; offValue?: string }
  | { op: 'hidePart'; slotKey: string }
  | { op: 'onePerEvent'; categoryId: string };

function writeSwitch(door: SwitchDoor, on: boolean): Promise<WriteResult> {
  if ('form' in door) return postForm(door.form, { ...door.hidden, [door.field]: on ? door.onValue ?? '1' : door.offValue ?? '0' });
  if (door.op === 'hidePart') return mapWrite({ op: 'hidePart', slotKey: door.slotKey, hidden: on }) as Promise<WriteResult>;
  return mapWrite({ op: 'onePerEvent', categoryId: door.categoryId, on }) as Promise<WriteResult>;
}

/** An on/off that saves on press: "Hidden from couples — on · Undo". */
export function InPlaceSwitch({ label, on, door, help }: { label: string; on: boolean; door: SwitchDoor; help?: ReactNode }) {
  const [now, setNow] = useState(on);
  useEffect(() => setNow(on), [on]);
  const { pending, run, local } = useInPlace();
  const flip = (to: boolean) => {
    setNow(to);
    run(() => writeSwitch(door, to), {
      what: label,
      said: `${label} — ${to ? 'on' : 'off'}`,
      undo: () => writeSwitch(door, !to),
      onDone: (r) => {
        if (!r.ok) setNow(!to);
      },
    });
  };
  return (
    <div data-switch={label}>
      <div className="flex min-h-11 items-center justify-between gap-3">
        <span className="text-[15px] text-ink">{label}</span>
        <button
          type="button"
          aria-pressed={now}
          aria-label={`${label}: ${now ? 'on' : 'off'}`}
          disabled={pending}
          className={SWITCH_BUTTON}
          onClick={() => flip(!now)}
        >
          <SwitchTrack on={now} />
        </button>
      </div>
      {help ? <p className="text-[12.5px] text-ink/70">{help}</p> : null}
      <SaidLine said={local} />
    </div>
  );
}

type AddDoor =
  | { form: ShippedFormKind; hidden: Record<string, string>; field: string }
  | { op: 'addCategory'; groupId: string }
  | { op: 'addService'; categoryId: string };

/**
 * The LAST-ROW ADD (the map's own shape): a dashed "＋ Add …" row; a press turns it into a field; Enter (or leaving
 * it) adds, Esc lets it go. The list redraws with the new row in place.
 */
export function DrawerAddRow({ text, placeholder, door, what }: { text: string; placeholder: string; door: AddDoor; what: string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const { pending, run, local } = useInPlace();
  const add = () => {
    const label = v.trim();
    if (!label) return setEditing(false);
    const write = (): Promise<WriteResult> =>
      'form' in door
        ? postForm(door.form, { ...door.hidden, [door.field]: label })
        : door.op === 'addCategory'
          ? (mapWrite({ op: 'addCategory', groupId: door.groupId, label }) as Promise<WriteResult>)
          : (mapWrite({ op: 'addService', categoryId: door.categoryId, label }) as Promise<WriteResult>);
    run(write, {
      what,
      said: `Added — ${label}`,
      onDone: (r) => {
        if (r.ok) {
          setV('');
          setEditing(false);
        }
      },
    });
  };
  if (!editing) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          data-add-row={what}
          className="sn-press flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-dashed border-ink/20 px-2.5 text-left text-[14px] text-ink/70"
        >
          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink/5">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        </button>
        <SaidLine said={local} />
      </div>
    );
  }
  return (
    <div>
      <input
        autoFocus
        value={v}
        disabled={pending}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={80}
        className={INPUT_IN_PLACE}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
          if (e.key === 'Escape') {
            setV('');
            setEditing(false);
          }
        }}
        onBlur={add}
      />
      <SaidLine said={local} />
    </div>
  );
}

/** A small word-button inside a chip (Approve · Reject · Remove) that posts one shipped form in place. */
export function ChipPress({
  label,
  name,
  tone = 'neutral',
  kind,
  hidden,
  said,
  undo,
}: {
  label: ReactNode;
  name: string;
  tone?: 'ok' | 'danger' | 'neutral';
  kind: ShippedFormKind;
  hidden: Record<string, string>;
  said: string;
  undo?: { kind: ShippedFormKind; hidden: Record<string, string> };
}) {
  const { pending, run } = useInPlace();
  const color = tone === 'ok' ? 'text-success-700' : tone === 'danger' ? 'text-danger-700' : 'text-ink/60';
  return (
    <button
      type="button"
      aria-label={name}
      disabled={pending}
      onClick={() => run(() => postForm(kind, hidden), { what: name, said, undo: undo ? () => postForm(undo.kind, undo.hidden) : undefined })}
      className={`sn-press sn-hit inline-flex min-h-8 items-center rounded-full px-1.5 text-[12.5px] font-semibold disabled:opacity-40 ${color}`}
    >
      {label}
    </button>
  );
}

/** A pick inside a row that saves on pick (a deadline's unit). */
export function UnitPick({
  label,
  value,
  choices,
  onPick,
}: {
  label: string;
  value: string;
  choices: ReadonlyArray<{ key: string; label: string }>;
  onPick: (key: string) => void;
}) {
  return <PickMenu label={label} value={value} options={choices.map((c) => ({ key: c.key, label: c.label }))} compact className="border border-ink/15" onPick={onPick} />;
}

const UNITS = [
  { key: 'day', label: 'days' },
  { key: 'week', label: 'weeks' },
  { key: 'month', label: 'months' },
] as const;

/** "Book by [6] [months ▾] before" — the number saves on blur/Enter, the unit on pick (`updatePlanningDeadline`). */
export function DeadlineInPlace({ label, deadlineId, value, unit }: { label: string; deadlineId: string; value: number; unit: string }) {
  const saved = useRef({ v: String(value), u: unit });
  const [v, setV] = useState(String(value));
  const [u, setU] = useState(unit);
  useEffect(() => {
    saved.current = { v: String(value), u: unit };
    setV(String(value));
    setU(unit);
  }, [value, unit]);
  const { run } = useInPlace();
  const post = (next: { v: string; u: string }) => postForm('deadline', { deadline_id: deadlineId, offset_value: next.v, offset_unit: next.u });
  const commit = (next: { v: string; u: string }) => {
    if (next.v === saved.current.v && next.u === saved.current.u) return;
    const before = { ...saved.current };
    run(() => post(next), { what: label, undo: () => post(before), onDone: (r) => { if (r.ok) saved.current = next; } });
  };
  return (
    <Row label={label}>
      <div className="flex flex-wrap items-center gap-2" data-deadline-row={deadlineId}>
        <input
          value={v}
          inputMode="numeric"
          aria-label={`${label} — how long before`}
          className={`${INPUT_IN_PLACE} !w-[72px]`}
          onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={() => commit({ v: v || '0', u })}
        />
        <UnitPick label="Unit" value={u} choices={UNITS} onPick={(k) => { setU(k); commit({ v: v || '0', u: k }); }} />
        <span className="text-[13px] text-ink/70">before</span>
      </div>
    </Row>
  );
}

/** "Last-minute from [2] months before" — empty = off (`setLastMinuteStart` / `clearLastMinuteStart`). */
export function LastMinuteInPlace({ refKey, label, months, tip }: { refKey: string; label: string; months: number | null; tip?: ReactNode }) {
  const saved = useRef(months == null ? '' : String(months));
  const [v, setV] = useState(saved.current);
  useEffect(() => {
    saved.current = months == null ? '' : String(months);
    setV(saved.current);
  }, [months]);
  const { run } = useInPlace();
  const post = (m: string) => (m === '' ? postForm('last-minute-off', { ref_key: refKey }) : postForm('last-minute', { ref_key: refKey, label, months: m }));
  return (
    <Row label="Last-minute from" tip={tip}>
      <div className="flex items-center gap-2">
        <input
          value={v}
          inputMode="numeric"
          placeholder="off"
          aria-label={`Last-minute months before for ${label}`}
          className={`${INPUT_IN_PLACE} !w-[72px]`}
          onChange={(e) => setV(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={() => {
            if (v === saved.current) return;
            const before = saved.current;
            run(() => post(v), { what: 'Last-minute', said: v === '' ? 'Saved — last-minute off' : 'Saved — Last-minute', undo: () => post(before), onDone: (r) => { if (r.ok) saved.current = v; } });
          }}
        />
        <span className="text-[13px] text-ink/70">months before</span>
      </div>
    </Row>
  );
}

/**
 * A shipped form, answered IN PLACE: the same inputs, the same action, but the submit posts through the drawer's
 * door and says "Saved — <what>" instead of loading the page. `autosave`: a text field in it saves when the person
 * leaves it (or presses Enter) — no Save button. `onSaved` runs after a good answer (close an "add" row).
 */
export function FormInPlace({
  kind,
  what,
  said,
  autosave = false,
  onSaved,
  className,
  children,
  data,
}: {
  kind: ShippedFormKind;
  what: string;
  said?: string;
  autosave?: boolean;
  onSaved?: () => void;
  className?: string;
  children: ReactNode;
  data?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const first = useRef<string | null>(null);
  const { pending, run, local } = useInPlace();
  const sig = (f: HTMLFormElement) => JSON.stringify([...new FormData(f).entries()].map(([k, v]) => [k, String(v)]));
  const submit = () => {
    const f = ref.current;
    if (!f) return;
    if (autosave && first.current !== null && sig(f) === first.current) return;
    const fd = new FormData(f);
    run(() => mapWriteForm(kind, fd) as Promise<WriteResult>, {
      what,
      said,
      onDone: (r) => {
        if (r.ok) {
          first.current = sig(f);
          onSaved?.();
        }
      },
    });
  };
  return (
    <form
      ref={ref}
      data-form-in-place={data ?? kind}
      className={`${className ?? ''} ${pending ? 'opacity-60' : ''}`}
      onFocus={() => {
        if (autosave && ref.current && first.current === null) first.current = sig(ref.current);
      }}
      onBlur={(e) => {
        if (!autosave) return;
        // Left the form (not just moved between its own fields) → save what changed.
        if (!ref.current?.contains(e.relatedTarget as Node | null)) submit();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {children}
      <SaidLine said={local} />
    </form>
  );
}
