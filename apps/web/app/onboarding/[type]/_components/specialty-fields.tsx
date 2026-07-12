'use client';

/**
 * SpecialtyFields — renders a type's rich "signature fields" from the specialty
 * catalog (lib/onboarding/specialty-catalog.ts) and collects the answers into one
 * value bag → persisted to events.signature_details (the Track-B capture layer).
 *
 * Supports the full field-type vocabulary the generic tile flow lacked: text ·
 * textarea · date · number · boolean · select · multiselect (fixed OR open set) ·
 * person_roster / list (repeatable rows — UNCAPPED, per the catalog's #1 cultural
 * rule: never hard-cap ninong/ninang / the 18s / the court). Pure controlled
 * component; every field optional (the whole screen is skippable upstream).
 */
import type { SpecialtyField, SpecialtyItemField } from '@/lib/onboarding/specialty-catalog';
import { isSpecialtyFieldVisible } from '@/lib/onboarding/specialty-values';

type Values = Record<string, unknown>;
type Row = Record<string, unknown>;

const INPUT =
  'w-full rounded-[var(--m-r-md)] border border-ink/15 bg-paper px-4 py-3 text-ink outline-none focus:border-mulberry';
const CHIP =
  'rounded-[var(--m-r-md)] border px-3 py-2 text-sm text-left transition';
const CHIP_ON = 'border-mulberry bg-mulberry/5 ring-1 ring-mulberry text-ink';
const CHIP_OFF = 'border-ink/12 bg-paper text-ink/80 hover:border-ink/30';

function asStr(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}
function asArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function asRows(v: unknown): Row[] {
  return Array.isArray(v) ? (v as Row[]) : [];
}

/** A single item-field inside a roster/list row (text/number/select/textarea). */
function ItemInput({
  field,
  value,
  onChange,
}: {
  field: SpecialtyItemField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const ph = field.help ?? field.key.replace(/_/g, ' ');
  if (field.type === 'select') {
    return (
      <select className={INPUT} value={asStr(value)} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        className={INPUT}
        rows={2}
        value={asStr(value)}
        placeholder={ph}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className={INPUT}
      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
      inputMode={field.type === 'number' ? 'numeric' : undefined}
      value={asStr(value)}
      placeholder={ph}
      onChange={(e) => onChange(field.type === 'number' ? e.target.value : e.target.value)}
    />
  );
}

/** A repeatable roster/list: uncapped add-as-many rows, each with item_fields. */
function Roster({
  field,
  rows,
  onChange,
}: {
  field: SpecialtyField;
  rows: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const items = field.item_fields ?? [];
  const setCell = (i: number, key: string, v: unknown) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)));
  const add = () => onChange([...rows, {}]);
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-[var(--m-r-md)] border border-ink/12 bg-paper/60 p-3">
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div key={it.key}>
                <span className="mb-1 block text-xs uppercase tracking-wide text-ink/45">
                  {it.key.replace(/_/g, ' ')}
                </span>
                <ItemInput field={it} value={row[it.key]} onChange={(v) => setCell(i, it.key, v)} />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="mt-2 text-sm text-ink/50 underline hover:text-mulberry"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start rounded-[var(--m-r-md)] border border-dashed border-ink/25 px-4 py-2 text-sm text-ink/70 hover:border-mulberry hover:text-mulberry"
      >
        + Add {rows.length > 0 ? 'another' : field.label.toLowerCase()}
      </button>
    </div>
  );
}

function OpenMultiselect({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const add = (raw: string) => {
    const v = raw.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
  };
  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className={`${CHIP} ${CHIP_ON}`}
            >
              {v} ✕
            </button>
          ))}
        </div>
      )}
      <input
        className={INPUT}
        placeholder="Type and press Enter to add…"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: SpecialtyField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'textarea':
      return (
        <textarea className={INPUT} rows={3} value={asStr(value)} placeholder={field.help} onChange={(e) => onChange(e.target.value)} />
      );
    case 'date':
      return <input className={INPUT} type="date" value={asStr(value)} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input className={INPUT} type="number" inputMode="numeric" value={asStr(value)} placeholder={field.help} onChange={(e) => onChange(e.target.value)} />
      );
    case 'boolean':
      return (
        <div className="flex gap-2">
          {[
            ['Yes', true],
            ['No', false],
          ].map(([lbl, v]) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => onChange(v)}
              className={`${CHIP} ${value === v ? CHIP_ON : CHIP_OFF}`}
            >
              {lbl as string}
            </button>
          ))}
        </div>
      );
    case 'select':
      return (
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onChange(asStr(value) === o ? '' : o)}
              className={`${CHIP} ${asStr(value) === o ? CHIP_ON : CHIP_OFF}`}
            >
              {o}
            </button>
          ))}
        </div>
      );
    case 'multiselect': {
      const vals = asArr(value);
      if (!field.options || field.options.length === 0) {
        return <OpenMultiselect values={vals} onChange={onChange} />;
      }
      return (
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const on = vals.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? vals.filter((x) => x !== o) : [...vals, o])}
                className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    case 'person_roster':
    case 'list':
      return <Roster field={field} rows={asRows(value)} onChange={onChange} />;
    case 'text':
    default:
      return <input className={INPUT} type="text" value={asStr(value)} placeholder={field.help} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function SpecialtyFields({
  fields,
  value,
  onChange,
  prefilledKeys,
}: {
  fields: readonly SpecialtyField[];
  value: Values;
  onChange: (next: Values) => void;
  /**
   * Field keys pre-answered from the user's profile (onboarding_v2_brief). They
   * render with a "From your profile" badge and a seeded value — still fully
   * editable, we just don't ask cold for what we already know.
   */
  prefilledKeys?: readonly string[];
}) {
  const prefilled = new Set(prefilledKeys ?? []);
  return (
    <div className="mt-6 flex flex-col gap-6">
      {fields.filter((f) => isSpecialtyFieldVisible(f, value)).map((f) => (
        <div key={f.key}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="block text-[15px] font-semibold text-ink">{f.label}</label>
            {prefilled.has(f.key) && (
              <span className="rounded-full border border-mulberry/30 bg-mulberry/5 px-2 py-0.5 text-[11px] font-medium text-mulberry">
                From your profile
              </span>
            )}
          </div>
          {f.help && f.type !== 'text' && f.type !== 'textarea' && f.type !== 'number' && (
            <p className="mt-0.5 text-sm text-ink/55">{f.help}</p>
          )}
          <div className="mt-2">
            <Field field={f} value={value[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })} />
          </div>
        </div>
      ))}
    </div>
  );
}
