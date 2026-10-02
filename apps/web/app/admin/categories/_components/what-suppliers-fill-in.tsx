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
 */
import { useState } from 'react';
import { Archive, Lock, Pencil, Plus, Undo2, X } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  addLeafAttributeFieldAction,
  addLeafAttributeOptionAction,
  relabelLeafAttributeFieldAction,
  retireLeafAttributeFieldAction,
  retireLeafAttributeOptionAction,
} from '../actions';
import type { SupplierField } from './model';

type ServiceRef = {
  canonical: string;
  en: string;
  schemaVersion: number;
  sharedGroups: readonly string[];
  fields: readonly SupplierField[];
};

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {children}
    </span>
  );
}

export function WhatSuppliersFillIn({ service }: { service: ServiceRef }) {
  return (
    <div className="space-y-3" data-what-suppliers-fill-in="">
      {service.fields.length === 0 ? (
        <p className="text-sm text-ink/70">No fields yet.</p>
      ) : (
        <ul className="space-y-2">
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
  const [renaming, setRenaming] = useState(false);
  const [addingOption, setAddingOption] = useState(false);
  const hasOptions = OPTION_BEARING.has(field.type);

  return (
    <li
      className={`rounded-md border p-2 ${
        field.retired ? 'border-ink/10 bg-ink/[0.02] opacity-70' : 'border-ink/15 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {renaming ? (
              <form action={relabelLeafAttributeFieldAction} className="flex items-center gap-1">
                <ServiceBack service={service} />
                <input type="hidden" name="field_key" value={field.key} />
                <input
                  name="field_label"
                  defaultValue={field.label}
                  autoFocus
                  required
                  minLength={2}
                  maxLength={80}
                  className="rounded border border-ink/20 bg-white px-1.5 py-0.5 text-xs"
                  aria-label={`Rename ${field.key}`}
                />
                <SubmitButton
                  className="rounded border border-ink/15 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink/70 hover:border-terracotta/50 hover:text-mulberry"
                  pendingLabel="…"
                >
                  Save
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  className="rounded p-0.5 text-ink/45 hover:bg-black/5"
                  aria-label="Cancel rename"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </form>
            ) : (
              <>
                <span className="text-xs font-medium text-ink">{field.label}</span>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="rounded p-0.5 text-ink/35 hover:bg-black/5 hover:text-ink/60"
                  aria-label={`Rename ${field.label}`}
                  title="Rename (label only — key is permanent)"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                </button>
              </>
            )}
            {field.retired ? <Badge tone="bg-ink/5 text-ink/45">retired</Badge> : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-ink/40">{field.key}</span>
            <Badge tone="bg-ink/5 text-ink/55">{LEAF_FIELD_TYPE_LABELS[field.type] ?? field.type}</Badge>
          </div>
        </div>

        {/* Retire / restore the whole field */}
        <form action={retireLeafAttributeFieldAction} className="shrink-0">
          <ServiceBack service={service} />
          <input type="hidden" name="field_key" value={field.key} />
          <input type="hidden" name="retired" value={field.retired ? 'false' : 'true'} />
          <SubmitButton
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${
              field.retired
                ? 'border-success-200 bg-white text-success-700 hover:bg-success-50'
                : 'border-ink/15 bg-white text-ink/55 hover:border-ink/40'
            }`}
            pendingLabel="…"
          >
            {field.retired ? (
              <>
                <Undo2 className="h-3 w-3" aria-hidden /> Restore
              </>
            ) : (
              <>
                <Archive className="h-3 w-3" aria-hidden /> Retire
              </>
            )}
          </SubmitButton>
        </form>
      </div>

      {/* Options (enum / multi_select) */}
      {hasOptions ? (
        <div className="mt-2 border-t border-ink/10 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {field.options.length === 0 ? (
              <span className="text-[10px] text-ink/45">No options.</span>
            ) : (
              field.options.map((opt) => (
                <span
                  key={opt.value}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                    opt.retired
                      ? 'border-ink/10 bg-ink/[0.02] text-ink/40 line-through'
                      : 'border-ink/15 bg-cream text-ink/70'
                  }`}
                >
                  <span>{humanize(opt.value)}</span>
                  <form action={retireLeafAttributeOptionAction} className="inline-flex">
                    <ServiceBack service={service} />
                    <input type="hidden" name="field_key" value={field.key} />
                    <input type="hidden" name="option" value={opt.value} />
                    <input type="hidden" name="retired" value={opt.retired ? 'false' : 'true'} />
                    <button
                      type="submit"
                      className="rounded p-0.5 text-ink/40 hover:bg-black/10"
                      aria-label={opt.retired ? `Restore option ${opt.value}` : `Retire option ${opt.value}`}
                      title={opt.retired ? 'Restore option' : 'Retire option (kept for saved answers)'}
                    >
                      {opt.retired ? <Undo2 className="h-2.5 w-2.5" aria-hidden /> : <X className="h-2.5 w-2.5" aria-hidden />}
                    </button>
                  </form>
                </span>
              ))
            )}
            {addingOption ? (
              <form action={addLeafAttributeOptionAction} className="inline-flex items-center gap-1">
                <ServiceBack service={service} />
                <input type="hidden" name="field_key" value={field.key} />
                <input
                  name="option_label"
                  autoFocus
                  required
                  maxLength={80}
                  placeholder="New option"
                  className="w-28 rounded border border-ink/20 bg-white px-1.5 py-0.5 text-[10px]"
                  aria-label={`New option for ${field.key}`}
                />
                <SubmitButton
                  className="rounded border border-success-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-success-700 hover:bg-success-50"
                  pendingLabel="…"
                >
                  Add
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setAddingOption(false)}
                  className="rounded p-0.5 text-ink/45 hover:bg-black/5"
                  aria-label="Cancel add option"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingOption(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 bg-white px-2 py-0.5 text-[10px] text-ink/55 hover:border-terracotta/50 hover:text-mulberry"
              >
                <Plus className="h-2.5 w-2.5" aria-hidden /> Option
              </button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** The hidden fields every field form needs: which service, and where to land. */
function ServiceBack({ service }: { service: ServiceRef }) {
  return (
    <>
      <input type="hidden" name="canonical_service" value={service.canonical} />
      <input type="hidden" name="_list" value="categories" />
      <input type="hidden" name="_open" value={`s:${service.canonical}`} />
    </>
  );
}

function AddFieldForm({ service }: { service: ServiceRef }) {
  const [type, setType] = useState('multi_select');
  const needsOptions = OPTION_BEARING.has(type);
  return (
    <form action={addLeafAttributeFieldAction} className="flex flex-wrap items-center gap-2" data-add-field="">
      <ServiceBack service={service} />
      <input type="hidden" name="field_type" value={type} />
      <input
        name="field_label"
        required
        minLength={2}
        maxLength={80}
        placeholder="+ Add a field — e.g. Shooting style"
        aria-label="New field name"
        className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-sm"
      />
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
          className="min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-sm"
        />
      ) : (
        <input type="hidden" name="field_options" value="" />
      )}
      <SubmitButton
        className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream"
        pendingLabel="Adding…"
      >
        Add
      </SubmitButton>
    </form>
  );
}
