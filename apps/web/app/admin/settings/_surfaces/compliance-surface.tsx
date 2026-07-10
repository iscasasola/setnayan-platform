// Money-split studio surface — the body of the former compliance page,
// re-homed here (2026-07-10). actions/_components stay in /admin/compliance; the
// legacy route is now a redirect (or, for pricing/settings, the studio shell).
import { notFound, redirect } from 'next/navigation';
import {
  ShieldCheck,
  Users,
  Briefcase,
  UserRound,
  CalendarDays,
  ScanFace,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ComplianceForm, type ComplianceFormState } from '@/app/admin/compliance/_components/compliance-form';
import type { SubProcessor } from '@/app/admin/compliance/actions';

import { requireAdmin } from '@/lib/admin/require-admin';
// Admin Compliance — the RA 10173 / NPC compliance facts surface.
//
// The admin layout already gates on is_admin; this page re-checks (defense in
// depth) then reads the singleton platform_compliance_facts row (admin client —
// the table is admin-only RLS) and computes live scale counts server-side. It
// hands facts + counts to the client form. The sensitive identifiers live only
// in the DB; they surface here for the admin to edit and never enter the repo.

/** DB row (nullable columns) → the form's all-strings state shape. */
function toFormState(row: Record<string, unknown> | null): ComplianceFormState {
  const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const n = (v: unknown) => (typeof v === 'number' ? String(v) : '');
  const subsRaw = Array.isArray(row?.sub_processors) ? row!.sub_processors : [];
  const sub_processors: SubProcessor[] = (subsRaw as unknown[]).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      name: typeof o.name === 'string' ? o.name : '',
      role: typeof o.role === 'string' ? o.role : '',
      jurisdiction: typeof o.jurisdiction === 'string' ? o.jurisdiction : '',
      personal_data: o.personal_data === true,
      dpa_on_file: o.dpa_on_file === true,
    };
  });
  return {
    legal_name: s(row?.legal_name),
    proprietor: s(row?.proprietor),
    dti_bn: s(row?.dti_bn),
    bir_tin: s(row?.bir_tin),
    registered_address: s(row?.registered_address),
    npc_registration_no: s(row?.npc_registration_no),
    dpo_name: s(row?.dpo_name),
    dpo_title: s(row?.dpo_title),
    dpo_email: s(row?.dpo_email),
    dpo_phone: s(row?.dpo_phone),
    dpo_employment_basis: s(row?.dpo_employment_basis),
    dpo_designation_date: s(row?.dpo_designation_date),
    headcount: n(row?.headcount),
    staff_with_data_access: n(row?.staff_with_data_access),
    breach_team: s(row?.breach_team),
    breach_contacts: s(row?.breach_contacts),
    sub_processors,
    sensitive_rsvp_fields: s(row?.sensitive_rsvp_fields),
    automated_decisions: s(row?.automated_decisions),
    maya_status: s(row?.maya_status),
    staff_controls: s(row?.staff_controls),
    dpia_adoption_dates: s(row?.dpia_adoption_dates),
  };
}

const NF = new Intl.NumberFormat('en-PH');

function CountCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
  label: string;
  value: number | null;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="flex items-center gap-2 text-ink/60">
        <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
        {value == null ? '—' : NF.format(value)}
      </p>
      <p className="mt-0.5 text-xs text-ink/50">{note}</p>
    </div>
  );
}

export async function ComplianceSurface() {
  await requireAdmin();
  // Defense-in-depth admin gate (team-member-aware), mirroring the layout.
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

  // Facts row + live scale counts, all server-side. head+exact counts avoid
  // pulling rows. A failed count degrades to null (rendered as "—") rather than
  // blowing up the page.
  const countOf = async (table: string): Promise<number | null> => {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true });
    return error ? null : (count ?? 0);
  };

  // Active (not-revoked) biometric face vectors — the NPC "sensitive PII" tally.
  const activeFaceCount = async (): Promise<number | null> => {
    const { count, error } = await admin
      .from('guest_face_enrollments') // chat-guard-allow: count-only NPC tally (count:exact, head:true) — returns a number, reads zero face vectors
      .select('*', { count: 'exact', head: true })
      .is('revoked_at', null);
    return error ? null : (count ?? 0);
  };

  const [factsRes, users, vendors, guests, events, faces] = await Promise.all([
    admin.from('platform_compliance_facts').select('*').eq('id', 1).maybeSingle(),
    countOf('users'),
    countOf('vendor_profiles'),
    countOf('guests'),
    countOf('events'),
    activeFaceCount(),
  ]);

  const initial = toFormState(factsRes.data as Record<string, unknown> | null);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      {/* 'Back to admin' link dropped — Compliance is a tab inside the Settings
          studio now; the tab strip replaces it. */}
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldCheck aria-hidden className="h-6 w-6" strokeWidth={1.75} /> Compliance
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          The RA 10173 (Data Privacy Act) / NPC registration facts — one place for
          the Personal Information Controller identity, DPO designation, breach
          plan, sub-processors, and processing declarations. Enter the sensitive
          identifiers here once; they live only in the database and feed the NPC
          data sheet.
        </p>
      </header>

      {/* Live scale counts — read-only, computed server-side. These feed the NPC
          "scale of processing" fields (total data subjects + sensitive-PII). */}
      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
          Live scale (from the database)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <CountCard icon={Users} label="Users" value={users} note="All accounts" />
          <CountCard icon={Briefcase} label="Vendors" value={vendors} note="Vendor profiles" />
          <CountCard icon={UserRound} label="Guests" value={guests} note="Event guests" />
          <CountCard icon={CalendarDays} label="Events" value={events} note="All events" />
          <CountCard
            icon={ScanFace}
            label="Face vectors"
            value={faces}
            note="Active (not revoked)"
          />
        </div>
      </section>

      <ComplianceForm initial={initial} />
    </section>
  );
}
