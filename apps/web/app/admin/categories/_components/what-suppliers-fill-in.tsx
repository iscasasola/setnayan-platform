'use client';

/**
 * what-suppliers-fill-in.tsx — the "What suppliers fill in" section of a
 * service panel: the fields a supplier answers for this service
 * (`canonical_service_schemas.category_specific_attributes`).
 *
 * Moved 2026-10-02 out of the Taxonomy Studio's Services tab, unchanged in
 * what it can do: add a field (Yes/no · Number · Short text · Long text ·
 * Pick one · Pick many · Tags), rename its label, retire / restore it, add an
 * option, retire / restore an option. Keys and option values are permanent
 * (a supplier's saved answer must never break); every change bumps the schema
 * version. The shared groups (faith · dietary · pricing) show read-only.
 *
 * 💾 IN PLACE (owner 2026-10-29, panels approved): a field's name saves when the admin leaves it; Retire / Restore
 * and an option's ✕ answer at once; nothing loads the page (`FormInPlace`, the shipped actions behind it).
 */
import { useState } from 'react';
import { Archive, Lock, Plus, Undo2, X } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { SupplierField } from './model';
import { FormInPlace, INPUT_IN_PLACE } from './drawer-kit';

type ServiceRef = {
  canonical: string;
  en: string;
  schemaVersion: number;
  sharedGroups: readonly string[];
  fields: readonly SupplierField[];
};

export function WhatSuppliersFillIn({ service }: { service: ServiceRef }) {
  return (
    <div className="space-y-3" data-what-suppliers-fill-in="">
      {service.fields.length === 0 ? (
        <p className="text-sm text-ink/70">No fields yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {service.fields.map((f) => (
            <LeafFieldCard key={f.key} service={service} field={f} />
          ))}
        </ul>
      )}
      {service.sharedGroups.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink/70">
          <Lock className="h-3 w-3" aria-hidden />
          Shared with every service: {service.sharedGroups.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ')}
        </p>
      ) : null}
      <AddFieldForm service={service} />
    </div>
  );
}

/** Human labels for the vendor-form-supported field types. Mirrors AttributeFieldDef. */
const LEAF_FIELD_TYPE_LABELS: Record<string, string> = {
  boolean: 'Yes / no',
  int: 'Number',
  text_short: 'Short text',
  text_long: 'Long text',
  enum: 'Pick one',
  multi_select: 'Pick many',
  multi_select_open: 'Tags (free)',
};

/** The types the admin can mint here + whether they carry a fixed option list. */
const LEAF_TYPE_CHOICES: { value: string; hasOptions: boolean }[] = [
  { value: 'boolean', hasOptions: false },
  { value: 'int', hasOptions: false },
  { value: 'text_short', hasOptions: false },
  { value: 'text_long', hasOptions: false },
  { value: 'enum', hasOptions: true },
  { value: 'multi_select', hasOptions: true },
  { value: 'multi_select_open', hasOptions: false },
];

const OPTION_BEARING = new Set(['enum', 'multi_select']);

/** Underscores → spaces, matching the supplier form's option/label display. */
function humanize(s: string): string {
  return s.replaceAll('_', ' ');
}

