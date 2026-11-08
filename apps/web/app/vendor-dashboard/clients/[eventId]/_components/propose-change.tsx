'use client';

/**
 * ✍️ "PROPOSE A CHANGE" — a supplier who is not the coordinator, holding the guest list, the seat plan or the
 * suppliers, asks for a change instead of making it (owner 8 Nov 2026: *"any supplier that is not a coordinator still
 * has to request a host or coordinator to accept the change"*).
 *
 * Every choice is ONE dropdown (`PickMenu`): what to change, then the guest / table / supplier / detail. Send, and the
 * change shows here as "Waiting for the host or the coordinator" — then its answer, which also arrives as an in-app
 * notice (`change_answered`). The form keeps the supplier's place after a send (a save never resets the screen); only
 * the typed value clears. The database decides what can be proposed (`change_request_payload_ok`) and who accepts.
 */
import { useState, useTransition } from 'react';
import { Loader2, Send } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { TypedRow } from '@/app/_components/form-row';
import { changeRequestAction } from '@/app/_actions/change-request-actions';
import {
  CHANGE_OPS,
  GUEST_EDIT_FIELDS,
  GUEST_FIELD_LABEL,
  MEAL_CHOICES,
  SUPPLIER_EDIT_FIELDS,
  SUPPLIER_FIELD_LABEL,
  changeStatusWords,
  type ChangeOp,
  type ChangeStatus,
} from '@/lib/change-requests';

type Named = { id: string; name: string };
type Mine = { changeId: string; summary: string; status: ChangeStatus; answerNote: string | null };

const MEAL_LABEL: Record<(typeof MEAL_CHOICES)[number], string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids meal',
  no_preference: 'No preference',
};
const NO_TABLE = '__none__';

export function ProposeChange({
  eventId,
  ops,
  guests,
  tables,
  suppliers,
  mine,
  measured,
}: {
  eventId: string;
  /** The changes their shared parts allow (`proposableOps`). */
  ops: ChangeOp[];
  guests: Named[];
  tables: Named[];
  suppliers: Named[];
  mine: Mine[];
  /** False when a read was refused — said, never drawn as an empty list. */
  measured: boolean;
}) {
  const [op, setOp] = useState<ChangeOp>(ops[0]!);
  const [target, setTarget] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [table, setTable] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentList, setSentList] = useState<Mine[]>([]);
  const [pending, startTransition] = useTransition();

  const targets = op === 'supplier_edit' ? suppliers : guests;
  const fields: readonly string[] = op === 'guest_edit' ? GUEST_EDIT_FIELDS : op === 'supplier_edit' ? SUPPLIER_EDIT_FIELDS : [];
  const fieldLabel = (f: string) => (GUEST_FIELD_LABEL as Record<string, string>)[f] ?? (SUPPLIER_FIELD_LABEL as Record<string, string>)[f] ?? f;
  const shown = [...sentList, ...mine];

  function pickOp(next: string) {
    setOp(next as ChangeOp);
    setTarget(null);
    setField(null);
    setValue('');
    setError(null);
  }

  function send() {
    setError(null);
    const targetName = targets.find((t) => t.id === target)?.name ?? null;
    startTransition(async () => {
      const res = await changeRequestAction(eventId, {
        op: 'propose',
        note: note || null,
        input: {
          op,
          targetId: target,
          targetName,
          firstName: first,
          lastName: last,
          changes: field ? { [field]: value } : {},
          tableId: table === NO_TABLE ? null : table,
          tableName: tables.find((t) => t.id === table)?.name ?? null,
        },
      });
      if (!res.ok) {
        setError(res.error ?? 'Could not send that.');
        return;
      }
      setSentList((prev) => [{ changeId: `sent-${prev.length}`, summary: res.summary ?? 'Your change', status: 'open', answerNote: null }, ...prev]);
      setValue('');
      setFirst('');
      setLast('');
      setNote('');
    });
  }

  return (
    <div className="space-y-1 py-1" data-propose-change="">
      <p className="text-sm font-medium text-ink">Propose a change</p>
      <p className="mt-1 text-xs text-ink/60">The host or the coordinator accepts it. Nothing changes until they do.</p>

      {!measured ? (
        <p className="mt-2 text-sm text-terracotta-700" data-propose-change-refused="">
          We could not load the list just now. Reload to try again.
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        <PickMenu
          label="What to change"
          value={op}
          options={ops.map((o) => ({ key: o, label: CHANGE_OPS[o].label }))}
          onPick={pickOp}
          dataAttr="data-propose-change-op"
        />

        {CHANGE_OPS[op].needsTarget ? (
          <PickMenu
            label={op === 'supplier_edit' ? 'Which supplier' : 'Which guest'}
            value={target}
            options={targets.map((t) => ({ key: t.id, label: t.name }))}
            onPick={setTarget}
            buttonText={target ? undefined : op === 'supplier_edit' ? 'Pick the supplier' : 'Pick the guest'}
            dataAttr="data-propose-change-target"
          />
        ) : null}

        {op === 'guest_add' ? (
          <>
            <TypedRow name="First name" value={first} maxLength={80} autoCapitalize="words" onKeep={(t) => setFirst(t)} data="propose-first-name" />
            <TypedRow name="Last name" value={last} maxLength={80} autoCapitalize="words" onKeep={(t) => setLast(t)} data="propose-last-name" />
          </>
        ) : null}

        {fields.length > 0 ? (
          <PickMenu
            label="Which detail"
            value={field}
            options={fields.map((f) => ({ key: f, label: fieldLabel(f) }))}
            onPick={(f) => {
              setField(f);
              setValue('');
            }}
            buttonText={field ? undefined : 'Pick the detail'}
            dataAttr="data-propose-change-field"
          />
        ) : null}

        {field === 'meal_preference' ? (
          <PickMenu
            label="Meal"
            value={value || null}
            options={MEAL_CHOICES.map((m) => ({ key: m, label: MEAL_LABEL[m] }))}
            onPick={setValue}
            buttonText={value ? undefined : 'Pick the meal'}
          />
        ) : field ? (
          <TypedRow
            key={field}
            name={`New ${fieldLabel(field).toLowerCase()}`}
            value={value}
            maxLength={200}
            inputMode={field === 'crew_size' ? 'numeric' : field === 'mobile' || field === 'contact_phone' ? 'tel' : field.includes('email') ? 'email' : 'text'}
            empty="Leave empty to clear it"
            onKeep={(t) => setValue(t)}
            data="propose-value"
          />
        ) : null}

        {op === 'seat_move' ? (
          <PickMenu
            label="Which table"
            value={table}
            options={[...tables.map((t) => ({ key: t.id, label: t.name })), { key: NO_TABLE, label: 'No table (take the seat away)' }]}
            onPick={setTable}
            buttonText={table ? undefined : 'Pick the table'}
            dataAttr="data-propose-change-table"
          />
        ) : null}

        <TypedRow name="Why" value={note} maxLength={240} empty="Optional" onKeep={(t) => setNote(t)} data="propose-note" />

        {error ? (
          <p role="alert" className="rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-40"
        >
          {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
          Send to the host
        </button>
      </div>

      {shown.length > 0 ? (
        <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-3" data-propose-change-mine="">
          {shown.map((m) => (
            <li key={m.changeId} className="text-sm">
              <span className="text-ink/80">{m.summary}</span>{' '}
              <span className={m.status === 'open' ? 'text-ink/50' : m.status === 'accepted' ? 'text-success-700' : 'text-ink/50'}>
                · {changeStatusWords(m.status)}
              </span>
              {m.answerNote ? <span className="block text-xs text-ink/55">“{m.answerNote}”</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
