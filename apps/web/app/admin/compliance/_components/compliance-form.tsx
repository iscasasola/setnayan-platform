'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ShieldAlert,
  Plus,
  Trash2,
  FileDown,
  Save,
} from 'lucide-react';
import {
  saveComplianceFacts,
  type ComplianceFactsInput,
  type SubProcessor,
} from '../actions';
import { useSaveLoader } from '@/components/sd-loader';

// Admin Compliance editor — every RA 10173 / NPC field bound to a controlled
// input, including the SENSITIVE identifiers (BIR TIN, registered address, DPO
// phone) that are entered here and saved straight to the DB. On submit it calls
// the saveComplianceFacts server action inside useTransition and surfaces a
// saved / error banner.

/** Server → client seed. All strings pre-stringified (NULL → '') for the inputs. */
export type ComplianceFormState = ComplianceFactsInput;

const emptySubProcessor: SubProcessor = {
  name: '',
  role: '',
  jurisdiction: '',
  personal_data: false,
  dpa_on_file: false,
};

const LABEL =
  'font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55';
const INPUT =
  'mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-terracotta/50';
const TEXTAREA = `${INPUT} min-h-[76px] resize-y`;

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink/45">{hint}</span> : null}
    </label>
  );
}

export function ComplianceForm({ initial }: { initial: ComplianceFormState }) {
  const [form, setForm] = useState<ComplianceFormState>(initial);
  const [subs, setSubs] = useState<SubProcessor[]>(initial.sub_processors);
  const [pending, startTransition] = useTransition();
  const save = useSaveLoader();
  const [result, setResult] = useState<
    { ok: true } | { ok: false; error: string } | null
  >(null);

  function set<K extends keyof ComplianceFormState>(
    key: K,
    value: ComplianceFormState[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
  }

  function setSub(idx: number, patch: Partial<SubProcessor>) {
    setSubs((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setResult(null);
  }

  function addSub() {
    setSubs((rows) => [...rows, { ...emptySubProcessor }]);
  }

  function removeSub(idx: number) {
    setSubs((rows) => rows.filter((_, i) => i !== idx));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await save.run(
        () => saveComplianceFacts({ ...form, sub_processors: subs }),
        { steps: ['Saving compliance facts'], hint: 'Saving' },
      );
      setResult(res);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Sensitive-data notice */}
      <p className="inline-flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs text-amber-900/90">
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>
          These fields include sensitive identifiers (BIR&nbsp;TIN, registered
          office address, DPO phone). They are stored only in the database
          behind admin-only access — never in the codebase. Fill them once here
          and they feed the NPC registration data sheet.
        </span>
      </p>

      {/* Business / PIC */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Business — Personal Information Controller
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Legal name">
            <input
              className={INPUT}
              value={form.legal_name}
              onChange={(e) => set('legal_name', e.target.value)}
            />
          </Field>
          <Field label="Proprietor / owner">
            <input
              className={INPUT}
              value={form.proprietor}
              onChange={(e) => set('proprietor', e.target.value)}
            />
          </Field>
          <Field label="DTI Business Name no.">
            <input
              className={INPUT}
              value={form.dti_bn}
              onChange={(e) => set('dti_bn', e.target.value)}
            />
          </Field>
          <Field label="NPC registration no.">
            <input
              className={INPUT}
              value={form.npc_registration_no}
              onChange={(e) => set('npc_registration_no', e.target.value)}
            />
          </Field>
          <Field label="BIR TIN (sensitive)" hint="Stored in the database only.">
            <input
              className={INPUT}
              autoComplete="off"
              value={form.bir_tin}
              onChange={(e) => set('bir_tin', e.target.value)}
            />
          </Field>
          <Field
            label="Registered office address (sensitive)"
            hint="Stored in the database only."
          >
            <textarea
              className={TEXTAREA}
              autoComplete="off"
              value={form.registered_address}
              onChange={(e) => set('registered_address', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* DPO */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Data Protection Officer
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="DPO name">
            <input
              className={INPUT}
              value={form.dpo_name}
              onChange={(e) => set('dpo_name', e.target.value)}
            />
          </Field>
          <Field label="DPO title / position">
            <input
              className={INPUT}
              value={form.dpo_title}
              onChange={(e) => set('dpo_title', e.target.value)}
            />
          </Field>
          <Field label="DPO email">
            <input
              type="email"
              className={INPUT}
              value={form.dpo_email}
              onChange={(e) => set('dpo_email', e.target.value)}
            />
          </Field>
          <Field label="DPO phone (sensitive)" hint="Stored in the database only.">
            <input
              className={INPUT}
              autoComplete="off"
              value={form.dpo_phone}
              onChange={(e) => set('dpo_phone', e.target.value)}
            />
          </Field>
          <Field label="DPO employment basis">
            <input
              className={INPUT}
              value={form.dpo_employment_basis}
              onChange={(e) => set('dpo_employment_basis', e.target.value)}
            />
          </Field>
          <Field label="DPO designation date">
            <input
              type="date"
              className={INPUT}
              value={form.dpo_designation_date}
              onChange={(e) => set('dpo_designation_date', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Team / scale */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-lg font-semibold tracking-tight">Team &amp; scale</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Headcount">
            <input
              type="number"
              min={0}
              className={INPUT}
              value={form.headcount}
              onChange={(e) => set('headcount', e.target.value)}
            />
          </Field>
          <Field label="Staff with data access">
            <input
              type="number"
              min={0}
              className={INPUT}
              value={form.staff_with_data_access}
              onChange={(e) => set('staff_with_data_access', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Breach response */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-lg font-semibold tracking-tight">Breach response</h2>
        <Field label="Breach response team">
          <textarea
            className={TEXTAREA}
            value={form.breach_team}
            onChange={(e) => set('breach_team', e.target.value)}
          />
        </Field>
        <Field
          label="Breach contacts"
          hint="Escalation contacts / hotline for severity-high incidents."
        >
          <textarea
            className={TEXTAREA}
            value={form.breach_contacts}
            onChange={(e) => set('breach_contacts', e.target.value)}
          />
        </Field>
      </section>

      {/* Sub-processors */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Sub-processors</h2>
          <button
            type="button"
            onClick={addSub}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-terracotta/50"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add row
          </button>
        </div>
        {subs.length === 0 ? (
          <p className="text-sm text-ink/45">No sub-processors yet.</p>
        ) : (
          <div className="space-y-3">
            {subs.map((sp, idx) => (
              <div
                key={idx}
                className="space-y-3 rounded-xl border border-ink/10 bg-white p-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Name">
                    <input
                      className={INPUT}
                      value={sp.name}
                      onChange={(e) => setSub(idx, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Role">
                    <input
                      className={INPUT}
                      value={sp.role}
                      onChange={(e) => setSub(idx, { role: e.target.value })}
                    />
                  </Field>
                  <Field label="Jurisdiction">
                    <input
                      className={INPUT}
                      value={sp.jurisdiction}
                      onChange={(e) =>
                        setSub(idx, { jurisdiction: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <label className="inline-flex items-center gap-2 text-sm text-ink/75">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink/30"
                      checked={sp.personal_data}
                      onChange={(e) =>
                        setSub(idx, { personal_data: e.target.checked })
                      }
                    />
                    Processes personal data
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-ink/75">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-ink/30"
                      checked={sp.dpa_on_file}
                      onChange={(e) =>
                        setSub(idx, { dpa_on_file: e.target.checked })
                      }
                    />
                    DPA on file
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSub(idx)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:border-rose-300 hover:text-rose-700"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Processing declarations */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Processing declarations
        </h2>
        <Field label="Sensitive RSVP fields">
          <textarea
            className={TEXTAREA}
            value={form.sensitive_rsvp_fields}
            onChange={(e) => set('sensitive_rsvp_fields', e.target.value)}
          />
        </Field>
        <Field label="Automated decisions">
          <textarea
            className={TEXTAREA}
            value={form.automated_decisions}
            onChange={(e) => set('automated_decisions', e.target.value)}
          />
        </Field>
        <Field label="Maya / payment gateway status">
          <textarea
            className={TEXTAREA}
            value={form.maya_status}
            onChange={(e) => set('maya_status', e.target.value)}
          />
        </Field>
        <Field label="Staff data-access controls">
          <textarea
            className={TEXTAREA}
            value={form.staff_controls}
            onChange={(e) => set('staff_controls', e.target.value)}
          />
        </Field>
        <Field label="DPIA adoption dates">
          <textarea
            className={TEXTAREA}
            value={form.dpia_adoption_dates}
            onChange={(e) => set('dpia_adoption_dates', e.target.value)}
          />
        </Field>
      </section>

      {/* Save + result */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600 disabled:cursor-wait disabled:opacity-70"
        >
          <Save aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {pending ? 'Saving…' : 'Save compliance facts'}
        </button>
        <Link
          href="/admin/compliance/data-sheet"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/50"
        >
          <FileDown aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Export NPC data sheet
        </Link>
        {result?.ok ? (
          <span
            role="status"
            className="inline-flex items-center gap-2 text-sm text-emerald-800"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Saved.
          </span>
        ) : result && !result.ok ? (
          <span
            role="alert"
            className="inline-flex items-center gap-2 text-sm text-rose-800"
          >
            <ShieldAlert aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {result.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
