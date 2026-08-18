import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DATA_SUBJECT_REGISTER,
  DATA_SUBJECT_REGISTER_ORDER,
} from '@/lib/data-subject-register';
import type { SubProcessor } from '../actions';
import { ErrorState } from '@/app/_components/states/error-state';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
// Admin Compliance — NPC data-sheet export view.
//
// A read-only, print-friendly rendering of the stored compliance facts laid out
// as the NPC registration fields (mirroring NPC_Compliance/03_DPO_Designation_
// and_NPC_Registration_Sheet). The owner can copy/print this to file with the
// NPC. Live scale counts are pulled server-side to fill the "scale of
// processing" section. Everything is server-rendered — no client JS needed.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NPC data sheet HQ' };

const NF = new Intl.NumberFormat('en-PH');
const TBD = '[TO CONFIRM]';

function val(v: unknown): string {
  if (v == null) return TBD;
  if (typeof v === 'number') return NF.format(v);
  const s = String(v).trim();
  return s.length ? s : TBD;
}

function Row({ field, value }: { field: string; value: unknown }) {
  const display = val(value);
  const missing = display === TBD;
  return (
    <tr className="border-b border-ink/10 last:border-0 align-top">
      <th
        scope="row"
        className="w-1/3 py-2 pr-4 text-left text-sm font-medium text-ink/70"
      >
        {field}
      </th>
      <td
        className={`py-2 text-sm ${missing ? 'italic text-ink/40' : 'text-ink/90'} whitespace-pre-wrap`}
      >
        {display}
      </td>
    </tr>
  );
}

/**
 * ⛔ THIS TABLE IS NOT OWED A CONVERSION, AND THE BILL LINE THAT REMAINS ON THIS
 * FILE IS THIS COMPONENT — deliberately, not as unfinished work.
 *
 * It is a FIELD SHEET, not a records list: `<th scope="row">` label + value
 * pairs, rendered five times down a document the owner prints and files with the
 * NPC. ConsoleTable is a columns-with-headers records component, so wearing it
 * here would add a visible "Field | Value" header row to a filed document and
 * drop the row-header semantics a screen reader uses to announce each field.
 *
 * Same reasoning as `ugat-console.tsx`: the shape is present, the conversion is
 * not what is wanted. The file's other two tables — categories of data subjects,
 * and sub-processors — ARE records lists and DID convert.
 */
function FieldTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="sn-tile overflow-x-auto !p-0">
      <table className="w-full border-collapse px-4">
        <tbody className="[&_th]:pl-4 [&_td]:pr-4">{children}</tbody>
      </table>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <FieldTable>{children}</FieldTable>
    </section>
  );
}

