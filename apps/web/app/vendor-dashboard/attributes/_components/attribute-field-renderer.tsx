'use client';

import { useState } from 'react';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';

/**
 * Iteration 0044 — dynamic per-field input renderer for the vendor
 * attribute form. Handles all 7 field types from AttributeFieldDef:
 *
 *   boolean            → checkbox
 *   int                → number input (respects min / max)
 *   text_short         → text input
 *   text_long          → textarea
 *   enum               → select dropdown (radio-like one-of-many)
 *   multi_select       → chip-style checkbox group (fixed options list)
 *   multi_select_open  → tag input (freeform additions + initial values)
 *
 * The input `name` is `field__${fieldKey}` so the server action's
 * formData.getAll(`field__${key}`) matches reliably. Initial values come
 * from `vendor_service_attributes.attribute_payload[fieldKey]` cast loose;
 * each renderer normalizes its own input. Required is enforced via the
 * HTML `required` attribute on top of the server-side check.
 */

const FIELD_NAME_PREFIX = 'field__';

function formatLabel(field: AttributeFieldDef, fallback: string): string {
  return field.label ?? fallback.replaceAll('_', ' ');
}

function formatOption(value: string): string {
  return value.replaceAll('_', ' ');
}

export function AttributeFieldRenderer({
  fieldKey,
  def,
  initial,
  isFacet,
}: {
  fieldKey: string;
  def: AttributeFieldDef;
  initial: unknown;
  /** True when this field is in the canonical_service's filter_facets array — we surface a small "marketplace filter" hint. */
  isFacet: boolean;
}) {
  const inputName = `${FIELD_NAME_PREFIX}${fieldKey}`;
  const label = formatLabel(def, fieldKey);
  const hint = (
    <span className="ml-2 inline-flex items-center gap-1">
      {def.required ? (
        <span className="font-mono text-[9px] uppercase tracking-wider text-terracotta">required</span>
      ) : null}
      {isFacet ? (
        <span className="font-mono text-[9px] uppercase tracking-wider text-ink/50">filter</span>
      ) : null}
      {def.required_if ? (
        <span className="font-mono text-[9px] text-ink/45">
          required if {def.required_if.replaceAll('_', ' ')}
        </span>
      ) : null}
    </span>
  );

  if (def.type === 'boolean') {
    const checked = initial === true;
    return (
      <label className="flex items-start gap-3 rounded-lg border border-ink/10 bg-cream px-3 py-2.5">
        <input
          type="checkbox"
          name={inputName}
          defaultChecked={checked}
          className="mt-0.5 h-4 w-4 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
        />
        <span className="text-sm text-ink/80">
          {label}
          {hint}
        </span>
      </label>
    );
  }

  if (def.type === 'int') {
    const value = typeof initial === 'number' ? initial : '';
    return (
      <div className="space-y-1">
        <label htmlFor={inputName} className="block text-sm font-medium text-ink/80">
          {label}
          {hint}
        </label>
        <input
          id={inputName}
          name={inputName}
          type="number"
          defaultValue={value}
          min={def.min}
          max={def.max}
          required={def.required}
          className="input-field w-full max-w-xs"
        />
        {def.min !== undefined ? (
          <p className="font-mono text-[10px] text-ink/45">minimum {def.min}</p>
        ) : null}
      </div>
    );
  }

  if (def.type === 'text_short') {
    const value = typeof initial === 'string' ? initial : '';
    return (
      <div className="space-y-1">
        <label htmlFor={inputName} className="block text-sm font-medium text-ink/80">
          {label}
          {hint}
        </label>
        <input
          id={inputName}
          name={inputName}
          type="text"
          maxLength={256}
          defaultValue={value}
          required={def.required}
          className="input-field w-full"
        />
      </div>
    );
  }

  if (def.type === 'text_long') {
    const value = typeof initial === 'string' ? initial : '';
    return (
      <div className="space-y-1">
        <label htmlFor={inputName} className="block text-sm font-medium text-ink/80">
          {label}
          {hint}
        </label>
        <textarea
          id={inputName}
          name={inputName}
          maxLength={2000}
          defaultValue={value}
          required={def.required}
          rows={4}
          className="input-field w-full"
        />
      </div>
    );
  }

  if (def.type === 'enum') {
    const options = def.options ?? [];
    const value = typeof initial === 'string' ? initial : '';
    return (
      <div className="space-y-1">
        <label htmlFor={inputName} className="block text-sm font-medium text-ink/80">
          {label}
          {hint}
        </label>
        <select
          id={inputName}
          name={inputName}
          defaultValue={value}
          required={def.required}
          className="input-field w-full max-w-md"
        >
          <option value="">— pick one —</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {formatOption(opt)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (def.type === 'multi_select') {
    const options = def.options ?? [];
    const initialArr = Array.isArray(initial) ? (initial as string[]) : [];
    return (
      <fieldset className="space-y-2">
        <legend className="block text-sm font-medium text-ink/80">
          {label}
          {hint}
        </legend>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const checked = initialArr.includes(opt);
            return (
              <label
                key={opt}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700 hover:border-ink/30"
              >
                <input
                  type="checkbox"
                  name={inputName}
                  value={opt}
                  defaultChecked={checked}
                  className="h-3.5 w-3.5 rounded border-ink/25 text-terracotta focus:ring-terracotta/40"
                />
                <span>{formatOption(opt)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (def.type === 'multi_select_open') {
    return <MultiSelectOpen fieldKey={fieldKey} def={def} initial={initial} hint={hint} label={label} inputName={inputName} />;
  }

  // Fallback for unknown types — render the raw initial as readonly so the
  // vendor can copy it out, but don't bind a form input. This shouldn't
  // happen in production but defends against future field-type additions
  // that haven't yet shipped a renderer.
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-ink/55">
        {label}
        <span className="ml-2 font-mono text-[10px] text-terracotta">unsupported field type: {def.type}</span>
      </label>
      <pre className="overflow-auto rounded-md border border-ink/15 bg-ink/[0.04] p-2 text-[11px] text-ink/65">
        {JSON.stringify(initial ?? null)}
      </pre>
    </div>
  );
}

function MultiSelectOpen({
  fieldKey,
  def,
  initial,
  hint,
  label,
  inputName,
}: {
  fieldKey: string;
  def: AttributeFieldDef;
  initial: unknown;
  hint: React.ReactNode;
  label: string;
  inputName: string;
}) {
  const initialArr = Array.isArray(initial)
    ? (initial as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const [tags, setTags] = useState<string[]>(initialArr);
  const [draft, setDraft] = useState('');

  function addDraft() {
    const trimmed = draft.trim().slice(0, 80);
    if (trimmed.length === 0) return;
    if (tags.includes(trimmed)) {
      setDraft('');
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`${inputName}__draft`} className="block text-sm font-medium text-ink/80">
        {label}
        {hint}
      </label>
      {/* Hidden inputs carry the current tag set to the server action. */}
      {tags.map((tag) => (
        <input key={`${fieldKey}-${tag}`} type="hidden" name={inputName} value={tag} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/10 px-3 py-1 text-xs text-terracotta-700"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
              className="text-terracotta hover:text-terracotta-800"
            >
              ×
            </button>
          </span>
        ))}
        <div className="flex items-center gap-2">
          <input
            id={`${inputName}__draft`}
            type="text"
            value={draft}
            maxLength={80}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addDraft();
              }
            }}
            placeholder="Type and press Enter…"
            className="input-field h-9 min-w-[180px]"
          />
          <button
            type="button"
            onClick={addDraft}
            className="button-secondary h-9 px-3 text-xs"
          >
            Add
          </button>
        </div>
      </div>
      <p className="font-mono text-[10px] text-ink/45">
        Press Enter or comma to add. Click × to remove.
      </p>
    </div>
  );
}