function LeafFieldCard({ service, field }: { service: ServiceRef; field: SupplierField }) {
  const [addingOption, setAddingOption] = useState(false);
  const hasOptions = OPTION_BEARING.has(field.type);
  const live = field.options.filter((o) => !o.retired).map((o) => humanize(o.value));

  return (
    <li className={`py-2 ${field.retired ? 'opacity-70' : ''}`} data-supplier-field={field.key}>
      <div className="flex items-start gap-2">
        <FormInPlace kind="field-relabel" what="Field name" autosave className="min-w-0 flex-1">
          <ServiceBack service={service} />
          <input type="hidden" name="field_key" value={field.key} />
          <input
            name="field_label"
            defaultValue={field.label}
            required
            minLength={2}
            maxLength={80}
            className={`${INPUT_IN_PLACE} !min-h-10`}
            aria-label={`Name of the field ${field.key}`}
          />
          <p className="mt-1 text-xs text-ink/70">
            {LEAF_FIELD_TYPE_LABELS[field.type] ?? field.type}
            {live.length ? ` · ${live.join(', ')}` : ''}
            {field.retired ? ' · retired' : ''}
          </p>
        </FormInPlace>

        {/* Retire / restore the whole field */}
        <FormInPlace kind="field-retire" what={field.retired ? 'Restored' : 'Retired'} said={field.retired ? `Restored — ${field.label}` : `Retired — ${field.label}`} className="shrink-0">
          <ServiceBack service={service} />
          <input type="hidden" name="field_key" value={field.key} />
          <input type="hidden" name="retired" value={field.retired ? 'false' : 'true'} />
          <button
            type="submit"
            className="sn-press inline-flex min-h-10 items-center gap-1 rounded-full border border-dashed border-ink/20 px-3 text-[13px] font-medium text-ink/70"
          >
            {field.retired ? <Undo2 className="h-3.5 w-3.5" aria-hidden /> : <Archive className="h-3.5 w-3.5" aria-hidden />}
            {field.retired ? 'Restore' : 'Retire'}
          </button>
        </FormInPlace>
      </div>

      {/* Options (enum / multi_select) */}
      {hasOptions ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {field.options.length === 0 ? <span className="text-xs text-ink/70">No options.</span> : null}
          {field.options.map((opt) => (
            <span
              key={opt.value}
              className={`inline-flex min-h-9 items-center gap-1 rounded-full border pl-3 text-[13px] ${
                opt.retired ? 'border-ink/10 text-ink/45 line-through' : 'border-ink/15 bg-raised text-ink'
              }`}
            >
              <span>{humanize(opt.value)}</span>
              <FormInPlace kind="field-option-retire" what="Option" said={opt.retired ? `Restored — ${humanize(opt.value)}` : `Retired — ${humanize(opt.value)}`} className="inline-flex">
                <ServiceBack service={service} />
                <input type="hidden" name="field_key" value={field.key} />
                <input type="hidden" name="option" value={opt.value} />
                <input type="hidden" name="retired" value={opt.retired ? 'false' : 'true'} />
                <button
                  type="submit"
                  className="sn-press sn-hit grid h-8 w-8 place-items-center rounded-full text-ink/60"
                  aria-label={opt.retired ? `Restore option ${opt.value}` : `Retire option ${opt.value}`}
                  title={opt.retired ? 'Restore option' : 'Retire option (kept for saved answers)'}
                >
                  {opt.retired ? <Undo2 className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                </button>
              </FormInPlace>
            </span>
          ))}
          {addingOption ? (
            <FormInPlace kind="field-option-add" what="Option" said="Added — option" onSaved={() => setAddingOption(false)} className="inline-flex items-center gap-1">
              <ServiceBack service={service} />
              <input type="hidden" name="field_key" value={field.key} />
              <input
                name="option_label"
                autoFocus
                required
                maxLength={80}
                placeholder="New option — Enter adds"
                className={`${INPUT_IN_PLACE} !min-h-9 !w-44`}
                aria-label={`New option for ${field.key}`}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setAddingOption(false);
                }}
              />
            </FormInPlace>
          ) : (
            <button
              type="button"
              onClick={() => setAddingOption(true)}
              className="sn-press inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-ink/25 px-3 text-[13px] text-ink/70"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add an option
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** The hidden fields every field form needs: which service. */
function ServiceBack({ service }: { service: ServiceRef }) {
  return <input type="hidden" name="canonical_service" value={service.canonical} />;
}

function AddFieldForm({ service }: { service: ServiceRef }) {
  const [type, setType] = useState('multi_select');
  const [n, setN] = useState(0);
  const needsOptions = OPTION_BEARING.has(type);
  return (
    <FormInPlace key={n} kind="field-add" what="Field" said="Added — field" onSaved={() => setN((x) => x + 1)} className="flex flex-col gap-2" data="add-field">
      <ServiceBack service={service} />
      <input type="hidden" name="field_type" value={type} />
      <input
        name="field_label"
        required
        minLength={2}
        maxLength={80}
        placeholder="Add a field — e.g. Shooting style"
        aria-label="New field name"
        className={INPUT_IN_PLACE}
      />
      <div className="flex flex-wrap items-center gap-2">
        <PickMenu
          label="Field type"
          value={type}
          options={LEAF_TYPE_CHOICES.map((c) => ({ key: c.value, label: LEAF_FIELD_TYPE_LABELS[c.value] ?? c.value }))}
          onPick={setType}
          compact
          className="border border-ink/15"
        />
        {needsOptions ? (
          <input
            name="field_options"
            required
            placeholder="Options, comma-separated"
            aria-label="Options, comma-separated"
            className={`${INPUT_IN_PLACE} !w-auto flex-1`}
          />
        ) : (
          <input type="hidden" name="field_options" value="" />
        )}
        <button type="submit" className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/20 px-4 text-sm font-semibold text-ink">
          <Plus className="h-4 w-4" aria-hidden /> Add
        </button>
      </div>
    </FormInPlace>
  );
}