export default async function ComplianceDataSheetPage() {
  await requireAdmin();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    notFound();
  }

  const admin = createAdminClient();

  const countOf = async (table: string): Promise<number | null> => {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true });
    return error ? null : (count ?? 0);
  };

  const activeFaceCount = async (): Promise<number | null> => {
    const { count, error } = await admin
      .from('guest_face_enrollments') // chat-guard-allow: count-only NPC tally (count:exact, head:true) — returns a number, reads zero face vectors
      .select('*', { count: 'exact', head: true })
      .is('revoked_at', null);
    return error ? null : (count ?? 0);
  };

  const [factsRes, users, guests, faces] = await Promise.all([
    admin.from('platform_compliance_facts').select('*').eq('id', 1).maybeSingle(),
    countOf('users'),
    countOf('guests'),
    activeFaceCount(),
  ]);

  /**
   * ⚠ `factsRes.error` WAS NEVER CHECKED, ON THE PAGE A REGULATOR'S QUESTIONS
   * LAND ON. `(factsRes.data ?? {})` turned a refused read into an empty object,
   * so every NPC field rendered "[TO CONFIRM]" — indistinguishable from fields
   * genuinely not yet settled — and the sub-processor table rendered "No
   * sub-processors recorded." on a document the owner prints and files.
   * Declaring no cross-border sub-processors when the read simply failed is the
   * worst version of this defect in the admin tree. Corrected 2026-08-17.
   */
  const factsError = factsRes.error ?? null;
  const f = (factsRes.data ?? {}) as Record<string, unknown>;
  // NULL = not measured. An absent `sub_processors` on a row that DID load is a
  // genuine zero and stays a zero.
  const subs: SubProcessor[] | null = factsError
    ? null
    : Array.isArray(f.sub_processors)
      ? (f.sub_processors as SubProcessor[])
      : [];

  // Total data subjects = every account + every guest (couples/organizers,
  // vendors, and internal accounts are all in `users`; guests are separate).
  const totalSubjects =
    users == null && guests == null ? null : (users ?? 0) + (guests ?? 0);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/settings?tab=compliance"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--m-orange-2)]"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Back to Compliance
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <FileText aria-hidden className="h-6 w-6" strokeWidth={1.75} /> NPC data sheet
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          The stored compliance facts laid out as the NPC Data Processing System
          registration fields. Copy or print this to file with the National
          Privacy Commission. Empty fields show{' '}
          <span className="italic text-ink/50">{TBD}</span> — settle them on the
          Compliance page before filing. This is the data to file, not the filing
          itself.
        </p>
      </header>

      {/* The field sheet below is deliberately NOT a ConsoleTable — see the
          FieldTable docblock. But it still owes the distinction, and it cannot
          make it cell-by-cell: every field would read "[TO CONFIRM]", which is
          exactly what a settled-but-blank field reads. So the refusal is
          declared ONCE, above the whole sheet, before anything can be copied
          off it. */}
      {factsError ? (
        <ErrorState
          title="Couldn’t read the stored compliance facts"
          broke={`The read was refused: ${factsError.message}`}
          survived="Every field below is showing its placeholder because nothing loaded — NOT because it is unsettled. Do not copy this sheet into a filing while this message is here."
          todo="Reload. If it repeats, the query is being rejected rather than returning nothing, and the column, value or migration it names is the thing to check."
        />
      ) : null}

      <Block title="B.1 — Personal Information Controller (PIC)">
        <Row field="Registered / legal name" value={f.legal_name} />
        <Row field="Proprietor / owner" value={f.proprietor} />
        <Row field="DTI Business Name no." value={f.dti_bn} />
        <Row field="BIR TIN / Form 2303" value={f.bir_tin} />
        <Row field="Registered / principal office address" value={f.registered_address} />
        <Row field="NPC registration no." value={f.npc_registration_no} />
      </Block>

      <Block title="B.2 — Data Protection Officer (DPO)">
        <Row field="DPO full name" value={f.dpo_name} />
        <Row field="DPO position / title" value={f.dpo_title} />
        <Row field="DPO email" value={f.dpo_email} />
        <Row field="DPO contact number" value={f.dpo_phone} />
        <Row field="DPO employment basis" value={f.dpo_employment_basis} />
        <Row field="Effectivity date of designation" value={f.dpo_designation_date} />
      </Block>

      {/* B.3 is ONE section. "Categories of data subjects" is a ROW INSIDE B.3 in
          the adopted registration sheet (NPC_Compliance/03_DPO_Designation_and_
          NPCRS_ADOPTED_2026-07-24.md line 185) — not a section of its own. It was
          briefly rendered as a second block also numbered B.3, which would have
          printed a filed document with two different B.3s. The categories table
          below is the expansion of that row, kept under this heading.

          It renders from lib/data-subject-register, the single register the guard
          holds against the schema. Do NOT re-type the categories here: a second
          copy is how the written record came to name four kinds of person while
          the code collected from five. */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          B.3 — Scale of processing
        </h2>
        <FieldTable>
          <Row field="Total number of employees" value={f.headcount} />
          <Row field="Staff with data access" value={f.staff_with_data_access} />
          <Row field="Total number of data subjects (live)" value={totalSubjects} />
          <Row field="Active biometric face vectors (live)" value={faces} />
        </FieldTable>

        <h3 className="pt-1 text-sm font-semibold tracking-tight text-ink">
          Categories of data subjects
        </h3>
        {/* `readPermitted` is honestly `true` for a third reason again: this
            renders from `lib/data-subject-register`, a local constant, so there
            is no read to refuse and no permission to prove. It is a records list
            in the register's own order, which is why it wears the table. */}
        <ConsoleTable
          rows={DATA_SUBJECT_REGISTER_ORDER.map((key) => ({ key, ...DATA_SUBJECT_REGISTER[key] }))}
          readPermitted
          label="Categories of data subjects"
          minWidth="45rem"
          rowKey={(c) => c.key}
          empty={{
            Icon: FileText,
            title: 'No categories registered',
            blurb:
              'The categories come from the single register the guard holds against the schema. An empty list would mean that register is empty, which the guard would already have failed on.',
          }}
          columns={[
            {
              header: 'Category',
              cell: (c) => (
                <>
                  <span className="text-ink/90">{c.label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink/70">
                    {c.holdsAccount ? 'Holds a Setnayan account' : 'No Setnayan account'}
                  </span>
                </>
              ),
            },
            {
              header: 'Personal data collected',
              hideBelow: 'md',
              cell: (c) => (
                <ul className="list-disc space-y-0.5 pl-4 text-ink/80">
                  {c.personalData.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ),
            },
            {
              header: 'Purpose',
              hideBelow: 'lg',
              cell: (c) => <span className="text-ink/80">{c.purpose}</span>,
            },
            {
              header: 'Retention (as enforced)',
              cell: (c) => (
                <span className="text-ink/80">
                  {c.retention}
                  {c.disposalDateSettled ? null : (
                    <span className="mt-1 block text-[11px] italic text-ink/70">
                      {TBD} — no automatic disposal date exists in code; the DPO must settle one
                      before filing.
                    </span>
                  )}
                </span>
              ),
            },
          ]}
        />
      </section>

      {/* NOT "B.4". The adopted registration sheet has no B-numbered field for
          breach response — its B.4 is "does the system process sensitive personal
          information", which is the "B.4 / B.5 — Processing declarations" block
          further down. This page had invented the number, so two sections claimed
          B.4 on a printed filing. The number is REMOVED rather than replaced: the
          breach team and contacts belong to the Data Breach Management Policy
          (NPC_Compliance/04_…), and picking a different B-number would be
          inventing a second claim to fix the first. */}
      <Block title="Breach response (Data Breach Management Policy)">
        <Row field="Breach response team" value={f.breach_team} />
        <Row field="Breach contacts" value={f.breach_contacts} />
      </Block>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          B.8 — Sub-processors / cross-border transfers
        </h2>
        <ConsoleTable
          rows={subs}
          readPermitted
          readError={factsError}
          reads="the recorded sub-processors"
          label="Sub-processors and cross-border transfers"
          minWidth="42rem"
          rowKey={(sp, i) => `${sp.name ?? 'sub'}-${i}`}
          empty={{
            Icon: FileText,
            title: 'No sub-processors recorded',
            blurb:
              'Add each one on the Compliance page before filing. This section of the NPC sheet is where every cross-border transfer has to be declared, so an empty list here is a claim that there are none.',
          }}
          columns={[
            { header: 'Name', cell: (sp) => <span className="text-ink/90">{val(sp.name)}</span> },
            { header: 'Role', cell: (sp) => <span className="text-ink/80">{val(sp.role)}</span> },
            {
              header: 'Jurisdiction',
              hideBelow: 'md',
              cell: (sp) => <span className="text-ink/80">{val(sp.jurisdiction)}</span>,
            },
            {
              header: 'Personal data',
              hideBelow: 'lg',
              cell: (sp) => <span className="text-ink/80">{sp.personal_data ? 'Yes' : 'No'}</span>,
            },
            {
              header: 'DPA on file',
              hideBelow: 'lg',
              cell: (sp) => <span className="text-ink/80">{sp.dpa_on_file ? 'Yes' : 'No'}</span>,
            },
          ]}
        />
      </section>

      <Block title="B.4 / B.5 — Processing declarations">
        <Row field="Sensitive RSVP fields" value={f.sensitive_rsvp_fields} />
        <Row field="Automated decisions" value={f.automated_decisions} />
        <Row field="Maya / payment gateway status" value={f.maya_status} />
        <Row field="Staff data-access controls" value={f.staff_controls} />
        <Row field="DPIA adoption dates" value={f.dpia_adoption_dates} />
      </Block>

      <p className="text-xs text-ink/45">
        Not a substitute for legal review. Finalize with the DPO and Philippine
        counsel before adoption or submission to the NPC.
      </p>
    </section>
  );
}
