import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SubProcessor } from '../actions';

import { requireAdmin } from '@/lib/admin/require-admin';
// Admin Compliance — NPC data-sheet export view.
//
// A read-only, print-friendly rendering of the stored compliance facts laid out
// as the NPC registration fields (mirroring NPC_Compliance/03_DPO_Designation_
// and_NPC_Registration_Sheet). The owner can copy/print this to file with the
// NPC. Live scale counts are pulled server-side to fill the "scale of
// processing" section. Everything is server-rendered — no client JS needed.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'NPC data sheet · Setnayan HQ' };

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

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-cream">
        <table className="w-full border-collapse px-4">
          <tbody className="[&_th]:pl-4 [&_td]:pr-4">{children}</tbody>
        </table>
      </div>
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

  const f = (factsRes.data ?? {}) as Record<string, unknown>;
  const subs: SubProcessor[] = Array.isArray(f.sub_processors)
    ? (f.sub_processors as SubProcessor[])
    : [];

  // Total data subjects = every account + every guest (couples/organizers,
  // vendors, and internal accounts are all in `users`; guests are separate).
  const totalSubjects =
    users == null && guests == null ? null : (users ?? 0) + (guests ?? 0);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/compliance"
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

      <Block title="B.3 — Scale of processing">
        <Row field="Total number of employees" value={f.headcount} />
        <Row field="Staff with data access" value={f.staff_with_data_access} />
        <Row field="Total number of data subjects (live)" value={totalSubjects} />
        <Row field="Active biometric face vectors (live)" value={faces} />
      </Block>

      <Block title="B.4 — Breach response">
        <Row field="Breach response team" value={f.breach_team} />
        <Row field="Breach contacts" value={f.breach_contacts} />
      </Block>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          B.8 — Sub-processors / cross-border transfers
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-cream">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/15 text-left text-[11px] uppercase tracking-[0.12em] text-ink/55">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Jurisdiction</th>
                <th className="px-4 py-2 font-medium">Personal data</th>
                <th className="px-4 py-2 font-medium">DPA on file</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 italic text-ink/40" colSpan={5}>
                    No sub-processors recorded.
                  </td>
                </tr>
              ) : (
                subs.map((sp, i) => (
                  <tr key={i} className="border-b border-ink/10 last:border-0 align-top">
                    <td className="px-4 py-2 text-ink/90">{val(sp.name)}</td>
                    <td className="px-4 py-2 text-ink/80">{val(sp.role)}</td>
                    <td className="px-4 py-2 text-ink/80">{val(sp.jurisdiction)}</td>
                    <td className="px-4 py-2 text-ink/80">
                      {sp.personal_data ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-2 text-ink/80">
                      {sp.dpa_on_file ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
